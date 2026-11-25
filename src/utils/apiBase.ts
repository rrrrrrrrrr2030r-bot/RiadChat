/**
 * Unified backend API & WebSocket endpoint resolver.
 * - Uses same-origin relative paths by default when Web is served alongside Express (`/api/*` & `/ws`).
 * - Supports linking to an external Express backend when `VITE_API_BASE_URL` is configured,
 *   while automatically ignoring misconfigured Supabase project URLs (`*.supabase.co`) so
 *   Express `/api/*` and `/ws` routes never get misdirected to Supabase.
 */

function isLocalHostName(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function sanitizeBackendBaseUrl(rawApiUrl?: string, rawSupabaseUrl?: string): string {
  const cleaned = String(rawApiUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    if (
      host.endsWith('.supabase.co') ||
      host.endsWith('.supabase.in') ||
      host.endsWith('.supabase.net')
    ) {
      return '';
    }
    const supaCleaned = String(rawSupabaseUrl || '').trim();
    if (supaCleaned) {
      try {
        if (new URL(supaCleaned).origin.toLowerCase() === parsed.origin.toLowerCase()) {
          return '';
        }
      } catch {
        // ignore invalid supabase url
      }
    }
    // Enforce HTTPS transport encryption for all non-localhost remote backends
    if (parsed.protocol === 'http:' && !isLocalHostName(host)) {
      parsed.protocol = 'https:';
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

const RAW_API_BASE_URL = sanitizeBackendBaseUrl(
  import.meta.env?.VITE_API_BASE_URL as string | undefined,
  import.meta.env?.VITE_SUPABASE_URL as string | undefined
);

export const API_BASE_URL = RAW_API_BASE_URL;

export function resolveApiUrl(path: string): string {
  if (!RAW_API_BASE_URL) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${RAW_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function resolveWsUrl(token?: string): string {
  let base: string;
  if (RAW_API_BASE_URL) {
    base = `${RAW_API_BASE_URL.replace(/^http(s?):/i, 'ws$1:')}/ws`;
  } else {
    const isSecure =
      window.location.protocol === 'https:' || !isLocalHostName(window.location.hostname.toLowerCase());
    base = `${isSecure ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  }
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

const RAW_CDN_BASE_URL = sanitizeBackendBaseUrl(
  import.meta.env?.VITE_CDN_BASE_URL as string | undefined
);

export function resolveCdnAssetUrl(assetPath: string): string {
  if (!assetPath) return '';
  if (/^(https?:|data:|blob:)/i.test(assetPath)) return assetPath;
  if (!RAW_CDN_BASE_URL) return assetPath;
  return `${RAW_CDN_BASE_URL}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
}

