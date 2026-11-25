import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const hasValidUrl =
  rawUrl.startsWith('https://') &&
  !rawUrl.includes('YOUR_PROJECT_REF') &&
  !rawUrl.includes('your-project') &&
  rawUrl.length > 16;

const isJwtFormat =
  rawAnonKey.startsWith('eyJ') && rawAnonKey.split('.').length === 3 && rawAnonKey.length > 80;
const isPublishableKeyFormat =
  rawAnonKey.startsWith('sb_publishable_') && rawAnonKey.length > 24;

const hasValidKey =
  !rawAnonKey.includes('YOUR_SUPABASE_ANON_KEY') &&
  !/\s/.test(rawAnonKey) &&
  (isJwtFormat || isPublishableKeyFormat);

export const isSupabaseConfigured = hasValidUrl && hasValidKey;

const rawPublicInviteUrl = (import.meta.env.VITE_PUBLIC_INVITE_URL || '').trim();
export const PUBLIC_INVITE_BASE_URL = (
  /^https?:\/\//i.test(rawPublicInviteUrl) ? rawPublicInviteUrl : 'https://riadchat.vercel.app'
).replace(/\/+$/, '');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'riad_chat_supabase_auth',
      },
    })
  : null;
