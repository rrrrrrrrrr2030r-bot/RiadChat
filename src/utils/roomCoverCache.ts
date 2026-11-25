/**
 * Two-tier Room Cover Image Cache (L1 in-memory Object URLs + L2 IndexedDB Blob store).
 * - Retention: 24-hour TTL per cover image.
 * - Capacity: Maximum 60 images with automatic LRU eviction (by `lastAccessedAt`).
 * - Safety: Validates URL schemes & `image/*` MIME types, caps blob size at 5 MB,
 *   deduplicates concurrent fetches, and degrades gracefully if IndexedDB or CORS is blocked.
 */

const DB_NAME = 'riad_chat_cover_cache_v1';
const DB_VERSION = 1;
const STORE_NAME = 'covers';

export const COVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const COVER_CACHE_MAX_ENTRIES = 60;
const COVER_CACHE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB safety limit per cover
const MAX_CONCURRENT_FETCHES = 4;

interface StoredCoverRecord {
  url: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  cachedAt: number;
  lastAccessedAt: number;
}

interface MemoryCoverEntry {
  objectUrl: string;
  cachedAt: number;
  lastAccessedAt: number;
}

const memoryCache = new Map<string, MemoryCoverEntry>();
const inFlightRequests = new Map<string, Promise<string>>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
let activeFetches = 0;
const fetchQueue: Array<() => void> = [];

function runWithFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      activeFetches += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeFetches = Math.max(0, activeFetches - 1);
          const next = fetchQueue.shift();
          if (next) next();
        });
    };
    if (activeFetches < MAX_CONCURRENT_FETCHES) {
      start();
    } else {
      fetchQueue.push(start);
    }
  });
}

export function normalizeSafeCoverUrl(rawUrl?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return '';
  } catch {
    return '';
  }
}

function isDirectPassThroughUrl(url: string): boolean {
  return !url || url.startsWith('data:image/') || url.startsWith('blob:');
}

function setMemoryEntry(url: string, blob: Blob, cachedAt: number): string {
  const existing = memoryCache.get(url);
  if (existing) {
    existing.cachedAt = cachedAt;
    existing.lastAccessedAt = Date.now();
    return existing.objectUrl;
  }

  const objectUrl = URL.createObjectURL(blob);
  memoryCache.set(url, {
    objectUrl,
    cachedAt,
    lastAccessedAt: Date.now(),
  });

  // Keep in-memory ObjectURL count bounded to prevent memory leaks
  if (memoryCache.size > COVER_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of memoryCache.entries()) {
      if (key !== url && entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const removed = memoryCache.get(oldestKey);
      memoryCache.delete(oldestKey);
      if (removed) {
        try {
          URL.revokeObjectURL(removed.objectUrl);
        } catch {
          // ignore revoke failure
        }
      }
    }
  }

  return objectUrl;
}

/**
 * Synchronous L1 lookup so already-loaded covers render immediately with zero flicker
 * when switching tabs or filtering the rooms list.
 */
export function getMemoryCachedCoverUrl(rawUrl?: string | null): string | null {
  const url = normalizeSafeCoverUrl(rawUrl);
  if (!url) return null;
  if (isDirectPassThroughUrl(url)) return url;
  const entry = memoryCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt >= COVER_CACHE_TTL_MS) {
    return null;
  }
  entry.lastAccessedAt = Date.now();
  return entry.objectUrl;
}

function openCoverDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

async function readRecordFromIdb(url: string): Promise<StoredCoverRecord | null> {
  const db = await openCoverDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);
      req.onsuccess = () => resolve((req.result as StoredCoverRecord | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeRecordToIdb(record: StoredCoverRecord): Promise<void> {
  const db = await openCoverDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  void pruneCoverCache();
}

async function touchRecordAccessTime(record: StoredCoverRecord): Promise<void> {
  const db = await openCoverDatabase();
  if (!db) return;
  const now = Date.now();
  // Avoid redundant writes if touched within the last 5 minutes
  if (now - record.lastAccessedAt < 5 * 60 * 1000) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...record, lastAccessedAt: now });
  } catch {
    // ignore touch failure
  }
}

/**
 * Evicts expired (>24h) entries and trims least-recently-used records whenever
 * stored covers exceed the 60-image limit.
 */
async function pruneCoverCache(): Promise<void> {
  const db = await openCoverDatabase();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const now = Date.now();

      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const records = (getAllReq.result as StoredCoverRecord[] | undefined) || [];
        const valid: StoredCoverRecord[] = [];

        for (const rec of records) {
          if (!rec?.url || now - rec.cachedAt >= COVER_CACHE_TTL_MS) {
            if (rec?.url) store.delete(rec.url);
          } else {
            valid.push(rec);
          }
        }

        if (valid.length > COVER_CACHE_MAX_ENTRIES) {
          valid.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
          const excessCount = valid.length - COVER_CACHE_MAX_ENTRIES;
          for (let i = 0; i < excessCount; i += 1) {
            store.delete(valid[i].url);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  return runWithFetchSlot(async () => {
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!res.ok) return null;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const blob = await res.blob();
      const effectiveType = (blob.type || contentType).toLowerCase();
      if (!effectiveType.startsWith('image/')) return null;
      if (blob.size <= 0 || blob.size > COVER_CACHE_MAX_BYTES) return null;
      return blob;
    } catch {
      return null;
    }
  });
}

/**
 * Resolves a room cover URL using L1 memory cache -> L2 IndexedDB -> deduplicated network fetch.
 * Always returns a usable image URL (ObjectURL from cache or safe fallback to original URL).
 */
export async function getOrFetchCachedCoverUrl(rawUrl?: string | null): Promise<string> {
  const url = normalizeSafeCoverUrl(rawUrl);
  if (!url) return '';
  if (isDirectPassThroughUrl(url)) return url;

  const memHit = getMemoryCachedCoverUrl(url);
  if (memHit) return memHit;

  const existingFlight = inFlightRequests.get(url);
  if (existingFlight) return existingFlight;

  const job = (async (): Promise<string> => {
    const now = Date.now();
    const idbRecord = await readRecordFromIdb(url);

    // Fresh L2 IndexedDB hit (< 24h)
    if (idbRecord?.blob && now - idbRecord.cachedAt < COVER_CACHE_TTL_MS) {
      const objectUrl = setMemoryEntry(url, idbRecord.blob, idbRecord.cachedAt);
      void touchRecordAccessTime(idbRecord);
      return objectUrl;
    }

    // Cache miss or expired (> 24h): fetch fresh copy from network
    const freshBlob = await fetchImageBlob(url);
    if (freshBlob) {
      const timestamp = Date.now();
      const objectUrl = setMemoryEntry(url, freshBlob, timestamp);
      await writeRecordToIdb({
        url,
        blob: freshBlob,
        mimeType: freshBlob.type || 'image/jpeg',
        sizeBytes: freshBlob.size,
        cachedAt: timestamp,
        lastAccessedAt: timestamp,
      });
      return objectUrl;
    }

    // Offline resilience: if network failed but an older IndexedDB blob exists, still serve it
    if (idbRecord?.blob) {
      return setMemoryEntry(url, idbRecord.blob, idbRecord.cachedAt);
    }

    // CORS-restricted third-party image or IndexedDB unavailable: fall back cleanly to original URL
    return url;
  })().finally(() => {
    inFlightRequests.delete(url);
  });

  inFlightRequests.set(url, job);
  return job;
}

/**
 * Prefetches room cover URLs into IndexedDB in order of priority (pinned room first).
 */
export function prefetchRoomCovers(rawUrls: Array<string | null | undefined>): void {
  if (typeof window === 'undefined') return;
  const seen = new Set<string>();
  const targets: string[] = [];

  for (const raw of rawUrls) {
    const normalized = normalizeSafeCoverUrl(raw);
    if (!normalized || isDirectPassThroughUrl(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    if (!getMemoryCachedCoverUrl(normalized)) {
      targets.push(normalized);
    }
  }

  // Respect the 60-image cache cap during bulk prefetching
  for (const url of targets.slice(0, COVER_CACHE_MAX_ENTRIES)) {
    void getOrFetchCachedCoverUrl(url);
  }
}
