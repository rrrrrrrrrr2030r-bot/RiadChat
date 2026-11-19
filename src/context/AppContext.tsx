import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  ActiveGiftAnimation,
  AgencyHostRecord,
  AgencyTransfer,
  CommissionDistribution,
  DailyTask,
  DiceMultiplier,
  GameLuckMode,
  MainTab,
  ModeratorRecord,
  ReportRecord,
  StorePackage,
  UserAccount,
  VoiceRoom,
} from '../types';
import {
  INITIAL_AGENCY_HOSTS,
  INITIAL_DISTRIBUTIONS,
  INITIAL_MODERATORS,
  INITIAL_REPORTS,
  INITIAL_ROOMS,
  INITIAL_TASKS,
  INITIAL_TRANSFERS,
  INITIAL_USERS,
  ROOM_GIFTS,
  normalizeAssetPath,
} from '../data/seedData';
import {
  ROOM_XP_REWARDS,
  applyXpGain,
  getDefaultXpForLevel,
} from '../utils/leveling';

interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'info' | 'warning' | 'error';
}

interface AppState {
  currentUserId: string;
  users: UserAccount[];
  rooms: VoiceRoom[];
  transfers: AgencyTransfer[];
  moderators: ModeratorRecord[];
  reports: ReportRecord[];
  tasks: DailyTask[];
  globalAnnouncement: string;
  gameLuckMode: GameLuckMode;
  diceMultiplier: DiceMultiplier;
  maintenanceMode: boolean;
  ultraNightMode: boolean;
  jackpotProgress: number;
  dailyStakedGold: number;
  cashbackClaimedBase: number;
  streakDay: number;
  lastCheckInDate: string | null;
  agentInviteCount: number;
  hosts: AgencyHostRecord[];
  distributions: CommissionDistribution[];
  autoDistributeEnabled: boolean;
  agencyCommissionSplit: number;
  hostBonusPoolGold: number;
}

const STORAGE_KEY = 'riad_chat_state_v3';
export const JACKPOT_TARGET = 600_000_000;
export const JACKPOT_REWARD = 50_000_000;

const WEALTH_BADGE_STEPS: Array<{ minHeat: number; label: string }> = [
  { minHeat: 1_000_000_000_000, label: '1000B' },
  { minHeat: 700_000_000_000, label: '700B' },
  { minHeat: 500_000_000_000, label: '500B' },
  { minHeat: 300_000_000_000, label: '300B' },
  { minHeat: 100_000_000_000, label: '100B' },
  { minHeat: 10_000_000_000, label: '10000M' },
  { minHeat: 1_000_000_000, label: '1000M' },
  { minHeat: 500_000_000, label: '500M' },
  { minHeat: 300_000_000, label: '300M' },
  { minHeat: 200_000_000, label: '200M' },
  { minHeat: 100_000_000, label: '100M' },
  { minHeat: 50_000_000, label: '50M' },
];

function computeWealthBadge(heat: number): string | undefined {
  for (const step of WEALTH_BADGE_STEPS) {
    if (heat >= step.minHeat) return step.label;
  }
  return undefined;
}

const DEFAULT_STATE: AppState = {
  currentUserId: '900',
  users: INITIAL_USERS,
  rooms: INITIAL_ROOMS,
  transfers: INITIAL_TRANSFERS,
  moderators: INITIAL_MODERATORS,
  reports: INITIAL_REPORTS,
  tasks: INITIAL_TASKS,
  globalAnnouncement: 'مرحباً بكم في منصة رياض شات — شحن الوكالات متاح الآن ببونص +25% على جميع الباقات!',
  gameLuckMode: 'generous',
  diceMultiplier: 1,
  maintenanceMode: false,
  ultraNightMode: false,
  jackpotProgress: 0,
  dailyStakedGold: 0,
  cashbackClaimedBase: 0,
  streakDay: 0,
  lastCheckInDate: null,
  agentInviteCount: 0,
  hosts: INITIAL_AGENCY_HOSTS,
  distributions: INITIAL_DISTRIBUTIONS,
  autoDistributeEnabled: true,
  agencyCommissionSplit: 20,
  hostBonusPoolGold: 0,
};

function normalizeStatePayload(raw: Partial<AppState>, fallbackCurrentUserId = '900'): AppState {
  const usersById = new Map(INITIAL_USERS.map((u) => [u.id, u]));
  const normalizedUsers = (raw.users?.length ? raw.users : DEFAULT_STATE.users).map((u) => {
    const seedMatch = usersById.get(u.id);
    const safeLevel = typeof u.level === 'number' && Number.isFinite(u.level) && u.level >= 1 ? u.level : 1;
    const safeXp =
      typeof u.xp === 'number' && Number.isFinite(u.xp) && u.xp >= 0
        ? u.xp
        : getDefaultXpForLevel(safeLevel);
    return {
      ...u,
      role: u.role || seedMatch?.role || 'USER',
      charisma:
        typeof u.charisma === 'number' && Number.isFinite(u.charisma)
          ? u.charisma
          : seedMatch?.charisma || 0,
      giftedGold:
        typeof u.giftedGold === 'number' && Number.isFinite(u.giftedGold)
          ? u.giftedGold
          : seedMatch?.giftedGold || 0,
      level: safeLevel,
      xp: safeXp,
      avatar: normalizeAssetPath(u.avatar),
    };
  });
  const normalizedRooms = (raw.rooms?.length ? raw.rooms : DEFAULT_STATE.rooms).map((r) => {
    const isLegacyMain = r.id === 'room-900' && !r.themeId;
    const rawSeats = (r.seats || []).map((s) => ({
      ...s,
      avatar: s.avatar ? normalizeAssetPath(s.avatar) : null,
    }));
    let seats = rawSeats;
    let totalMics = r.totalMics || rawSeats.length || 20;

    if (isLegacyMain && rawSeats.length < 20) {
      totalMics = 20;
      const bySeat = new Map(rawSeats.map((s) => [s.seatNumber, s]));
      seats = Array.from({ length: 20 }, (_, idx) => {
        const num = idx + 1;
        return (
          bySeat.get(num) || {
            seatNumber: num,
            userId: null,
            userName: null,
            avatar: null,
            isMuted: false,
            isSpeaking: false,
            isLocked: false,
          }
        );
      });
    }

    return {
      ...r,
      ownerAvatar: normalizeAssetPath(r.ownerAvatar),
      coverImage: normalizeAssetPath(r.coverImage || r.ownerAvatar),
      welcomeMessage: r.welcomeMessage ?? 'ارحبووو',
      themeId: r.themeId || 'ocean-stars',
      useThemeFilter: typeof r.useThemeFilter === 'boolean' ? r.useThemeFilter : true,
      diceCount: typeof r.diceCount === 'number' ? r.diceCount : 1,
      membershipCount: typeof r.membershipCount === 'number' ? r.membershipCount : 0,
      membersOnlyEntry: Boolean(r.membersOnlyEntry),
      allowVisitorsOnMic: typeof r.allowVisitorsOnMic === 'boolean' ? r.allowVisitorsOnMic : true,
      sendEmojiToChat: Boolean(r.sendEmojiToChat),
      visitorChatRequirement: r.visitorChatRequirement || 'all',
      bannedUserIds: Array.isArray(r.bannedUserIds) ? r.bannedUserIds : [],
      totalMics,
      seats,
    };
  });
  return {
    ...DEFAULT_STATE,
    ...raw,
    currentUserId: raw.currentUserId || fallbackCurrentUserId,
    users: normalizedUsers,
    rooms: normalizedRooms,
    transfers: raw.transfers || DEFAULT_STATE.transfers,
    moderators: raw.moderators || DEFAULT_STATE.moderators,
    reports: raw.reports || DEFAULT_STATE.reports,
    tasks: raw.tasks?.length ? raw.tasks : DEFAULT_STATE.tasks,
    ultraNightMode: Boolean(raw.ultraNightMode),
    jackpotProgress:
      typeof raw.jackpotProgress === 'number' && Number.isFinite(raw.jackpotProgress)
        ? Math.min(JACKPOT_TARGET, Math.max(0, raw.jackpotProgress))
        : DEFAULT_STATE.jackpotProgress,
    dailyStakedGold:
      typeof raw.dailyStakedGold === 'number' && Number.isFinite(raw.dailyStakedGold)
        ? Math.max(0, raw.dailyStakedGold)
        : DEFAULT_STATE.dailyStakedGold,
    cashbackClaimedBase:
      typeof raw.cashbackClaimedBase === 'number' && Number.isFinite(raw.cashbackClaimedBase)
        ? Math.max(0, raw.cashbackClaimedBase)
        : 0,
    streakDay:
      typeof raw.streakDay === 'number' && Number.isFinite(raw.streakDay)
        ? Math.min(7, Math.max(0, raw.streakDay))
        : 0,
    lastCheckInDate: raw.lastCheckInDate ?? null,
    agentInviteCount:
      typeof raw.agentInviteCount === 'number' && Number.isFinite(raw.agentInviteCount)
        ? Math.max(0, raw.agentInviteCount)
        : DEFAULT_STATE.agentInviteCount,
    hosts: (raw.hosts?.length ? raw.hosts : DEFAULT_STATE.hosts).map((h) => ({
      ...h,
      avatar: normalizeAssetPath(h.avatar),
    })),
    distributions: raw.distributions?.length
      ? raw.distributions
      : DEFAULT_STATE.distributions,
    autoDistributeEnabled:
      typeof raw.autoDistributeEnabled === 'boolean'
        ? raw.autoDistributeEnabled
        : DEFAULT_STATE.autoDistributeEnabled,
    agencyCommissionSplit:
      typeof raw.agencyCommissionSplit === 'number' &&
      Number.isFinite(raw.agencyCommissionSplit)
        ? Math.min(40, Math.max(5, raw.agencyCommissionSplit))
        : DEFAULT_STATE.agencyCommissionSplit,
    hostBonusPoolGold:
      typeof raw.hostBonusPoolGold === 'number' && Number.isFinite(raw.hostBonusPoolGold)
        ? Math.max(0, raw.hostBonusPoolGold)
        : DEFAULT_STATE.hostBonusPoolGold,
  };
}

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return normalizeStatePayload(parsed);
  } catch {
    return DEFAULT_STATE;
  }
}

function makeIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface LevelUpModalState {
  newLevel: number;
  previousLevel: number;
}

interface AppContextValue {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  minimizedRoomId: string | null;
  minimizeRoom: () => void;
  restoreMinimizedRoom: () => void;
  closeMinimizedRoom: () => void;
  walletInitialTab: 'gold' | 'diamonds';
  openWallet: (tab?: 'gold' | 'diamonds') => void;
  state: AppState;
  currentUser: UserAccount;
  toasts: ToastMessage[];
  dragonOverlayActive: boolean;
  dragonBannerText: string;
  activeGiftAnimation: ActiveGiftAnimation | null;
  dismissGiftAnimation: () => void;
  levelUpModal: LevelUpModalState | null;
  dismissLevelUpModal: () => void;
  shareLevelAchievementInRoom: (level?: number) => void;
  isRealtimeConnected: boolean;
  followedUserIds: string[];
  toggleFollowUser: (targetUserId: string) => void;
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
  triggerRoyalDragon: (senderName?: string) => void;
  updateAnnouncement: (text: string) => void;
  setGameLuckMode: (mode: GameLuckMode) => void;
  setDiceMultiplier: (mult: DiceMultiplier) => void;
  toggleMaintenanceMode: () => void;
  toggleUltraNightMode: () => void;
  grantRoyalBlessingAll: () => void;
  feedAdminTreasury: () => void;
  boostAllRoomsHeat: () => void;
  boostRoomHeat: (roomId: string, amount?: number) => void;
  adjustUserGold: (userId: string, deltaGold: number, deltaDiamonds?: number) => void;
  transferAgencyGold: (recipientId: string, baseGold: number, agentName?: string) => boolean;
  purchaseStorePackage: (pkg: StorePackage) => void;
  setActiveEntry: (entry: string) => void;
  addModerator: (mod: Omit<ModeratorRecord, 'id' | 'status' | 'createdAt'>) => ModeratorRecord;
  toggleModeratorStatus: (id: string) => void;
  deleteModerator: (id: string) => void;
  resolveReport: (id: string, status: 'resolved' | 'dismissed') => void;
  toggleUserBan: (userId: string) => void;
  verifyUserAgent: (userId: string) => void;
  switchUserAccount: (userId: string) => void;
  createVoiceRoom: (title: string, country: string, flag: string, category: VoiceRoom['category'], description: string) => void;
  updateRoomSettings: (roomId: string, patch: Partial<VoiceRoom>) => void;
  toggleRoomBanUser: (roomId: string, userId: string) => void;
  deleteVoiceRoom: (roomId: string) => void;
  toggleSeatInRoom: (roomId: string, seatNumber: number) => void;
  toggleMuteSeat: (roomId: string, seatNumber: number) => void;
  sendRoomMessage: (roomId: string, text: string) => void;
  clearRoomMessages: (roomId: string) => void;
  sendRoomGift: (roomId: string, giftId: string, recipientId?: string, quantity?: number) => boolean;
  triggerIncomingGiftForMe: (roomId: string) => void;
  exchangeDiamondsToGold: (diamondAmount: number) => boolean;
  purchaseWalletPack: (gold: number, priceLabel: string) => void;
  completeTaskProgress: (taskId: string) => void;
  claimTaskReward: (taskId: string) => void;
  joinAristocratTier: (tierName: string, costGold: number) => boolean;
  upgradeSvip: () => boolean;
  recordGameBet: (amount: number) => void;
  claimJackpotChest: () => boolean;
  claimDailyCashback: () => number;
  claimDailyStreakBonus: () => boolean;
  purchaseAgentWholesalePack: (gold: number, priceUsd: number) => void;
  sendRechargeInvite: () => number;
  registerAsAgent: (agencyTitle: string) => void;
  distributeProfitsAutomatically: (mode?: 'auto' | 'manual') => boolean;
  distributeSingleHostCommission: (hostId: string) => boolean;
  updateHostCommissionRate: (hostId: string, rate: number) => void;
  toggleAutoDistribution: () => void;
  setAgencyCommissionSplit: (pct: number) => void;
  addAgencyHost: (userId: string, roomId: string, targetGold: number, commissionRate: number) => boolean;
  boostHostDailyProfit: (hostId: string, amountGold?: number) => { reachedTarget: boolean; hostName: string };
  sendSpeakingState: (roomId: string, seatNumber: number, isSpeaking: boolean) => void;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function getInitialTabFromUrl(): MainTab {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('agent') || params.get('pack')) return 'agencies';
  } catch {
    // Ignore URL parse error
  }
  return 'rooms';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [activeTab, setActiveTabState] = useState<MainTab>(getInitialTabFromUrl);
  const [activeRoomId, setActiveRoomIdState] = useState<string | null>(null);
  const [minimizedRoomId, setMinimizedRoomId] = useState<string | null>(null);
  const [walletInitialTab, setWalletInitialTab] = useState<'gold' | 'diamonds'>('diamonds');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [dragonOverlayActive, setDragonOverlayActive] = useState(false);
  const [dragonBannerText, setDragonBannerText] = useState('التنين الملكي يضيء سماء رياض شات!');
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<ActiveGiftAnimation | null>(null);
  const [levelUpModal, setLevelUpModal] = useState<LevelUpModalState | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);
  const giftTimerRef = useRef<number | null>(null);
  const dragonTimerRef = useRef<number | null>(null);
  const authTokenRef = useRef<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const suppressNextLevelTriggerRef = useRef<boolean>(false);

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  const prevUserLevelRef = useRef<{ userId: string; level: number }>({
    userId: currentUser.id,
    level: currentUser.level,
  });

  const isOwner = currentUser.role === 'OWNER';

  const setActiveTab = useCallback(
    (tab: MainTab) => {
      if ((tab === 'agency-dashboard' || tab === 'system') && currentUser.role !== 'OWNER') {
        showToast('🚫 ممنوع (403): لوحة التحكم الإدارية مخصصة لحساب المالك فقط', 'error');
        return;
      }
      setActiveTabState(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentUser.role, showToast]
  );

  const setActiveRoomId = useCallback((roomId: string | null) => {
    setActiveRoomIdState(roomId);
    if (roomId) {
      setMinimizedRoomId(null);
    }
  }, []);

  const minimizeRoom = useCallback(() => {
    if (activeRoomId) {
      setMinimizedRoomId(activeRoomId);
      setActiveRoomIdState(null);
    }
  }, [activeRoomId]);

  const restoreMinimizedRoom = useCallback(() => {
    if (minimizedRoomId) {
      setActiveRoomIdState(minimizedRoomId);
      setMinimizedRoomId(null);
    }
  }, [minimizedRoomId]);

  const closeMinimizedRoom = useCallback(() => {
    setMinimizedRoomId(null);
  }, []);

  const openWallet = useCallback(
    (tab: 'gold' | 'diamonds' = 'diamonds') => {
      setWalletInitialTab(tab);
      setActiveRoomIdState(null);
      setActiveTab('wallet');
    },
    [setActiveTab]
  );

  const issueSessionToken = useCallback(async (userId: string) => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { token?: string };
        if (data.token) {
          authTokenRef.current = data.token;
        }
      }
    } catch {
      // Offline / static fallback
    }
  }, []);

  const apiMutate = useCallback(
    async (
      url: string,
      options: { method?: string; body?: Record<string, unknown>; idempotencyKey?: string } = {}
    ): Promise<{ ok: boolean; status: number; data?: Record<string, unknown> }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (authTokenRef.current) {
          headers.Authorization = `Bearer ${authTokenRef.current}`;
        }
        if (options.idempotencyKey) {
          headers['Idempotency-Key'] = options.idempotencyKey;
        }
        const res = await fetch(url, {
          method: options.method || 'POST',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (res.status === 403) {
          showToast('🚫 ممنوع (403 Forbidden): لا تملك صلاحية المالك لهذا الإجراء', 'error');
          return { ok: false, status: 403, data };
        }
        if (res.ok && data.state) {
          setState((prev) => ({
            ...normalizeStatePayload(data.state as Partial<AppState>, prev.currentUserId),
            currentUserId: prev.currentUserId,
          }));
        }
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: false, status: 0 };
      }
    },
    [showToast]
  );

  // Hydrate state + issue session token + maintain WebSocket sync with reconnect
  useEffect(() => {
    let active = true;
    let reconnectTimer: number | null = null;
    let retryMs = 800;

    const bootstrap = async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok && active) {
          const payload = (await res.json()) as { state?: Partial<AppState> };
          if (payload.state) {
            suppressNextLevelTriggerRef.current = true;
            setState((prev) => ({
              ...normalizeStatePayload(payload.state!, prev.currentUserId),
              currentUserId: prev.currentUserId,
            }));
          }
        }
      } catch {
        // Fallback to localStorage state
      }
      if (active) {
        await issueSessionToken(state.currentUserId);
      }
    };

    const connectWs = () => {
      if (!active || typeof window === 'undefined') return;
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          retryMs = 800;
          if (active) setIsRealtimeConnected(true);
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data) as {
              type?: string;
              state?: Partial<AppState>;
              roomId?: string;
              seatNumber?: number;
              isSpeaking?: boolean;
            };
            if (msg.type === 'state:sync' && msg.state) {
              setState((prev) => ({
                ...normalizeStatePayload(msg.state!, prev.currentUserId),
                currentUserId: prev.currentUserId,
              }));
            } else if (
              msg.type === 'room:speaking' &&
              msg.roomId &&
              typeof msg.seatNumber === 'number'
            ) {
              setState((prev) => ({
                ...prev,
                rooms: prev.rooms.map((r) =>
                  r.id === msg.roomId
                    ? {
                        ...r,
                        seats: r.seats.map((s) =>
                          s.seatNumber === msg.seatNumber
                            ? { ...s, isSpeaking: Boolean(msg.isSpeaking) }
                            : s
                        ),
                      }
                    : r
                ),
              }));
            }
          } catch {
            // Ignore malformed WS frames
          }
        };

        ws.onerror = () => {
          if (active) setIsRealtimeConnected(false);
        };

        ws.onclose = () => {
          if (!active) return;
          setIsRealtimeConnected(false);
          reconnectTimer = window.setTimeout(() => {
            retryMs = Math.min(10000, retryMs * 1.6);
            connectWs();
          }, retryMs);
        };
      } catch {
        if (active) setIsRealtimeConnected(false);
      }
    };

    bootstrap();
    connectWs();

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [issueSessionToken]);

  const sendSpeakingState = useCallback(
    (roomId: string, seatNumber: number, isSpeaking: boolean) => {
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId
            ? {
                ...r,
                seats: r.seats.map((s) =>
                  s.seatNumber === seatNumber && !s.isMuted ? { ...s, isSpeaking } : s
                ),
              }
            : r
        ),
      }));
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'room:speaking',
            roomId,
            seatNumber,
            userId: state.currentUserId,
            isSpeaking,
          })
        );
      }
    },
    [state.currentUserId]
  );

  useEffect(() => {
    return () => {
      if (giftTimerRef.current) window.clearTimeout(giftTimerRef.current);
      if (dragonTimerRef.current) window.clearTimeout(dragonTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle('ultra-night-mode', state.ultraNightMode);
  }, [state.ultraNightMode]);

  useEffect(() => {
    const prev = prevUserLevelRef.current;
    if (suppressNextLevelTriggerRef.current) {
      suppressNextLevelTriggerRef.current = false;
      prevUserLevelRef.current = { userId: currentUser.id, level: currentUser.level };
      return;
    }
    if (prev.userId !== currentUser.id) {
      prevUserLevelRef.current = { userId: currentUser.id, level: currentUser.level };
      setLevelUpModal(null);
      return;
    }
    if (currentUser.level > prev.level) {
      setLevelUpModal({
        newLevel: currentUser.level,
        previousLevel: prev.level,
      });
    }
    prevUserLevelRef.current = { userId: currentUser.id, level: currentUser.level };
  }, [currentUser.id, currentUser.level]);

  const dismissLevelUpModal = useCallback(() => {
    setLevelUpModal(null);
  }, []);

  const toggleFollowUser = useCallback(
    (targetUserId: string) => {
      if (!targetUserId || targetUserId === currentUser.id) {
        showToast('لا يمكنك متابعة حسابك الشخصي', 'info');
        return;
      }
      const target = state.users.find((u) => u.id === targetUserId);
      if (!target) return;
      const alreadyFollowing = followedUserIds.includes(targetUserId);
      setFollowedUserIds((prev) =>
        alreadyFollowing ? prev.filter((id) => id !== targetUserId) : [...prev, targetUserId]
      );
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => {
          if (u.id === targetUserId) {
            return {
              ...u,
              followers: Math.max(0, (u.followers || 0) + (alreadyFollowing ? -1 : 1)),
            };
          }
          if (u.id === prev.currentUserId) {
            return {
              ...u,
              following: Math.max(0, (u.following || 0) + (alreadyFollowing ? -1 : 1)),
            };
          }
          return u;
        }),
      }));
      showToast(
        alreadyFollowing
          ? `تم إلغاء متابعة ${target.name}`
          : `✨ بدأت متابعة ${target.name} الآن!`,
        alreadyFollowing ? 'info' : 'success'
      );
    },
    [currentUser.id, followedUserIds, state.users, showToast]
  );

  const shareLevelAchievementInRoom = useCallback(
    (level?: number) => {
      const achievedLevel = level ?? levelUpModal?.newLevel ?? currentUser.level;
      const targetRoomId = activeRoomId || minimizedRoomId || state.rooms[0]?.id;
      if (!targetRoomId) {
        setLevelUpModal(null);
        showToast('لا توجد غرفة صوتية نشطة لمشاركة الإنجاز حالياً', 'warning');
        return;
      }
      const shareText = `🏆 حققت مستوى جديد Lv.${achievedLevel}! أشارككم فرحة الترقية والإنجاز في رياض شات ✨`;
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((room) =>
          room.id === targetRoomId
            ? {
                ...room,
                messages: [
                  ...room.messages.slice(-30),
                  {
                    id: `ach-${Date.now()}`,
                    senderId: currentUser.id,
                    senderName: currentUser.name,
                    senderLevel: achievedLevel,
                    text: shareText,
                    type: 'achievement',
                    timestamp: 'الآن',
                  },
                ],
              }
            : room
        ),
      }));
      void apiMutate(`/api/rooms/${targetRoomId}/message`, {
        body: { text: shareText, type: 'achievement' },
      });
      if (!activeRoomId) {
        setActiveRoomIdState(targetRoomId);
        setMinimizedRoomId(null);
      }
      setLevelUpModal(null);
      showToast(`🎉 تمت مشاركة إنجاز المستوى Lv.${achievedLevel} في الغرفة!`, 'success');
    },
    [
      levelUpModal?.newLevel,
      currentUser.id,
      currentUser.name,
      currentUser.level,
      activeRoomId,
      minimizedRoomId,
      state.rooms,
      apiMutate,
      showToast,
    ]
  );

  const triggerRoyalDragon = useCallback((senderName = 'الإدارة الملكية') => {
    if (dragonTimerRef.current) window.clearTimeout(dragonTimerRef.current);
    setDragonBannerText(`${senderName} أطلق التنين الملكي في سماء رياض شات!`);
    setDragonOverlayActive(true);
    dragonTimerRef.current = window.setTimeout(() => {
      setDragonOverlayActive(false);
    }, 4500);
  }, []);

  const updateAnnouncement = useCallback(
    (text: string) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): تعديل الإعلان العام للمالك فقط', 'error');
        return;
      }
      const clean = text.trim();
      if (!clean) {
        showToast('يرجى كتابة نص الإعلان أولاً', 'warning');
        return;
      }
      setState((prev) => ({ ...prev, globalAnnouncement: clean }));
      void apiMutate('/api/system/announcement', { body: { text: clean } });
      showToast('تم تحديث شريط الإعلان العام المباشر بنجاح', 'success');
    },
    [isOwner, apiMutate, showToast]
  );

  const setGameLuckMode = useCallback(
    (mode: GameLuckMode) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): تعديل نسب الألعاب للمالك فقط', 'error');
        return;
      }
      setState((prev) => ({ ...prev, gameLuckMode: mode }));
      void apiMutate('/api/system/luck', { body: { mode } });
      const labels: Record<GameLuckMode, string> = {
        generous: 'سخي جداً (ربح عالي)',
        balanced: 'متوازن (قياسي)',
        strict: 'صارم (تحدي)',
      };
      showToast(`تم ضبط نسبة حظ الألعاب: ${labels[mode]}`, 'info');
    },
    [isOwner, apiMutate, showToast]
  );

  const setDiceMultiplier = useCallback(
    (mult: DiceMultiplier) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): تعديل المضاعف للمالك فقط', 'error');
        return;
      }
      setState((prev) => ({ ...prev, diceMultiplier: mult }));
      void apiMutate('/api/system/multiplier', { body: { mult } });
      showToast(`تم ضبط مضاعف الحظ إلى x${mult}`, 'info');
    },
    [isOwner, apiMutate, showToast]
  );

  const toggleMaintenanceMode = useCallback(() => {
    if (!isOwner) {
      showToast('🚫 ممنوع (403): وضع الصيانة للمالك فقط', 'error');
      return;
    }
    setState((prev) => {
      const next = !prev.maintenanceMode;
      showToast(
        next ? 'تم تفعيل وضع الصيانة العامة للغرف الصوتية' : 'تم إلغاء وضع الصيانة وفتح الغرف',
        next ? 'warning' : 'success'
      );
      return { ...prev, maintenanceMode: next };
    });
    void apiMutate('/api/system/maintenance');
  }, [isOwner, apiMutate, showToast]);

  const toggleUltraNightMode = useCallback(() => {
    if (!isOwner) {
      showToast('🚫 ممنوع (403): إعدادات النظام للمالك فقط', 'error');
      return;
    }
    const next = !state.ultraNightMode;
    setState((prev) => ({ ...prev, ultraNightMode: next }));
    void apiMutate('/api/system/ultra-night');
    showToast(
      next
        ? 'تم تفعيل الوضع الليلي الفائق — تباين بنفسجي وأزرق مع تقليل سطوع الأبيض'
        : 'تم إيقاف الوضع الليلي الفائق والعودة للوضع القياسي',
      'info'
    );
  }, [isOwner, state.ultraNightMode, apiMutate, showToast]);

  const grantRoyalBlessingAll = useCallback(() => {
    if (!isOwner) {
      showToast('🚫 ممنوع (403): المكرمة الملكية للمالك فقط', 'error');
      return;
    }
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => ({ ...u, gold: u.gold + 1_000_000 })),
    }));
    void apiMutate('/api/system/grant-all');
    showToast('مكرمة ملكية شاملة: تم إهداء +1,000,000 ذهب لكل عضو!', 'success');
  }, [isOwner, apiMutate, showToast]);

  const feedAdminTreasury = useCallback(() => {
    if (!isOwner) {
      showToast('🚫 ممنوع (403): تغذية الخزينة للمالك فقط', 'error');
      return;
    }
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === prev.currentUserId ? { ...u, gold: u.gold + 50_000_000 } : u
      ),
    }));
    void apiMutate('/api/system/treasury');
    showToast('تم تغذية حسابك الفوري بـ +50,000,000 ذهب!', 'success');
  }, [isOwner, apiMutate, showToast]);

  const boostAllRoomsHeat = useCallback(() => {
    if (!isOwner) {
      showToast('🚫 ممنوع (403): مضاعفة دعم الغرف للمالك فقط', 'error');
      return;
    }
    setState((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) => ({ ...r, heat: r.heat + 10_000_000 })),
    }));
    void apiMutate('/api/system/boost-rooms');
    showToast('تم رفع حرارة ودعم كل الغرف الصوتية +10M!', 'success');
  }, [isOwner, apiMutate, showToast]);

  const boostRoomHeat = useCallback(
    (roomId: string, amount = 1_000_000) => {
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) => (r.id === roomId ? { ...r, heat: r.heat + amount } : r)),
      }));
      if (isOwner) {
        void apiMutate(`/api/rooms/${roomId}/boost`, { body: { amount } });
      }
      showToast(`تم دعم الغرفة بـ +${(amount / 1_000_000).toFixed(0)}M حرارة!`, 'success');
    },
    [isOwner, apiMutate, showToast]
  );

  const adjustUserGold = useCallback(
    (userId: string, deltaGold: number, deltaDiamonds = 0) => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                gold: Math.max(0, u.gold + deltaGold),
                diamonds: Math.max(0, u.diamonds + deltaDiamonds),
              }
            : u
        ),
      }));
      if (isOwner) {
        void apiMutate('/api/system/user/adjust-gold', {
          body: { userId, deltaGold, deltaDiamonds },
        });
      }
    },
    [isOwner, apiMutate]
  );

  const transferAgencyGold = useCallback(
    (recipientId: string, baseGold: number, agentName = 'وكالة رياض'): boolean => {
      const target = state.users.find((u) => u.id === recipientId.trim());
      if (!target) {
        showToast('معرف اللاعب غير موجود، تحقق من الرقم', 'error');
        return false;
      }
      if (!Number.isFinite(baseGold) || baseGold <= 0) {
        showToast('أدخل قيمة ذهب صالحة للشحن', 'warning');
        return false;
      }
      const agent = state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const isSelfTransfer = target.id === agent.id;
      if (!isSelfTransfer && agent.gold < baseGold) {
        showToast('رصيد الوكيل غير كافٍ — اضغط «شراء ذهبية وكيل الشحن» لتعبئة رصيدك', 'warning');
        return false;
      }
      const bonusGold = Math.floor(baseGold * 0.25);
      const totalGold = baseGold + bonusGold;
      const newRecord: AgencyTransfer = {
        id: `tr-${Date.now().toString().slice(-5)}`,
        recipientId: target.id,
        recipientName: target.name,
        baseGold,
        bonusGold,
        totalGold,
        agentName,
        timestamp: 'الآن',
      };
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => {
          if (isSelfTransfer && u.id === agent.id) {
            return { ...u, gold: u.gold + bonusGold };
          }
          if (u.id === agent.id) {
            return { ...u, gold: Math.max(0, u.gold - baseGold) };
          }
          if (u.id === target.id) {
            return { ...u, gold: u.gold + totalGold };
          }
          return u;
        }),
        transfers: [newRecord, ...prev.transfers],
        hostBonusPoolGold: prev.hostBonusPoolGold + Math.floor(baseGold * 0.05),
      }));
      void apiMutate('/api/agency/transfer', {
        body: { recipientId: target.id, baseGold },
        idempotencyKey: makeIdempotencyKey('tr'),
      });
      showToast(
        isSelfTransfer
          ? `تمت إضافة بونص الشحن الذاتي (+${bonusGold.toLocaleString('en-US')} ذهبية) لرصيدك!`
          : `تم تحويل ${totalGold.toLocaleString('en-US')} ذهبية (شامل +25% بونص) إلى ${target.name} (ID:${target.id})!`,
        'success'
      );
      return true;
    },
    [state.users, state.currentUserId, apiMutate, showToast]
  );

  const purchaseStorePackage = useCallback(
    (pkg: StorePackage) => {
      const totalGold = pkg.gold + pkg.bonusGold;
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => {
          if (u.id !== prev.currentUserId) return u;
          const ownedEntries = pkg.entryItem && !u.ownedEntries.includes(pkg.entryItem)
            ? [...u.ownedEntries, pkg.entryItem]
            : u.ownedEntries;
          return {
            ...u,
            gold: u.gold + totalGold,
            diamonds: u.diamonds + pkg.diamonds,
            ownedEntries,
            activeEntry: pkg.entryItem || u.activeEntry,
            title: pkg.titleGrant || u.title,
          };
        }),
      }));
      void apiMutate('/api/store/purchase', {
        body: {
          gold: pkg.gold,
          bonusGold: pkg.bonusGold,
          diamonds: pkg.diamonds,
          entryItem: pkg.entryItem,
          titleGrant: pkg.titleGrant,
        },
        idempotencyKey: makeIdempotencyKey('store'),
      });
      showToast(`تم تفعيل ${pkg.name} وإضافة الرصيد الفوري لحسابك!`, 'success');
    },
    [apiMutate, showToast]
  );

  const setActiveEntry = useCallback(
    (entry: string) => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === prev.currentUserId ? { ...u, activeEntry: entry } : u
        ),
      }));
      showToast(`تم تفعيل الدخولية: ${entry}`, 'success');
    },
    [showToast]
  );

  const addModerator = useCallback(
    (mod: Omit<ModeratorRecord, 'id' | 'status' | 'createdAt'>): ModeratorRecord => {
      const record: ModeratorRecord = {
        ...mod,
        id: `mod-${Date.now().toString().slice(-5)}`,
        status: 'active',
        createdAt: 'اليوم',
      };
      if (!isOwner) {
        showToast('🚫 ممنوع (403): تعيين المشرفين للمالك فقط', 'error');
        return record;
      }
      setState((prev) => ({
        ...prev,
        moderators: [record, ...prev.moderators],
      }));
      void apiMutate('/api/system/moderators', { body: mod as Record<string, unknown> });
      showToast(`تم إصدار صلاحية ${record.role} لـ ${record.name}`, 'success');
      return record;
    },
    [isOwner, apiMutate, showToast]
  );

  const toggleModeratorStatus = useCallback(
    (id: string) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): للمالك فقط', 'error');
        return;
      }
      setState((prev) => ({
        ...prev,
        moderators: prev.moderators.map((m) =>
          m.id === id ? { ...m, status: m.status === 'active' ? 'suspended' : 'active' } : m
        ),
      }));
      void apiMutate(`/api/system/moderators/${id}/toggle`);
      showToast('تم تحديث حالة المشرف', 'info');
    },
    [isOwner, apiMutate, showToast]
  );

  const deleteModerator = useCallback(
    (id: string) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): للمالك فقط', 'error');
        return;
      }
      setState((prev) => ({
        ...prev,
        moderators: prev.moderators.filter((m) => m.id !== id),
      }));
      void apiMutate(`/api/system/moderators/${id}`, { method: 'DELETE' });
      showToast('تم سحب صلاحية المشرف', 'warning');
    },
    [isOwner, apiMutate, showToast]
  );

  const resolveReport = useCallback(
    (id: string, status: 'resolved' | 'dismissed') => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): معالجة البلاغات للمالك فقط', 'error');
        return;
      }
      setState((prev) => ({
        ...prev,
        reports: prev.reports.map((r) => (r.id === id ? { ...r, status } : r)),
      }));
      void apiMutate(`/api/system/reports/${id}`, { body: { status } });
      showToast(status === 'resolved' ? 'تم تنفيذ الإجراء وإغلاق البلاغ' : 'تم حفظ البلاغ', 'info');
    },
    [isOwner, apiMutate, showToast]
  );

  const toggleUserBan = useCallback(
    (userId: string) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): الحظر الإداري للمالك فقط', 'error');
        return;
      }
      const target = state.users.find((u) => u.id === userId);
      if (target?.role === 'OWNER' || target?.isAdmin) {
        showToast('لا يمكن حظر الحساب الإداري الرئيسي', 'warning');
        return;
      }
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === userId ? { ...u, isBanned: !u.isBanned } : u)),
      }));
      void apiMutate('/api/system/user/ban', { body: { userId } });
      showToast('تم تحديث حالة الحظر للعضو', 'info');
    },
    [isOwner, state.users, apiMutate, showToast]
  );

  const verifyUserAgent = useCallback(
    (userId: string) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): توثيق الوكلاء للمالك فقط', 'error');
        return;
      }
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === userId ? { ...u, isVerifiedAgent: !u.isVerifiedAgent } : u
        ),
      }));
      void apiMutate('/api/system/user/verify-agent', { body: { userId } });
      showToast('تم تحديث شارة توثيق الوكالة', 'success');
    },
    [isOwner, apiMutate, showToast]
  );

  const switchUserAccount = useCallback(
    (userId: string) => {
      const target = state.users.find((u) => u.id === userId);
      if (!target) return;
      setState((prev) => ({ ...prev, currentUserId: userId }));
      void issueSessionToken(userId);
      if ((activeTab === 'agency-dashboard' || activeTab === 'system') && target.role !== 'OWNER') {
        setActiveTabState('rooms');
      }
      showToast(`تم التبديل إلى حساب ${target.name} (ID: ${target.id})`, 'info');
    },
    [state.users, activeTab, issueSessionToken, showToast]
  );

  const createVoiceRoom = useCallback(
    (
      title: string,
      country: string,
      flag: string,
      category: VoiceRoom['category'],
      description: string
    ) => {
      const me = state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const xpResult = applyXpGain(me.level, me.xp, ROOM_XP_REWARDS.createRoom);
      const totalMics = 20;
      const seats: VoiceRoom['seats'] = Array.from({ length: totalMics }, (_, i) => ({
        seatNumber: i + 1,
        userId: i === 0 ? me.id : null,
        userName: i === 0 ? me.name : null,
        avatar: i === 0 ? me.avatar : null,
        isMuted: false,
        isSpeaking: i === 0,
        isLocked: false,
      }));
      const newRoom: VoiceRoom = {
        id: `room-${Date.now().toString().slice(-5)}`,
        title: title.trim() || `غرفة ${me.name}`,
        ownerId: me.id,
        ownerName: me.name,
        ownerAvatar: me.avatar,
        coverImage: me.avatar,
        country,
        flag,
        category,
        description: description.trim() || 'مرحباً بالجميع في غرفتنا الصوتية المباشرة!',
        welcomeMessage: 'ارحبووو',
        themeId: 'ocean-stars',
        useThemeFilter: true,
        diceCount: 1,
        membershipCount: 0,
        membersOnlyEntry: false,
        allowVisitorsOnMic: true,
        sendEmojiToChat: false,
        visitorChatRequirement: 'all',
        bannedUserIds: [],
        heat: 0,
        listeners: 1,
        totalMics,
        seats,
        messages: [
          {
            id: `msg-${Date.now()}`,
            senderId: me.id,
            senderName: me.name,
            senderLevel: xpResult.level,
            text: 'تم افتتاح الغرفة الصوتية الآن — تفضلوا بالصعود على المايك!',
            type: 'system',
            timestamp: 'الآن',
          },
        ],
      };
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === me.id ? { ...u, level: xpResult.level, xp: xpResult.xp } : u
        ),
        rooms: [newRoom, ...prev.rooms],
      }));
      setActiveRoomId(newRoom.id);
      void apiMutate('/api/rooms/create', {
        body: { title, country, flag, category, description },
      }).then((res) => {
        const created = res.data?.room as VoiceRoom | undefined;
        if (created?.id) setActiveRoomId(created.id);
      });
      showToast(`تم إنشاء غرفتك الصوتية بنجاح! (+${ROOM_XP_REWARDS.createRoom} XP)`, 'success');
      if (xpResult.levelsGained > 0) {
        showToast(`🎉 مبروك! ارتفع مستواك إلى Lv.${xpResult.level} بفضل تفاعلك في الغرف!`, 'success');
      }
    },
    [state.users, state.currentUserId, apiMutate, setActiveRoomId, showToast]
  );

  const toggleSeatInRoom = useCallback(
    (roomId: string, seatNumber: number) => {
      if (currentUser.isBanned && !currentUser.isAdmin) {
        showToast('حسابك مقيد حالياً من الصعود على المايك', 'error');
        return;
      }
      const room = state.rooms.find((r) => r.id === roomId);
      if (!room) return;
      const clickedSeat = room.seats.find((s) => s.seatNumber === seatNumber);
      if (!clickedSeat || clickedSeat.isLocked) return;

      const me = state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      if (room.bannedUserIds?.includes(me.id) && me.role !== 'OWNER') {
        showToast('أنت محظور من التفاعل في هذه الغرفة', 'error');
        return;
      }
      const isSteppingDown = clickedSeat.userId === me.id;
      if (
        !isSteppingDown &&
        room.allowVisitorsOnMic === false &&
        me.role === 'USER' &&
        room.ownerId !== me.id
      ) {
        showToast('الصعود على المايك مقيد للزوار في إعدادات الغرفة', 'warning');
        return;
      }
      const isOccupiedByOther = Boolean(clickedSeat.userId) && !isSteppingDown;
      if (isOccupiedByOther) return;

      const wasAlreadySeated = room.seats.some((s) => s.userId === me.id);
      const shouldAwardMicXp = !isSteppingDown && !wasAlreadySeated;
      const xpResult = shouldAwardMicXp
        ? applyXpGain(me.level, me.xp, ROOM_XP_REWARDS.micAscend)
        : null;

      setState((prev) => ({
        ...prev,
        users: xpResult
          ? prev.users.map((u) =>
              u.id === me.id ? { ...u, level: xpResult.level, xp: xpResult.xp } : u
            )
          : prev.users,
        rooms: prev.rooms.map((r) => {
          if (r.id !== roomId) return r;
          if (isSteppingDown) {
            return {
              ...r,
              seats: r.seats.map((s) =>
                s.seatNumber === seatNumber
                  ? { ...s, userId: null, userName: null, avatar: null, isSpeaking: false, isMuted: false }
                  : s
              ),
            };
          }
          return {
            ...r,
            seats: r.seats.map((s) => {
              if (s.seatNumber === seatNumber) {
                return {
                  ...s,
                  userId: me.id,
                  userName: me.name,
                  avatar: me.avatar,
                  isMuted: false,
                  isSpeaking: true,
                };
              }
              if (s.userId === me.id) {
                return { ...s, userId: null, userName: null, avatar: null, isSpeaking: false };
              }
              return s;
            }),
          };
        }),
        tasks: prev.tasks.map((t) =>
          t.id === 'task-2' ? { ...t, progress: t.target } : t
        ),
      }));

      if (xpResult && xpResult.levelsGained > 0) {
        showToast(`🎉 مبروك! ارتفع مستواك إلى Lv.${xpResult.level} بفضل تفاعلك في الغرف!`, 'success');
      }
      void apiMutate(`/api/rooms/${roomId}/seat`, { body: { seatNumber } });
    },
    [currentUser.isBanned, currentUser.isAdmin, state.rooms, state.users, state.currentUserId, apiMutate, showToast]
  );

  const toggleMuteSeat = useCallback(
    (roomId: string, seatNumber: number) => {
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                seats: room.seats.map((s) =>
                  s.seatNumber === seatNumber
                    ? { ...s, isMuted: !s.isMuted, isSpeaking: s.isMuted }
                    : s
                ),
              }
            : room
        ),
      }));
      void apiMutate(`/api/rooms/${roomId}/mute`, { body: { seatNumber } });
    },
    [apiMutate]
  );

  const sendRoomMessage = useCallback(
    (roomId: string, text: string) => {
      if (currentUser.isBanned && !currentUser.isAdmin) {
        showToast('حسابك مقيد حالياً من إرسال الرسائل', 'error');
        return;
      }
      const clean = text.trim();
      if (!clean) return;
      const me = state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const targetRoom = state.rooms.find((r) => r.id === roomId);
      if (targetRoom) {
        if (targetRoom.bannedUserIds?.includes(me.id) && me.role !== 'OWNER') {
          showToast('تم تقييد إرسالك للرسائل في هذه الغرفة', 'error');
          return;
        }
        const isVisitor = me.role === 'USER' && targetRoom.ownerId !== me.id;
        if (isVisitor) {
          if (targetRoom.visitorChatRequirement === 'disallowed') {
            showToast('الدردشة غير مسموحة للزوار حسب إعدادات الغرفة', 'warning');
            return;
          }
          if (targetRoom.visitorChatRequirement === 'lv5' && me.level < 5) {
            showToast('يتطلب إرسال الرسائل للزوار الوصول إلى المستوى 5', 'warning');
            return;
          }
          if (targetRoom.visitorChatRequirement === 'lv10' && me.level < 10) {
            showToast('يتطلب إرسال الرسائل للزوار الوصول إلى المستوى 10', 'warning');
            return;
          }
        }
      }
      const xpResult = applyXpGain(me.level, me.xp, ROOM_XP_REWARDS.chatMessage);

      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === me.id ? { ...u, level: xpResult.level, xp: xpResult.xp } : u
        ),
        rooms: prev.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                messages: [
                  ...room.messages.slice(-30),
                  {
                    id: `m-${Date.now()}`,
                    senderId: me.id,
                    senderName: me.name,
                    senderLevel: xpResult.level,
                    text: clean,
                    type: 'chat',
                    timestamp: 'الآن',
                  },
                ],
              }
            : room
        ),
        tasks: prev.tasks.map((t) => (t.id === 'task-2' ? { ...t, progress: t.target } : t)),
      }));

      void apiMutate(`/api/rooms/${roomId}/message`, { body: { text: clean } });

      if (xpResult.levelsGained > 0) {
        showToast(`🎉 مبروك! ارتفع مستواك إلى Lv.${xpResult.level} بفضل تفاعلك في الغرف!`, 'success');
      }
    },
    [currentUser.isBanned, currentUser.isAdmin, state.users, state.rooms, state.currentUserId, apiMutate, showToast]
  );

  const updateRoomSettings = useCallback(
    (roomId: string, patch: Partial<VoiceRoom>) => {
      const target = state.rooms.find((r) => r.id === roomId);
      if (!target) return;
      const canManage =
        currentUser.role === 'OWNER' ||
        currentUser.role === 'SUPERVISOR' ||
        target.ownerId === currentUser.id;
      if (!canManage) {
        showToast('🚫 ممنوع (403): تعديل إعدادات الغرفة لصاحب الغرفة أو المشرفين فقط', 'error');
        return;
      }

      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) => {
          if (r.id !== roomId) return r;
          const next = { ...r, ...patch };
          if (typeof patch.coverImage === 'string' && patch.coverImage.trim()) {
            next.ownerAvatar = patch.coverImage.trim();
          }
          if (typeof patch.password === 'string') {
            next.isLocked = Boolean(patch.password.trim());
          }
          if (typeof patch.totalMics === 'number' && Number.isFinite(patch.totalMics)) {
            const count = Math.min(20, Math.max(1, Math.round(patch.totalMics)));
            next.totalMics = count;
            const bySeat = new Map(r.seats.map((s) => [s.seatNumber, s]));
            next.seats = Array.from({ length: count }, (_, idx) => {
              const num = idx + 1;
              return (
                bySeat.get(num) || {
                  seatNumber: num,
                  userId: null,
                  userName: null,
                  avatar: null,
                  isMuted: false,
                  isSpeaking: false,
                  isLocked: false,
                }
              );
            });
          }
          return next;
        }),
      }));

      void apiMutate(`/api/rooms/${roomId}/settings`, {
        method: 'PATCH',
        body: patch as Record<string, unknown>,
      });
    },
    [state.rooms, currentUser.role, currentUser.id, apiMutate, showToast]
  );

  const toggleRoomBanUser = useCallback(
    (roomId: string, userId: string) => {
      const target = state.rooms.find((r) => r.id === roomId);
      if (!target) return;
      const canManage =
        currentUser.role === 'OWNER' ||
        currentUser.role === 'SUPERVISOR' ||
        target.ownerId === currentUser.id;
      if (!canManage) {
        showToast('🚫 ممنوع (403): إدارة الحظر للمشرف أو المالك فقط', 'error');
        return;
      }
      if (userId === target.ownerId) {
        showToast('لا يمكن حظر مالك الغرفة', 'warning');
        return;
      }
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) => {
          if (r.id !== roomId) return r;
          const current = r.bannedUserIds || [];
          const isBannedNow = current.includes(userId);
          const bannedUserIds = isBannedNow
            ? current.filter((id) => id !== userId)
            : [...current, userId];
          const seats = !isBannedNow
            ? r.seats.map((s) =>
                s.userId === userId
                  ? { ...s, userId: null, userName: null, avatar: null, isSpeaking: false, isMuted: false }
                  : s
              )
            : r.seats;
          return { ...r, bannedUserIds, seats };
        }),
      }));
      void apiMutate(`/api/rooms/${roomId}/ban`, { body: { userId } });
      showToast('تم تحديث قائمة الحظر في الغرفة', 'info');
    },
    [state.rooms, currentUser.role, currentUser.id, apiMutate, showToast]
  );

  const deleteVoiceRoom = useCallback(
    (roomId: string) => {
      const target = state.rooms.find((r) => r.id === roomId);
      if (!target) return;
      const canManage =
        currentUser.role === 'OWNER' ||
        currentUser.role === 'SUPERVISOR' ||
        target.ownerId === currentUser.id;
      if (!canManage) {
        showToast('🚫 ممنوع (403): حذف الغرفة لصاحب الغرفة أو المالك فقط', 'error');
        return;
      }
      if (state.rooms.length <= 1) {
        showToast('لا يمكن حذف آخر غرفة نشطة في المنصة', 'warning');
        return;
      }
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.filter((r) => r.id !== roomId),
      }));
      if (activeRoomId === roomId) setActiveRoomIdState(null);
      if (minimizedRoomId === roomId) setMinimizedRoomId(null);
      void apiMutate(`/api/rooms/${roomId}`, { method: 'DELETE' });
      showToast(`تم حذف غرفة «${target.title}»`, 'warning');
    },
    [state.rooms, currentUser.role, currentUser.id, activeRoomId, minimizedRoomId, apiMutate, showToast]
  );

  const dismissGiftAnimation = useCallback(() => {
    if (giftTimerRef.current) window.clearTimeout(giftTimerRef.current);
    setActiveGiftAnimation(null);
  }, []);

  const playGiftBanner = useCallback((anim: Omit<ActiveGiftAnimation, 'id'>) => {
    if (giftTimerRef.current) window.clearTimeout(giftTimerRef.current);
    setActiveGiftAnimation((prev) => {
      const sameCombo =
        prev &&
        prev.roomId === anim.roomId &&
        prev.giftId === anim.giftId &&
        prev.recipientId === anim.recipientId &&
        prev.senderName === anim.senderName;
      return {
        ...anim,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        quantity: sameCombo ? prev.quantity + anim.quantity : anim.quantity,
      };
    });
    giftTimerRef.current = window.setTimeout(() => {
      setActiveGiftAnimation(null);
    }, 3600);
  }, []);

  const sendRoomGift = useCallback(
    (roomId: string, giftId: string, recipientId?: string, quantity = 1): boolean => {
      const gift = ROOM_GIFTS.find((g) => g.id === giftId);
      if (!gift) return false;
      const room = state.rooms.find((r) => r.id === roomId);
      if (!room) return false;

      const me = state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const safeQty = Math.max(1, quantity);
      const totalCost = gift.costGold * safeQty;
      const totalHeat = gift.heatGain * safeQty;

      if (me.gold < totalCost) {
        showToast('رصيد الذهب غير كافٍ لإرسال هذه الهدية', 'warning');
        return false;
      }

      const targetId = recipientId || room.ownerId;
      const targetUser =
        state.users.find((u) => u.id === targetId) ||
        state.users.find((u) => u.id === room.ownerId) ||
        me;

      const recipientDiamondBonus = Math.max(1, Math.round(totalCost / 20_000));
      const charismaGain = Math.max(1, Math.round(totalCost / 10_000));
      const senderXpGain =
        ROOM_XP_REWARDS.sendGiftBase * safeQty + Math.min(5000, Math.floor(totalCost / 20_000));
      const recipientXpGain = ROOM_XP_REWARDS.receiveGift * safeQty;

      const isSelfGift = me.id === targetUser.id;
      const senderXpResult = applyXpGain(
        me.level,
        me.xp,
        isSelfGift ? senderXpGain + recipientXpGain : senderXpGain
      );
      const recipientXpResult = isSelfGift
        ? senderXpResult
        : applyXpGain(targetUser.level, targetUser.xp, recipientXpGain);

      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => {
          if (isSelfGift && u.id === me.id) {
            return {
              ...u,
              gold: u.gold - totalCost,
              diamonds: Number((u.diamonds + recipientDiamondBonus).toFixed(2)),
              charisma: (u.charisma || 0) + charismaGain,
              giftedGold: (u.giftedGold || 0) + totalCost,
              level: senderXpResult.level,
              xp: senderXpResult.xp,
            };
          }
          if (u.id === me.id) {
            return {
              ...u,
              gold: u.gold - totalCost,
              giftedGold: (u.giftedGold || 0) + totalCost,
              level: senderXpResult.level,
              xp: senderXpResult.xp,
            };
          }
          if (u.id === targetUser.id) {
            return {
              ...u,
              diamonds: Number((u.diamonds + recipientDiamondBonus).toFixed(2)),
              charisma: (u.charisma || 0) + charismaGain,
              level: recipientXpResult.level,
              xp: recipientXpResult.xp,
            };
          }
          return u;
        }),
        rooms: prev.rooms.map((r) => {
          if (r.id !== roomId) return r;
          const nextHeat = r.heat + totalHeat;
          return {
            ...r,
            heat: nextHeat,
            wealthBadge: computeWealthBadge(nextHeat) || r.wealthBadge,
            messages: [
              ...r.messages.slice(-30),
              {
                id: `g-${Date.now()}`,
                senderId: me.id,
                senderName: me.name,
                senderLevel: senderXpResult.level,
                text: `أرسل ${safeQty > 1 ? `${safeQty}× ` : ''}${gift.icon} ${gift.name} إلى ${targetUser.name} (+${totalHeat.toLocaleString('en-US')} حرارة)`,
                type: 'gift',
                timestamp: 'الآن',
              },
            ],
          };
        }),
        hostBonusPoolGold: prev.hostBonusPoolGold + Math.floor(totalCost * 0.12),
        hosts: prev.hosts.map((h) =>
          h.userId === targetUser.id || h.roomId === roomId
            ? {
                ...h,
                giftsReceivedGold: h.giftsReceivedGold + totalCost,
                diamondsEarned: h.diamondsEarned + recipientDiamondBonus,
                pendingCommissionGold:
                  h.pendingCommissionGold + Math.floor((totalCost * h.commissionRate) / 100),
              }
            : h
        ),
      }));

      void apiMutate(`/api/rooms/${roomId}/gift`, {
        body: { giftId, recipientId: targetUser.id, quantity: safeQty },
      });

      playGiftBanner({
        roomId,
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.icon,
        senderName: me.name,
        recipientId: targetUser.id,
        recipientName: targetUser.name,
        recipientAvatar: targetUser.avatar,
        quantity: safeQty,
        costGold: totalCost,
        isGrand: gift.isGrand,
      });

      if (gift.isGrand) {
        triggerRoyalDragon(me.name);
      }
      if (senderXpResult.levelsGained > 0) {
        showToast(`🎉 مبروك! ارتفع مستواك إلى Lv.${senderXpResult.level} بفضل تفاعلك في الغرف!`, 'success');
      }
      return true;
    },
    [state.users, state.rooms, state.currentUserId, apiMutate, showToast, triggerRoyalDragon, playGiftBanner]
  );

  const triggerIncomingGiftForMe = useCallback(
    (roomId: string) => {
      const room = state.rooms.find((r) => r.id === roomId);
      if (!room) return;
      const me = state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const otherUsers = state.users.filter((u) => u.id !== me.id);
      const sender = otherUsers[Math.floor(Math.random() * otherUsers.length)] || me;
      const sampleGifts = ROOM_GIFTS.filter((g) => !g.isGrand);
      const gift = sampleGifts[Math.floor(Math.random() * sampleGifts.length)];
      const rewardDiamonds = Math.max(5, Math.round(gift.costGold / 15_000));
      const charismaGain = Math.max(1, Math.round(gift.costGold / 10_000));
      const xpResult = applyXpGain(me.level, me.xp, ROOM_XP_REWARDS.incomingGiftBonus);

      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === me.id
            ? {
                ...u,
                diamonds: Number((u.diamonds + rewardDiamonds).toFixed(2)),
                charisma: (u.charisma || 0) + charismaGain,
                level: xpResult.level,
                xp: xpResult.xp,
              }
            : u
        ),
        rooms: prev.rooms.map((r) => {
          if (r.id !== roomId) return r;
          const nextHeat = r.heat + gift.heatGain;
          return {
            ...r,
            heat: nextHeat,
            wealthBadge: computeWealthBadge(nextHeat) || r.wealthBadge,
            messages: [
              ...r.messages.slice(-30),
              {
                id: `g-in-${Date.now()}`,
                senderId: sender.id,
                senderName: sender.name,
                senderLevel: sender.level,
                text: `أهدى ${me.name} هدية ${gift.icon} ${gift.name} (+${rewardDiamonds} ماسة · +${ROOM_XP_REWARDS.incomingGiftBonus} XP)`,
                type: 'gift',
                timestamp: 'الآن',
              },
            ],
          };
        }),
      }));

      playGiftBanner({
        roomId,
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.icon,
        senderName: sender.name,
        recipientId: me.id,
        recipientName: me.name,
        recipientAvatar: me.avatar,
        quantity: 1,
        costGold: gift.costGold,
      });

      showToast(
        `استلمت هدية ${gift.icon} ${gift.name} من ${sender.name}! (+${ROOM_XP_REWARDS.incomingGiftBonus} XP)`,
        'success'
      );
      if (xpResult.levelsGained > 0) {
        showToast(`🎉 مبروك! ارتفع مستواك إلى Lv.${xpResult.level} بفضل تفاعلك في الغرف!`, 'success');
      }
    },
    [state.rooms, state.users, state.currentUserId, playGiftBanner, showToast]
  );

  const completeTaskProgress = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, progress: t.target } : t)),
    }));
  }, []);

  const claimTaskReward = useCallback(
    (taskId: string) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task || task.claimed || task.progress < task.target) return;
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, claimed: true } : t)),
        users: prev.users.map((u) =>
          u.id === prev.currentUserId
            ? {
                ...u,
                gold: u.gold + task.rewardGold,
                diamonds: u.diamonds + task.rewardDiamonds,
              }
            : u
        ),
      }));
      showToast(`تم استلام مكافأة المهمة: +${task.rewardGold.toLocaleString('en-US')} ذهب!`, 'success');
    },
    [state.tasks, showToast]
  );

  const joinAristocratTier = useCallback(
    (tierName: string, costGold: number): boolean => {
      if (currentUser.gold < costGold) {
        showToast('رصيد الذهب غير كافٍ للانضمام لهذه الرتبة', 'warning');
        return false;
      }
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === prev.currentUserId
            ? { ...u, gold: u.gold - costGold, aristocratTier: tierName }
            : u
        ),
      }));
      showToast(`مبروك! أصبحت الآن برتبة ${tierName} في الارستقراط`, 'success');
      return true;
    },
    [currentUser.gold, showToast]
  );

  const upgradeSvip = useCallback((): boolean => {
    if (currentUser.svip >= 7) {
      showToast('أنت بالفعل في أعلى رتبة SVIP 7 الملكية!', 'info');
      return false;
    }
    const cost = (currentUser.svip + 1) * 50_000_000;
    if (currentUser.gold < cost) {
      showToast('تحتاج إلى ذهب إضافي للترقية للمستوى التالي', 'warning');
      return false;
    }
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === prev.currentUserId
          ? { ...u, gold: u.gold - cost, svip: u.svip + 1 }
          : u
      ),
    }));
    showToast(`تمت ترقيتك إلى SVIP ${currentUser.svip + 1}!`, 'success');
    return true;
  }, [currentUser.svip, currentUser.gold, showToast]);

  const clearRoomMessages = useCallback(
    (roomId: string) => {
      const me = state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId
            ? {
                ...r,
                messages: [
                  {
                    id: `clr-${Date.now()}`,
                    senderId: me.id,
                    senderName: me.name,
                    senderLevel: me.level,
                    text: 'قام مالك الغرفة بمسح رسالة دردشة الغرفة',
                    type: 'system',
                    timestamp: 'الآن',
                  },
                ],
              }
            : r
        ),
      }));
      void apiMutate(`/api/rooms/${roomId}/clear`);
      showToast('تم مسح رسائل دردشة الغرفة', 'info');
    },
    [state.users, state.currentUserId, apiMutate, showToast]
  );

  const exchangeDiamondsToGold = useCallback(
    (diamondAmount: number): boolean => {
      const safeAmount = Math.floor(diamondAmount);
      if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        showToast('أدخل عدداً صحيحاً من الماس للاستبدال', 'warning');
        return false;
      }
      if (currentUser.diamonds < safeAmount) {
        showToast('رصيد الماس غير كافٍ لإتمام الاستبدال', 'warning');
        return false;
      }
      const gainedGold = safeAmount * 15_000;
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === prev.currentUserId
            ? {
                ...u,
                diamonds: Number((u.diamonds - safeAmount).toFixed(2)),
                gold: u.gold + gainedGold,
              }
            : u
        ),
      }));
      void apiMutate('/api/wallet/exchange', { body: { diamondAmount: safeAmount } });
      showToast(
        `تم استبدال ${safeAmount.toLocaleString('en-US')} ماسة بـ +${gainedGold.toLocaleString('en-US')} ذهب!`,
        'success'
      );
      return true;
    },
    [currentUser.diamonds, apiMutate, showToast]
  );

  const purchaseWalletPack = useCallback(
    (gold: number, priceLabel: string) => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === prev.currentUserId ? { ...u, gold: u.gold + gold } : u
        ),
      }));
      void apiMutate('/api/wallet/recharge', {
        body: { gold },
        idempotencyKey: makeIdempotencyKey('wallet'),
      });
      showToast(
        `تم شحن +${gold.toLocaleString('en-US')} ذهبية ($US ${priceLabel}) لحسابك بنجاح!`,
        'success'
      );
    },
    [apiMutate, showToast]
  );

  const recordGameBet = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setState((prev) => {
      const me = prev.users.find((u) => u.id === prev.currentUserId) || prev.users[0];
      const xpGain = Math.min(250, Math.max(8, Math.floor(amount / 15_000)));
      const xpResult = applyXpGain(me.level, me.xp, xpGain);
      return {
        ...prev,
        jackpotProgress: Math.min(JACKPOT_TARGET, prev.jackpotProgress + amount),
        dailyStakedGold: prev.dailyStakedGold + amount,
        users: prev.users.map((u) =>
          u.id === me.id ? { ...u, level: xpResult.level, xp: xpResult.xp } : u
        ),
        tasks: prev.tasks.map((t) =>
          t.id === 'task-3' ? { ...t, progress: t.target } : t
        ),
      };
    });
  }, []);

  const claimJackpotChest = useCallback((): boolean => {
    if (state.jackpotProgress < JACKPOT_TARGET) {
      const remaining = JACKPOT_TARGET - state.jackpotProgress;
      showToast(
        `متبقي ${remaining.toLocaleString('en-US')} ذهب رهان لفتح صندوق الـ 600M!`,
        'info'
      );
      return false;
    }
    setState((prev) => ({
      ...prev,
      jackpotProgress: 0,
      users: prev.users.map((u) =>
        u.id === prev.currentUserId
          ? {
              ...u,
              gold: u.gold + JACKPOT_REWARD,
              diamonds: u.diamonds + 250,
            }
          : u
      ),
    }));
    triggerRoyalDragon(currentUser.name);
    showToast(
      `🏆 مبروك! فتحت صندوق الجاك بوت الملكي: +50,000,000 ذهبية و +250 ماسة!`,
      'success'
    );
    return true;
  }, [state.jackpotProgress, currentUser.name, showToast, triggerRoyalDragon]);

  const claimDailyCashback = useCallback((): number => {
    const eligibleStake = Math.max(0, state.dailyStakedGold - state.cashbackClaimedBase);
    const refund = Math.floor(eligibleStake * 0.08);
    if (refund <= 0) {
      showToast('العب جولات في الفواكه أو الخضروات لتجميع استرداد 8% اليومي!', 'info');
      return 0;
    }
    setState((prev) => ({
      ...prev,
      cashbackClaimedBase: prev.dailyStakedGold,
      users: prev.users.map((u) =>
        u.id === prev.currentUserId ? { ...u, gold: u.gold + refund } : u
      ),
    }));
    showToast(`💸 تم استلام عودة 8% لليوم: +${refund.toLocaleString('en-US')} ذهبية!`, 'success');
    return refund;
  }, [state.dailyStakedGold, state.cashbackClaimedBase, showToast]);

  const claimDailyStreakBonus = useCallback((): boolean => {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastCheckInDate === today) {
      showToast('لقد استلمت مكافأة الحضور الأسطورية لليوم بالفعل — عُد غداً!', 'info');
      return false;
    }
    const nextDay = state.streakDay >= 7 ? 1 : state.streakDay + 1;
    const goldRewards = [500_000, 1_000_000, 2_000_000, 4_000_000, 7_500_000, 12_000_000, 25_000_000];
    const diamondRewards = [15, 25, 40, 65, 100, 150, 300];
    const gReward = goldRewards[nextDay - 1] || 500_000;
    const dReward = diamondRewards[nextDay - 1] || 15;
    const xpReward = nextDay * 40;

    setState((prev) => {
      const me = prev.users.find((u) => u.id === prev.currentUserId) || prev.users[0];
      const xpResult = applyXpGain(me.level, me.xp, xpReward);
      return {
        ...prev,
        streakDay: nextDay,
        lastCheckInDate: today,
        users: prev.users.map((u) =>
          u.id === me.id
            ? {
                ...u,
                gold: u.gold + gReward,
                diamonds: u.diamonds + dReward,
                level: xpResult.level,
                xp: xpResult.xp,
              }
            : u
        ),
      };
    });
    showToast(
      `🎁 مكافأة اليوم ${nextDay}: +${gReward.toLocaleString('en-US')} ذهب · +${dReward} ماسة · +${xpReward} XP!`,
      'success'
    );
    return true;
  }, [state.lastCheckInDate, state.streakDay, showToast]);

  const purchaseAgentWholesalePack = useCallback(
    (gold: number, priceUsd: number) => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === prev.currentUserId ? { ...u, gold: u.gold + gold } : u
        ),
      }));
      void apiMutate('/api/agency/wholesale', {
        body: { gold },
        idempotencyKey: makeIdempotencyKey('wholesale'),
      });
      showToast(
        `تمت تعبئة رصيد وكيل الشحن بـ +${gold.toLocaleString('en-US')} ذهبية ($${priceUsd}) بنجاح!`,
        'success'
      );
    },
    [apiMutate, showToast]
  );

  const sendRechargeInvite = useCallback((): number => {
    const reward = 1_000_000;
    setState((prev) => ({
      ...prev,
      agentInviteCount: prev.agentInviteCount + 1,
      users: prev.users.map((u) =>
        u.id === prev.currentUserId ? { ...u, gold: u.gold + reward } : u
      ),
    }));
    void apiMutate('/api/agency/invite');
    showToast(
      `تم إنشاء دعوة إعادة الشحن وإضافة +1,000,000 ذهبية مكافأة دعوة لحسابك!`,
      'success'
    );
    return reward;
  }, [apiMutate, showToast]);

  const registerAsAgent = useCallback(
    (agencyTitle: string) => {
      const cleanTitle = agencyTitle.trim() || `وكالة ${currentUser.name}`;
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === prev.currentUserId
            ? {
                ...u,
                isVerifiedAgent: true,
                title: cleanTitle,
                gold: u.gold + 5_000_000,
              }
            : u
        ),
      }));
      void apiMutate('/api/agency/register', { body: { agencyTitle: cleanTitle } });
      showToast(`🎉 مبروك! تم توثيق «${cleanTitle}» كوكالة شحن معتمدة (+5M مخزون هدية)`, 'success');
    },
    [currentUser.name, apiMutate, showToast]
  );

  const distributeProfitsAutomatically = useCallback(
    (mode: 'auto' | 'manual' = 'auto'): boolean => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403 Forbidden): توزيع الأرباح محصور لحساب المالك فقط', 'error');
        return false;
      }
      const pendingTotal = state.hosts.reduce((sum, h) => sum + h.pendingCommissionGold, 0);
      const bonusPool = state.hostBonusPoolGold;
      const totalDistributable = pendingTotal + bonusPool;

      if (totalDistributable <= 0) {
        showToast('لا توجد عمولات معلقة أو أرباح في المجمع حالياً للتوزيع', 'info');
        return false;
      }

      const agencyShareFromPool = Math.floor((bonusPool * state.agencyCommissionSplit) / 100);
      const hostsPoolShare = Math.max(0, bonusPool - agencyShareFromPool);
      const totalWeight = state.hosts.reduce(
        (sum, h) => sum + Math.max(1, h.giftsReceivedGold),
        0
      );

      const payoutsByUserId = new Map<string, number>();
      let hostsDistributedTotal = 0;

      state.hosts.forEach((h) => {
        const shareFromPool =
          totalWeight > 0
            ? Math.floor((hostsPoolShare * Math.max(1, h.giftsReceivedGold)) / totalWeight)
            : 0;
        const hostTotal = h.pendingCommissionGold + shareFromPool;
        hostsDistributedTotal += hostTotal;
        payoutsByUserId.set(h.userId, (payoutsByUserId.get(h.userId) || 0) + hostTotal);
      });

      const nowTime = new Date().toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const entry: CommissionDistribution = {
        id: `dist-${Date.now().toString().slice(-5)}`,
        timestamp: `الآن · ${nowTime}`,
        totalPoolGold: totalDistributable,
        hostsCount: state.hosts.length,
        agencyShareGold: agencyShareFromPool,
        hostsShareGold: hostsDistributedTotal,
        mode,
        note:
          mode === 'auto'
            ? `توزيع آلي لـ ${state.hosts.length} مضيفين (حصة الوكالة ${state.agencyCommissionSplit}%)`
            : `تسوية يدوية فورية لـ ${state.hosts.length} مضيفين`,
      };

      setState((prev) => ({
        ...prev,
        hostBonusPoolGold: 0,
        hosts: prev.hosts.map((h) => ({ ...h, pendingCommissionGold: 0 })),
        users: prev.users.map((u) => {
          const hostGain = payoutsByUserId.get(u.id) || 0;
          const agencyGain = u.id === prev.currentUserId ? agencyShareFromPool : 0;
          const totalGain = hostGain + agencyGain;
          return totalGain > 0 ? { ...u, gold: u.gold + totalGain } : u;
        }),
        distributions: [entry, ...prev.distributions],
      }));

      void apiMutate('/api/agency/distribute', { body: { mode } });

      showToast(
        `⚡ تم التوزيع الآلي: +${hostsDistributedTotal.toLocaleString('en-US')} ذهب للمضيفين و +${agencyShareFromPool.toLocaleString('en-US')} ذهب للوكالة!`,
        'success'
      );
      return true;
    },
    [isOwner, state.hosts, state.hostBonusPoolGold, state.agencyCommissionSplit, apiMutate, showToast]
  );

  const distributeSingleHostCommission = useCallback(
    (hostId: string): boolean => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403 Forbidden): صرف العمولات محصور للمالك فقط', 'error');
        return false;
      }
      const host = state.hosts.find((h) => h.id === hostId);
      if (!host) return false;
      if (host.pendingCommissionGold <= 0) {
        showToast(`لا توجد عمولات معلقة حالياً للمضيف ${host.name}`, 'info');
        return false;
      }

      const payout = host.pendingCommissionGold;
      const nowTime = new Date().toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const entry: CommissionDistribution = {
        id: `dist-${Date.now().toString().slice(-5)}`,
        timestamp: `الآن · ${nowTime}`,
        totalPoolGold: payout,
        hostsCount: 1,
        agencyShareGold: 0,
        hostsShareGold: payout,
        mode: 'manual',
        note: `صرف عمولة فردية إلى ${host.name} (${host.commissionRate}%)`,
      };

      setState((prev) => ({
        ...prev,
        hosts: prev.hosts.map((h) =>
          h.id === hostId ? { ...h, pendingCommissionGold: 0 } : h
        ),
        users: prev.users.map((u) =>
          u.id === host.userId ? { ...u, gold: u.gold + payout } : u
        ),
        distributions: [entry, ...prev.distributions],
      }));

      void apiMutate('/api/agency/payout', { body: { hostId } });

      showToast(
        `تم صرف عمولة ${host.name}: +${payout.toLocaleString('en-US')} ذهبية بنجاح!`,
        'success'
      );
      return true;
    },
    [isOwner, state.hosts, apiMutate, showToast]
  );

  const updateHostCommissionRate = useCallback(
    (hostId: string, rate: number) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): تعديل العمولات للمالك فقط', 'error');
        return;
      }
      const clampedRate = Math.min(30, Math.max(5, Math.round(rate)));
      setState((prev) => ({
        ...prev,
        hosts: prev.hosts.map((h) => {
          if (h.id !== hostId) return h;
          const prevRate = Math.max(1, h.commissionRate);
          const updatedPending =
            h.pendingCommissionGold > 0
              ? Math.round((h.pendingCommissionGold * clampedRate) / prevRate)
              : 0;
          return {
            ...h,
            commissionRate: clampedRate,
            pendingCommissionGold: updatedPending,
          };
        }),
      }));
      void apiMutate('/api/agency/commission', { body: { hostId, rate: clampedRate } });
      showToast(`تم تعديل نسبة عمولة المضيف إلى ${clampedRate}%`, 'info');
    },
    [isOwner, apiMutate, showToast]
  );

  const toggleAutoDistribution = useCallback(() => {
    if (!isOwner) {
      showToast('🚫 ممنوع (403): للمالك فقط', 'error');
      return;
    }
    setState((prev) => {
      const next = !prev.autoDistributeEnabled;
      showToast(
        next
          ? 'تم تفعيل التوزيع الآلي للأرباح والعمولات كل دورة'
          : 'تم إيقاف التوزيع الآلي المؤقت — يمكنك التوزيع يدوياً في أي وقت',
        'info'
      );
      return { ...prev, autoDistributeEnabled: next };
    });
    void apiMutate('/api/agency/toggle-auto');
  }, [isOwner, apiMutate, showToast]);

  const setAgencyCommissionSplit = useCallback(
    (pct: number) => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): للمالك فقط', 'error');
        return;
      }
      const safePct = Math.min(40, Math.max(5, Math.round(pct)));
      setState((prev) => ({ ...prev, agencyCommissionSplit: safePct }));
      void apiMutate('/api/agency/split', { body: { pct: safePct } });
      showToast(`تم ضبط حصة الوكالة إلى ${safePct}% وحصة المضيفين ${100 - safePct}%`, 'info');
    },
    [isOwner, apiMutate, showToast]
  );

  const addAgencyHost = useCallback(
    (userId: string, roomId: string, targetGold: number, commissionRate: number): boolean => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): إضافة المضيفين للمالك فقط', 'error');
        return false;
      }
      const user = state.users.find((u) => u.id === userId.trim());
      if (!user) {
        showToast('معرف العضو غير موجود', 'error');
        return false;
      }
      if (state.hosts.some((h) => h.userId === user.id)) {
        showToast(`${user.name} مسجل بالفعل كمضيف في الوكالة`, 'warning');
        return false;
      }
      const room = state.rooms.find((r) => r.id === roomId) || state.rooms[0];
      const safeTarget = Math.max(10_000_000, targetGold || 100_000_000);
      const safeRate = Math.min(30, Math.max(5, commissionRate || 15));
      const newHost: AgencyHostRecord = {
        id: `host-${user.id}`,
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        roomId: room.id,
        roomTitle: room.title,
        hoursLive: 1.5,
        giftsReceivedGold: 12_000_000,
        diamondsEarned: 600,
        targetGold: safeTarget,
        commissionRate: safeRate,
        pendingCommissionGold: Math.floor((12_000_000 * safeRate) / 100),
        status: 'online',
      };
      setState((prev) => ({
        ...prev,
        hosts: [newHost, ...prev.hosts],
      }));
      void apiMutate('/api/agency/host/add', {
        body: { userId: user.id, roomId: room.id, targetGold: safeTarget, commissionRate: safeRate },
      });
      showToast(`تم ضم ${user.name} كمضيف رسمي لغرفة «${room.title}»!`, 'success');
      return true;
    },
    [isOwner, state.users, state.hosts, state.rooms, apiMutate, showToast]
  );

  const boostHostDailyProfit = useCallback(
    (hostId: string, amountGold = 5_000_000): { reachedTarget: boolean; hostName: string } => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): للمالك فقط', 'error');
        return { reachedTarget: false, hostName: '' };
      }
      const host = state.hosts.find((h) => h.id === hostId);
      if (!host) return { reachedTarget: false, hostName: '' };
      const safeGain = Math.max(500_000, amountGold);
      const nextTotal = host.giftsReceivedGold + safeGain;
      const wasBelowTarget = host.giftsReceivedGold < host.targetGold;
      const reachedTarget = wasBelowTarget && nextTotal >= host.targetGold;
      const commissionGain = Math.floor((safeGain * host.commissionRate) / 100);
      const milestoneBonus = reachedTarget ? 1_000_000 : 0;

      setState((prev) => ({
        ...prev,
        hostBonusPoolGold: prev.hostBonusPoolGold + Math.floor(safeGain * 0.1),
        hosts: prev.hosts.map((h) =>
          h.id === hostId
            ? {
                ...h,
                giftsReceivedGold: h.giftsReceivedGold + safeGain,
                diamondsEarned: h.diamondsEarned + Math.round(safeGain / 20_000),
                pendingCommissionGold: h.pendingCommissionGold + commissionGain + milestoneBonus,
              }
            : h
        ),
      }));

      void apiMutate('/api/agency/host/boost', { body: { hostId, amountGold: safeGain } });

      if (reachedTarget) {
        showToast(
          `🏆 تهانينا! وصل المضيف ${host.name} إلى الهدف الربحي اليومي (+1M عمولة تحفيزية)!`,
          'success'
        );
      } else {
        showToast(
          `تم تسجيل +${safeGain.toLocaleString('en-US')} ذهب أرباح يومية للمضيف ${host.name}`,
          'info'
        );
      }
      return { reachedTarget, hostName: host.name };
    },
    [isOwner, state.hosts, apiMutate, showToast]
  );

  const resetDemoData = useCallback(() => {
    if (!isOwner) {
      showToast('🚫 ممنوع (403): استعادة النظام للمالك فقط', 'error');
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    suppressNextLevelTriggerRef.current = true;
    setLevelUpModal(null);
    setState(DEFAULT_STATE);
    setActiveRoomIdState(null);
    setMinimizedRoomId(null);
    void apiMutate('/api/system/reset');
    showToast('تمت استعادة الإعدادات الافتراضية لرياض شات', 'info');
  }, [isOwner, apiMutate, showToast]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activeRoomId,
        setActiveRoomId,
        minimizedRoomId,
        minimizeRoom,
        restoreMinimizedRoom,
        closeMinimizedRoom,
        walletInitialTab,
        openWallet,
        state,
        currentUser,
        toasts,
        dragonOverlayActive,
        dragonBannerText,
        activeGiftAnimation,
        dismissGiftAnimation,
        levelUpModal,
        dismissLevelUpModal,
        shareLevelAchievementInRoom,
        isRealtimeConnected,
        followedUserIds,
        toggleFollowUser,
        showToast,
        triggerRoyalDragon,
        updateAnnouncement,
        setGameLuckMode,
        setDiceMultiplier,
        toggleMaintenanceMode,
        toggleUltraNightMode,
        grantRoyalBlessingAll,
        feedAdminTreasury,
        boostAllRoomsHeat,
        boostRoomHeat,
        adjustUserGold,
        transferAgencyGold,
        purchaseStorePackage,
        setActiveEntry,
        addModerator,
        toggleModeratorStatus,
        deleteModerator,
        resolveReport,
        toggleUserBan,
        verifyUserAgent,
        switchUserAccount,
        createVoiceRoom,
        updateRoomSettings,
        toggleRoomBanUser,
        deleteVoiceRoom,
        toggleSeatInRoom,
        toggleMuteSeat,
        sendRoomMessage,
        clearRoomMessages,
        sendRoomGift,
        triggerIncomingGiftForMe,
        exchangeDiamondsToGold,
        purchaseWalletPack,
        completeTaskProgress,
        claimTaskReward,
        joinAristocratTier,
        upgradeSvip,
        recordGameBet,
        claimJackpotChest,
        claimDailyCashback,
        claimDailyStreakBonus,
        purchaseAgentWholesalePack,
        sendRechargeInvite,
        registerAsAgent,
        distributeProfitsAutomatically,
        distributeSingleHostCommission,
        updateHostCommissionRate,
        toggleAutoDistribution,
        setAgencyCommissionSplit,
        addAgencyHost,
        boostHostDailyProfit,
        sendSpeakingState,
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
