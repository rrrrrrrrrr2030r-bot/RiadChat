import { resolveApiUrl } from './apiBase';

const STORED_VERSION_KEY = 'riad_chat_app_version_v1';

export interface AppVersionInfo {
  version: string;
  startedAt: number;
  appName?: string;
}

export async function fetchServerAppVersion(): Promise<AppVersionInfo | null> {
  try {
    const res = await fetch(resolveApiUrl(`/api/version?t=${Date.now()}`), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AppVersionInfo;
    if (!data?.version) return null;
    return data;
  } catch {
    return null;
  }
}

export function getStoredAppVersion(): string | null {
  try {
    return localStorage.getItem(STORED_VERSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredAppVersion(version: string): void {
  try {
    localStorage.setItem(STORED_VERSION_KEY, version);
  } catch {
    // ignore storage errors in restricted webviews
  }
}

/**
 * Checks for a newer Service Worker registration and compares server build version.
 * Returns `{ hasUpdate, latestVersion }` without reloading unexpectedly.
 */
export async function checkForAppUpdate(): Promise<{
  hasUpdate: boolean;
  latestVersion: string | null;
}> {
  // Trigger Service Worker update check if supported
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    } catch {
      // ignore SW update check errors
    }
  }

  const info = await fetchServerAppVersion();
  if (!info?.version) {
    return { hasUpdate: false, latestVersion: null };
  }

  const stored = getStoredAppVersion();
  if (!stored) {
    setStoredAppVersion(info.version);
    return { hasUpdate: false, latestVersion: info.version };
  }

  return {
    hasUpdate: stored !== info.version,
    latestVersion: info.version,
  };
}

/**
 * Clears all Cache Storage entries, unregisters outdated Service Workers,
 * updates the stored build version, and reloads with a cache-busting timestamp.
 */
export async function forceRefreshApp(latestVersion?: string | null): Promise<void> {
  if (latestVersion) {
    setStoredAppVersion(latestVersion);
  } else {
    const fresh = await fetchServerAppVersion();
    if (fresh?.version) {
      setStoredAppVersion(fresh.version);
    }
  }

  // 1. Delete all Cache Storage caches (PWA & WebView assets)
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    } catch {
      // continue even if caches API is blocked
    }
  }

  // 2. Unregister active service workers so fresh bundle is fetched immediately
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    } catch {
      // continue even if unregister fails
    }
  }

  // 3. Reload with cache-busting query param for aggressive WebViews
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', String(Date.now()));
    window.location.replace(url.toString());
  }
}

/**
 * Cleans up the temporary `_refresh` cache-busting param after reload.
 */
export function cleanupRefreshQueryParam(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_refresh')) {
      url.searchParams.delete('_refresh');
      const clean = `${url.pathname}${url.search ? url.search : ''}${url.hash}`;
      window.history.replaceState({}, document.title, clean || '/');
    }
  } catch {
    // ignore URL errors
  }
}
