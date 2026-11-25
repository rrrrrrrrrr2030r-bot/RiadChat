import {
  Linking,
  PermissionsAndroid,
  Platform,
  Share,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { mediaDevices, MediaStream } from 'react-native-webrtc';

const STORAGE_USER_KEY = '@riyadh_chat_current_user_id';
const STORAGE_SESSION_TOKEN_KEY = '@riyadh_chat_session_token_v1';
const STORAGE_SUPABASE_SESSION_KEY = '@riyadh_chat_supabase_session_v1';
const STORAGE_PENDING_REFERRAL_KEY = '@riyadh_chat_pending_referral_v1';
const STORAGE_PENDING_ROOM_KEY = '@riyadh_chat_pending_room_v1';
const STORAGE_GOOGLE_HINT_KEY = '@riyadh_chat_google_hint_v1';
const STORAGE_BIOMETRIC_ENABLED_KEY = '@riyadh_chat_biometric_enabled_v1';

interface SecureStoreLike {
  getItemAsync?: (key: string) => Promise<string | null>;
  setItemAsync?: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
  deleteItemAsync?: (key: string) => Promise<void>;
}

let cachedSecureStore: SecureStoreLike | null | undefined;

function getHardwareSecureStore(): SecureStoreLike | null {
  if (cachedSecureStore !== undefined) return cachedSecureStore;
  try {
    // Dynamically resolve expo-secure-store when bundled in native builds (iOS Keychain / Android Keystore)
    const dynamicRequire = (globalThis as unknown as { require?: (id: string) => unknown }).require;
    if (typeof dynamicRequire === 'function') {
      const mod = dynamicRequire('expo-secure-store') as SecureStoreLike | null;
      if (mod && typeof mod.getItemAsync === 'function' && typeof mod.setItemAsync === 'function') {
        cachedSecureStore = mod;
        return cachedSecureStore;
      }
    }
  } catch {
    // Module not linked in this runtime; fall back cleanly to AsyncStorage
  }
  cachedSecureStore = null;
  return null;
}

function toSecureKey(key: string): string {
  // expo-secure-store allows only [A-Za-z0-9._-]
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function readSecureSecret(key: string): Promise<string | null> {
  const secureStore = getHardwareSecureStore();
  if (secureStore?.getItemAsync) {
    try {
      const secureVal = await secureStore.getItemAsync(toSecureKey(key));
      if (secureVal) return secureVal;
      // Seamless one-time migration from legacy AsyncStorage to hardware Keychain/Keystore
      const legacyVal = await AsyncStorage.getItem(key);
      if (legacyVal && secureStore.setItemAsync) {
        await secureStore.setItemAsync(toSecureKey(key), legacyVal);
        await AsyncStorage.removeItem(key);
        return legacyVal;
      }
      return null;
    } catch {
      // Fall through to AsyncStorage if Keychain/Keystore throws on this device
    }
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeSecureSecret(key: string, value: string): Promise<void> {
  const secureStore = getHardwareSecureStore();
  if (secureStore?.setItemAsync) {
    try {
      await secureStore.setItemAsync(toSecureKey(key), value);
      await AsyncStorage.removeItem(key).catch(() => {});
      return;
    } catch {
      // Fall back to AsyncStorage if secure store value size or device keystore fails
    }
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignore storage error
  }
}

async function deleteSecureSecret(key: string): Promise<void> {
  const secureStore = getHardwareSecureStore();
  if (secureStore?.deleteItemAsync) {
    await secureStore.deleteItemAsync(toSecureKey(key)).catch(() => {});
  }
  await AsyncStorage.removeItem(key).catch(() => {});
}

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export interface ParsedDeepLink {
  rawUrl: string;
  inviteCode?: string;
  roomId?: string;
  isAuthCallback?: boolean;
}

export function triggerNativeHaptic(kind: 'light' | 'success' | 'warning' = 'light'): void {
  try {
    if (kind === 'success') {
      ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS);
    } else if (kind === 'warning') {
      ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS);
    } else {
      ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS);
    }
  } catch {
    Vibration.vibrate(kind === 'success' ? [0, 35, 45, 50] : 20);
  }
}

export async function requestNativeMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'إذن الميكروفون للغرف الصوتية',
        message: 'يحتاج تطبيق رياض شات إلى إذن الميكروفون للتحدث مع أصدقائك في الغرفة الصوتية.',
        buttonNeutral: 'لاحقاً',
        buttonNegative: 'إلغاء',
        buttonPositive: 'سماح',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function acquireNativeVoiceStream(): Promise<MediaStream | null> {
  const permitted = await requestNativeMicrophonePermission();
  if (!permitted) return null;
  try {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    return stream;
  } catch {
    return null;
  }
}

export function releaseNativeVoiceStream(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // Ignore track cleanup error
  }
}

export async function shareNativeInviteLink(params: {
  title: string;
  message: string;
  url: string;
}): Promise<boolean> {
  try {
    const result = await Share.share({
      title: params.title,
      message: `${params.message}\n${params.url}`,
      url: params.url,
    });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function parseIncomingInviteUrl(url: string | null): ParsedDeepLink {
  if (!url) return { rawUrl: '' };
  try {
    const clean = url.trim();
    const isAuthCallback =
      /^riyadhchat:\/\/auth\/callback/i.test(clean) ||
      /(?:[?#&](?:access_token|refresh_token|code)=)/i.test(clean);

    const roomMatch = clean.match(/[?&]room=([^&#]+)/i);
    const roomId = roomMatch ? decodeURIComponent(roomMatch[1]) : undefined;

    const schemeMatch = clean.match(/^riyadhchat:\/\/invite\/([A-Za-z0-9_-]+)/i);
    if (schemeMatch) {
      return {
        rawUrl: clean,
        inviteCode: decodeURIComponent(schemeMatch[1]).toUpperCase(),
        roomId,
        isAuthCallback,
      };
    }

    const roomSchemeMatch = clean.match(/^riyadhchat:\/\/room\/([A-Za-z0-9_-]+)/i);
    if (roomSchemeMatch) {
      return {
        rawUrl: clean,
        roomId: decodeURIComponent(roomSchemeMatch[1]),
        isAuthCallback,
      };
    }

    const inviteQuery = clean.match(/[?&](?:invite|ref)=([^&#]+)/i);
    return {
      rawUrl: clean,
      inviteCode: inviteQuery ? decodeURIComponent(inviteQuery[1]).toUpperCase() : undefined,
      roomId,
      isAuthCallback,
    };
  } catch {
    return { rawUrl: url || '' };
  }
}

export function subscribeDeepLinks(
  handler: (parsed: ParsedDeepLink) => void
): () => void {
  Linking.getInitialURL()
    .then((initialUrl) => {
      const parsed = parseIncomingInviteUrl(initialUrl);
      if (parsed.isAuthCallback || parsed.inviteCode || parsed.roomId) {
        handler(parsed);
      }
    })
    .catch(() => {});

  const subscription = Linking.addEventListener('url', ({ url }) => {
    const parsed = parseIncomingInviteUrl(url);
    if (parsed.isAuthCallback || parsed.inviteCode || parsed.roomId) {
      handler(parsed);
    }
  });

  return () => subscription.remove();
}

export async function loadSavedUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_USER_KEY);
  } catch {
    return null;
  }
}

export async function saveUserId(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_USER_KEY, userId);
  } catch {
    // Ignore storage quota error
  }
}

export async function clearSavedUserId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_USER_KEY);
  } catch {
    // Ignore storage error
  }
}

export async function loadSavedSessionToken(): Promise<string | null> {
  return readSecureSecret(STORAGE_SESSION_TOKEN_KEY);
}

export async function saveSessionToken(token: string): Promise<void> {
  await writeSecureSecret(STORAGE_SESSION_TOKEN_KEY, token);
}

export async function clearSavedSessionToken(): Promise<void> {
  await deleteSecureSecret(STORAGE_SESSION_TOKEN_KEY);
}

export async function loadSavedSupabaseSession(): Promise<Session | null> {
  try {
    const raw = await readSecureSecret(STORAGE_SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (
      !parsed ||
      typeof parsed.access_token !== 'string' ||
      !parsed.access_token.trim() ||
      typeof parsed.refresh_token !== 'string' ||
      !parsed.refresh_token.trim() ||
      !parsed.user ||
      typeof parsed.user.id !== 'string' ||
      !parsed.user.id.trim()
    ) {
      await deleteSecureSecret(STORAGE_SUPABASE_SESSION_KEY);
      return null;
    }
    return parsed as Session;
  } catch {
    await deleteSecureSecret(STORAGE_SUPABASE_SESSION_KEY);
    return null;
  }
}

export async function saveSupabaseSession(session: Session | null): Promise<void> {
  if (
    !session ||
    !session.access_token ||
    !session.refresh_token ||
    !session.user?.id
  ) {
    await clearSavedSupabaseSession();
    return;
  }
  await writeSecureSecret(STORAGE_SUPABASE_SESSION_KEY, JSON.stringify(session));
}

export async function clearSavedSupabaseSession(): Promise<void> {
  await deleteSecureSecret(STORAGE_SUPABASE_SESSION_KEY);
}

export async function loadPendingReferral(): Promise<{ code: string | null; roomId: string | null }> {
  try {
    const [code, roomId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_PENDING_REFERRAL_KEY),
      AsyncStorage.getItem(STORAGE_PENDING_ROOM_KEY),
    ]);
    return { code, roomId };
  } catch {
    return { code: null, roomId: null };
  }
}

export async function savePendingReferral(code?: string | null, roomId?: string | null): Promise<void> {
  try {
    if (code) {
      await AsyncStorage.setItem(STORAGE_PENDING_REFERRAL_KEY, code.trim().toUpperCase());
    }
    if (roomId) {
      await AsyncStorage.setItem(STORAGE_PENDING_ROOM_KEY, roomId.trim());
    }
  } catch {
    // Ignore storage error
  }
}

export async function clearPendingReferral(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_PENDING_REFERRAL_KEY),
      AsyncStorage.removeItem(STORAGE_PENDING_ROOM_KEY),
    ]);
  } catch {
    // Ignore storage error
  }
}

export async function loadSavedGoogleHint(): Promise<{ email: string; name?: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_GOOGLE_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; name?: string };
    const email = String(parsed?.email || '').trim().toLowerCase();
    if (!email) return null;
    return {
      email,
      name: typeof parsed?.name === 'string' && parsed.name.trim() ? parsed.name.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveGoogleHint(hint: { email: string; name?: string }): Promise<void> {
  const email = hint.email.trim().toLowerCase();
  if (!email) return;
  try {
    await AsyncStorage.setItem(
      STORAGE_GOOGLE_HINT_KEY,
      JSON.stringify({ email, name: hint.name?.trim() || undefined })
    );
  } catch {
    // Ignore storage error
  }
}

export async function clearSavedGoogleHint(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_GOOGLE_HINT_KEY);
  } catch {
    // Ignore storage error
  }
}

export async function loadBiometricLockEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_BIOMETRIC_ENABLED_KEY);
    // Default enabled for pre-existing AsyncStorage sessions on biometric-capable devices
    if (val === null) return true;
    return val === '1' || val === 'true';
  } catch {
    return true;
  }
}

export async function saveBiometricLockEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_BIOMETRIC_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage error
  }
}
