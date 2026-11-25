import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { AppliedMigrationRecord, DryRunResult } from '../migrations/index.ts';

export interface BackupMetadata {
  id: string;
  kind: 'daily' | 'pitr' | 'manual';
  reason: string;
  createdAt: string;
  sizeBytes: number;
  encrypted: boolean;
  checksumSha256: string;
  filename: string;
}

export interface RestoreDrillResult {
  ranAt: string;
  backupId: string;
  passed: boolean;
  usersVerified: number;
  roomsVerified: number;
  owner900Intact: boolean;
  checksumMatched: boolean;
  durationMs: number;
  error?: string;
}

export interface ArchivedRoomEntry {
  archivedAt: string;
  archivedBy: string;
  reason: string;
  room: Record<string, unknown>;
}

export interface ArchivedModeratorEntry {
  archivedAt: string;
  archivedBy: string;
  reason: string;
  moderator: Record<string, unknown>;
}

export interface DataGovernanceState {
  readOnlyAutomationMode: boolean;
  alertWebhookUrl: string;
  backupWebhookUrl: string;
  appliedMigrations: AppliedMigrationRecord[];
  lastDryRuns: Record<string, DryRunResult>;
  lastRestoreDrill: RestoreDrillResult | null;
  lastOffsitePushAt: string | null;
  archivedRooms: ArchivedRoomEntry[];
  archivedModerators: ArchivedModeratorEntry[];
}

export const DAILY_BACKUP_RETENTION_DAYS = 30;
export const MAX_PITR_SNAPSHOTS = 60;

/**
 * Strict SSRF guard for optional off-server backup & alert webhook URLs.
 * Allows HTTPS public hosts only; blocks loopback, private LAN, and cloud metadata IPs.
 */
export function validateSafeWebhookUrl(rawUrl: string): { ok: boolean; normalized: string; error?: string } {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return { ok: true, normalized: '' };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { ok: false, normalized: '', error: 'يجب أن يبدأ رابط Webhook بـ https:// فقط' };
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^fc[0-9a-f]{2}:/i.test(host) ||
      /^fd[0-9a-f]{2}:/i.test(host) ||
      /^fe80:/i.test(host)
    ) {
      return {
        ok: false,
        normalized: '',
        error: 'ممنوع استخدام عناوين الشبكة الداخلية أو المحلية في روابط Webhook',
      };
    }
    return { ok: true, normalized: parsed.toString() };
  } catch {
    return { ok: false, normalized: '', error: 'صيغة رابط Webhook غير صالحة' };
  }
}

/**
 * Safe Delete Guard: prevents unconditioned/wildcard deletes (equivalent to blocking DELETE without WHERE).
 */
export function assertSafeDeleteCondition(params: {
  targetId?: string;
  entityType: string;
}): { ok: boolean; error?: string } {
  const cleanId = String(params.targetId || '').trim();
  if (!cleanId || cleanId === '*' || cleanId.toLowerCase() === 'all' || cleanId.length > 120) {
    return {
      ok: false,
      error: `مرفوض أمنياً: يمنع حذف ${params.entityType} بدون معرف محدد (WHERE id = ...)`,
    };
  }
  return { ok: true };
}

export class DataProtectionManager {
  private readonly backupsDir: string;
  private readonly encodePayload: (plaintext: string) => { body: string; encrypted: boolean };
  private readonly decodePayload: (raw: string) => string;

  constructor(options: {
    dataDir: string;
    encodePayload: (plaintext: string) => { body: string; encrypted: boolean };
    decodePayload: (raw: string) => string;
  }) {
    this.backupsDir = path.join(options.dataDir, 'backups');
    this.encodePayload = options.encodePayload;
    this.decodePayload = options.decodePayload;
  }

  private ensureDir() {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true, mode: 0o700 });
    }
    try {
      fs.chmodSync(this.backupsDir, 0o700);
    } catch {
      // Ignore chmod errors on non-POSIX filesystems
    }
  }

  private resolveSafeBackupFile(filename: string): string | null {
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) return null;
    const base = path.resolve(this.backupsDir);
    const resolved = path.resolve(base, filename);
    if (!resolved.startsWith(base + path.sep)) return null;
    return resolved;
  }

  createSnapshot(params: {
    kind: 'daily' | 'pitr' | 'manual';
    reason: string;
    payloadObject: Record<string, unknown>;
  }): BackupMetadata {
    this.ensureDir();
    const now = new Date();
    const iso = now.toISOString();
    const dateKey = iso.slice(0, 10);
    const safeReason = params.reason.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'snapshot';
    const id =
      params.kind === 'daily'
        ? `daily-${dateKey}`
        : `${params.kind}-${now.getTime()}-${safeReason}`;
    const filename = `${id}.riadbackup.json`;
    const targetPath = this.resolveSafeBackupFile(filename)!;

    const plaintext = JSON.stringify({
      backupId: id,
      kind: params.kind,
      reason: params.reason,
      createdAt: iso,
      payload: params.payloadObject,
    });
    const checksumSha256 = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
    const encoded = this.encodePayload(plaintext);
    const envelope = JSON.stringify({
      format: 'riad-chat-backup-v1',
      id,
      kind: params.kind,
      reason: params.reason,
      createdAt: iso,
      encrypted: encoded.encrypted,
      checksumSha256,
      data: encoded.body,
    });

    const tmpPath = `${targetPath}.tmp`;
    fs.writeFileSync(tmpPath, envelope, { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(tmpPath, 0o600);
    } catch {
      // Ignore
    }
    fs.renameSync(tmpPath, targetPath);

    this.pruneRetentionPolicies();

    return {
      id,
      kind: params.kind,
      reason: params.reason,
      createdAt: iso,
      sizeBytes: Buffer.byteLength(envelope, 'utf8'),
      encrypted: encoded.encrypted,
      checksumSha256,
      filename,
    };
  }

  ensureDailyBackup(payloadObject: Record<string, unknown>): BackupMetadata {
    const todayKey = `daily-${new Date().toISOString().slice(0, 10)}`;
    const existing = this.listBackups().find((b) => b.id === todayKey);
    if (existing) return existing;
    return this.createSnapshot({
      kind: 'daily',
      reason: 'daily-scheduled',
      payloadObject,
    });
  }

  listBackups(): BackupMetadata[] {
    if (!fs.existsSync(this.backupsDir)) return [];
    const files = fs.readdirSync(this.backupsDir).filter((f) => f.endsWith('.riadbackup.json'));
    const list: BackupMetadata[] = [];
    for (const filename of files) {
      const fullPath = this.resolveSafeBackupFile(filename);
      if (!fullPath) continue;
      try {
        const stat = fs.statSync(fullPath);
        const raw = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<BackupMetadata>;
        if (!parsed.id || !parsed.createdAt) continue;
        list.push({
          id: parsed.id,
          kind: parsed.kind === 'daily' || parsed.kind === 'manual' ? parsed.kind : 'pitr',
          reason: parsed.reason || 'snapshot',
          createdAt: parsed.createdAt,
          sizeBytes: stat.size,
          encrypted: Boolean(parsed.encrypted),
          checksumSha256: String(parsed.checksumSha256 || ''),
          filename,
        });
      } catch {
        // Skip unreadable or partial files
      }
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private pruneRetentionPolicies() {
    const all = this.listBackups();
    const cutoffDaily = Date.now() - DAILY_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const dailyBackups = all.filter((b) => b.kind === 'daily');
    for (const b of dailyBackups) {
      const ts = Date.parse(b.createdAt);
      if (!Number.isNaN(ts) && ts < cutoffDaily) {
        const full = this.resolveSafeBackupFile(b.filename);
        if (full) {
          try {
            fs.unlinkSync(full);
          } catch {
            // Ignore
          }
        }
      }
    }

    const pitrBackups = all.filter((b) => b.kind !== 'daily');
    if (pitrBackups.length > MAX_PITR_SNAPSHOTS) {
      for (const old of pitrBackups.slice(MAX_PITR_SNAPSHOTS)) {
        const full = this.resolveSafeBackupFile(old.filename);
        if (full) {
          try {
            fs.unlinkSync(full);
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  readBackupRawEnvelope(backupId: string): { meta: BackupMetadata; rawEnvelope: string } | null {
    const meta = this.listBackups().find((b) => b.id === backupId);
    if (!meta) return null;
    const full = this.resolveSafeBackupFile(meta.filename);
    if (!full || !fs.existsSync(full)) return null;
    return { meta, rawEnvelope: fs.readFileSync(full, 'utf8') };
  }

  loadAndVerifyBackup(backupId: string): {
    ok: boolean;
    meta?: BackupMetadata;
    payload?: Record<string, unknown>;
    checksumMatched: boolean;
    error?: string;
  } {
    const found = this.readBackupRawEnvelope(backupId);
    if (!found) {
      return { ok: false, checksumMatched: false, error: 'النسخة الاحتياطية المطلوبة غير موجودة' };
    }
    try {
      const envelope = JSON.parse(found.rawEnvelope) as {
        checksumSha256?: string;
        data?: string;
      };
      if (!envelope.data) {
        return { ok: false, checksumMatched: false, error: 'ملف النسخة الاحتياطية فارغ أو تالف' };
      }
      const plaintext = this.decodePayload(envelope.data);
      const actualHash = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
      const checksumMatched = Boolean(
        envelope.checksumSha256 &&
          envelope.checksumSha256.length === actualHash.length &&
          crypto.timingSafeEqual(Buffer.from(envelope.checksumSha256), Buffer.from(actualHash))
      );
      if (!checksumMatched) {
        return {
          ok: false,
          meta: found.meta,
          checksumMatched: false,
          error: 'فشل التحقق من سلامة النسخة الاحتياطية (تعارض SHA-256)',
        };
      }
      const inner = JSON.parse(plaintext) as { payload?: Record<string, unknown> };
      if (!inner.payload || typeof inner.payload !== 'object') {
        return { ok: false, meta: found.meta, checksumMatched: true, error: 'بنية البيانات الداخلية غير صالحة' };
      }
      return {
        ok: true,
        meta: found.meta,
        payload: inner.payload,
        checksumMatched: true,
      };
    } catch (err) {
      return {
        ok: false,
        meta: found.meta,
        checksumMatched: false,
        error: err instanceof Error ? err.message : 'تعذر فك تشفير النسخة الاحتياطية',
      };
    }
  }

  /**
   * Monthly / on-demand isolated restore drill: decrypts, verifies checksum & core invariants
   * in a sandbox without mutating live production state.
   */
  runRestoreDrill(backupId?: string): RestoreDrillResult {
    const start = Date.now();
    const backups = this.listBackups();
    const targetId = backupId || backups[0]?.id;
    if (!targetId) {
      return {
        ranAt: new Date().toISOString(),
        backupId: 'none',
        passed: false,
        usersVerified: 0,
        roomsVerified: 0,
        owner900Intact: false,
        checksumMatched: false,
        durationMs: Date.now() - start,
        error: 'لا توجد نسخ احتياطية متوفرة بعد لإجراء تجربة الاسترجاع',
      };
    }

    const loaded = this.loadAndVerifyBackup(targetId);
    if (!loaded.ok || !loaded.payload) {
      return {
        ranAt: new Date().toISOString(),
        backupId: targetId,
        passed: false,
        usersVerified: 0,
        roomsVerified: 0,
        owner900Intact: false,
        checksumMatched: loaded.checksumMatched,
        durationMs: Date.now() - start,
        error: loaded.error || 'فشل فك تشفير النسخة',
      };
    }

    const state = (loaded.payload.state || {}) as {
      users?: Array<{ id?: string }>;
      rooms?: Array<{ id?: string }>;
    };
    const users = Array.isArray(state.users) ? state.users : [];
    const rooms = Array.isArray(state.rooms) ? state.rooms : [];
    const owner900Intact = users.some((u) => u.id === '900');

    return {
      ranAt: new Date().toISOString(),
      backupId: targetId,
      passed: loaded.checksumMatched && owner900Intact && users.length > 0 && rooms.length > 0,
      usersVerified: users.length,
      roomsVerified: rooms.length,
      owner900Intact,
      checksumMatched: loaded.checksumMatched,
      durationMs: Date.now() - start,
    };
  }

  async pushToOffsiteWebhook(webhookUrl: string, backupId: string): Promise<{ ok: boolean; error?: string }> {
    const validated = validateSafeWebhookUrl(webhookUrl);
    if (!validated.ok || !validated.normalized) {
      return { ok: false, error: validated.error || 'رابط النسخ الخارجي غير مضبوط' };
    }
    const found = this.readBackupRawEnvelope(backupId);
    if (!found) {
      return { ok: false, error: 'النسخة الاحتياطية غير موجودة' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(validated.normalized, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Riad-Backup-Id': found.meta.id,
          'X-Riad-Backup-Sha256': found.meta.checksumSha256,
        },
        body: found.rawEnvelope,
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, error: `رفض الخادم الخارجي النسخة (HTTP ${res.status})` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'تعذر الاتصال بخادم النسخ الخارجي ضمن المهلة' };
    } finally {
      clearTimeout(timer);
    }
  }
}
