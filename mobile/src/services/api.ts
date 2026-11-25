import type {
  MobileAgency2FAStatus,
  MobileInAppNotification,
  MobileInviteLink,
  MobileNotificationPrefs,
  MobilePaginatedResponse,
  MobileResolvedInvite,
  MobileServerState,
  MobileUser,
  MobileVoiceRoom,
} from '../types';

declare const process: { env?: Record<string, string | undefined> } | undefined;

const envObj = typeof process !== 'undefined' && process?.env ? process.env : {};

const DEFAULT_MOBILE_BACKEND_URL =
  'https://ais-pre-a7c3aeq5qwiwm34deodtyr-421264512085.europe-west2.run.app';

function isLocalHostName(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2' || host === '::1';
}

function sanitizeMobileBackendUrl(candidate?: string): string {
  const cleaned = String(candidate || '')
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
    const supaUrls = [envObj.EXPO_PUBLIC_SUPABASE_URL, envObj.VITE_SUPABASE_URL].filter(Boolean);
    for (const supa of supaUrls) {
      try {
        if (new URL(String(supa)).origin.toLowerCase() === parsed.origin.toLowerCase()) {
          return '';
        }
      } catch {
        // ignore invalid supabase url
      }
    }
    // Enforce TLS on all non-localhost backends
    if (parsed.protocol === 'http:' && !isLocalHostName(parsed.hostname)) {
      parsed.protocol = 'https:';
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export const API_BASE_URL =
  sanitizeMobileBackendUrl(envObj.EXPO_PUBLIC_API_BASE_URL) ||
  sanitizeMobileBackendUrl(envObj.API_BASE_URL) ||
  sanitizeMobileBackendUrl(envObj.VITE_API_BASE_URL) ||
  DEFAULT_MOBILE_BACKEND_URL;

export function buildWsUrl(token?: string): string {
  const parsed = new URL(API_BASE_URL);
  const wsProto = isLocalHostName(parsed.hostname) && parsed.protocol === 'http:' ? 'ws:' : 'wss:';
  const base = `${wsProto}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}/ws`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export async function checkServerHealth(): Promise<{
  ok: boolean;
  version?: string;
  supabaseLinked?: boolean;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      headers: { 'Cache-Control': 'no-cache', 'X-Client-Platform': 'mobile' },
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as {
      ok?: boolean;
      version?: string;
      supabaseLinked?: boolean;
    };
    return {
      ok: Boolean(data.ok),
      version: data.version,
      supabaseLinked: data.supabaseLinked,
    };
  } catch {
    return { ok: false };
  }
}

export interface MobileAuthResponse {
  ok?: boolean;
  error?: string;
  token?: string;
  user?: MobileUser;
  state?: MobileServerState;
  isNewUser?: boolean;
  referral?: {
    applied: boolean;
    inviterId?: string;
    inviterName?: string;
    targetRoomId?: string | null;
    welcomeGold?: number;
  };
  referralResult?: {
    applied: boolean;
    inviterId?: string;
    inviterName?: string;
    targetRoomId?: string | null;
    welcomeGold?: number;
  };
}

export class RiyadhChatApiClient {
  private token = '';
  private agency2faToken = '';
  private currentUserId = '';

  setSessionToken(token: string): void {
    this.token = token || '';
  }

  getSessionToken(): string {
    return this.token;
  }

  setAgency2FAToken(token: string): void {
    this.agency2faToken = token || '';
  }

  getAgency2FAToken(): string {
    return this.agency2faToken;
  }

  clearSession(): void {
    this.token = '';
    this.agency2faToken = '';
    this.currentUserId = '';
  }

  setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  async fetchState(): Promise<MobileServerState> {
    const res = await fetch(`${API_BASE_URL}/api/state`, {
      headers: {
        'Cache-Control': 'no-cache',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch state (${res.status})`);
    }
    const payload = (await res.json()) as { state: MobileServerState };
    return payload.state;
  }

  async fetchMe(token = this.token): Promise<{
    ok: boolean;
    user?: MobileUser;
    state?: MobileServerState;
  }> {
    if (!token) return { ok: false };
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      user?: MobileUser;
      state?: MobileServerState;
    };
    if (res.ok && data.user) {
      this.token = token;
      this.currentUserId = data.user.id;
      return { ok: true, user: data.user, state: data.state };
    }
    return { ok: false };
  }

  async registerWithEmail(params: {
    name: string;
    email: string;
    password: string;
    referralCode?: string;
  }): Promise<{ ok: boolean; status: number; data: MobileAuthResponse }> {
    return this.postPublic<MobileAuthResponse>('/api/auth/register', params);
  }

  async loginWithEmail(params: {
    email: string;
    password: string;
  }): Promise<{ ok: boolean; status: number; data: MobileAuthResponse }> {
    return this.postPublic<MobileAuthResponse>('/api/auth/login', params);
  }

  async sendPhoneOtp(phone: string): Promise<{
    ok: boolean;
    status: number;
    data: { ok?: boolean; error?: string; previewOtp?: string; expiresInSec?: number };
  }> {
    return this.postPublic('/api/auth/phone/send-otp', { phone });
  }

  async verifyPhoneOtp(params: {
    phone: string;
    code: string;
    name?: string;
    referralCode?: string;
  }): Promise<{ ok: boolean; status: number; data: MobileAuthResponse }> {
    return this.postPublic<MobileAuthResponse>('/api/auth/phone/verify-otp', params);
  }

  async loginWithGoogle(params: {
    name?: string;
    email?: string;
    googleId?: string;
    referralCode?: string;
  }): Promise<{ ok: boolean; status: number; data: MobileAuthResponse }> {
    return this.postPublic<MobileAuthResponse>('/api/auth/google', params);
  }

  async loginWithFacebook(params: {
    name?: string;
    email?: string;
    facebookId?: string;
    referralCode?: string;
  }): Promise<{ ok: boolean; status: number; data: MobileAuthResponse }> {
    return this.postPublic<MobileAuthResponse>('/api/auth/facebook', params);
  }

  async syncSupabaseUser(params: {
    accessToken: string;
    supabaseUid?: string;
    email?: string;
    phone?: string;
    name?: string;
    avatar?: string;
    provider?: string;
    referralCode?: string;
  }): Promise<{ ok: boolean; status: number; data: MobileAuthResponse }> {
    return this.postPublic<MobileAuthResponse>('/api/auth/supabase-sync', params);
  }

  async resolveInviteCode(code: string): Promise<MobileResolvedInvite | null> {
    const clean = code.trim();
    if (!clean) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/invites/resolve/${encodeURIComponent(clean)}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { ok?: boolean } & Partial<MobileResolvedInvite>;
      if (!data.ok || !data.inviterId || !data.inviterName || !data.code) return null;
      return {
        code: data.code,
        inviterId: data.inviterId,
        inviterName: data.inviterName,
        inviterAvatar: data.inviterAvatar,
        roomId: data.roomId ?? null,
        roomTitle: data.roomTitle ?? null,
        welcomeGold: data.welcomeGold ?? 500_000,
        referrerRewardGold: data.referrerRewardGold ?? 1_000_000,
      };
    } catch {
      return null;
    }
  }

  private async postPublic<T>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; data: T }> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  }

  async mutate<T extends Record<string, unknown> = Record<string, unknown>>(
    endpoint: string,
    body?: Record<string, unknown>,
    method: 'POST' | 'DELETE' = 'POST'
  ): Promise<{ ok: boolean; status: number; data: T; retryAfterSec?: number }> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(this.agency2faToken ? { 'X-Agency-2FA-Token': this.agency2faToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const retryHeader = Number(res.headers.get('Retry-After'));
    const data = (await res.json().catch(() => ({}))) as T;
    if (res.status === 403 && (data as { code?: string }).code === 'AGENCY_2FA_REQUIRED') {
      this.agency2faToken = '';
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      retryAfterSec:
        res.status === 429 && Number.isFinite(retryHeader) && retryHeader > 0
          ? retryHeader
          : undefined,
    };
  }

  async fetchAgency2FAStatus(): Promise<MobileAgency2FAStatus | null> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/agency/2fa/status`, {
        headers: {
          'Cache-Control': 'no-cache',
          Authorization: `Bearer ${this.token}`,
          ...(this.agency2faToken ? { 'X-Agency-2FA-Token': this.agency2faToken } : {}),
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as MobileAgency2FAStatus & { ok?: boolean };
      if (!data.verified) {
        this.agency2faToken = '';
      }
      return data;
    } catch {
      return null;
    }
  }

  async requestAgency2FA(
    channel: 'sms' | 'email',
    destination?: string
  ): Promise<{
    ok: boolean;
    error?: string;
    maskedDestination?: string;
    previewOtp?: string;
    cooldownSec?: number;
  }> {
    const res = await this.mutate<{
      ok?: boolean;
      error?: string;
      maskedDestination?: string;
      previewOtp?: string;
      cooldownSec?: number;
    }>('/api/agency/2fa/request', {
      channel,
      ...(destination ? { destination } : {}),
    });
    return {
      ok: res.ok && Boolean(res.data.ok),
      error: res.data.error,
      maskedDestination: res.data.maskedDestination,
      previewOtp: res.data.previewOtp,
      cooldownSec: res.data.cooldownSec,
    };
  }

  async verifyAgency2FA(code: string): Promise<{
    ok: boolean;
    error?: string;
    expiresAt?: number;
    remainingSec?: number;
  }> {
    const res = await this.mutate<{
      ok?: boolean;
      error?: string;
      token?: string;
      agency2faToken?: string;
      expiresAt?: number;
      remainingSec?: number;
    }>('/api/agency/2fa/verify', { code });
    const issuedToken = res.data.agency2faToken || res.data.token;
    if (res.ok && issuedToken) {
      this.agency2faToken = issuedToken;
    }
    return {
      ok: res.ok && Boolean(res.data.ok),
      error: res.data.error,
      expiresAt: res.data.expiresAt,
      remainingSec: res.data.remainingSec,
    };
  }

  async lockAgency2FA(): Promise<boolean> {
    const res = await this.mutate<{ ok?: boolean }>('/api/agency/2fa/lock', {});
    this.agency2faToken = '';
    return res.ok;
  }

  async fetchRoomsPage(
    page = 1,
    limit = 20,
    category?: string
  ): Promise<MobilePaginatedResponse<MobileVoiceRoom> | null> {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (category) params.set('category', category);
      const res = await fetch(`${API_BASE_URL}/api/rooms?${params.toString()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
      });
      if (!res.ok) return null;
      return (await res.json()) as MobilePaginatedResponse<MobileVoiceRoom>;
    } catch {
      return null;
    }
  }

  async verifyRoomPassword(
    roomId: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await this.mutate<{ ok?: boolean; error?: string }>(
      `/api/rooms/${encodeURIComponent(roomId)}/verify-password`,
      { password }
    );
    return { ok: res.ok && Boolean(res.data.ok), error: res.data.error };
  }

  async createInviteLink(roomId?: string): Promise<{
    invite?: MobileInviteLink;
    nativeDeepLink?: string;
    state?: MobileServerState;
  }> {
    const res = await this.mutate<{
      invite?: MobileInviteLink;
      nativeDeepLink?: string;
      state?: MobileServerState;
    }>('/api/invites/create', roomId ? { roomId } : {});
    return res.data;
  }

  async redeemInviteCode(code: string): Promise<{
    ok: boolean;
    targetRoomId?: string | null;
    state?: MobileServerState;
  }> {
    const res = await this.mutate<{
      targetRoomId?: string | null;
      state?: MobileServerState;
    }>(`/api/invites/${encodeURIComponent(code)}/redeem`);
    return { ok: res.ok, targetRoomId: res.data.targetRoomId, state: res.data.state };
  }

  async announceGameWinInRoom(
    roomId: string,
    gameName: string,
    icon: string,
    payout: number
  ): Promise<MobileServerState | undefined> {
    const res = await this.mutate<{ state?: MobileServerState }>(
      `/api/rooms/${encodeURIComponent(roomId)}/game-win`,
      { gameName, icon, payout }
    );
    return res.data.state;
  }

  async fetchNotifications(): Promise<{
    notifications: MobileInAppNotification[];
    unreadCount: number;
    followedRoomIds: string[];
    preferences: MobileNotificationPrefs;
  } | null> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: {
          'Cache-Control': 'no-cache',
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (!res.ok) return null;
      return (await res.json()) as {
        notifications: MobileInAppNotification[];
        unreadCount: number;
        followedRoomIds: string[];
        preferences: MobileNotificationPrefs;
      };
    } catch {
      return null;
    }
  }

  async markNotificationRead(notificationId: string): Promise<boolean> {
    const res = await this.mutate(
      `/api/notifications/${encodeURIComponent(notificationId)}/read`,
      {}
    );
    return res.ok;
  }

  async markAllNotificationsRead(): Promise<boolean> {
    const res = await this.mutate('/api/notifications/read-all', {});
    return res.ok;
  }

  async toggleFollowRoom(roomId: string): Promise<{
    ok: boolean;
    following?: boolean;
    followedRoomIds?: string[];
  }> {
    const res = await this.mutate<{
      ok?: boolean;
      following?: boolean;
      followedRoomIds?: string[];
    }>(`/api/rooms/${encodeURIComponent(roomId)}/follow`, {});
    return {
      ok: res.ok && Boolean(res.data.ok),
      following: res.data.following,
      followedRoomIds: res.data.followedRoomIds,
    };
  }

  async startRoomLiveBroadcast(
    roomId: string,
    topic?: string
  ): Promise<{ ok: boolean; notifiedCount?: number; state?: MobileServerState }> {
    const res = await this.mutate<{
      ok?: boolean;
      notifiedCount?: number;
      state?: MobileServerState;
    }>(`/api/rooms/${encodeURIComponent(roomId)}/live/start`, { topic: topic || '' });
    return {
      ok: res.ok && Boolean(res.data.ok),
      notifiedCount: res.data.notifiedCount,
      state: res.data.state,
    };
  }
}

export const mobileApi = new RiyadhChatApiClient();
