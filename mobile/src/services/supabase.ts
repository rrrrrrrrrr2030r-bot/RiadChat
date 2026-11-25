import 'react-native-url-polyfill/auto';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

declare const process: { env?: Record<string, string | undefined> } | undefined;

function readEnv(keys: string[]): string {
  const env = typeof process !== 'undefined' && process?.env ? process.env : {};
  for (const key of keys) {
    const val = (env[key] || '').trim();
    if (val) return val;
  }
  return '';
}

const rawSupabaseUrl = readEnv([
  'EXPO_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
]);

const rawSupabaseAnonKey = readEnv([
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
]);

export const MOBILE_SUPABASE_REDIRECT_URL = 'riyadhchat://auth/callback';

const rawMobileInviteUrl = readEnv([
  'EXPO_PUBLIC_PUBLIC_INVITE_URL',
  'PUBLIC_INVITE_URL',
  'VITE_PUBLIC_INVITE_URL',
]);
export const PUBLIC_INVITE_BASE_URL = (
  /^https?:\/\//i.test(rawMobileInviteUrl) ? rawMobileInviteUrl : 'https://riadchat.vercel.app'
).replace(/\/+$/, '');

const isValidMobileSupabaseKey =
  !rawSupabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY') &&
  !/\s/.test(rawSupabaseAnonKey) &&
  ((rawSupabaseAnonKey.startsWith('eyJ') &&
    rawSupabaseAnonKey.split('.').length === 3 &&
    rawSupabaseAnonKey.length > 80) ||
    (rawSupabaseAnonKey.startsWith('sb_publishable_') && rawSupabaseAnonKey.length > 24));

export const isMobileSupabaseConfigured = Boolean(
  rawSupabaseUrl &&
    isValidMobileSupabaseKey &&
    /^https?:\/\//i.test(rawSupabaseUrl) &&
    !rawSupabaseUrl.includes('your-project') &&
    !rawSupabaseUrl.includes('YOUR_PROJECT_REF')
);

export const mobileSupabase: SupabaseClient | null = isMobileSupabaseConfigured
  ? createClient(rawSupabaseUrl, rawSupabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Keeps Supabase JWT auto-refresh active only while the React Native app is in foreground.
 */
export function bindSupabaseAppStateAutoRefresh(): () => void {
  if (!mobileSupabase) return () => {};

  const handleChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      mobileSupabase.auth.startAutoRefresh();
    } else {
      mobileSupabase.auth.stopAutoRefresh();
    }
  };

  mobileSupabase.auth.startAutoRefresh();
  const sub = AppState.addEventListener('change', handleChange);
  return () => {
    sub.remove();
    mobileSupabase.auth.stopAutoRefresh();
  };
}

export type SupabaseSessionRestoreStatus =
  | 'valid'
  | 'refreshed'
  | 'revoked'
  | 'offline'
  | 'none';

export interface SupabaseSessionRestoreResult {
  session: Session | null;
  status: SupabaseSessionRestoreStatus;
}

function isSupabaseAuthRejectionError(error: { message?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.status === 400 || error.status === 401 || error.status === 403) {
    return true;
  }
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token not found') ||
    msg.includes('invalid_grant') ||
    msg.includes('jwt expired') ||
    msg.includes('session not found') ||
    msg.includes('user not found') ||
    msg.includes('token is expired') ||
    msg.includes('already used')
  );
}

/**
 * Restores a persisted Supabase session from AsyncStorage on cold start and automatically
 * refreshes expired or near-expiry tokens. Only reports 'revoked' on explicit auth rejection,
 * keeping cached sessions intact during transient offline launches.
 */
export async function restoreOrRefreshSupabaseSession(
  cachedSession: Session | null
): Promise<SupabaseSessionRestoreResult> {
  if (!mobileSupabase) {
    return {
      session: cachedSession,
      status: cachedSession ? 'offline' : 'none',
    };
  }

  try {
    const liveRes = await mobileSupabase.auth.getSession();
    let activeSession: Session | null = liveRes.data.session ?? null;

    // Prefer whichever persisted session has the newer expiration timestamp
    if (cachedSession?.access_token && cachedSession?.refresh_token) {
      const liveExp = activeSession?.expires_at ?? 0;
      const cachedExp = cachedSession.expires_at ?? 0;
      if (!activeSession || cachedExp > liveExp) {
        const setRes = await mobileSupabase.auth.setSession({
          access_token: cachedSession.access_token,
          refresh_token: cachedSession.refresh_token,
        });
        if (!setRes.error && setRes.data.session) {
          activeSession = setRes.data.session;
        } else if (setRes.error) {
          // If access_token expired, try refreshSession explicitly before deciding revocation
          const refRes = await mobileSupabase.auth.refreshSession({
            refresh_token: cachedSession.refresh_token,
          });
          if (!refRes.error && refRes.data.session) {
            return { session: refRes.data.session, status: 'refreshed' };
          }
          if (isSupabaseAuthRejectionError(refRes.error || setRes.error)) {
            return { session: null, status: 'revoked' };
          }
          return { session: cachedSession, status: 'offline' };
        }
      }
    }

    if (!activeSession) {
      return { session: null, status: 'none' };
    }

    // Automatically refresh expired or near-expiry tokens (within 60s window)
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = activeSession.expires_at ?? 0;
    if (expiresAt > 0 && expiresAt <= nowSec + 60 && activeSession.refresh_token) {
      const refRes = await mobileSupabase.auth.refreshSession({
        refresh_token: activeSession.refresh_token,
      });
      if (!refRes.error && refRes.data.session) {
        return { session: refRes.data.session, status: 'refreshed' };
      }
      if (isSupabaseAuthRejectionError(refRes.error)) {
        return { session: null, status: 'revoked' };
      }
      return { session: activeSession, status: 'offline' };
    }

    return { session: activeSession, status: 'valid' };
  } catch {
    return {
      session: cachedSession,
      status: cachedSession ? 'offline' : 'none',
    };
  }
}

function parseUrlParams(segment: string): Record<string, string> {
  const out: Record<string, string> = {};
  const cleaned = segment.replace(/^[?#]/, '');
  if (!cleaned) return out;
  for (const part of cleaned.split('&')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = decodeURIComponent(part.slice(0, idx));
    const v = decodeURIComponent(part.slice(idx + 1).replace(/\+/g, ' '));
    out[k] = v;
  }
  return out;
}

/**
 * Completes a native OAuth redirect (e.g. Facebook Login -> riyadhchat://auth/callback)
 * supporting both PKCE (?code=...) and implicit (#access_token=...&refresh_token=...) flows.
 */
export const PRIMARY_OWNER_ID = '900';
export const PRIMARY_OWNER_EMAIL = 'rrrrrrrrrr2030r@gmail.com';

/**
 * Permanently binds the Primary Owner (ID: 900) in Supabase Auth user_metadata
 * and upserts the owner record in the Supabase `profiles` table (if provisioned).
 */
export async function bindPrimaryOwnerInSupabase(params: {
  supabaseUid: string;
  email: string;
  name?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!mobileSupabase) {
    return { ok: false, error: 'Supabase client is not configured' };
  }

  const cleanEmail = params.email.trim().toLowerCase();
  const displayName = params.name?.trim() || 'رياض | Riad';

  try {
    await mobileSupabase.auth.updateUser({
      data: {
        app_user_id: PRIMARY_OWNER_ID,
        role: 'OWNER',
        is_primary_admin: true,
        full_name: displayName,
        referral_code: 'RIYADH900',
      },
    });
  } catch {
    // Non-fatal if session refresh is pending
  }

  try {
    const { error } = await mobileSupabase.from('profiles').upsert(
      {
        id: params.supabaseUid,
        app_user_id: PRIMARY_OWNER_ID,
        email: cleanEmail,
        display_name: displayName,
        role: 'OWNER',
        is_primary_admin: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not upsert owner profile in Supabase',
    };
  }
}

export interface SupabaseOwnerVerification {
  checked: boolean;
  authenticated: boolean;
  supabaseUid: string | null;
  email: string | null;
  appUserId: string | null;
  isPrimaryOwner: boolean;
  isVerifiedAgent: boolean;
  session: Session | null;
}

/**
 * Verifies the active Supabase session against Auth user_metadata and the `profiles` table
 * to confirm Primary Owner (ID: 900) and verified agency status in real time.
 * Always fails closed (isPrimaryOwner=false, isVerifiedAgent=false) if verification cannot succeed.
 */
export async function verifyOwnerIdentityInSupabase(
  existingSession?: Session | null
): Promise<SupabaseOwnerVerification> {
  if (!mobileSupabase) {
    return {
      checked: false,
      authenticated: false,
      supabaseUid: null,
      email: null,
      appUserId: null,
      isPrimaryOwner: false,
      isVerifiedAgent: false,
      session: null,
    };
  }

  try {
    const session = existingSession ?? (await mobileSupabase.auth.getSession()).data.session ?? null;
    if (!session?.user) {
      return {
        checked: true,
        authenticated: false,
        supabaseUid: null,
        email: null,
        appUserId: null,
        isPrimaryOwner: false,
        isVerifiedAgent: false,
        session: null,
      };
    }

    // Confirm token validity directly with Supabase Auth server when online
    let verifiedUser = session.user;
    try {
      const { data: userData, error: userErr } = await mobileSupabase.auth.getUser();
      if (!userErr && userData.user) {
        verifiedUser = userData.user;
      }
    } catch {
      // Keep session user for server cross-check below
    }

    const email = (verifiedUser.email || '').trim().toLowerCase() || null;
    const meta = (verifiedUser.user_metadata || {}) as Record<string, unknown>;
    let appUserId =
      typeof meta.app_user_id === 'string' && meta.app_user_id.trim()
        ? meta.app_user_id.trim()
        : null;
    let profilePrimaryAdmin = meta.is_primary_admin === true;
    let profileVerifiedAgent = meta.is_verified_agent === true;

    try {
      const { data: profileRow } = await mobileSupabase
        .from('profiles')
        .select('app_user_id, role, is_primary_admin, is_verified_agent')
        .eq('id', verifiedUser.id)
        .maybeSingle();

      if (profileRow) {
        if (typeof profileRow.app_user_id === 'string' && profileRow.app_user_id.trim()) {
          appUserId = profileRow.app_user_id.trim();
        }
        profilePrimaryAdmin =
          profileRow.is_primary_admin === true ||
          profileRow.app_user_id === PRIMARY_OWNER_ID ||
          profileRow.role === 'OWNER';
        profileVerifiedAgent =
          profileRow.is_verified_agent === true ||
          profileRow.role === 'AGENCY_AGENT' ||
          profilePrimaryAdmin;
      }
    } catch {
      // `profiles` table may not be provisioned yet; rely on metadata + server check
    }

    const isPrimaryOwner = Boolean(
      appUserId === PRIMARY_OWNER_ID ||
        (email === PRIMARY_OWNER_EMAIL && (profilePrimaryAdmin || appUserId === PRIMARY_OWNER_ID))
    );

    if (isPrimaryOwner && appUserId !== PRIMARY_OWNER_ID) {
      appUserId = PRIMARY_OWNER_ID;
      void bindPrimaryOwnerInSupabase({
        supabaseUid: verifiedUser.id,
        email: email || PRIMARY_OWNER_EMAIL,
      });
    }

    return {
      checked: true,
      authenticated: true,
      supabaseUid: verifiedUser.id,
      email,
      appUserId,
      isPrimaryOwner,
      isVerifiedAgent: isPrimaryOwner || profileVerifiedAgent,
      session,
    };
  } catch {
    return {
      checked: false,
      authenticated: false,
      supabaseUid: null,
      email: null,
      appUserId: null,
      isPrimaryOwner: false,
      isVerifiedAgent: false,
      session: null,
    };
  }
}

export async function completeSupabaseOAuthCallback(url: string): Promise<{
  handled: boolean;
  session: Session | null;
  error?: string;
}> {
  if (!mobileSupabase) {
    return { handled: false, session: null };
  }
  if (!url || !/(auth\/callback|access_token=|code=)/i.test(url)) {
    return { handled: false, session: null };
  }

  try {
    const [withoutHash, hashPart = ''] = url.split('#');
    const queryPart = withoutHash.includes('?') ? withoutHash.split('?')[1] : '';
    const queryParams = parseUrlParams(queryPart);
    const hashParams = parseUrlParams(hashPart);

    const oauthError = queryParams.error_description || hashParams.error_description || queryParams.error || hashParams.error;
    if (oauthError) {
      return { handled: true, session: null, error: oauthError };
    }

    const pkceCode = queryParams.code;
    if (pkceCode) {
      const { data, error } = await mobileSupabase.auth.exchangeCodeForSession(pkceCode);
      if (error) {
        return { handled: true, session: null, error: error.message };
      }
      return { handled: true, session: data.session ?? null };
    }

    const accessToken = hashParams.access_token || queryParams.access_token;
    const refreshToken = hashParams.refresh_token || queryParams.refresh_token;
    if (accessToken && refreshToken) {
      const { data, error } = await mobileSupabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        return { handled: true, session: null, error: error.message };
      }
      return { handled: true, session: data.session ?? null };
    }

    return { handled: false, session: null };
  } catch (err) {
    return {
      handled: true,
      session: null,
      error: err instanceof Error ? err.message : 'تعذر إكمال جلسة المصادقة',
    };
  }
}
