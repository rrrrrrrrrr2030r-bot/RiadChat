import type { NextFunction, Request, Response } from 'express';
import { validateSafeWebhookUrl } from './dataProtection.ts';

export interface HealthProbeSnapshot {
  checkedAt: string;
  status: 'healthy' | 'degraded' | 'down';
  responseMs: number;
  eventLoopLagMs: number;
  heapUsedMb: number;
  rssMb: number;
  wsClients: number;
  activeRequests: number;
  note?: string;
}

export interface OutageAlertRecord {
  id: string;
  triggeredAt: string;
  severity: 'warning' | 'critical';
  message: string;
  webhookDispatched: boolean;
}

export interface StressTestStageResult {
  stageName: string;
  concurrency: number;
  totalRequests: number;
  okCount: number;
  rateLimited429Count: number;
  errorCount: number;
  rps: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface StressTestReport {
  ranAt: string;
  targetPath: string;
  durationMs: number;
  peakRps: number;
  saturationStage: string | null;
  stages: StressTestStageResult[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginateItems<T>(items: T[], rawPage?: unknown, rawLimit?: unknown): PaginatedResult<T> {
  const limit = Math.min(100, Math.max(1, Math.floor(Number(rawLimit) || 20)));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(totalPages, Math.max(1, Math.floor(Number(rawPage) || 1)));
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * O(1) in-memory index layer to eliminate O(N) full scans on hot API & WS lookups.
 */
export class StateIndexManager<
  TUser extends { id: string },
  TRoom extends { id: string },
  TInvite extends { code: string },
> {
  usersById = new Map<string, TUser>();
  roomsById = new Map<string, TRoom>();
  invitesByCode = new Map<string, TInvite>();
  lastRebuiltAt = new Date().toISOString();
  rebuildCount = 0;

  rebuild(state: { users: TUser[]; rooms: TRoom[]; invites: TInvite[] }) {
    this.usersById.clear();
    for (const u of state.users) this.usersById.set(u.id, u);

    this.roomsById.clear();
    for (const r of state.rooms) this.roomsById.set(r.id, r);

    this.invitesByCode.clear();
    for (const inv of state.invites) this.invitesByCode.set(inv.code.toUpperCase(), inv);

    this.lastRebuiltAt = new Date().toISOString();
    this.rebuildCount += 1;
  }

  getStats() {
    return {
      indexedUsers: this.usersById.size,
      indexedRooms: this.roomsById.size,
      indexedInvites: this.invitesByCode.size,
      rebuildCount: this.rebuildCount,
      lastRebuiltAt: this.lastRebuiltAt,
    };
  }
}

/**
 * Pooled write batcher (Connection / Persistence Pool analogue for local encrypted store).
 * Coalesces rapid write bursts into batched atomic commits while tracking queue/pool stats.
 */
export class WriteBatchPool {
  private timer: NodeJS.Timeout | null = null;
  private pendingWrites = 0;
  private flushedBatches = 0;
  private lastFlushMs = 0;
  private lastFlushedAt: string | null = null;
  private readonly coalesceMs: number;
  private readonly flushFn: () => void;

  constructor(flushFn: () => void, coalesceMs = 150) {
    this.flushFn = flushFn;
    this.coalesceMs = coalesceMs;
  }

  scheduleWrite() {
    this.pendingWrites += 1;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.flushNow();
    }, this.coalesceMs);
  }

  flushNow() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const start = Date.now();
    this.flushFn();
    this.lastFlushMs = Date.now() - start;
    this.lastFlushedAt = new Date().toISOString();
    this.flushedBatches += 1;
    this.pendingWrites = 0;
  }

  getStats() {
    return {
      coalesceMs: this.coalesceMs,
      pendingWrites: this.pendingWrites,
      flushedBatches: this.flushedBatches,
      lastFlushMs: this.lastFlushMs,
      lastFlushedAt: this.lastFlushedAt,
    };
  }
}

/**
 * Smart traffic-surge protection returning HTTP 429 + Retry-After: 120 ("جرب بعد دقيقتين")
 * ONLY under sudden high-traffic spikes while keeping normal user sessions completely smooth.
 */
export class TrafficSurgeProtector {
  private readonly perIpWindow = new Map<string, number[]>();
  private readonly windowMs = 60 * 1000; // 1 minute sliding window
  private readonly maxPerIpPerMinute: number;
  private readonly maxConcurrentInFlight: number;
  private activeRequests = 0;
  private totalServed = 0;
  private totalRejected429 = 0;
  private peakConcurrent = 0;

  constructor(options?: { maxPerIpPerMinute?: number; maxConcurrentInFlight?: number }) {
    this.maxPerIpPerMinute = options?.maxPerIpPerMinute ?? 180;
    this.maxConcurrentInFlight = options?.maxConcurrentInFlight ?? 90;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Never block health checks or Owner operations console recovery routes
      if (
        req.path === '/api/health' ||
        req.path.startsWith('/api/ops/') ||
        !req.path.startsWith('/api/')
      ) {
        next();
        return;
      }

      const now = Date.now();
      const stressBucket = String(req.headers['x-stress-client-id'] || '').trim();
      const ip =
        String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
          .split(',')[0]
          .trim();
      const key = stressBucket ? `${ip}:stress:${stressBucket}` : ip;

      const cutoff = now - this.windowMs;
      const hits = (this.perIpWindow.get(key) || []).filter((ts) => ts > cutoff);

      const perClientLimit = stressBucket ? 45 : this.maxPerIpPerMinute;
      const overloaded =
        this.activeRequests >= this.maxConcurrentInFlight || hits.length >= perClientLimit;

      if (overloaded) {
        this.totalRejected429 += 1;
        res.setHeader('Retry-After', '120');
        res.status(429).json({
          error: 'الموقع يشهد إقبالاً عالياً الآن — جرب بعد دقيقتين',
          code: 'TRAFFIC_SURGE_LIMIT',
          retryAfterSec: 120,
        });
        return;
      }

      hits.push(now);
      this.perIpWindow.set(key, hits);
      if (this.perIpWindow.size > 3000) {
        for (const [k, list] of this.perIpWindow.entries()) {
          if (!list.length || list[list.length - 1] <= cutoff) this.perIpWindow.delete(k);
        }
      }

      this.activeRequests += 1;
      this.totalServed += 1;
      if (this.activeRequests > this.peakConcurrent) {
        this.peakConcurrent = this.activeRequests;
      }
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.activeRequests = Math.max(0, this.activeRequests - 1);
      };
      res.once('finish', release);
      res.once('close', release);
      next();
    };
  }

  getStats() {
    return {
      activeRequests: this.activeRequests,
      peakConcurrent: this.peakConcurrent,
      maxConcurrentInFlight: this.maxConcurrentInFlight,
      maxPerIpPerMinute: this.maxPerIpPerMinute,
      totalServed: this.totalServed,
      totalRejected429: this.totalRejected429,
      retryAfterSec: 120,
    };
  }
}

/**
 * 1-Minute Automated Uptime & Health Monitor with optional SSRF-safe Webhook alerts.
 */
export class UptimeHealthMonitor {
  private history: HealthProbeSnapshot[] = [];
  private alerts: OutageAlertRecord[] = [];
  private timer: NodeJS.Timeout | null = null;
  private lastAlertSentAt = 0;

  private readonly getContext: () => {
    wsClients: number;
    activeRequests: number;
    ownerIntact: boolean;
    alertWebhookUrl: string;
  };

  constructor(getContext: () => {
    wsClients: number;
    activeRequests: number;
    ownerIntact: boolean;
    alertWebhookUrl: string;
  }) {
    this.getContext = getContext;
  }

  start() {
    if (this.timer) return;
    void this.runProbeNow();
    this.timer = setInterval(() => {
      void this.runProbeNow();
    }, 60 * 1000);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  async runProbeNow(): Promise<HealthProbeSnapshot> {
    const start = Date.now();
    // Measure real event-loop lag
    const lagStart = Date.now();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    const eventLoopLagMs = Math.max(0, Date.now() - lagStart - 10);

    const mem = process.memoryUsage();
    const heapUsedMb = Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10;
    const rssMb = Math.round((mem.rss / (1024 * 1024)) * 10) / 10;
    const ctx = this.getContext();
    const responseMs = Math.max(1, Date.now() - start);

    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    let note: string | undefined;
    if (!ctx.ownerIntact) {
      status = 'down';
      note = 'فقدان سلامة سجل المالك الرئيسي في الذاكرة';
    } else if (eventLoopLagMs > 250 || heapUsedMb > 750) {
      status = 'degraded';
      note = `ارتفاع ملحوظ في زمن الاستجابة (${eventLoopLagMs}ms) أو الذاكرة (${heapUsedMb}MB)`;
    }

    const snap: HealthProbeSnapshot = {
      checkedAt: new Date().toISOString(),
      status,
      responseMs,
      eventLoopLagMs,
      heapUsedMb,
      rssMb,
      wsClients: ctx.wsClients,
      activeRequests: ctx.activeRequests,
      note,
    };

    this.history = [snap, ...this.history].slice(0, 60);

    if (status !== 'healthy') {
      await this.emitAlert(
        status === 'down' ? 'critical' : 'warning',
        note || 'تم رصد تدهور في صحة الخادم أثناء الفحص الدوري',
        ctx.alertWebhookUrl
      );
    }

    return snap;
  }

  private async emitAlert(severity: 'warning' | 'critical', message: string, webhookUrl: string) {
    const now = Date.now();
    // Avoid alert storms: at most 1 webhook alert per 2 minutes
    const canDispatchWebhook = Boolean(webhookUrl && now - this.lastAlertSentAt > 120_000);
    let webhookDispatched = false;

    if (canDispatchWebhook) {
      const validated = validateSafeWebhookUrl(webhookUrl);
      if (validated.ok && validated.normalized) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(validated.normalized, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'riad-chat-monitor',
              severity,
              message,
              timestamp: new Date().toISOString(),
            }),
            signal: controller.signal,
          });
          webhookDispatched = res.ok;
          if (res.ok) this.lastAlertSentAt = now;
        } catch {
          webhookDispatched = false;
        } finally {
          clearTimeout(timer);
        }
      }
    }

    const record: OutageAlertRecord = {
      id: `alert-${now.toString().slice(-6)}`,
      triggeredAt: new Date().toISOString(),
      severity,
      message,
      webhookDispatched,
    };
    this.alerts = [record, ...this.alerts].slice(0, 30);
  }

  getOverview() {
    const latest = this.history[0] || null;
    const healthyCount = this.history.filter((h) => h.status === 'healthy').length;
    const uptimePct =
      this.history.length > 0 ? Math.round((healthyCount / this.history.length) * 1000) / 10 : 100;
    return {
      intervalSec: 60,
      latest,
      uptimePct,
      history: this.history,
      alerts: this.alerts,
    };
  }
}

/**
 * Safe progressive stress test runner (Owner ID 900 only) that ramps virtual concurrency
 * against the local paginated endpoint to measure RPS, P95 latency, and 429 saturation threshold.
 */
export async function runProgressiveStressTest(port: number): Promise<StressTestReport> {
  const startedAt = Date.now();
  const targetPath = '/api/rooms?page=1&limit=12';
  const baseUrl = `http://127.0.0.1:${port}${targetPath}`;

  const stageSpecs = [
    { name: 'حمل طبيعي (15 زائر متزامن)', concurrency: 15, totalRequests: 30, bucket: 'stage-1' },
    { name: 'حمل متوسط (35 زائر متزامن)', concurrency: 35, totalRequests: 50, bucket: 'stage-2' },
    { name: 'ذروة زحمة (70 زائر متزامن)', concurrency: 70, totalRequests: 75, bucket: 'stage-3' },
  ];

  const stages: StressTestStageResult[] = [];
  let peakRps = 0;
  let saturationStage: string | null = null;

  for (const spec of stageSpecs) {
    const stageStart = Date.now();
    const latencies: number[] = [];
    let okCount = 0;
    let rateLimited429Count = 0;
    let errorCount = 0;
    let nextIdx = 0;

    const worker = async () => {
      while (true) {
        const myIdx = nextIdx++;
        if (myIdx >= spec.totalRequests) break;
        const reqStart = Date.now();
        try {
          const res = await fetch(baseUrl, {
            headers: {
              'X-Stress-Client-Id': spec.bucket,
              'Cache-Control': 'no-cache',
            },
          });
          await res.arrayBuffer();
          const elapsed = Math.max(1, Date.now() - reqStart);
          latencies.push(elapsed);
          if (res.status === 429) rateLimited429Count += 1;
          else if (res.ok) okCount += 1;
          else errorCount += 1;
        } catch {
          latencies.push(Math.max(1, Date.now() - reqStart));
          errorCount += 1;
        }
      }
    };

    const workers = Array.from({ length: Math.min(spec.concurrency, spec.totalRequests) }, () => worker());
    await Promise.all(workers);

    const stageDurationMs = Math.max(1, Date.now() - stageStart);
    latencies.sort((a, b) => a - b);
    const avgMs = latencies.length
      ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
      : 0;
    const p95Ms = latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
      : 0;
    const maxMs = latencies.length ? latencies[latencies.length - 1] : 0;
    const rps = Math.round((spec.totalRequests / (stageDurationMs / 1000)) * 10) / 10;

    if (rps > peakRps) peakRps = rps;
    if (!saturationStage && (rateLimited429Count > 0 || errorCount > 0)) {
      saturationStage = spec.name;
    }

    stages.push({
      stageName: spec.name,
      concurrency: spec.concurrency,
      totalRequests: spec.totalRequests,
      okCount,
      rateLimited429Count,
      errorCount,
      rps,
      avgMs,
      p95Ms,
      maxMs,
    });
  }

  return {
    ranAt: new Date().toISOString(),
    targetPath,
    durationMs: Date.now() - startedAt,
    peakRps,
    saturationStage,
    stages,
  };
}
