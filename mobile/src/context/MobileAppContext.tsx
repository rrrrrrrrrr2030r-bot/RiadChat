import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type {
  MobileAgency2FAStatus,
  MobileAuthActionResult,
  MobileGoogleHint,
  MobileInAppNotification,
  MobileInviteLink,
  MobileServerState,
  MobileUser,
  MobileVoiceRoom,
  UnifiedRbacResult,
} from '../types';
import { useQueryClient } from '@tanstack/react-query';
import {
  buildWsUrl,
  mobileApi,
  type MobileAuthResponse,
} from '../services/api';
import {
  MOBILE_QUERY_KEYS,
  MOBILE_STALE_TIME_MS,
  clearMobileSessionQueries,
  hydrateMobileServerStateCache,
  mergeRoomMessagesIdempotently,
  patchMobileRoomSeatsAndMessagesInCache,
  patchMobileRoomSpeakingInCache,
  type MobileRoomSeatsSyncPayload,
} from '../services/queryClient';
import {
  clearPendingReferral,
  clearSavedGoogleHint,
  clearSavedSessionToken,
  clearSavedSupabaseSession,
  clearSavedUserId,
  loadBiometricLockEnabled,
  loadPendingReferral,
  loadSavedGoogleHint,
  loadSavedSessionToken,
  loadSavedSupabaseSession,
  openExternalUrl,
  saveBiometricLockEnabled,
  saveGoogleHint,
  savePendingReferral,
  saveSessionToken,
  saveSupabaseSession,
  saveUserId,
  shareNativeInviteLink,
  subscribeDeepLinks,
  triggerNativeHaptic,
} from '../services/nativeBridge';
import {
  authenticateWithBiometrics,
  getBiometricCapabilities,
} from '../services/biometricAuth';
import {
  MOBILE_SUPABASE_REDIRECT_URL,
  PRIMARY_OWNER_EMAIL,
  PUBLIC_INVITE_BASE_URL,
  bindPrimaryOwnerInSupabase,
  bindSupabaseAppStateAutoRefresh,
  completeSupabaseOAuthCallback,
  isMobileSupabaseConfigured,
  mobileSupabase,
  restoreOrRefreshSupabaseSession,
  verifyOwnerIdentityInSupabase,
} from '../services/supabase';

export const PRIMARY_ADMIN_ID = '900';

export function isPrimaryAdminUser(user?: Pick<MobileUser, 'id'> | null): boolean {
  return Boolean(user && user.id === PRIMARY_ADMIN_ID);
}

export function isApprovedAgentUser(
  user?: Pick<MobileUser, 'id' | 'isVerifiedAgent'> | null
): boolean {
  return Boolean(user && (user.id === PRIMARY_ADMIN_ID || user.isVerifiedAgent === true));
}

export type MobileWsConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface MobileAppContextValue {
  state: MobileServerState | null;
  loading: boolean;
  connected: boolean;
  connectionStatus: MobileWsConnectionStatus;
  wsLatencyMs: number | null;
  wsReconnectAttempt: number;
  reconnectWebSocket: () => void;
  syncActiveRoomSeatsSilently: () => void;
  emitRoomSpeaking: (roomId: string, seatNumber: number, isSpeaking: boolean) => void;
  currentUser: MobileUser | null;
  isPrimaryAdmin: boolean;
  isApprovedAgent: boolean;
  rbacChecking: boolean;
  isAuthenticated: boolean;
  authLoading: boolean;
  isSupabaseEnabled: boolean;
  supabaseSession: Session | null;
  pendingReferralCode: string | null;
  activeRoomId: string | null;
  activeRoom: MobileVoiceRoom | null;
  loginWithEmail: (email: string, password: string) => Promise<MobileAuthActionResult>;
  registerWithEmail: (
    name: string,
    email: string,
    password: string,
    referralCode?: string
  ) => Promise<MobileAuthActionResult>;
  sendPhoneOtp: (phone: string) => Promise<MobileAuthActionResult>;
  verifyPhoneOtp: (
    phone: string,
    code: string,
    name?: string,
    referralCode?: string
  ) => Promise<MobileAuthActionResult>;
  lastGoogleHint: MobileGoogleHint | null;
  clearGoogleHint: () => Promise<void>;
  loginWithGoogle: (options?: {
    name?: string;
    email?: string;
    referralCode?: string;
    switchAccount?: boolean;
  }) => Promise<MobileAuthActionResult>;
  loginWithFacebook: (options?: {
    name?: string;
    email?: string;
    referralCode?: string;
  }) => Promise<MobileAuthActionResult>;
  biometricSupported: boolean;
  biometricEnabled: boolean;
  biometricLabel: string;
  biometricIcon: string;
  hasPersistedSession: boolean;
  canUseBiometricQuickLogin: boolean;
  loginWithBiometrics: () => Promise<MobileAuthActionResult>;
  toggleBiometricLock: () => Promise<void>;
  logoutAccount: () => Promise<void>;
  verifyUnifiedOwnerAndAgentRbac: (options?: {
    session?: Session | null;
    forceServerRefresh?: boolean;
  }) => Promise<UnifiedRbacResult>;
  verifyAndBindPrimaryAdmin: (credentials: {
    email?: string | null;
    password?: string | null;
  }) => Promise<boolean>;
  revalidateSessionAndRbac: () => Promise<boolean>;
  approveAgencyRequestAsAdmin: (requestId: string) => Promise<boolean>;
  rejectAgencyRequestAsAdmin: (requestId: string) => Promise<boolean>;
  boostRoomAsAdmin: (roomId: string) => Promise<boolean>;
  boostAllRoomsAsAdmin: () => Promise<boolean>;
  addTreasuryGoldAsAdmin: (goldAmount: number) => Promise<boolean>;
  updateGlobalAnnouncementAsAdmin: (text: string) => Promise<boolean>;
  enterRoom: (roomId: string) => void;
  leaveRoom: () => void;
  toggleSeat: (roomId: string, seatNumber: number) => Promise<void>;
  toggleMute: (roomId: string, seatNumber: number) => Promise<void>;
  sendRoomMessage: (roomId: string, text: string) => Promise<void>;
  sendRoomGift: (roomId: string, giftId: string, recipientId?: string) => Promise<void>;
  placeGameBet: (amount: number) => Promise<boolean>;
  settleGameWin: (gameName: string, icon: string, payout: number) => Promise<void>;
  createAndShareInvite: (roomId?: string) => Promise<MobileInviteLink | null>;
  redeemInvite: (code: string) => Promise<string | null>;
  refreshState: (options?: { force?: boolean }) => Promise<void>;
  agency2faStatus: MobileAgency2FAStatus | null;
  refreshAgency2FAStatus: () => Promise<MobileAgency2FAStatus | null>;
  requestAgency2FA: (
    channel: 'sms' | 'email',
    destination?: string
  ) => Promise<{
    ok: boolean;
    error?: string;
    maskedDestination?: string;
    previewOtp?: string;
    cooldownSec?: number;
  }>;
  verifyAgency2FA: (code: string) => Promise<{ ok: boolean; error?: string }>;
  lockAgency2FA: () => Promise<void>;
  notifications: MobileInAppNotification[];
  unreadNotificationsCount: number;
  followedRoomIds: string[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  toggleFollowRoom: (roomId: string) => Promise<boolean>;
  startRoomLiveBroadcast: (roomId: string, topic?: string) => Promise<boolean>;
}

const MobileAppContext = createContext<MobileAppContextValue | null>(null);

export const MobileAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<MobileServerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<MobileWsConnectionStatus>('reconnecting');
  const [wsLatencyMs, setWsLatencyMs] = useState<number | null>(null);
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState(0);
  const [currentUserId, setCurrentUserId] = useState('');
  const [verifiedPrimaryAdmin, setVerifiedPrimaryAdmin] = useState(false);
  const [verifiedApprovedAgent, setVerifiedApprovedAgent] = useState(false);
  const [rbacChecking, setRbacChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [lastGoogleHint, setLastGoogleHint] = useState<MobileGoogleHint | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [biometricLabel, setBiometricLabel] = useState('البصمة أو التعرف على الوجه');
  const [biometricIcon, setBiometricIcon] = useState('🔐');
  const [hasPersistedSession, setHasPersistedSession] = useState(false);
  const [agency2faStatus, setAgency2faStatus] = useState<MobileAgency2FAStatus | null>(null);
  const [notifications, setNotifications] = useState<MobileInAppNotification[]>([]);
  const [followedRoomIds, setFollowedRoomIds] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const wsGenerationRef = useRef(0);
  const wsReconnectRef = useRef<
    ((options?: { immediate?: boolean; forceReset?: boolean }) => void) | null
  >(null);
  const pendingSpeakingRef = useRef<{
    roomId: string;
    seatNumber: number;
    userId: string;
    isSpeaking: boolean;
  } | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const isAuthenticatedRef = useRef(false);
  const biometricGateLockedRef = useRef(false);
  const lastSyncedSupabaseUidRef = useRef<string | null>(null);
  const rbacInFlightRef = useRef<Promise<UnifiedRbacResult> | null>(null);

  useEffect(() => {
    void loadSavedGoogleHint().then((hint) => {
      if (hint) setLastGoogleHint(hint);
    });
  }, []);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  /**
   * Synchronizes Supabase Session across React state and persistent AsyncStorage
   * so authenticated users stay signed in after full app termination.
   * Never stores privileged RBAC flags locally; Owner/Agent roles are verified live from server.
   */
  const persistSupabaseSession = useCallback(async (session: Session | null): Promise<void> => {
    setSupabaseSession(session);
    if (session?.access_token && session?.refresh_token && session?.user?.id) {
      await saveSupabaseSession(session);
    } else {
      await clearSavedSupabaseSession();
    }
  }, []);

  const refreshState = useCallback(
    async (options?: { force?: boolean }) => {
      try {
        const fresh = await queryClient.fetchQuery({
          queryKey: MOBILE_QUERY_KEYS.serverState,
          queryFn: () => mobileApi.fetchState(),
          staleTime: options?.force ? 0 : MOBILE_STALE_TIME_MS,
        });
        setState(fresh);
        hydrateMobileServerStateCache(queryClient, fresh);
      } catch {
        // Keep previous cached state on transient network failure
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const applyRbacFlags = useCallback(
    (user?: Pick<MobileUser, 'id' | 'isVerifiedAgent'> | null): {
      isPrimaryAdmin: boolean;
      isApprovedAgent: boolean;
    } => {
      const adminAllowed = isPrimaryAdminUser(user);
      const agentAllowed = isApprovedAgentUser(user);
      setVerifiedPrimaryAdmin(adminAllowed);
      setVerifiedApprovedAgent(agentAllowed);
      return { isPrimaryAdmin: adminAllowed, isApprovedAgent: agentAllowed };
    },
    []
  );

  const applyAuthenticatedPayload = useCallback(
    async (payload: MobileAuthResponse, showWelcomeAlert = false) => {
      if (payload.token) {
        mobileApi.setSessionToken(payload.token);
        await saveSessionToken(payload.token);
      }

      if (payload.user?.id) {
        setCurrentUserId(payload.user.id);
        mobileApi.setCurrentUserId(payload.user.id);
        await saveUserId(payload.user.id);
        applyRbacFlags(payload.user);
      } else {
        applyRbacFlags(null);
      }

      if (payload.state) {
        setState(payload.state);
        hydrateMobileServerStateCache(queryClient, payload.state);
        setLoading(false);
      } else {
        await refreshState();
      }

      biometricGateLockedRef.current = false;
      setHasPersistedSession(true);
      setIsAuthenticated(true);
      setAuthLoading(false);
      // Silently re-establish WebSocket using the freshly issued session token
      wsReconnectRef.current?.({ immediate: true, forceReset: true });

      const referralInfo = payload.referral || payload.referralResult;
      if (referralInfo?.applied) {
        setPendingReferralCode(null);
        await clearPendingReferral();
        const targetRoom = referralInfo.targetRoomId || pendingRoomId;
        if (targetRoom) {
          setActiveRoomId(targetRoom);
          setPendingRoomId(null);
        }
        triggerNativeHaptic('success');
        if (showWelcomeAlert) {
          Alert.alert(
            'تم ربط رابط الدعوة بنجاح 🎉',
            `مرحباً بك في رياض شات! تم ربط حسابك بـ ${referralInfo.inviterName || 'صاحب الدعوة'} وإضافة +${(
              referralInfo.welcomeGold || 500_000
            ).toLocaleString('en-US')} ذهبية لرصيدك.`
          );
        }
      } else if (pendingRoomId) {
        setActiveRoomId(pendingRoomId);
        setPendingRoomId(null);
        await clearPendingReferral();
      }
    },
    [applyRbacFlags, pendingRoomId, queryClient, refreshState]
  );

  const syncSupabaseUserWithServer = useCallback(
    async (
      sbUser: SupabaseAuthUser,
      overrideName?: string,
      overrideReferral?: string,
      accessTokenOverride?: string
    ): Promise<MobileAuthActionResult> => {
      try {
        let accessToken = (accessTokenOverride || '').trim();
        if (!accessToken && mobileSupabase) {
          const { data } = await mobileSupabase.auth.getSession();
          accessToken = data.session?.access_token?.trim() || '';
        }
        if (!accessToken) {
          return {
            ok: false,
            error: 'جلسة التحقق غير مكتملة — يرجى إعادة تسجيل الدخول',
          };
        }

        const storedPending = await loadPendingReferral();
        const effectiveReferral =
          (overrideReferral || pendingReferralCode || storedPending.code || '').trim() || undefined;

        const metadata = (sbUser.user_metadata || {}) as Record<string, unknown>;
        const appMeta = (sbUser.app_metadata || {}) as Record<string, unknown>;
        const displayName =
          overrideName?.trim() ||
          (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
          (typeof metadata.name === 'string' && metadata.name.trim()) ||
          (sbUser.email ? sbUser.email.split('@')[0] : '') ||
          (sbUser.phone ? `عضو ${sbUser.phone.slice(-4)}` : 'عضو رياض شات');

        const avatar =
          (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
          (typeof metadata.picture === 'string' && metadata.picture) ||
          undefined;

        const provider =
          typeof appMeta.provider === 'string' && appMeta.provider
            ? appMeta.provider
            : 'supabase';

        const res = await mobileApi.syncSupabaseUser({
          accessToken,
          supabaseUid: sbUser.id,
          email: sbUser.email || undefined,
          phone: sbUser.phone || undefined,
          name: displayName,
          avatar,
          provider,
          referralCode: effectiveReferral,
        });

        if (!res.ok || !res.data.user || !res.data.token) {
          return {
            ok: false,
            error: res.data.error || 'تعذر مزامنة ملفك الشخصي مع خادم رياض شات',
          };
        }

        lastSyncedSupabaseUidRef.current = sbUser.id;
        if (provider === 'google' && sbUser.email) {
          const hint: MobileGoogleHint = {
            email: sbUser.email.trim().toLowerCase(),
            name: displayName || undefined,
          };
          setLastGoogleHint(hint);
          void saveGoogleHint(hint);
        }
        if (
          res.data.user.id === PRIMARY_ADMIN_ID ||
          (sbUser.email && sbUser.email.trim().toLowerCase() === PRIMARY_OWNER_EMAIL)
        ) {
          void bindPrimaryOwnerInSupabase({
            supabaseUid: sbUser.id,
            email: sbUser.email || PRIMARY_OWNER_EMAIL,
            name: res.data.user.name,
          });
        }
        await applyAuthenticatedPayload(res.data, Boolean(res.data.isNewUser));
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بخادم رياض شات لمزامنة الجلسة' };
      }
    },
    [applyAuthenticatedPayload, pendingReferralCode]
  );

  /**
   * Unified Owner (ID: 900) & Approved Agency RBAC Verification linked with Supabase + Backend.
   * Deduplicates concurrent calls and strictly fails closed on any session mismatch or error.
   */
  const verifyUnifiedOwnerAndAgentRbac = useCallback(
    async (options?: {
      session?: Session | null;
      forceServerRefresh?: boolean;
    }): Promise<UnifiedRbacResult> => {
      if (rbacInFlightRef.current && !options?.forceServerRefresh) {
        return rbacInFlightRef.current;
      }

      const task = (async (): Promise<UnifiedRbacResult> => {
        setRbacChecking(true);
        try {
          let supabaseLinked = false;

          // 1. Verify active Supabase session & owner/agent profile binding when Supabase is configured
          if (mobileSupabase) {
            const sbCheck = await verifyOwnerIdentityInSupabase(options?.session);
            if (sbCheck.authenticated && sbCheck.session?.user) {
              void persistSupabaseSession(sbCheck.session);
              supabaseLinked = true;
              const synced = await syncSupabaseUserWithServer(
                sbCheck.session.user,
                undefined,
                undefined,
                sbCheck.session.access_token
              );
              if (synced.ok) {
                const token = mobileApi.getSessionToken();
                if (token) {
                  const me = await mobileApi.fetchMe(token);
                  if (me.ok && me.user) {
                    const isOwnerConfirmed =
                      me.user.id === PRIMARY_ADMIN_ID &&
                      (!sbCheck.appUserId || sbCheck.appUserId === PRIMARY_ADMIN_ID);

                    if (isOwnerConfirmed && sbCheck.supabaseUid) {
                      void bindPrimaryOwnerInSupabase({
                        supabaseUid: sbCheck.supabaseUid,
                        email: sbCheck.email || PRIMARY_OWNER_EMAIL,
                        name: me.user.name,
                      });
                    }

                    setCurrentUserId(me.user.id);
                    mobileApi.setCurrentUserId(me.user.id);
                    if (me.state) setState(me.state);
                    setIsAuthenticated(true);

                    const flags = applyRbacFlags({
                      id: isOwnerConfirmed ? PRIMARY_ADMIN_ID : me.user.id,
                      isVerifiedAgent: isOwnerConfirmed || me.user.isVerifiedAgent === true,
                    });

                    return {
                      isPrimaryAdmin: flags.isPrimaryAdmin,
                      isApprovedAgent: flags.isApprovedAgent,
                      userId: me.user.id,
                      supabaseLinked: true,
                      source: 'supabase+server',
                    };
                  }
                }
              }
            }
          }

          // 2. Fallback / Authoritative Backend Verification via persistent Bearer token (/api/auth/me)
          const token = mobileApi.getSessionToken() || (await loadSavedSessionToken());
          if (!token) {
            applyRbacFlags(null);
            setIsAuthenticated(false);
            setCurrentUserId('');
            return {
              isPrimaryAdmin: false,
              isApprovedAgent: false,
              userId: null,
              supabaseLinked,
              source: 'none',
            };
          }

          const me = await mobileApi.fetchMe(token);
          if (me.ok && me.user) {
            setCurrentUserId(me.user.id);
            mobileApi.setCurrentUserId(me.user.id);
            if (me.state) setState(me.state);
            setIsAuthenticated(true);
            const flags = applyRbacFlags(me.user);
            return {
              isPrimaryAdmin: flags.isPrimaryAdmin,
              isApprovedAgent: flags.isApprovedAgent,
              userId: me.user.id,
              supabaseLinked,
              source: supabaseLinked ? 'supabase+server' : 'server',
            };
          }

          // Expired or revoked session -> immediately clear elevated access & sign out cleanly
          await Promise.all([clearSavedSessionToken(), clearSavedSupabaseSession()]);
          mobileApi.clearSession();
          setSupabaseSession(null);
          biometricGateLockedRef.current = false;
          setHasPersistedSession(false);
          applyRbacFlags(null);
          setIsAuthenticated(false);
          setCurrentUserId('');
          setActiveRoomId(null);
          return {
            isPrimaryAdmin: false,
            isApprovedAgent: false,
            userId: null,
            supabaseLinked: false,
            source: 'none',
          };
        } catch {
          // Strict fail-closed policy: never retain elevated admin/agency privileges on verification failure
          // Keep persisted AsyncStorage session intact during transient offline errors
          applyRbacFlags(null);
          return {
            isPrimaryAdmin: false,
            isApprovedAgent: false,
            userId: null,
            supabaseLinked: false,
            source: 'none',
          };
        } finally {
          setRbacChecking(false);
          rbacInFlightRef.current = null;
        }
      })();

      rbacInFlightRef.current = task;
      return task;
    },
    [applyRbacFlags, persistSupabaseSession, syncSupabaseUserWithServer]
  );

  // Backwards-compatible alias delegating directly to the unified verification function
  const revalidateSessionAndRbac = useCallback(async (): Promise<boolean> => {
    const result = await verifyUnifiedOwnerAndAgentRbac({ forceServerRefresh: true });
    return result.isPrimaryAdmin;
  }, [verifyUnifiedOwnerAndAgentRbac]);

  // 1. Bind Supabase AppState auto-refresh + Auth state change listener -> triggers unified RBAC verification
  useEffect(() => {
    if (!mobileSupabase) return;

    const unbindAppState = bindSupabaseAppStateAutoRefresh();
    const {
      data: { subscription },
    } = mobileSupabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        void persistSupabaseSession(session);
      } else if (event === 'SIGNED_OUT') {
        void persistSupabaseSession(null);
      }

      if (
        session?.user &&
        (event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED' ||
          event === 'INITIAL_SESSION')
      ) {
        // Never bypass an active biometric lock gate during cold-start INITIAL_SESSION
        if (event === 'INITIAL_SESSION' && biometricGateLockedRef.current) {
          return;
        }
        void verifyUnifiedOwnerAndAgentRbac({
          session,
          forceServerRefresh: event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED',
        });
      } else if (event === 'SIGNED_OUT') {
        lastSyncedSupabaseUidRef.current = null;
        biometricGateLockedRef.current = false;
        setHasPersistedSession(false);
        mobileApi.clearSession();
        void Promise.all([
          clearSavedSessionToken(),
          clearSavedUserId(),
          clearSavedSupabaseSession(),
        ]);
        setIsAuthenticated(false);
        applyRbacFlags(null);
        setCurrentUserId('');
        setActiveRoomId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      unbindAppState();
    };
  }, [applyRbacFlags, persistSupabaseSession, verifyUnifiedOwnerAndAgentRbac]);

  // 2. Boot session restore (Supabase + Saved Bearer Token), AppState resume RBAC + WebSocket auto-reconnect,
  //    Ping/Pong heartbeat, Exponential Backoff, and silent room/mic/message state resync
  useEffect(() => {
    const WS_INITIAL_RETRY_MS = 1000;
    const WS_MAX_RETRY_MS = 15000;
    const WS_HEARTBEAT_INTERVAL_MS = 15000;
    const WS_PONG_TIMEOUT_MS = 5000;
    const WS_RESUME_PROBE_TIMEOUT_MS = 3000;
    const INACTIVE_RESUME_THRESHOLD_MS = 3000;

    let alive = true;
    let retryAttempt = 0;
    let hasEverConnected = false;
    let lastConnectedToken = '';
    let lastAppState: AppStateStatus = AppState.currentState;
    let inactiveSinceMs: number | null = null;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const clearPongTimeout = () => {
      if (pongTimeoutTimer) {
        clearTimeout(pongTimeoutTimer);
        pongTimeoutTimer = null;
      }
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      clearPongTimeout();
    };

    const clearAllWsTimers = () => {
      clearReconnectTimer();
      stopHeartbeat();
    };

    const safeSendJson = (ws: WebSocket | null, payload: Record<string, unknown>): boolean => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        ws.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    };

    const requestAuthoritativeRoomAndStateSync = (ws: WebSocket | null) => {
      const roomId = activeRoomIdRef.current;
      if (roomId) {
        // Lightweight targeted reconciliation for active room seats, mics, and recent chat messages
        safeSendJson(ws, { type: 'room:seats:request', roomId });
        safeSendJson(ws, { type: 'room:telemetry:subscribe', roomId });
      }
      safeSendJson(ws, { type: 'state:request' });
    };

    const teardownCurrentSocket = () => {
      wsGenerationRef.current += 1;
      clearAllWsTimers();
      const existing = wsRef.current;
      wsRef.current = null;
      if (existing) {
        existing.onopen = null;
        existing.onmessage = null;
        existing.onerror = null;
        existing.onclose = null;
        try {
          if (
            existing.readyState === WebSocket.OPEN ||
            existing.readyState === WebSocket.CONNECTING
          ) {
            existing.close();
          }
        } catch {
          // Ignore close errors on already-dead mobile sockets
        }
      }
    };

    // Only pause WS loop in true background so transient iOS `inactive` sheets (Face ID / Control Center) keep mics live
    const isBackgrounded = () => lastAppState === 'background';

    const scheduleReconnect = () => {
      if (!alive) return;
      if (isBackgrounded()) {
        setConnectionStatus('disconnected');
        return;
      }

      clearReconnectTimer();
      const exponential = Math.min(
        WS_MAX_RETRY_MS,
        WS_INITIAL_RETRY_MS * Math.pow(2, retryAttempt)
      );
      const jitter = Math.floor(Math.random() * Math.min(600, Math.round(exponential * 0.2)));
      retryAttempt = Math.min(retryAttempt + 1, 6);
      setWsReconnectAttempt(retryAttempt);
      setConnectionStatus(retryAttempt >= 3 ? 'disconnected' : 'reconnecting');

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWs({ immediate: true });
      }, exponential + jitter);
    };

    const armPongDeadline = (ws: WebSocket, gen: number, timeoutMs: number) => {
      clearPongTimeout();
      pongTimeoutTimer = setTimeout(() => {
        pongTimeoutTimer = null;
        if (!alive || gen !== wsGenerationRef.current) return;
        // Silent zombie socket detected -> force clean teardown and reconnect immediately
        setConnected(false);
        setConnectionStatus('reconnecting');
        connectWs({ immediate: true, forceReset: true });
      }, timeoutMs);
    };

    const sendHeartbeatProbe = (ws: WebSocket, gen: number, timeoutMs: number) => {
      if (!alive || gen !== wsGenerationRef.current) return;
      if (isBackgrounded()) return;
      const sent = safeSendJson(ws, { type: 'ping', ts: Date.now() });
      if (!sent) {
        setConnected(false);
        setConnectionStatus('reconnecting');
        connectWs({ immediate: true, forceReset: true });
        return;
      }
      armPongDeadline(ws, gen, timeoutMs);
    };

    const startHeartbeat = (ws: WebSocket, gen: number) => {
      stopHeartbeat();
      heartbeatInterval = setInterval(() => {
        if (!alive || gen !== wsGenerationRef.current) {
          stopHeartbeat();
          return;
        }
        if (isBackgrounded()) return;
        sendHeartbeatProbe(ws, gen, WS_PONG_TIMEOUT_MS);
      }, WS_HEARTBEAT_INTERVAL_MS);
    };

    const connectWs = (options?: { immediate?: boolean; forceReset?: boolean }) => {
      if (!alive || isBackgrounded()) return;

      const currentToken = mobileApi.getSessionToken() || '';
      const existing = wsRef.current;

      if (
        !options?.forceReset &&
        existing &&
        (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING) &&
        lastConnectedToken === currentToken
      ) {
        return;
      }

      if (options?.forceReset) {
        retryAttempt = 0;
        setWsReconnectAttempt(0);
      }

      teardownCurrentSocket();
      const gen = wsGenerationRef.current;
      lastConnectedToken = currentToken;
      setConnectionStatus('reconnecting');

      try {
        const ws = new WebSocket(buildWsUrl(currentToken || undefined));
        wsRef.current = ws;

        ws.onopen = () => {
          if (!alive || gen !== wsGenerationRef.current) return;
          retryAttempt = 0;
          setWsReconnectAttempt(0);
          setConnected(true);
          setConnectionStatus('connected');
          startHeartbeat(ws, gen);
          requestAuthoritativeRoomAndStateSync(ws);

          // Flush latest pending mic speaking indicator queued during brief disconnect
          if (pendingSpeakingRef.current) {
            const pending = pendingSpeakingRef.current;
            pendingSpeakingRef.current = null;
            safeSendJson(ws, {
              type: 'room:speaking',
              roomId: pending.roomId,
              seatNumber: pending.seatNumber,
              userId: pending.userId,
              isSpeaking: pending.isSpeaking,
            });
          }

          // On reconnect after a previous session, force an authoritative HTTP refresh bypassing
          // React Query's 30s staleTime so mic seats and missed messages reconcile seamlessly
          if (hasEverConnected) {
            void refreshState({ force: true });
          }
          hasEverConnected = true;
        };

        ws.onmessage = (evt) => {
          if (!alive || gen !== wsGenerationRef.current) return;
          // Any valid frame received from the server confirms socket liveness
          clearPongTimeout();

          try {
            const msg = JSON.parse(String(evt.data)) as {
              type?: string;
              ts?: number;
              state?: MobileServerState;
              roomId?: string;
              seatNumber?: number;
              isSpeaking?: boolean;
              seats?: MobileVoiceRoom['seats'];
              messages?: MobileVoiceRoom['messages'];
              listeners?: number;
              heat?: number;
              isLocked?: boolean;
              notFound?: boolean;
              syncedAt?: number;
              notifications?: MobileInAppNotification[];
              notification?: MobileInAppNotification;
              followedRoomIds?: string[];
            };

            if (msg.type === 'pong') {
              if (typeof msg.ts === 'number') {
                setWsLatencyMs(Math.max(1, Date.now() - msg.ts));
              }
              return;
            }

            if (msg.type === 'notifications:init') {
              if (Array.isArray(msg.notifications)) setNotifications(msg.notifications);
              if (Array.isArray(msg.followedRoomIds)) setFollowedRoomIds(msg.followedRoomIds);
              return;
            }

            if (msg.type === 'notification:new' && msg.notification) {
              const incomingNotif = msg.notification;
              setNotifications((prev) => {
                if (prev.some((n) => n.id === incomingNotif.id)) return prev;
                return [incomingNotif, ...prev].slice(0, 60);
              });
              if (activeRoomIdRef.current !== incomingNotif.roomId) {
                triggerNativeHaptic('light');
              }
              return;
            }

            if (msg.type === 'room:seats:sync' && msg.roomId) {
              const syncPayload: MobileRoomSeatsSyncPayload = {
                roomId: msg.roomId,
                seats: msg.seats,
                messages: msg.messages,
                listeners: msg.listeners,
                heat: msg.heat,
                isLocked: msg.isLocked,
                notFound: msg.notFound,
                syncedAt: msg.syncedAt,
              };
              patchMobileRoomSeatsAndMessagesInCache(queryClient, syncPayload);

              if (msg.notFound) {
                setState((prev) =>
                  prev
                    ? { ...prev, rooms: prev.rooms.filter((r) => r.id !== msg.roomId) }
                    : prev
                );
                if (activeRoomIdRef.current === msg.roomId) {
                  setActiveRoomId(null);
                }
                return;
              }

              setState((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  rooms: prev.rooms.map((room) =>
                    room.id === msg.roomId
                      ? {
                          ...room,
                          seats: Array.isArray(msg.seats) ? msg.seats : room.seats,
                          messages: Array.isArray(msg.messages)
                            ? mergeRoomMessagesIdempotently(room.messages, msg.messages)
                            : room.messages,
                          listeners:
                            typeof msg.listeners === 'number' ? msg.listeners : room.listeners,
                          heat: typeof msg.heat === 'number' ? msg.heat : room.heat,
                          isLocked:
                            typeof msg.isLocked === 'boolean' ? msg.isLocked : room.isLocked,
                        }
                      : room
                  ),
                };
              });
              return;
            }

            if (msg.type === 'state:sync' && msg.state) {
              setState(msg.state);
              hydrateMobileServerStateCache(queryClient, msg.state);
              // Keep user inside their active room unless that room no longer exists on server
              if (
                activeRoomIdRef.current &&
                !msg.state.rooms.some((r) => r.id === activeRoomIdRef.current)
              ) {
                setActiveRoomId(null);
              }
              return;
            }

            if (
              msg.type === 'room:speaking' &&
              msg.roomId &&
              typeof msg.seatNumber === 'number'
            ) {
              const targetRoomId = msg.roomId;
              const targetSeatNumber = msg.seatNumber;
              const speaking = Boolean(msg.isSpeaking);
              patchMobileRoomSpeakingInCache(
                queryClient,
                targetRoomId,
                targetSeatNumber,
                speaking
              );
              setState((prev) => {
                if (!prev) return prev;
                let changed = false;
                const nextRooms = prev.rooms.map((room) => {
                  if (room.id !== targetRoomId) return room;
                  const nextSeats = room.seats.map((seat) => {
                    if (seat.seatNumber !== targetSeatNumber || seat.isSpeaking === speaking) {
                      return seat;
                    }
                    changed = true;
                    return { ...seat, isSpeaking: speaking };
                  });
                  return changed ? { ...room, seats: nextSeats } : room;
                });
                return changed ? { ...prev, rooms: nextRooms } : prev;
              });
            }
          } catch {
            // Ignore malformed WS frames
          }
        };

        ws.onclose = () => {
          if (!alive || gen !== wsGenerationRef.current) return;
          clearAllWsTimers();
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
          setConnected(false);
          scheduleReconnect();
        };

        ws.onerror = () => {
          if (!alive || gen !== wsGenerationRef.current) return;
          setConnected(false);
          setConnectionStatus(retryAttempt >= 3 ? 'disconnected' : 'reconnecting');
          // Force close so broken mobile sockets always transition cleanly into reconnect
          try {
            ws.close();
          } catch {
            // Ignore close failure
          }
        };
      } catch {
        if (alive && gen === wsGenerationRef.current) {
          setConnected(false);
          scheduleReconnect();
        }
      }
    };

    wsReconnectRef.current = connectWs;

    const handleForegroundResume = () => {
      if (!alive) return;
      retryAttempt = 0;
      setWsReconnectAttempt(0);

      // 1. Restore/auto-refresh persisted AsyncStorage Supabase session, then re-verify Owner (ID: 900) & Agent RBAC
      //    Skip silent session unlock if user is currently locked at the biometric gate on AuthScreen
      if (!biometricGateLockedRef.current) {
        void (async () => {
          let resumedSession: Session | null = null;
          if (mobileSupabase) {
            const cached = await loadSavedSupabaseSession();
            const restored = await restoreOrRefreshSupabaseSession(cached);
            if (restored.status === 'valid' || restored.status === 'refreshed') {
              resumedSession = restored.session;
              if (alive) await persistSupabaseSession(restored.session);
            } else if (restored.status === 'revoked') {
              if (alive) await persistSupabaseSession(null);
            } else if (restored.status === 'offline' && restored.session) {
              resumedSession = restored.session;
            }
          }
          if (alive) {
            await verifyUnifiedOwnerAndAgentRbac({
              session: resumedSession,
              forceServerRefresh: true,
            });
          }
        })();
      }
      // Force silent HTTP resync bypassing 30s React Query staleTime on foreground return
      void refreshState({ force: true });

      // 2. Inspect existing WebSocket: revive closed sockets immediately, or actively probe open sockets
      //    with a short 3s Ping/Pong deadline to catch background zombie TCP connections instantly
      const ws = wsRef.current;
      const gen = wsGenerationRef.current;
      const currentToken = mobileApi.getSessionToken() || '';

      if (
        !ws ||
        ws.readyState === WebSocket.CLOSED ||
        ws.readyState === WebSocket.CLOSING ||
        lastConnectedToken !== currentToken
      ) {
        connectWs({ immediate: true, forceReset: true });
        return;
      }

      if (ws.readyState === WebSocket.CONNECTING) {
        armPongDeadline(ws, gen, WS_RESUME_PROBE_TIMEOUT_MS);
        return;
      }

      if (ws.readyState === WebSocket.OPEN) {
        startHeartbeat(ws, gen);
        sendHeartbeatProbe(ws, gen, WS_RESUME_PROBE_TIMEOUT_MS);
        requestAuthoritativeRoomAndStateSync(ws);
      }
    };

    const boot = async () => {
      try {
        const [
          pending,
          savedToken,
          cachedSupabaseSession,
          biometricCaps,
          biometricPref,
        ] = await Promise.all([
          loadPendingReferral(),
          loadSavedSessionToken(),
          loadSavedSupabaseSession(),
          getBiometricCapabilities(),
          loadBiometricLockEnabled(),
        ]);

        const hasExistingAsyncSession = Boolean(savedToken || cachedSupabaseSession);

        if (alive) {
          if (pending.code) setPendingReferralCode(pending.code);
          if (pending.roomId) setPendingRoomId(pending.roomId);
          setBiometricSupported(biometricCaps.available);
          setBiometricLabel(biometricCaps.label);
          setBiometricIcon(biometricCaps.icon);
          setBiometricEnabled(biometricPref);
          setHasPersistedSession(hasExistingAsyncSession);
        }

        // Biometric Quick Login gate: strictly activated ONLY when a pre-existing session exists in AsyncStorage
        if (hasExistingAsyncSession && biometricCaps.available && biometricPref) {
          biometricGateLockedRef.current = true;
          const bioResult = await authenticateWithBiometrics(
            `تأكيد ${biometricCaps.label} لفتح جلستك المحفوظة في رياض شات`
          );
          if (!bioResult.success) {
            // Keep persisted session in AsyncStorage so user can retry via quick-login button or sign in manually
            if (alive) {
              applyRbacFlags(null);
              setIsAuthenticated(false);
              setCurrentUserId('');
              await refreshState();
            }
            return;
          }
          biometricGateLockedRef.current = false;
        }

        if (alive && cachedSupabaseSession) {
          setSupabaseSession(cachedSupabaseSession);
        }

        if (savedToken) {
          mobileApi.setSessionToken(savedToken);
        }

        // Restore & auto-refresh expired Supabase tokens in background; only clear AsyncStorage on explicit rejection
        let hydratedSession: Session | null = cachedSupabaseSession;
        if (mobileSupabase) {
          const restored = await restoreOrRefreshSupabaseSession(cachedSupabaseSession);
          if (restored.status === 'valid' || restored.status === 'refreshed') {
            hydratedSession = restored.session;
            if (alive) {
              await persistSupabaseSession(restored.session);
            }
          } else if (restored.status === 'revoked') {
            hydratedSession = null;
            if (alive) {
              await persistSupabaseSession(null);
            }
          } else if (restored.status === 'offline' && restored.session) {
            hydratedSession = restored.session;
          }
        }

        // Always verify Owner (ID: 900) & Approved Agency privileges live with server (never cached)
        const rbacRes = await verifyUnifiedOwnerAndAgentRbac({
          session: hydratedSession,
          forceServerRefresh: true,
        });
        if (alive && !rbacRes.userId && !savedToken && !hydratedSession) {
          setHasPersistedSession(false);
        }
        await refreshState();
      } finally {
        if (alive) {
          setAuthLoading(false);
          setLoading(false);
          // Ensure socket uses the restored session token once boot finishes
          connectWs({ immediate: true });
        }
      }
    };

    // Listen for background <-> foreground transitions to prevent dropped mic/message streams
    // Keeps socket alive during brief iOS `inactive` flashes (Face ID / Control Center),
    // pauses timers only in true `background`, and runs silent seat/message reconciliation on return.
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = lastAppState;
      lastAppState = nextState;

      if (!alive) return;

      if (nextState === 'background') {
        inactiveSinceMs = null;
        clearAllWsTimers();
        return;
      }

      if (nextState === 'inactive') {
        if (inactiveSinceMs === null) {
          inactiveSinceMs = Date.now();
        }
        return;
      }

      if (nextState === 'active') {
        const wasExtendedInactive =
          prevState === 'inactive' &&
          inactiveSinceMs !== null &&
          Date.now() - inactiveSinceMs >= INACTIVE_RESUME_THRESHOLD_MS;
        inactiveSinceMs = null;

        if (prevState === 'background' || wasExtendedInactive) {
          handleForegroundResume();
        }
      }
    });

    void boot();
    connectWs({ immediate: true });

    return () => {
      alive = false;
      wsReconnectRef.current = null;
      appStateSub.remove();
      teardownCurrentSocket();
    };
  }, [persistSupabaseSession, refreshState, verifyUnifiedOwnerAndAgentRbac]);

  const redeemInvite = useCallback(async (code: string): Promise<string | null> => {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    if (!isAuthenticatedRef.current) {
      setPendingReferralCode(clean);
      await savePendingReferral(clean, null);
      return null;
    }
    const res = await mobileApi.redeemInviteCode(clean);
    if (res.ok && res.state) {
      setState(res.state);
      triggerNativeHaptic('success');
      if (res.targetRoomId) {
        setActiveRoomId(res.targetRoomId);
      }
      Alert.alert(
        'تم تفعيل رابط الدعوة 🎉',
        'مرحباً بك في رياض شات! تمت إضافة +500,000 ذهبية ترحيبية إلى رصيدك.'
      );
      return res.targetRoomId || null;
    }
    Alert.alert('كود غير صالح', 'تحقق من صحة رابط أو كود الدعوة ثم حاول مرة أخرى.');
    return null;
  }, []);

  // 3. Intercept deep-links: Supabase OAuth callbacks (Facebook) + Invite & Room links
  useEffect(() => {
    return subscribeDeepLinks(({ rawUrl, inviteCode, roomId, isAuthCallback }) => {
      if (isAuthCallback && rawUrl) {
        void completeSupabaseOAuthCallback(rawUrl).then((result) => {
          if (result.error) {
            Alert.alert('تعذر تسجيل الدخول', result.error);
          } else if (result.session?.user) {
            void persistSupabaseSession(result.session);
            void syncSupabaseUserWithServer(
              result.session.user,
              undefined,
              undefined,
              result.session.access_token
            );
          }
        });
        return;
      }

      if (inviteCode) {
        if (isAuthenticatedRef.current) {
          void redeemInvite(inviteCode).then((joinedRoomId) => {
            if (!joinedRoomId && roomId) {
              setActiveRoomId(roomId);
            }
          });
        } else {
          setPendingReferralCode(inviteCode);
          if (roomId) setPendingRoomId(roomId);
          void savePendingReferral(inviteCode, roomId);
        }
      } else if (roomId) {
        if (isAuthenticatedRef.current) {
          setActiveRoomId(roomId);
        } else {
          setPendingRoomId(roomId);
          void savePendingReferral(null, roomId);
        }
      }
    });
  }, [persistSupabaseSession, redeemInvite, syncSupabaseUserWithServer]);

  // 4. Real Authentication Actions (Email, Phone OTP, Facebook + Supabase Sync)
  const verifyAndBindPrimaryAdmin = useCallback(
    async (credentials: {
      email?: string | null;
      password?: string | null;
    }): Promise<boolean> => {
      const normalizedEmail = String(credentials.email || '').trim().toLowerCase();
      const rawPassword = String(credentials.password || '');

      if (normalizedEmail !== PRIMARY_OWNER_EMAIL || !rawPassword) {
        setVerifiedPrimaryAdmin(false);
        return false;
      }

      // Authenticate strictly against server/Supabase — never validate passwords client-side
      const serverRes = await mobileApi.loginWithEmail({
        email: PRIMARY_OWNER_EMAIL,
        password: rawPassword,
      });
      if (
        serverRes.ok &&
        serverRes.data.user &&
        serverRes.data.token &&
        serverRes.data.user.id === PRIMARY_ADMIN_ID
      ) {
        setVerifiedPrimaryAdmin(true);
        await applyAuthenticatedPayload(serverRes.data);

        if (mobileSupabase) {
          try {
            const signInRes = await mobileSupabase.auth.signInWithPassword({
              email: PRIMARY_OWNER_EMAIL,
              password: rawPassword,
            });
            if (!signInRes.error && signInRes.data.user && signInRes.data.session) {
              await persistSupabaseSession(signInRes.data.session);
              await bindPrimaryOwnerInSupabase({
                supabaseUid: signInRes.data.user.id,
                email: PRIMARY_OWNER_EMAIL,
                name: serverRes.data.user.name || 'رياض | Riad',
              });
            }
          } catch {
            // Server authentication already succeeded
          }
        }
        return true;
      }

      if (mobileSupabase) {
        try {
          const signInRes = await mobileSupabase.auth.signInWithPassword({
            email: PRIMARY_OWNER_EMAIL,
            password: rawPassword,
          });
          const accessToken = signInRes.data.session?.access_token;
          if (!signInRes.error && signInRes.data.user && accessToken) {
            await persistSupabaseSession(signInRes.data.session ?? null);
            const synced = await mobileApi.syncSupabaseUser({
              accessToken,
              supabaseUid: signInRes.data.user.id,
              email: PRIMARY_OWNER_EMAIL,
              name: 'رياض | Riad',
              provider: 'email',
            });
            if (
              synced.ok &&
              synced.data.user &&
              synced.data.token &&
              synced.data.user.id === PRIMARY_ADMIN_ID
            ) {
              setVerifiedPrimaryAdmin(true);
              lastSyncedSupabaseUidRef.current = signInRes.data.user.id;
              await bindPrimaryOwnerInSupabase({
                supabaseUid: signInRes.data.user.id,
                email: PRIMARY_OWNER_EMAIL,
                name: synced.data.user.name || 'رياض | Riad',
              });
              await applyAuthenticatedPayload(synced.data);
              return true;
            }
          }
        } catch {
          // Fall through to fail closed
        }
      }

      setVerifiedPrimaryAdmin(false);
      return false;
    },
    [applyAuthenticatedPayload, persistSupabaseSession]
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<MobileAuthActionResult> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        return { ok: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
      }

      if (cleanEmail === PRIMARY_OWNER_EMAIL) {
        const bound = await verifyAndBindPrimaryAdmin({ email: cleanEmail, password });
        if (bound) {
          return { ok: true };
        }
        return { ok: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      }

      if (mobileSupabase && cleanEmail.includes('@')) {
        try {
          const { data, error } = await mobileSupabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (!error && data.user && data.session?.access_token) {
            await persistSupabaseSession(data.session);
            const synced = await syncSupabaseUserWithServer(
              data.user,
              undefined,
              undefined,
              data.session.access_token
            );
            if (synced.ok) return synced;
          }
        } catch {
          // Fall back smoothly to Riyadh Chat server auth
        }
      }

      const res = await mobileApi.loginWithEmail({ email: cleanEmail, password });
      if (!res.ok || !res.data.user || !res.data.token) {
        return { ok: false, error: res.data.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      }
      await applyAuthenticatedPayload(res.data);
      return { ok: true };
    },
    [
      applyAuthenticatedPayload,
      persistSupabaseSession,
      syncSupabaseUserWithServer,
      verifyAndBindPrimaryAdmin,
    ]
  );

  const registerWithEmail = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      referralCode?: string
    ): Promise<MobileAuthActionResult> => {
      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();
      const effectiveReferral = (referralCode || pendingReferralCode || '').trim() || undefined;

      if (cleanName.length < 2) {
        return { ok: false, error: 'يرجى إدخال الاسم الظاهر (حرفين على الأقل)' };
      }
      if (!cleanEmail.includes('@')) {
        return { ok: false, error: 'يرجى إدخال بريد إلكتروني صحيح' };
      }
      if (password.length < 6) {
        return { ok: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
      }

      if (effectiveReferral) {
        await savePendingReferral(effectiveReferral, pendingRoomId);
      }

      if (mobileSupabase) {
        try {
          const { data, error } = await mobileSupabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: cleanName,
                referral_code: effectiveReferral,
              },
            },
          });
          if (!error && data.user && data.session?.access_token) {
            await persistSupabaseSession(data.session);
            const synced = await syncSupabaseUserWithServer(
              data.user,
              cleanName,
              effectiveReferral,
              data.session.access_token
            );
            if (synced.ok) return synced;
          }
        } catch {
          // Fall back to Riyadh Chat persistent server registration on invalid Supabase key or network failure
        }
      }

      const res = await mobileApi.registerWithEmail({
        name: cleanName,
        email: cleanEmail,
        password,
        referralCode: effectiveReferral,
      });
      if (!res.ok || !res.data.user || !res.data.token) {
        return { ok: false, error: res.data.error || 'تعذر إنشاء الحساب' };
      }
      await applyAuthenticatedPayload(res.data, true);
      return { ok: true };
    },
    [
      applyAuthenticatedPayload,
      pendingReferralCode,
      pendingRoomId,
      persistSupabaseSession,
      syncSupabaseUserWithServer,
    ]
  );

  const sendPhoneOtp = useCallback(async (phone: string): Promise<MobileAuthActionResult> => {
    const cleanPhone = phone.trim();
    if (cleanPhone.replace(/\D/g, '').length < 8) {
      return { ok: false, error: 'يرجى إدخال رقم هاتف صحيح مع رمز الدولة' };
    }

    if (mobileSupabase) {
      try {
        const { error } = await mobileSupabase.auth.signInWithOtp({ phone: cleanPhone });
        if (!error) {
          return { ok: true };
        }
      } catch {
        // Fall back seamlessly to Riyadh Chat OTP
      }
    }

    const res = await mobileApi.sendPhoneOtp(cleanPhone);
    if (!res.ok) {
      return { ok: false, error: res.data.error || 'تعذر إرسال رمز التحقق' };
    }
    return { ok: true, previewOtp: res.data.previewOtp };
  }, []);

  const verifyPhoneOtp = useCallback(
    async (
      phone: string,
      code: string,
      name?: string,
      referralCode?: string
    ): Promise<MobileAuthActionResult> => {
      const cleanPhone = phone.trim();
      const cleanCode = code.trim();
      const effectiveReferral = (referralCode || pendingReferralCode || '').trim() || undefined;

      if (cleanCode.length < 6) {
        return { ok: false, error: 'أدخل رمز التحقق المكون من 6 أرقام' };
      }

      if (mobileSupabase) {
        try {
          const { data, error } = await mobileSupabase.auth.verifyOtp({
            phone: cleanPhone,
            token: cleanCode,
            type: 'sms',
          });
          if (!error && data.user && data.session?.access_token) {
            await persistSupabaseSession(data.session);
            const synced = await syncSupabaseUserWithServer(
              data.user,
              name,
              effectiveReferral,
              data.session.access_token
            );
            if (synced.ok) return synced;
          }
        } catch {
          // Fall back to server OTP verification
        }
      }

      const res = await mobileApi.verifyPhoneOtp({
        phone: cleanPhone,
        code: cleanCode,
        name: name?.trim() || undefined,
        referralCode: effectiveReferral,
      });
      if (!res.ok || !res.data.user || !res.data.token) {
        return { ok: false, error: res.data.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية' };
      }
      await applyAuthenticatedPayload(res.data, Boolean(res.data.isNewUser));
      return { ok: true };
    },
    [applyAuthenticatedPayload, pendingReferralCode, persistSupabaseSession, syncSupabaseUserWithServer]
  );

  const clearGoogleHint = useCallback(async () => {
    setLastGoogleHint(null);
    await clearSavedGoogleHint();
  }, []);

  const loginWithGoogle = useCallback(
    async (options?: {
      name?: string;
      email?: string;
      referralCode?: string;
      switchAccount?: boolean;
    }): Promise<MobileAuthActionResult> => {
      const effectiveReferral =
        (options?.referralCode || pendingReferralCode || '').trim() || undefined;
      if (effectiveReferral) {
        await savePendingReferral(effectiveReferral, pendingRoomId);
      }

      const cachedHint = options?.switchAccount
        ? null
        : lastGoogleHint || (await loadSavedGoogleHint());

      if (mobileSupabase && !options?.email) {
        try {
          // Disable forced Google account chooser by omitting `prompt: 'select_account'`
          // and passing cached `login_hint` for direct/automatic sign-in.
          const queryParams: Record<string, string> = {};
          if (options?.switchAccount) {
            queryParams.prompt = 'select_account';
          } else if (cachedHint?.email) {
            queryParams.login_hint = cachedHint.email;
          }
          const { data, error } = await mobileSupabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: MOBILE_SUPABASE_REDIRECT_URL,
              skipBrowserRedirect: true,
              ...(Object.keys(queryParams).length > 0 ? { queryParams } : {}),
            },
          });
          if (!error && data?.url) {
            const opened = await openExternalUrl(data.url);
            if (opened) {
              return { ok: true, redirected: true };
            }
          }
        } catch {
          // Fall back to direct server Google auth
        }
      }

      const cleanEmail = (options?.email || cachedHint?.email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return { ok: false, error: 'يرجى إدخال بريد حساب جوجل للمتابعة المباشرة' };
      }
      const cleanName =
        (options?.name || cachedHint?.name || '').trim() || cleanEmail.split('@')[0] || 'عضو جوجل';

      const res = await mobileApi.loginWithGoogle({
        googleId: `google_${cleanEmail}`,
        name: cleanName,
        email: cleanEmail,
        referralCode: effectiveReferral,
      });
      if (!res.ok || !res.data.user || !res.data.token) {
        return { ok: false, error: res.data.error || 'تعذر تسجيل الدخول عبر جوجل' };
      }
      const hint: MobileGoogleHint = { email: cleanEmail, name: cleanName };
      setLastGoogleHint(hint);
      await saveGoogleHint(hint);
      await applyAuthenticatedPayload(res.data, Boolean(res.data.isNewUser));
      return { ok: true };
    },
    [applyAuthenticatedPayload, lastGoogleHint, pendingReferralCode, pendingRoomId]
  );

  const loginWithFacebook = useCallback(
    async (options?: {
      name?: string;
      email?: string;
      referralCode?: string;
    }): Promise<MobileAuthActionResult> => {
      const effectiveReferral =
        (options?.referralCode || pendingReferralCode || '').trim() || undefined;
      if (effectiveReferral) {
        await savePendingReferral(effectiveReferral, pendingRoomId);
      }

      if (mobileSupabase && !options?.name) {
        try {
          const { data, error } = await mobileSupabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
              redirectTo: MOBILE_SUPABASE_REDIRECT_URL,
              skipBrowserRedirect: true,
            },
          });
          if (!error && data?.url) {
            const opened = await openExternalUrl(data.url);
            if (opened) {
              return { ok: true, redirected: true };
            }
          }
        } catch {
          // Fall back to built-in Facebook auth
        }
      }

      const res = await mobileApi.loginWithFacebook({
        name: options?.name?.trim() || 'عضو فيسبوك',
        email: options?.email?.trim() || undefined,
        referralCode: effectiveReferral,
      });
      if (!res.ok || !res.data.user || !res.data.token) {
        return { ok: false, error: res.data.error || 'تعذر تسجيل الدخول عبر فيسبوك' };
      }
      await applyAuthenticatedPayload(res.data, Boolean(res.data.isNewUser));
      return { ok: true };
    },
    [applyAuthenticatedPayload, pendingReferralCode, pendingRoomId]
  );

  const loginWithBiometrics = useCallback(async (): Promise<MobileAuthActionResult> => {
    const [savedToken, cachedSupabaseSession, caps] = await Promise.all([
      loadSavedSessionToken(),
      loadSavedSupabaseSession(),
      getBiometricCapabilities(),
    ]);

    // Strictly allow biometric quick-login ONLY for pre-existing sessions in AsyncStorage
    if (!savedToken && !cachedSupabaseSession) {
      setHasPersistedSession(false);
      biometricGateLockedRef.current = false;
      return {
        ok: false,
        error: 'لا توجد جلسة محفوظة مسبقاً لتفعيل الدخول بالبصمة',
      };
    }

    if (!caps.available) {
      setBiometricSupported(false);
      return {
        ok: false,
        error: 'المصادقة الحيوية غير مفعّلة على هذا الجهاز',
      };
    }

    const promptRes = await authenticateWithBiometrics(
      `تأكيد ${caps.label} للدخول السريع إلى رياض شات`
    );
    if (!promptRes.success) {
      return {
        ok: false,
        error: promptRes.error || 'تم إلغاء التحقق الحيوي',
      };
    }

    biometricGateLockedRef.current = false;
    if (savedToken) {
      mobileApi.setSessionToken(savedToken);
    }

    let hydratedSession: Session | null = cachedSupabaseSession;
    if (mobileSupabase && cachedSupabaseSession) {
      const restored = await restoreOrRefreshSupabaseSession(cachedSupabaseSession);
      if (restored.status === 'valid' || restored.status === 'refreshed') {
        hydratedSession = restored.session;
        await persistSupabaseSession(restored.session);
      } else if (restored.status === 'revoked') {
        hydratedSession = null;
        await persistSupabaseSession(null);
      } else if (restored.status === 'offline' && restored.session) {
        hydratedSession = restored.session;
      }
    } else if (cachedSupabaseSession) {
      setSupabaseSession(cachedSupabaseSession);
    }

    const rbacRes = await verifyUnifiedOwnerAndAgentRbac({
      session: hydratedSession,
      forceServerRefresh: true,
    });

    if (!rbacRes.userId) {
      setHasPersistedSession(false);
      return {
        ok: false,
        error: 'انتهت صلاحية الجلسة المحفوظة، يرجى تسجيل الدخول مجدداً',
      };
    }

    await refreshState();
    wsReconnectRef.current?.({ immediate: true, forceReset: true });
    triggerNativeHaptic('success');
    return { ok: true };
  }, [persistSupabaseSession, refreshState, verifyUnifiedOwnerAndAgentRbac]);

  const toggleBiometricLock = useCallback(async () => {
    const next = !biometricEnabled;
    setBiometricEnabled(next);
    await saveBiometricLockEnabled(next);
    triggerNativeHaptic('light');
  }, [biometricEnabled]);

  const logoutAccount = useCallback(async () => {
    try {
      if (mobileSupabase) {
        await mobileSupabase.auth.signOut();
      }
    } catch {
      // Proceed with local cleanup even if offline
    }
    lastSyncedSupabaseUidRef.current = null;
    biometricGateLockedRef.current = false;
    setHasPersistedSession(false);
    setAgency2faStatus(null);
    setNotifications([]);
    setFollowedRoomIds([]);
    await persistSupabaseSession(null);
    mobileApi.clearSession();
    await Promise.all([
      clearSavedSessionToken(),
      clearSavedUserId(),
      clearSavedSupabaseSession(),
    ]);
    clearMobileSessionQueries(queryClient);
    setIsAuthenticated(false);
    applyRbacFlags(null);
    setCurrentUserId('');
    setActiveRoomId(null);
    wsReconnectRef.current?.({ immediate: true, forceReset: true });
  }, [applyRbacFlags, persistSupabaseSession, queryClient]);

  const currentUser = useMemo(() => {
    if (!state || !currentUserId) return null;
    return state.users.find((u) => u.id === currentUserId) || null;
  }, [state, currentUserId]);

  // Reactive RBAC guard: instantaneously syncs Owner (ID: 900) and Approved Agency status
  // whenever auth state, currentUser.id, or live WebSocket isVerifiedAgent status changes
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setVerifiedPrimaryAdmin(false);
      setVerifiedApprovedAgent(false);
      return;
    }
    setVerifiedPrimaryAdmin(currentUser.id === PRIMARY_ADMIN_ID);
    setVerifiedApprovedAgent(
      currentUser.id === PRIMARY_ADMIN_ID || currentUser.isVerifiedAgent === true
    );
  }, [isAuthenticated, currentUser?.id, currentUser?.isVerifiedAgent]);

  const isPrimaryAdmin = useMemo(
    () => Boolean(isAuthenticated && currentUser?.id === PRIMARY_ADMIN_ID && verifiedPrimaryAdmin),
    [isAuthenticated, currentUser?.id, verifiedPrimaryAdmin]
  );

  const isApprovedAgent = useMemo(
    () =>
      Boolean(
        isAuthenticated &&
          currentUser &&
          (currentUser.id === PRIMARY_ADMIN_ID || currentUser.isVerifiedAgent === true) &&
          verifiedApprovedAgent
      ),
    [isAuthenticated, currentUser, verifiedApprovedAgent]
  );

  const assertPrimaryAdmin = useCallback((): boolean => {
    return isPrimaryAdmin;
  }, [isPrimaryAdmin]);

  const approveAgencyRequestAsAdmin = useCallback(
    async (requestId: string): Promise<boolean> => {
      if (!assertPrimaryAdmin()) return false;
      const res = await mobileApi.mutate<{ state?: MobileServerState }>(
        `/api/agency/requests/${encodeURIComponent(requestId)}/approve`,
        {}
      );
      if (res.ok && res.data.state) {
        setState(res.data.state);
        triggerNativeHaptic('success');
        return true;
      }
      return false;
    },
    [assertPrimaryAdmin]
  );

  const rejectAgencyRequestAsAdmin = useCallback(
    async (requestId: string): Promise<boolean> => {
      if (!assertPrimaryAdmin()) return false;
      const res = await mobileApi.mutate<{ state?: MobileServerState }>(
        `/api/agency/requests/${encodeURIComponent(requestId)}/reject`,
        {}
      );
      if (res.ok && res.data.state) {
        setState(res.data.state);
        triggerNativeHaptic('light');
        return true;
      }
      return false;
    },
    [assertPrimaryAdmin]
  );

  const boostRoomAsAdmin = useCallback(
    async (roomId: string): Promise<boolean> => {
      if (!assertPrimaryAdmin()) return false;
      const res = await mobileApi.mutate<{ state?: MobileServerState }>(
        `/api/rooms/${encodeURIComponent(roomId)}/boost`,
        {}
      );
      if (res.ok && res.data.state) {
        setState(res.data.state);
        triggerNativeHaptic('success');
        Alert.alert('تم دعم الغرفة ⚡', 'تمت زيادة حرارة وظهور الغرفة بنجاح.');
        return true;
      }
      return false;
    },
    [assertPrimaryAdmin]
  );

  const boostAllRoomsAsAdmin = useCallback(async (): Promise<boolean> => {
    if (!assertPrimaryAdmin()) return false;
    const res = await mobileApi.mutate<{ state?: MobileServerState }>(
      '/api/system/boost-rooms',
      {}
    );
    if (res.ok && res.data.state) {
      setState(res.data.state);
      triggerNativeHaptic('success');
      Alert.alert('تم تعزيز الغرف ⚡', 'تم دعم جميع الغرف النشطة بنجاح.');
      return true;
    }
    return false;
  }, [assertPrimaryAdmin]);

  const addTreasuryGoldAsAdmin = useCallback(
    async (goldAmount: number): Promise<boolean> => {
      if (!assertPrimaryAdmin()) return false;
      const res = await mobileApi.mutate<{ state?: MobileServerState }>(
        '/api/system/treasury',
        { goldAmount }
      );
      if (res.ok && res.data.state) {
        setState(res.data.state);
        triggerNativeHaptic('success');
        Alert.alert(
          'تمت تغذية الخزينة 💰',
          `تمت إضافة +${goldAmount.toLocaleString('en-US')} ذهبية لحساب المالك.`
        );
        return true;
      }
      return false;
    },
    [assertPrimaryAdmin]
  );

  const updateGlobalAnnouncementAsAdmin = useCallback(
    async (text: string): Promise<boolean> => {
      if (!assertPrimaryAdmin()) return false;
      const clean = text.trim();
      if (!clean) return false;
      const res = await mobileApi.mutate<{ state?: MobileServerState }>(
        '/api/system/announcement',
        { text: clean }
      );
      if (res.ok && res.data.state) {
        setState(res.data.state);
        triggerNativeHaptic('success');
        Alert.alert('تم بث الإعلان 📢', 'تم تحديث الإعلان العام لجميع المستخدمين.');
        return true;
      }
      return false;
    },
    [assertPrimaryAdmin]
  );

  const activeRoom = useMemo(() => {
    if (!state || !activeRoomId) return null;
    return state.rooms.find((r) => r.id === activeRoomId) || null;
  }, [state, activeRoomId]);

  const syncActiveRoomSeatsSilently = useCallback(() => {
    const roomId = activeRoomIdRef.current;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        if (roomId) {
          ws.send(JSON.stringify({ type: 'room:seats:request', roomId }));
        } else {
          ws.send(JSON.stringify({ type: 'state:request' }));
        }
        return;
      } catch {
        // Fall through to reconnect
      }
    }
    wsReconnectRef.current?.({ immediate: true, forceReset: true });
    void refreshState({ force: true });
  }, [refreshState]);

  const emitRoomSpeaking = useCallback(
    (roomId: string, seatNumber: number, isSpeaking: boolean) => {
      if (!currentUserId) return;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              type: 'room:speaking',
              roomId,
              seatNumber,
              userId: currentUserId,
              isSpeaking,
            })
          );
          return;
        } catch {
          // Queue latest state for flush upon reconnect
        }
      }
      pendingSpeakingRef.current = {
        roomId,
        seatNumber,
        userId: currentUserId,
        isSpeaking,
      };
    },
    [currentUserId]
  );

  const enterRoom = useCallback(
    (roomId: string) => {
      triggerNativeHaptic('light');
      activeRoomIdRef.current = roomId;
      setActiveRoomId(roomId);
      if (currentUserId) {
        void saveUserId(currentUserId);
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'room:seats:request', roomId }));
          ws.send(JSON.stringify({ type: 'state:request' }));
          ws.send(JSON.stringify({ type: 'room:telemetry:subscribe', roomId }));
        } catch {
          wsReconnectRef.current?.({ immediate: true, forceReset: true });
        }
      } else {
        wsReconnectRef.current?.({ immediate: true, forceReset: true });
      }
    },
    [currentUserId]
  );

  const leaveRoom = useCallback(() => {
    setActiveRoomId(null);
  }, []);

  const toggleSeat = useCallback(async (roomId: string, seatNumber: number) => {
    triggerNativeHaptic('light');
    const res = await mobileApi.mutate<{ state?: MobileServerState }>(
      `/api/rooms/${encodeURIComponent(roomId)}/seat`,
      { seatNumber }
    );
    if (res.ok && res.data.state) setState(res.data.state);
  }, []);

  const toggleMute = useCallback(async (roomId: string, seatNumber: number) => {
    triggerNativeHaptic('light');
    const res = await mobileApi.mutate<{ state?: MobileServerState }>(
      `/api/rooms/${encodeURIComponent(roomId)}/mute`,
      { seatNumber }
    );
    if (res.ok && res.data.state) setState(res.data.state);
  }, []);

  const sendRoomMessage = useCallback(async (roomId: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const res = await mobileApi.mutate<{ state?: MobileServerState }>(
      `/api/rooms/${encodeURIComponent(roomId)}/message`,
      { text: clean }
    );
    if (res.ok && res.data.state) setState(res.data.state);
  }, []);

  const sendRoomGift = useCallback(
    async (roomId: string, giftId: string, recipientId?: string) => {
      triggerNativeHaptic('success');
      const res = await mobileApi.mutate<{ state?: MobileServerState }>(
        `/api/rooms/${encodeURIComponent(roomId)}/gift`,
        { giftId, recipientId, quantity: 1 }
      );
      if (res.ok && res.data.state) setState(res.data.state);
    },
    []
  );

  const placeGameBet = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!currentUser || currentUser.gold < amount) {
        triggerNativeHaptic('warning');
        Alert.alert('رصيد غير كافٍ', 'يرجى شحن رصيد الذهب للمتابعة.');
        return false;
      }
      triggerNativeHaptic('light');
      const payoutRes = await mobileApi.mutate<{ state?: MobileServerState }>(
        '/api/games/payout',
        { deltaGold: -amount }
      );
      const betRes = await mobileApi.mutate<{ state?: MobileServerState }>(
        '/api/games/bet',
        { amount }
      );
      if (betRes.ok && betRes.data.state) {
        setState(betRes.data.state);
      } else if (payoutRes.ok && payoutRes.data.state) {
        setState(payoutRes.data.state);
      }
      return true;
    },
    [currentUser]
  );

  const settleGameWin = useCallback(
    async (gameName: string, icon: string, payout: number) => {
      if (payout <= 0) return;
      triggerNativeHaptic('success');
      const winRes = await mobileApi.mutate<{ state?: MobileServerState }>(
        '/api/games/payout',
        { deltaGold: payout }
      );
      if (winRes.ok && winRes.data.state) {
        setState(winRes.data.state);
      }
      if (activeRoomId) {
        const synced = await mobileApi.announceGameWinInRoom(
          activeRoomId,
          gameName,
          icon,
          payout
        );
        if (synced) setState(synced);
      }
    },
    [activeRoomId]
  );

  const createAndShareInvite = useCallback(
    async (roomId?: string): Promise<MobileInviteLink | null> => {
      const created = await mobileApi.createInviteLink(roomId);
      if (!created.invite) return null;
      if (created.state) setState(created.state);
      triggerNativeHaptic('success');
      const webUrl = roomId
        ? `${PUBLIC_INVITE_BASE_URL}/?invite=${encodeURIComponent(created.invite.code)}&room=${encodeURIComponent(roomId)}`
        : `${PUBLIC_INVITE_BASE_URL}/?invite=${encodeURIComponent(created.invite.code)}`;
      await shareNativeInviteLink({
        title: created.invite.roomTitle
          ? `دعوة إلى غرفة ${created.invite.roomTitle} في رياض شات`
          : 'دعوة للانضمام إلى رياض شات',
        message: created.invite.roomTitle
          ? `🎙️ أدعوك للانضمام معي إلى غرفة «${created.invite.roomTitle}» في رياض شات (+500,000 ذهبية ترحيبية):`
          : '👑 انضم إليّ في تطبيق رياض شات للدردشة الصوتية والألعاب (+500,000 ذهبية ترحيبية):',
        url: webUrl,
      });
      return created.invite;
    },
    []
  );

  const reconnectWebSocket = useCallback(() => {
    triggerNativeHaptic('light');
    setConnectionStatus('reconnecting');
    wsReconnectRef.current?.({ immediate: true, forceReset: true });
    void refreshState();
  }, [refreshState]);

  const refreshAgency2FAStatus = useCallback(async (): Promise<MobileAgency2FAStatus | null> => {
    const status = await mobileApi.fetchAgency2FAStatus();
    setAgency2faStatus(status);
    return status;
  }, []);

  const requestAgency2FA = useCallback(
    async (channel: 'sms' | 'email', destination?: string) => {
      const res = await mobileApi.requestAgency2FA(channel, destination);
      if (res.ok) {
        triggerNativeHaptic('light');
        void refreshAgency2FAStatus();
      }
      return res;
    },
    [refreshAgency2FAStatus]
  );

  const verifyAgency2FA = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await mobileApi.verifyAgency2FA(code);
      if (res.ok) {
        triggerNativeHaptic('success');
        await refreshAgency2FAStatus();
      }
      return { ok: res.ok, error: res.error };
    },
    [refreshAgency2FAStatus]
  );

  const lockAgency2FA = useCallback(async () => {
    await mobileApi.lockAgency2FA();
    await refreshAgency2FAStatus();
    triggerNativeHaptic('light');
  }, [refreshAgency2FAStatus]);

  const unreadNotificationsCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [notifications]
  );

  const refreshNotifications = useCallback(async () => {
    const data = await mobileApi.fetchNotifications();
    if (!data) return;
    setNotifications(data.notifications);
    setFollowedRoomIds(data.followedRoomIds);
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    await mobileApi.markNotificationRead(notificationId);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await mobileApi.markAllNotificationsRead();
  }, []);

  const toggleFollowRoom = useCallback(async (roomId: string): Promise<boolean> => {
    const res = await mobileApi.toggleFollowRoom(roomId);
    if (res.ok && Array.isArray(res.followedRoomIds)) {
      setFollowedRoomIds(res.followedRoomIds);
      triggerNativeHaptic('light');
    }
    return Boolean(res.following);
  }, []);

  const startRoomLiveBroadcast = useCallback(
    async (roomId: string, topic?: string): Promise<boolean> => {
      const res = await mobileApi.startRoomLiveBroadcast(roomId, topic);
      if (res.ok && res.state) {
        setState(res.state);
        triggerNativeHaptic('success');
      }
      return res.ok;
    },
    []
  );

  const canUseBiometricQuickLogin = Boolean(
    biometricSupported && biometricEnabled && hasPersistedSession && !isAuthenticated
  );

  return (
    <MobileAppContext.Provider
      value={{
        state,
        loading,
        connected,
        connectionStatus,
        wsLatencyMs,
        wsReconnectAttempt,
        reconnectWebSocket,
        syncActiveRoomSeatsSilently,
        emitRoomSpeaking,
        currentUser,
        isPrimaryAdmin,
        isApprovedAgent,
        rbacChecking,
        isAuthenticated,
        authLoading,
        isSupabaseEnabled: isMobileSupabaseConfigured,
        supabaseSession,
        pendingReferralCode,
        activeRoomId,
        activeRoom,
        loginWithEmail,
        registerWithEmail,
        sendPhoneOtp,
        verifyPhoneOtp,
        lastGoogleHint,
        clearGoogleHint,
        loginWithGoogle,
        loginWithFacebook,
        biometricSupported,
        biometricEnabled,
        biometricLabel,
        biometricIcon,
        hasPersistedSession,
        canUseBiometricQuickLogin,
        loginWithBiometrics,
        toggleBiometricLock,
        logoutAccount,
        verifyUnifiedOwnerAndAgentRbac,
        verifyAndBindPrimaryAdmin,
        revalidateSessionAndRbac,
        approveAgencyRequestAsAdmin,
        rejectAgencyRequestAsAdmin,
        boostRoomAsAdmin,
        boostAllRoomsAsAdmin,
        addTreasuryGoldAsAdmin,
        updateGlobalAnnouncementAsAdmin,
        enterRoom,
        leaveRoom,
        toggleSeat,
        toggleMute,
        sendRoomMessage,
        sendRoomGift,
        placeGameBet,
        settleGameWin,
        createAndShareInvite,
        redeemInvite,
        refreshState,
        agency2faStatus,
        refreshAgency2FAStatus,
        requestAgency2FA,
        verifyAgency2FA,
        lockAgency2FA,
        notifications,
        unreadNotificationsCount,
        followedRoomIds,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        toggleFollowRoom,
        startRoomLiveBroadcast,
      }}
    >
      {children}
    </MobileAppContext.Provider>
  );
};

export function useMobileApp(): MobileAppContextValue {
  const ctx = useContext(MobileAppContext);
  if (!ctx) throw new Error('useMobileApp must be used inside MobileAppProvider');
  return ctx;
}
