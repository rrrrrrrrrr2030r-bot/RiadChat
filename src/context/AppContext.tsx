import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  ActiveGiftAnimation,
  Agency2FAChannel,
  Agency2FAStatus,
  AgencyApplicationRequest,
  AgencyHostRecord,
  AgencyTransfer,
  CommissionDistribution,
  DailyTask,
  DiceMultiplier,
  GameLuckMode,
  InAppNotification,
  InviteLinkRecord,
  MainTab,
  ModeratorRecord,
  NotificationPreferences,
  OpsOverviewResponse,
  ReportRecord,
  RoomTelemetryPoint,
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
import { useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { resolveApiUrl, resolveWsUrl } from '../utils/apiBase';
import {
  QUERY_KEYS,
  SERVER_STATE_STALE_TIME_MS,
  clearSessionQueries,
  fetchCurrentUserSession,
  fetchServerStateSnapshot,
  hydrateServerStateCache,
  patchRoomSpeakingInCache,
} from '../lib/queryClient';

const SESSION_TOKEN_KEY = 'riad_chat_session_token_v1';
const PENDING_REFERRAL_KEY = 'riad_chat_pending_referral_v1';
const PENDING_ROOM_KEY = 'riad_chat_pending_room_v1';
const GOOGLE_LOGIN_HINT_KEY = 'riad_chat_google_hint_v1';

export interface GoogleLoginHint {
  email: string;
  name?: string;
}

function readGoogleLoginHint(): GoogleLoginHint | null {
  try {
    const raw = localStorage.getItem(GOOGLE_LOGIN_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GoogleLoginHint>;
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

function writeGoogleLoginHint(hint: GoogleLoginHint): void {
  const email = hint.email.trim().toLowerCase();
  if (!email) return;
  try {
    localStorage.setItem(
      GOOGLE_LOGIN_HINT_KEY,
      JSON.stringify({ email, name: hint.name?.trim() || undefined })
    );
  } catch {
    // ignore storage errors
  }
}

function removeGoogleLoginHint(): void {
  try {
    localStorage.removeItem(GOOGLE_LOGIN_HINT_KEY);
  } catch {
    // ignore storage errors
  }
}

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  redirected?: boolean;
  previewOtp?: string;
}

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
  invites: InviteLinkRecord[];
  agencyRequests: AgencyApplicationRequest[];
}

const STORAGE_KEY = 'riad_chat_state_v4_prod';
const LEGACY_STORAGE_KEYS = ['riad_chat_state_v3'];
const LEGACY_DEMO_USER_IDS = new Set([
  '10',
  '200016',
  '51115',
  '882001',
  '774100',
  '660500',
]);
const LEGACY_DEMO_ROOM_IDS = new Set([
  'room-locked-1',
  'room-51115',
  'room-774100',
  'room-882001',
]);
const LEGACY_DEMO_HOST_IDS = new Set([
  'host-51115',
  'host-200016',
  'host-882001',
  'host-774100',
]);
const LEGACY_DEMO_TRANSFER_IDS = new Set(['tr-102', 'tr-103', 'tr-104', 'tr-105']);
const LEGACY_DEMO_REPORT_IDS = new Set(['rep-1', 'rep-2']);
const LEGACY_DEMO_DISTRIBUTION_IDS = new Set(['dist-101', 'dist-102']);
export const PRIMARY_ADMIN_ID = '900';
export const JACKPOT_TARGET = 600_000_000;
export const JACKPOT_REWARD = 50_000_000;

export function isPrimaryAdminUser(user?: Pick<UserAccount, 'id'> | null): boolean {
  return Boolean(user && user.id === PRIMARY_ADMIN_ID);
}

export function isApprovedAgentUser(
  user?: Pick<UserAccount, 'id' | 'isVerifiedAgent'> | null
): boolean {
  return Boolean(user && (user.id === PRIMARY_ADMIN_ID || user.isVerifiedAgent === true));
}

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
  globalAnnouncement:
    'مرحباً بكم في الانطلاقة الرسمية لتطبيق رياض شات — أنشئ حسابك وغرفتك الصوتية الآن!',
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
  invites: [
    {
      code: 'RIYADH900',
      inviterId: '900',
      inviterName: 'رياض | Riad',
      roomId: 'room-900',
      roomTitle: 'وكاله ريــــ1ــــاض',
      uses: 0,
      rewardGold: 1_000_000,
      createdAt: 'اليوم',
    },
  ],
  agencyRequests: [],
};

function normalizeStatePayload(raw: Partial<AppState>, fallbackCurrentUserId = '900'): AppState {
  const usersById = new Map(INITIAL_USERS.map((u) => [u.id, u]));
  const filteredRawUsers = (raw.users?.length ? raw.users : DEFAULT_STATE.users).filter(
    (u) => !LEGACY_DEMO_USER_IDS.has(u.id)
  );
  const normalizedUsers = (filteredRawUsers.length ? filteredRawUsers : DEFAULT_STATE.users).map((u) => {
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
  const filteredRawRooms = (raw.rooms?.length ? raw.rooms : DEFAULT_STATE.rooms).filter(
    (r) => !LEGACY_DEMO_ROOM_IDS.has(r.id) && !LEGACY_DEMO_USER_IDS.has(r.ownerId)
  );
  const normalizedRooms = (filteredRawRooms.length ? filteredRawRooms : DEFAULT_STATE.rooms).map((r) => {
    const isLegacyMain = r.id === 'room-900' && !r.themeId;
    const rawSeats = (r.seats || []).map((s) =>
      s.userId && LEGACY_DEMO_USER_IDS.has(s.userId)
        ? {
            ...s,
            userId: null,
            userName: null,
            avatar: null,
            isSpeaking: false,
          }
        : {
            ...s,
            avatar: s.avatar ? normalizeAssetPath(s.avatar) : null,
          }
    );
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
      welcomeMessage: r.welcomeMessage ?? 'أهلاً وسهلاً بكم في رياض شات',
      themeId: r.themeId || 'ocean-stars',
      useThemeFilter: typeof r.useThemeFilter === 'boolean' ? r.useThemeFilter : true,
      diceCount: typeof r.diceCount === 'number' ? r.diceCount : 1,
      membershipCount: typeof r.membershipCount === 'number' ? r.membershipCount : 0,
      membersOnlyEntry: Boolean(r.membersOnlyEntry),
      allowVisitorsOnMic: typeof r.allowVisitorsOnMic === 'boolean' ? r.allowVisitorsOnMic : true,
      sendEmojiToChat: Boolean(r.sendEmojiToChat),
      autoSleepEnabled: typeof r.autoSleepEnabled === 'boolean' ? r.autoSleepEnabled : true,
      visitorChatRequirement: r.visitorChatRequirement || 'all',
      bannedUserIds: Array.isArray(r.bannedUserIds) ? r.bannedUserIds : [],
      messages: (r.messages || []).filter((m) => !LEGACY_DEMO_USER_IDS.has(m.senderId)),
      totalMics,
      seats,
    };
  });
  const safeCurrentUserId =
    raw.currentUserId && !LEGACY_DEMO_USER_IDS.has(raw.currentUserId)
      ? raw.currentUserId
      : fallbackCurrentUserId;
  return {
    ...DEFAULT_STATE,
    ...raw,
    currentUserId: safeCurrentUserId,
    users: normalizedUsers,
    rooms: normalizedRooms,
    transfers: (raw.transfers || DEFAULT_STATE.transfers).filter(
      (t) =>
        !LEGACY_DEMO_TRANSFER_IDS.has(t.id) && !LEGACY_DEMO_USER_IDS.has(t.recipientId)
    ),
    moderators: raw.moderators || DEFAULT_STATE.moderators,
    reports: (raw.reports || DEFAULT_STATE.reports).filter(
      (rep) =>
        !LEGACY_DEMO_REPORT_IDS.has(rep.id) && !LEGACY_DEMO_USER_IDS.has(rep.targetId)
    ),
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
    hosts: (raw.hosts?.length ? raw.hosts : DEFAULT_STATE.hosts)
      .filter((h) => !LEGACY_DEMO_HOST_IDS.has(h.id) && !LEGACY_DEMO_USER_IDS.has(h.userId))
      .map((h) => ({
        ...h,
        avatar: normalizeAssetPath(h.avatar),
      })),
    distributions: (raw.distributions?.length
      ? raw.distributions
      : DEFAULT_STATE.distributions
    ).filter((d) => !LEGACY_DEMO_DISTRIBUTION_IDS.has(d.id)),
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
    invites: Array.isArray(raw.invites) ? raw.invites : DEFAULT_STATE.invites,
    agencyRequests: Array.isArray(raw.agencyRequests)
      ? raw.agencyRequests.map((r) => ({
          ...r,
          userAvatar: normalizeAssetPath(r.userAvatar),
        }))
      : [],
  };
}

function loadInitialState(): AppState {
  try {
    for (const oldKey of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(oldKey);
    }
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
  isPrimaryAdmin: boolean;
  isApprovedAgent: boolean;
  isAuthenticated: boolean;
  authLoading: boolean;
  pendingReferralCode: string | null;
  loginWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  registerWithEmail: (
    name: string,
    email: string,
    password: string,
    referralCode?: string
  ) => Promise<AuthActionResult>;
  sendPhoneOtp: (phone: string) => Promise<AuthActionResult>;
  verifyPhoneOtp: (
    phone: string,
    code: string,
    name?: string,
    referralCode?: string
  ) => Promise<AuthActionResult>;
  lastGoogleHint: GoogleLoginHint | null;
  clearGoogleHint: () => void;
  loginWithGoogle: (profile?: {
    name?: string;
    email?: string;
    referralCode?: string;
    switchAccount?: boolean;
  }) => Promise<AuthActionResult>;
  loginWithFacebook: (profile?: {
    name?: string;
    email?: string;
    referralCode?: string;
  }) => Promise<AuthActionResult>;
  claimOwnerPassword: (identifier: string, password: string) => Promise<AuthActionResult>;
  updateAccountCredentials: (payload: {
    phone?: string;
    newPassword?: string;
    currentPassword?: string;
  }) => Promise<AuthActionResult>;
  requestOwnerRecoveryCode: (email: string) => Promise<{
    ok: boolean;
    error?: string;
    maskedEmail?: string;
    deliveryMode?: 'resend' | 'smtp' | 'dev_preview';
    expiresInSec?: number;
    resendCooldownSec?: number;
    retryAfterSec?: number;
    previewOtp?: string;
  }>;
  completeOwnerRecovery: (payload: {
    code: string;
    newPassword: string;
    phone?: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    revokedSessions?: number;
    phoneUpdated?: boolean;
  }>;
  verifyRoomPassword: (roomId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  agency2faStatus: Agency2FAStatus | null;
  agency2faLoading: boolean;
  refreshAgency2FAStatus: () => Promise<Agency2FAStatus | null>;
  requestAgency2FA: (
    channel: Agency2FAChannel,
    destination?: string
  ) => Promise<{
    ok: boolean;
    maskedDestination?: string;
    resendAfterSec?: number;
    deliveryMode?: string;
    previewOtp?: string;
    error?: string;
  }>;
  verifyAgency2FA: (code: string) => Promise<{ ok: boolean; error?: string }>;
  lockAgency2FA: () => Promise<void>;
  trafficSurgeRetrySec: number;
  dismissTrafficSurgeNotice: () => void;
  opsRequest: <T = Record<string, unknown>>(
    path: string,
    options?: { method?: string; body?: Record<string, unknown> }
  ) => Promise<{ ok: boolean; status: number; data?: T; error?: string }>;
  fetchOpsOverview: () => Promise<OpsOverviewResponse | null>;
  logoutAccount: () => Promise<void>;
  roomTelemetry: Record<string, RoomTelemetryPoint[]>;
  subscribeRoomTelemetry: (roomId: string) => void;
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
  registerAsAgent: (agencyTitle: string, contactNote?: string) => Promise<boolean>;
  submitAgencyRequest: (agencyTitle: string, contactNote?: string) => Promise<boolean>;
  approveAgencyRequest: (requestId: string) => Promise<boolean>;
  rejectAgencyRequest: (requestId: string) => Promise<boolean>;
  distributeProfitsAutomatically: (mode?: 'auto' | 'manual') => boolean;
  distributeSingleHostCommission: (hostId: string) => boolean;
  updateHostCommissionRate: (hostId: string, rate: number) => void;
  toggleAutoDistribution: () => void;
  setAgencyCommissionSplit: (pct: number) => void;
  addAgencyHost: (userId: string, roomId: string, targetGold: number, commissionRate: number) => boolean;
  boostHostDailyProfit: (hostId: string, amountGold?: number) => { reachedTarget: boolean; hostName: string };
  sendSpeakingState: (roomId: string, seatNumber: number, isSpeaking: boolean) => void;
  createInviteLink: (roomId?: string) => Promise<InviteLinkRecord | null>;
  redeemInviteCode: (code: string) => Promise<boolean>;
  announceGameWinInRoom: (gameName: string, icon: string, payout: number) => void;
  resetDemoData: () => void;
  notifications: InAppNotification[];
  unreadNotificationsCount: number;
  followedRoomIds: string[];
  notificationPrefs: NotificationPreferences;
  liveNotificationBanners: InAppNotification[];
  dismissLiveNotificationBanner: (notificationId: string) => void;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  updateNotificationPrefs: (patch: Partial<NotificationPreferences>) => Promise<void>;
  toggleFollowRoom: (roomId: string) => Promise<boolean>;
  startRoomLiveBroadcast: (
    roomId: string,
    topic?: string
  ) => Promise<{ ok: boolean; notifiedCount?: number }>;
  stopRoomLiveBroadcast: (roomId: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

function getInitialTabFromUrl(): MainTab {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('agent') || params.get('pack')) return 'rooms';
  } catch {
    // Ignore URL parse error
  }
  return 'rooms';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
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
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [followedRoomIds, setFollowedRoomIds] = useState<string[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    followedRoomsLive: true,
    popularRoomsLive: true,
    soundEnabled: true,
  });
  const [liveNotificationBanners, setLiveNotificationBanners] = useState<InAppNotification[]>([]);
  const notificationPrefsRef = useRef<NotificationPreferences>(notificationPrefs);
  notificationPrefsRef.current = notificationPrefs;
  const [roomTelemetry, setRoomTelemetry] = useState<Record<string, RoomTelemetryPoint[]>>({});
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [lastGoogleHint, setLastGoogleHint] = useState<GoogleLoginHint | null>(() =>
    readGoogleLoginHint()
  );
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = (params.get('invite') || params.get('ref') || '').trim().toUpperCase();
      if (fromUrl) {
        localStorage.setItem(PENDING_REFERRAL_KEY, fromUrl);
        return fromUrl;
      }
      return localStorage.getItem(PENDING_REFERRAL_KEY);
    } catch {
      return null;
    }
  });
  const giftTimerRef = useRef<number | null>(null);
  const dragonTimerRef = useRef<number | null>(null);
  const authTokenRef = useRef<string>('');
  const currentUserIdRef = useRef<string>(state.currentUserId);
  const activeRoomIdRef = useRef<string | null>(activeRoomId);
  const wsRef = useRef<WebSocket | null>(null);
  const suppressNextLevelTriggerRef = useRef<boolean>(false);

  currentUserIdRef.current = state.currentUserId;
  activeRoomIdRef.current = activeRoomId;

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

  const isPrimaryAdmin = isPrimaryAdminUser(currentUser);
  const isOwner = isPrimaryAdmin;
  const isApprovedAgent = isApprovedAgentUser(currentUser);

  const setActiveTab = useCallback(
    (tab: MainTab) => {
      if ((tab === 'agency-dashboard' || tab === 'system') && !isPrimaryAdminUser(currentUser)) {
        showToast('🚫 ممنوع (403): لوحة التحكم الإدارية مخصصة لحساب الإدارة الأساسي (ID: 900) فقط', 'error');
        return;
      }
      setActiveTabState(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentUser, showToast]
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

  // Keep session token strictly in memory (never localStorage) and scrub any legacy stored token
  const savePersistedToken = useCallback((token: string) => {
    authTokenRef.current = token;
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const applyAuthenticatedPayload = useCallback(
    (payload: {
      token?: string;
      user?: UserAccount;
      state?: Partial<AppState>;
      isNewUser?: boolean;
      referral?: {
        applied?: boolean;
        referrerName?: string;
        welcomeGold?: number;
        targetRoomId?: string;
      };
    }) => {
      if (payload.token) {
        savePersistedToken(payload.token);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'auth', token: payload.token }));
          } catch {
            // ignore transient WS send error
          }
        }
      }
      const nextUid = payload.user?.id || currentUserIdRef.current;
      currentUserIdRef.current = nextUid;
      if (payload.state) {
        suppressNextLevelTriggerRef.current = true;
        const normalized = {
          ...normalizeStatePayload(payload.state, nextUid),
          currentUserId: nextUid,
        };
        setState(normalized);
        hydrateServerStateCache(queryClient, normalized);
      } else if (payload.user) {
        setState((prev) => {
          const next = {
            ...prev,
            currentUserId: payload.user!.id,
            users: prev.users.some((u) => u.id === payload.user!.id)
              ? prev.users.map((u) => (u.id === payload.user!.id ? payload.user! : u))
              : [...prev.users, payload.user!],
          };
          hydrateServerStateCache(queryClient, next);
          return next;
        });
      }
      setIsAuthenticated(true);
      setAuthLoading(false);

      if (payload.user && !isPrimaryAdminUser(payload.user)) {
        const canAccessAgency = isApprovedAgentUser(payload.user);
        setActiveTabState((prev) =>
          prev === 'agency-dashboard' ||
          prev === 'system' ||
          (!canAccessAgency && prev === 'agencies')
            ? 'rooms'
            : prev
        );
      }

      if (payload.referral?.applied) {
        try {
          localStorage.removeItem(PENDING_REFERRAL_KEY);
        } catch {
          // ignore
        }
        setPendingReferralCode(null);
        showToast(
          `🎉 مرحباً بك! تم ربط دعوتك بـ ${payload.referral.referrerName || 'صديقك'} وإضافة +${(
            payload.referral.welcomeGold || 500_000
          ).toLocaleString('en-US')} ذهبية لرصيدك!`,
          'success'
        );
      }

      let pendingRoom: string | null = payload.referral?.targetRoomId || null;
      try {
        const storedRoom = localStorage.getItem(PENDING_ROOM_KEY);
        if (storedRoom) {
          pendingRoom = pendingRoom || storedRoom;
          localStorage.removeItem(PENDING_ROOM_KEY);
        }
      } catch {
        // ignore
      }
      if (pendingRoom) {
        setActiveRoomIdState(pendingRoom);
        setMinimizedRoomId(null);
      }
    },
    [queryClient, savePersistedToken, showToast]
  );

  const syncSupabaseUserWithServer = useCallback(
    async (
      sbUser: {
        id: string;
        email?: string | null;
        phone?: string | null;
        user_metadata?: Record<string, unknown>;
        app_metadata?: Record<string, unknown>;
      },
      explicitReferralCode?: string,
      explicitAccessToken?: string
    ): Promise<AuthActionResult> => {
      try {
        let accessToken = (explicitAccessToken || '').trim();
        if (!accessToken && supabase) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            accessToken = sessionData.session?.access_token || '';
          } catch {
            accessToken = '';
          }
        }
        if (!accessToken) {
          return { ok: false, error: 'تعذر الحصول على رمز جلسة Supabase الموثّق' };
        }

        const referralCode =
          explicitReferralCode ||
          pendingReferralCode ||
          (() => {
            try {
              return localStorage.getItem(PENDING_REFERRAL_KEY) || '';
            } catch {
              return '';
            }
          })();

        const meta = sbUser.user_metadata || {};
        const name = String(
          meta.full_name || meta.name || meta.display_name || sbUser.email?.split('@')[0] || ''
        ).trim();
        const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : undefined;
        const provider = String(sbUser.app_metadata?.provider || 'supabase');

        const res = await fetch(resolveApiUrl('/api/auth/supabase-sync'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            accessToken,
            name,
            avatar,
            referralCode: referralCode || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ok: false, error: String(data.error || 'تعذر مزامنة الحساب') };
        }
        if (provider === 'google' && sbUser.email) {
          const hint: GoogleLoginHint = {
            email: sbUser.email.trim().toLowerCase(),
            name: name || undefined,
          };
          writeGoogleLoginHint(hint);
          setLastGoogleHint(hint);
        }
        applyAuthenticatedPayload(
          data as Parameters<typeof applyAuthenticatedPayload>[0]
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لمزامنة الحساب' };
      }
    },
    [pendingReferralCode, applyAuthenticatedPayload]
  );

  const issueSessionToken = useCallback(
    async (userId: string): Promise<string> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) {
          headers.Authorization = `Bearer ${authTokenRef.current}`;
        }
        const res = await fetch(resolveApiUrl('/api/auth/session'), {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ userId }),
        });
        if (res.ok) {
          const data = (await res.json()) as { token?: string };
          if (data.token) {
            savePersistedToken(data.token);
            return data.token;
          }
        }
      } catch {
        // Offline / static fallback
      }
      return '';
    },
    [savePersistedToken]
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const normalizedIdentifier = email
        .trim()
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
      try {
        if (isSupabaseConfigured && supabase && normalizedIdentifier.includes('@')) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: normalizedIdentifier,
              password,
            });
            if (!error && data.user && data.session?.access_token) {
              const synced = await syncSupabaseUserWithServer(
                data.user,
                undefined,
                data.session.access_token
              );
              if (synced.ok) return synced;
            }
          } catch {
            // Fall back smoothly to built-in persistent server auth
          }
        }

        const res = await fetch(resolveApiUrl('/api/auth/login'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ email: normalizedIdentifier, password }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          if (typeof data.error === 'string' && data.error.trim()) {
            return { ok: false, error: data.error };
          }
          if (res.status === 404 || res.status >= 500) {
            return { ok: false, error: 'تعذر الوصول إلى خادم المصادقة، يرجى إعادة المحاولة' };
          }
          return { ok: false, error: 'بيانات الدخول غير صحيحة' };
        }
        applyAuthenticatedPayload(data as Parameters<typeof applyAuthenticatedPayload>[0]);
        showToast(`أهلاً بعودتك ${(data.user as UserAccount)?.name || ''}!`, 'success');
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم، يرجى المحاولة مجدداً' };
      }
    },
    [syncSupabaseUserWithServer, applyAuthenticatedPayload, showToast]
  );

  const claimOwnerPassword = useCallback(
    async (identifier: string, password: string): Promise<AuthActionResult> => {
      try {
        const res = await fetch(resolveApiUrl('/api/auth/owner-claim'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ identifier: identifier.trim(), password }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ok: false, error: String(data.error || 'تعذر تفعيل كلمة مرور المالك') };
        }
        applyAuthenticatedPayload(data as Parameters<typeof applyAuthenticatedPayload>[0]);
        showToast('تم تفعيل كلمة مرور المالك الأساسي وحفظها بشكل مشفّر بنجاح!', 'success');
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لتفعيل حساب المالك' };
      }
    },
    [applyAuthenticatedPayload, showToast]
  );

  const updateAccountCredentials = useCallback(
    async (payload: {
      phone?: string;
      newPassword?: string;
      currentPassword?: string;
    }): Promise<AuthActionResult> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) {
          headers.Authorization = `Bearer ${authTokenRef.current}`;
        }
        const res = await fetch(resolveApiUrl('/api/auth/credentials'), {
          method: 'PATCH',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return {
            ok: false,
            error: String(data.error || 'تعذر تحديث بيانات الحساب حالياً'),
          };
        }
        const updatedUser = data.user as UserAccount | undefined;
        if (updatedUser?.id) {
          setState((prev) => ({
            ...prev,
            users: prev.users.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)),
          }));
        }
        showToast('تم تحديث رقم الهاتف وكلمة المرور وحفظها بشكل مشفّر بنجاح!', 'success');
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لتحديث بيانات الحساب' };
      }
    },
    [showToast]
  );

  const requestOwnerRecoveryCode = useCallback(
    async (email: string) => {
      try {
        const res = await fetch(resolveApiUrl('/api/auth/owner-recovery/request'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return {
            ok: false,
            error: String(data.error || 'تعذر إرسال رمز الاستعادة حالياً'),
            retryAfterSec: typeof data.retryAfterSec === 'number' ? data.retryAfterSec : undefined,
          };
        }
        showToast('تم إرسال رمز استعادة حساب المالك بنجاح', 'success');
        return {
          ok: true,
          maskedEmail: typeof data.maskedEmail === 'string' ? data.maskedEmail : undefined,
          deliveryMode: data.deliveryMode as 'resend' | 'smtp' | 'dev_preview' | undefined,
          expiresInSec: typeof data.expiresInSec === 'number' ? data.expiresInSec : 600,
          resendCooldownSec:
            typeof data.resendCooldownSec === 'number' ? data.resendCooldownSec : 60,
          previewOtp: typeof data.previewOtp === 'string' ? data.previewOtp : undefined,
        };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لطلب رمز الاستعادة' };
      }
    },
    [showToast]
  );

  const completeOwnerRecovery = useCallback(
    async (payload: { code: string; newPassword: string; phone?: string }) => {
      try {
        const res = await fetch(resolveApiUrl('/api/auth/owner-recovery/complete'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return {
            ok: false,
            error: String(data.error || 'تعذر إتمام استعادة حساب المالك'),
          };
        }
        applyAuthenticatedPayload(data as Parameters<typeof applyAuthenticatedPayload>[0]);
        const revoked = typeof data.revokedSessions === 'number' ? data.revokedSessions : 1;
        showToast(
          `تمت استعادة حساب المالك 900 بنجاح وإنهاء ${revoked} جلسة سابقة!`,
          'success'
        );
        return {
          ok: true,
          revokedSessions: revoked,
          phoneUpdated: Boolean(data.phoneUpdated),
        };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لإتمام استعادة الحساب' };
      }
    },
    [applyAuthenticatedPayload, showToast]
  );

  const verifyRoomPassword = useCallback(
    async (roomId: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) {
          headers.Authorization = `Bearer ${authTokenRef.current}`;
        }
        const res = await fetch(resolveApiUrl(`/api/rooms/${encodeURIComponent(roomId)}/verify-password`), {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ password }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ok: false, error: String(data.error || 'كلمة مرور الغرفة غير صحيحة') };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر التحقق من كلمة مرور الغرفة حالياً' };
      }
    },
    []
  );

  const registerWithEmail = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      referralCode?: string
    ): Promise<AuthActionResult> => {
      const effectiveRef = (referralCode || pendingReferralCode || '').trim().toUpperCase();
      try {
        if (isSupabaseConfigured && supabase) {
          try {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: name, referral_code: effectiveRef || undefined },
              },
            });
            if (!error && data.user && data.session?.access_token) {
              const synced = await syncSupabaseUserWithServer(
                data.user,
                effectiveRef || undefined,
                data.session.access_token
              );
              if (synced.ok) return synced;
            }
          } catch {
            // Fall back to built-in persistent server registration on invalid/unconfigured Supabase key or network failure
          }
        }

        const res = await fetch(resolveApiUrl('/api/auth/register'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            name,
            email,
            password,
            referralCode: effectiveRef || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ok: false, error: String(data.error || 'تعذر إنشاء الحساب') };
        }
        applyAuthenticatedPayload(data as Parameters<typeof applyAuthenticatedPayload>[0]);
        const createdUser = data.user as UserAccount | undefined;
        showToast(
          `🎉 تم إنشاء حسابك بنجاح! معرفك الفريد: ID ${createdUser?.id || ''}`,
          'success'
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم، يرجى المحاولة مجدداً' };
      }
    },
    [pendingReferralCode, syncSupabaseUserWithServer, applyAuthenticatedPayload, showToast]
  );

  const sendPhoneOtp = useCallback(async (phone: string): Promise<AuthActionResult> => {
    try {
      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.auth.signInWithOtp({ phone });
          if (!error) {
            return { ok: true };
          }
        } catch {
          // Fall back to built-in OTP service
        }
      }

      const res = await fetch(resolveApiUrl('/api/auth/phone/send-otp'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        return { ok: false, error: String(data.error || 'تعذر إرسال رمز التحقق') };
      }
      return {
        ok: true,
        previewOtp: typeof data.previewOtp === 'string' ? data.previewOtp : undefined,
      };
    } catch {
      return { ok: false, error: 'تعذر إرسال رمز التحقق حالياً' };
    }
  }, []);

  const verifyPhoneOtp = useCallback(
    async (
      phone: string,
      code: string,
      name?: string,
      referralCode?: string
    ): Promise<AuthActionResult> => {
      const effectiveRef = (referralCode || pendingReferralCode || '').trim().toUpperCase();
      try {
        if (isSupabaseConfigured && supabase) {
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              phone,
              token: code,
              type: 'sms',
            });
            if (!error && data.user && data.session?.access_token) {
              const synced = await syncSupabaseUserWithServer(
                data.user,
                effectiveRef || undefined,
                data.session.access_token
              );
              if (synced.ok) return synced;
            }
          } catch {
            // Fall back to built-in OTP verification
          }
        }

        const res = await fetch(resolveApiUrl('/api/auth/phone/verify-otp'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            phone,
            code,
            name,
            referralCode: effectiveRef || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ok: false, error: String(data.error || 'رمز التحقق غير صحيح') };
        }
        applyAuthenticatedPayload(data as Parameters<typeof applyAuthenticatedPayload>[0]);
        const user = data.user as UserAccount | undefined;
        showToast(
          data.isNewUser
            ? `🎉 تم تسجيلك برقم الهاتف بنجاح! معرفك: ID ${user?.id || ''}`
            : `أهلاً بعودتك ${user?.name || ''}!`,
          'success'
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر التحقق من الرمز، حاول مجدداً' };
      }
    },
    [pendingReferralCode, syncSupabaseUserWithServer, applyAuthenticatedPayload, showToast]
  );

  const clearGoogleHint = useCallback(() => {
    removeGoogleLoginHint();
    setLastGoogleHint(null);
  }, []);

  const loginWithGoogle = useCallback(
    async (profile?: {
      name?: string;
      email?: string;
      referralCode?: string;
      switchAccount?: boolean;
    }): Promise<AuthActionResult> => {
      const effectiveRef = (profile?.referralCode || pendingReferralCode || '').trim().toUpperCase();
      if (effectiveRef) {
        try {
          localStorage.setItem(PENDING_REFERRAL_KEY, effectiveRef);
        } catch {
          // ignore
        }
      }

      const cachedHint = profile?.switchAccount ? null : lastGoogleHint || readGoogleLoginHint();

      try {
        if (isSupabaseConfigured && supabase && !profile?.email) {
          try {
            const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
            // Disable forced account chooser by omitting `prompt: 'select_account'`
            // and passing cached `login_hint` for direct single-tap Google sign-in.
            const queryParams: Record<string, string> = {};
            if (profile?.switchAccount) {
              queryParams.prompt = 'select_account';
            } else if (cachedHint?.email) {
              queryParams.login_hint = cachedHint.email;
            }
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo,
                ...(Object.keys(queryParams).length > 0 ? { queryParams } : {}),
              },
            });
            if (!error) {
              return { ok: true, redirected: true };
            }
          } catch {
            // Fall back to direct server Google auth when Supabase Google provider is not enabled
          }
        }

        const cleanEmail = (profile?.email || cachedHint?.email || '').trim().toLowerCase();
        if (!cleanEmail) {
          return { ok: false, error: 'يرجى إدخال بريد حساب جوجل للمتابعة المباشرة' };
        }
        const cleanName =
          (profile?.name || cachedHint?.name || '').trim() || cleanEmail.split('@')[0] || 'عضو جوجل';

        const res = await fetch(resolveApiUrl('/api/auth/google'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            googleId: `google_${cleanEmail}`,
            name: cleanName,
            email: cleanEmail,
            referralCode: effectiveRef || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ok: false, error: String(data.error || 'تعذر تسجيل الدخول عبر جوجل') };
        }

        const hint: GoogleLoginHint = { email: cleanEmail, name: cleanName };
        writeGoogleLoginHint(hint);
        setLastGoogleHint(hint);

        applyAuthenticatedPayload(data as Parameters<typeof applyAuthenticatedPayload>[0]);
        const user = data.user as UserAccount | undefined;
        showToast(
          data.isNewUser
            ? `🎉 تم تسجيلك عبر جوجل! معرفك الفريد: ID ${user?.id || ''}`
            : `أهلاً بعودتك ${user?.name || ''}!`,
          'success'
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بخدمة الدخول عبر جوجل' };
      }
    },
    [pendingReferralCode, lastGoogleHint, applyAuthenticatedPayload, showToast]
  );

  const loginWithFacebook = useCallback(
    async (profile?: {
      name?: string;
      email?: string;
      referralCode?: string;
    }): Promise<AuthActionResult> => {
      const effectiveRef = (profile?.referralCode || pendingReferralCode || '').trim().toUpperCase();
      if (effectiveRef) {
        try {
          localStorage.setItem(PENDING_REFERRAL_KEY, effectiveRef);
        } catch {
          // ignore
        }
      }
      try {
        if (isSupabaseConfigured && supabase && !profile?.name) {
          try {
            const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'facebook',
              options: { redirectTo },
            });
            if (!error) {
              return { ok: true, redirected: true };
            }
          } catch {
            // Fall back to built-in Facebook login endpoint
          }
        }

        const cleanName = (profile?.name || '').trim() || 'عضو فيسبوك';
        const cleanEmail =
          (profile?.email || '').trim().toLowerCase() ||
          `fb.${Date.now().toString().slice(-6)}@facebook.riadchat.app`;
        const res = await fetch(resolveApiUrl('/api/auth/facebook'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            facebookId: `fb_${cleanEmail}`,
            name: cleanName,
            email: cleanEmail,
            referralCode: effectiveRef || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ok: false, error: String(data.error || 'تعذر تسجيل الدخول عبر فيسبوك') };
        }
        applyAuthenticatedPayload(data as Parameters<typeof applyAuthenticatedPayload>[0]);
        const user = data.user as UserAccount | undefined;
        showToast(
          data.isNewUser
            ? `🎉 تم تسجيلك عبر فيسبوك! معرفك الفريد: ID ${user?.id || ''}`
            : `أهلاً بك ${user?.name || ''}!`,
          'success'
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بخدمة الدخول عبر فيسبوك' };
      }
    },
    [pendingReferralCode, applyAuthenticatedPayload, showToast]
  );

  const agency2faTokenRef = useRef<string>('');
  const [agency2faStatus, setAgency2faStatus] = useState<Agency2FAStatus | null>(null);
  const [agency2faLoading, setAgency2faLoading] = useState<boolean>(false);
  const [trafficSurgeRetrySec, setTrafficSurgeRetrySec] = useState<number>(0);

  useEffect(() => {
    if (trafficSurgeRetrySec <= 0) return;
    const timer = window.setInterval(() => {
      setTrafficSurgeRetrySec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [trafficSurgeRetrySec]);

  const dismissTrafficSurgeNotice = useCallback(() => {
    setTrafficSurgeRetrySec(0);
  }, []);

  const refreshAgency2FAStatus = useCallback(async (): Promise<Agency2FAStatus | null> => {
    setAgency2faLoading(true);
    try {
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
      if (agency2faTokenRef.current) headers['X-Agency-2FA-Token'] = agency2faTokenRef.current;

      const res = await fetch(resolveApiUrl('/api/agency/2fa/status'), {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          agency2faTokenRef.current = '';
          setAgency2faStatus(null);
        }
        return null;
      }
      const data = (await res.json()) as Agency2FAStatus & { ok?: boolean };
      const normalized: Agency2FAStatus = {
        verified: Boolean(data.verified),
        expiresAt: data.expiresAt ?? null,
        remainingSec: Number(data.remainingSec || 0),
        channel: data.channel ?? null,
        maskedEmail: data.maskedEmail || '',
        maskedPhone: data.maskedPhone || '',
        hasEmail: Boolean(data.hasEmail),
        hasPhone: Boolean(data.hasPhone),
        smsConfigured: Boolean(data.smsConfigured),
        emailConfigured: Boolean(data.emailConfigured),
        sessionDurationMin: Number(data.sessionDurationMin || 30),
      };
      if (!normalized.verified) {
        agency2faTokenRef.current = '';
      }
      setAgency2faStatus(normalized);
      return normalized;
    } catch {
      return null;
    } finally {
      setAgency2faLoading(false);
    }
  }, []);

  const requestAgency2FA = useCallback(
    async (channel: Agency2FAChannel, destination?: string) => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;

        const res = await fetch(resolveApiUrl('/api/agency/2fa/request'), {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ channel, destination: destination?.trim() || undefined }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          maskedDestination?: string;
          resendAfterSec?: number;
          deliveryMode?: string;
          previewOtp?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'تعذر إرسال رمز المصادقة الثنائية' };
        }
        return {
          ok: true,
          maskedDestination: data.maskedDestination,
          resendAfterSec: data.resendAfterSec || 60,
          deliveryMode: data.deliveryMode,
          previewOtp: data.previewOtp,
        };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لإرسال رمز التحقق' };
      }
    },
    []
  );

  const verifyAgency2FA = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;

        const res = await fetch(resolveApiUrl('/api/agency/2fa/verify'), {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ code: code.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          verified?: boolean;
          expiresAt?: number;
          remainingSec?: number;
          channel?: Agency2FAChannel;
          token?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.verified) {
          return { ok: false, error: data.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية' };
        }
        if (data.token) {
          agency2faTokenRef.current = data.token;
        }
        setAgency2faStatus((prev) => ({
          verified: true,
          expiresAt: data.expiresAt ?? Date.now() + 30 * 60 * 1000,
          remainingSec: data.remainingSec ?? 1800,
          channel: data.channel ?? prev?.channel ?? 'email',
          maskedEmail: prev?.maskedEmail || '',
          maskedPhone: prev?.maskedPhone || '',
          hasEmail: prev?.hasEmail || false,
          hasPhone: prev?.hasPhone || false,
          smsConfigured: prev?.smsConfigured || false,
          emailConfigured: prev?.emailConfigured || false,
          sessionDurationMin: prev?.sessionDurationMin || 30,
        }));
        showToast('تم تفعيل المصادقة الثنائية للوكيل لمدة 30 دقيقة بنجاح', 'success');
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر التحقق من الرمز الآن' };
      }
    },
    [showToast]
  );

  const lockAgency2FA = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
      if (agency2faTokenRef.current) headers['X-Agency-2FA-Token'] = agency2faTokenRef.current;

      await fetch(resolveApiUrl('/api/agency/2fa/lock'), {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch {
      // Ignore network error during manual lock
    }
    agency2faTokenRef.current = '';
    setAgency2faStatus((prev) =>
      prev ? { ...prev, verified: false, expiresAt: null, remainingSec: 0 } : null
    );
    showToast('تم قفل بوابة الوكيل فوراً — سيُطلب رمز OTP عند الدخول مجدداً', 'info');
  }, [showToast]);

  const opsRequest = useCallback(
    async <T = Record<string, unknown>>(
      path: string,
      options: { method?: string; body?: Record<string, unknown> } = {}
    ): Promise<{ ok: boolean; status: number; data?: T; error?: string }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
        const res = await fetch(resolveApiUrl(path), {
          method: options.method || 'POST',
          credentials: 'include',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const data = (await res.json().catch(() => ({}))) as T & { error?: string; state?: Partial<AppState> };
        if (res.ok && data && typeof data === 'object' && 'state' in data && data.state) {
          setState((prev) => {
            const next = {
              ...normalizeStatePayload(data.state as Partial<AppState>, prev.currentUserId),
              currentUserId: prev.currentUserId,
            };
            hydrateServerStateCache(queryClient, next);
            return next;
          });
        }
        return {
          ok: res.ok,
          status: res.status,
          data,
          error: !res.ok ? data?.error || `HTTP ${res.status}` : undefined,
        };
      } catch {
        return { ok: false, status: 0, error: 'تعذر الاتصال بالخادم' };
      }
    },
    [queryClient]
  );

  const fetchOpsOverview = useCallback(async (): Promise<OpsOverviewResponse | null> => {
    const res = await opsRequest<OpsOverviewResponse>('/api/ops/overview', { method: 'GET' });
    return res.ok && res.data ? res.data : null;
  }, [opsRequest]);

  const logoutAccount = useCallback(async () => {
    try {
      await fetch(resolveApiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } catch {
      // ignore network error on cookie logout
    }
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // ignore supabase signout error
    }
    agency2faTokenRef.current = '';
    setAgency2faStatus(null);
    savePersistedToken('');
    clearSessionQueries(queryClient);
    setActiveRoomIdState(null);
    setMinimizedRoomId(null);
    setActiveTabState('rooms');
    setIsAuthenticated(false);
    showToast('تم تسجيل الخروج بنجاح', 'info');
  }, [queryClient, savePersistedToken, showToast]);

  const apiMutate = useCallback(
    async (
      url: string,
      options: { method?: string; body?: Record<string, unknown>; idempotencyKey?: string } = {}
    ): Promise<{ ok: boolean; status: number; data?: Record<string, unknown> }> => {
      try {
        const execute = async (token: string) => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
          if (agency2faTokenRef.current) {
            headers['X-Agency-2FA-Token'] = agency2faTokenRef.current;
          }
          if (options.idempotencyKey) {
            headers['Idempotency-Key'] = options.idempotencyKey;
          }
          return fetch(resolveApiUrl(url), {
            method: options.method || 'POST',
            credentials: 'include',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
          });
        };

        const token = authTokenRef.current;
        const res = await execute(token);

        if (res.status === 429) {
          const retryHeader = Number(res.headers.get('Retry-After') || 120);
          const data429 = (await res.json().catch(() => ({}))) as { error?: string; retryAfterSec?: number };
          const waitSec = Math.max(5, Number(data429.retryAfterSec || retryHeader || 120));
          setTrafficSurgeRetrySec(waitSec);
          showToast(
            data429.error || 'الموقع يشهد إقبالاً عالياً الآن — جرب بعد دقيقتين',
            'warning'
          );
          return { ok: false, status: 429, data: data429 as Record<string, unknown> };
        }

        if (res.status === 401) {
          agency2faTokenRef.current = '';
          setAgency2faStatus(null);
          savePersistedToken('');
          clearSessionQueries(queryClient);
          setIsAuthenticated(false);
          showToast('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً', 'warning');
          return { ok: false, status: 401 };
        }

        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (res.status === 403) {
          if (data.code === 'AGENCY_2FA_REQUIRED') {
            agency2faTokenRef.current = '';
            setAgency2faStatus((prev) =>
              prev ? { ...prev, verified: false, expiresAt: null, remainingSec: 0 } : null
            );
            showToast('انتهت نافذة المصادقة الثنائية للوكيل — يرجى إدخال رمز OTP للمتابعة', 'warning');
            return { ok: false, status: 403, data };
          }
          showToast('🚫 ممنوع (403 Forbidden): هذا الإجراء مخصص للإدارة الأساسية (ID: 900) فقط', 'error');
          return { ok: false, status: 403, data };
        }
        if (res.ok && data.state) {
          setState((prev) => {
            const next = {
              ...normalizeStatePayload(data.state as Partial<AppState>, prev.currentUserId),
              currentUserId: prev.currentUserId,
            };
            hydrateServerStateCache(queryClient, next);
            return next;
          });
        }
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: false, status: 0 };
      }
    },
    [queryClient, savePersistedToken, showToast]
  );

  // Hydrate persistent session (Supabase or saved Bearer token) + maintain WebSocket sync with reconnect
  useEffect(() => {
    let active = true;
    let reconnectTimer: number | null = null;
    let retryMs = 800;

    // Capture incoming ?invite / ?ref / ?room parameters cleanly before auth
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteCode = (params.get('invite') || params.get('ref') || '').trim().toUpperCase();
      const roomParam = (params.get('room') || '').trim();
      if (inviteCode) {
        localStorage.setItem(PENDING_REFERRAL_KEY, inviteCode);
        setPendingReferralCode(inviteCode);
      }
      if (roomParam) {
        localStorage.setItem(PENDING_ROOM_KEY, roomParam);
      }
      if (inviteCode || roomParam) {
        const cleanUrl = `${window.location.pathname}${window.location.hash}`;
        window.history.replaceState({}, '', cleanUrl || '/');
      }
    } catch {
      // ignore URL errors
    }

    const bootstrap = async () => {
      try {
        const fetchedState = await queryClient.fetchQuery({
          queryKey: QUERY_KEYS.serverState,
          queryFn: () => fetchServerStateSnapshot<Partial<AppState>>(),
          staleTime: SERVER_STATE_STALE_TIME_MS,
        });
        if (fetchedState && active) {
          suppressNextLevelTriggerRef.current = true;
          setState((prev) => {
            const next = {
              ...normalizeStatePayload(fetchedState, prev.currentUserId),
              currentUserId: prev.currentUserId,
            };
            hydrateServerStateCache(queryClient, next);
            return next;
          });
        }
      } catch {
        // Fallback to localStorage state
      }

      // Scrub any legacy session token previously persisted in localStorage
      try {
        localStorage.removeItem(SESSION_TOKEN_KEY);
      } catch {
        // ignore
      }

      // 1. Check active Supabase Auth session (including OAuth callback)
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user && data.session.access_token && active) {
            const syncRes = await syncSupabaseUserWithServer(
              data.session.user,
              undefined,
              data.session.access_token
            );
            if (syncRes.ok) return;
          }
        } catch {
          // continue to check HttpOnly cookie session
        }
      }

      // 2. Restore session securely via HttpOnly cookie (/api/auth/me) without localStorage tokens
      try {
        const data = await queryClient.fetchQuery({
          queryKey: QUERY_KEYS.currentUserMe,
          queryFn: () => fetchCurrentUserSession(authTokenRef.current || undefined),
          staleTime: SERVER_STATE_STALE_TIME_MS,
        });
        if (data?.user && active) {
          applyAuthenticatedPayload({
            token: data.token || authTokenRef.current || undefined,
            user: data.user,
            state: data.state as Partial<AppState> | undefined,
          });
          return;
        }
        if (!data) {
          savePersistedToken('');
          clearSessionQueries(queryClient);
        }
      } catch {
        // offline
      }

      if (active) {
        setIsAuthenticated(false);
        setAuthLoading(false);
      }
    };

    const sbSub =
      isSupabaseConfigured && supabase
        ? supabase.auth.onAuthStateChange((event, session) => {
            if (!active) return;
            if (
              (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
              session?.user &&
              session.access_token
            ) {
              void syncSupabaseUserWithServer(session.user, undefined, session.access_token);
            } else if (event === 'SIGNED_OUT') {
              savePersistedToken('');
              clearSessionQueries(queryClient);
              setIsAuthenticated(false);
            }
          })
        : null;

    let wsGen = 0;
    let heartbeatTimer: number | null = null;
    let pongDeadlineTimer: number | null = null;

    const clearWsTimers = () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (pongDeadlineTimer) {
        window.clearTimeout(pongDeadlineTimer);
        pongDeadlineTimer = null;
      }
    };

    const clearPongDeadline = () => {
      if (pongDeadlineTimer) {
        window.clearTimeout(pongDeadlineTimer);
        pongDeadlineTimer = null;
      }
    };

    const teardownWebSocket = () => {
      wsGen += 1;
      clearWsTimers();
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
          // Ignore close errors
        }
      }
    };

    const connectWs = (forceReset = false) => {
      if (!active || typeof window === 'undefined') return;
      const existing = wsRef.current;
      if (
        !forceReset &&
        existing &&
        (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }
      if (forceReset) {
        retryMs = 800;
      }

      teardownWebSocket();
      const currentGen = wsGen;

      try {
        const token = authTokenRef.current || '';
        const wsUrl = resolveWsUrl(token || undefined);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const sendPingProbe = (timeoutMs: number) => {
          if (!active || currentGen !== wsGen || ws.readyState !== WebSocket.OPEN) return;
          try {
            ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
          } catch {
            setIsRealtimeConnected(false);
            connectWs(true);
            return;
          }
          clearPongDeadline();
          pongDeadlineTimer = window.setTimeout(() => {
            pongDeadlineTimer = null;
            if (!active || currentGen !== wsGen) return;
            setIsRealtimeConnected(false);
            connectWs(true);
          }, timeoutMs);
        };

        ws.onopen = () => {
          if (!active || currentGen !== wsGen) return;
          retryMs = 800;
          setIsRealtimeConnected(true);
          try {
            ws.send(JSON.stringify({ type: 'state:request' }));
            if (activeRoomIdRef.current) {
              ws.send(
                JSON.stringify({
                  type: 'room:telemetry:subscribe',
                  roomId: activeRoomIdRef.current,
                })
              );
            }
          } catch {
            // Ignore transient send error
          }
          heartbeatTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
              sendPingProbe(6000);
            }
          }, 20000);
        };

        ws.onmessage = (evt) => {
          if (!active || currentGen !== wsGen) return;
          clearPongDeadline();
          try {
            const msg = JSON.parse(evt.data) as {
              type?: string;
              state?: Partial<AppState>;
              roomId?: string;
              seatNumber?: number;
              isSpeaking?: boolean;
              telemetryByRoomId?: Record<string, RoomTelemetryPoint[]>;
              points?: RoomTelemetryPoint[];
              point?: RoomTelemetryPoint;
              notifications?: InAppNotification[];
              notification?: InAppNotification;
              followedRoomIds?: string[];
              preferences?: NotificationPreferences;
            };
            if (msg.type === 'pong') {
              return;
            }
            if (msg.type === 'session:revoked') {
              agency2faTokenRef.current = '';
              setAgency2faStatus(null);
              savePersistedToken('');
              clearSessionQueries(queryClient);
              setActiveRoomIdState(null);
              setMinimizedRoomId(null);
              setIsAuthenticated(false);
              showToast('تم إنهاء جلستك بعد استعادة حساب المالك — يرجى تسجيل الدخول مجدداً', 'warning');
              return;
            }
            if (msg.type === 'notifications:init') {
              if (Array.isArray(msg.notifications)) {
                setNotifications(msg.notifications);
              }
              if (Array.isArray(msg.followedRoomIds)) {
                setFollowedRoomIds(msg.followedRoomIds);
              }
              if (msg.preferences) {
                setNotificationPrefs(msg.preferences);
              }
              return;
            }
            if (msg.type === 'notification:new' && msg.notification) {
              const incomingNotif = msg.notification;
              setNotifications((prev) => {
                if (prev.some((n) => n.id === incomingNotif.id)) return prev;
                return [incomingNotif, ...prev].slice(0, 60);
              });
              // Show floating slide-in banner unless the user is already inside that exact room
              if (activeRoomIdRef.current !== incomingNotif.roomId) {
                setLiveNotificationBanners((prev) => {
                  if (prev.some((b) => b.id === incomingNotif.id)) return prev;
                  return [incomingNotif, ...prev].slice(0, 2);
                });
                window.setTimeout(() => {
                  setLiveNotificationBanners((prev) =>
                    prev.filter((b) => b.id !== incomingNotif.id)
                  );
                }, 6500);

                if (notificationPrefsRef.current.soundEnabled) {
                  try {
                    const AudioCtx =
                      window.AudioContext ||
                      (window as unknown as { webkitAudioContext?: typeof AudioContext })
                        .webkitAudioContext;
                    if (AudioCtx) {
                      const ctx = new AudioCtx();
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.type = 'sine';
                      osc.frequency.setValueAtTime(660, ctx.currentTime);
                      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
                      gain.gain.setValueAtTime(0.06, ctx.currentTime);
                      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
                      osc.connect(gain);
                      gain.connect(ctx.destination);
                      osc.start();
                      osc.stop(ctx.currentTime + 0.25);
                    }
                  } catch {
                    // Ignore autoplay restrictions
                  }
                }
              }
              return;
            }
            if (msg.type === 'state:sync' && msg.state) {
              setState((prev) => {
                const next = {
                  ...normalizeStatePayload(msg.state!, prev.currentUserId),
                  currentUserId: prev.currentUserId,
                };
                hydrateServerStateCache(queryClient, next);
                return next;
              });
            } else if (msg.type === 'room:telemetry:init') {
              if (msg.telemetryByRoomId) {
                setRoomTelemetry((prev) => ({ ...prev, ...msg.telemetryByRoomId }));
              } else if (msg.roomId && Array.isArray(msg.points)) {
                setRoomTelemetry((prev) => ({ ...prev, [msg.roomId!]: msg.points!.slice(-16) }));
              }
            } else if (msg.type === 'room:telemetry:point' && msg.roomId && msg.point) {
              const incoming = msg.point;
              const targetRoomId = msg.roomId;
              setRoomTelemetry((prev) => {
                const existingPoints = prev[targetRoomId] || [];
                // Idempotent seq deduplication across reconnects
                if (existingPoints.some((p) => p.seq === incoming.seq)) {
                  return prev;
                }
                return {
                  ...prev,
                  [targetRoomId]: [...existingPoints.slice(-15), incoming],
                };
              });
            } else if (
              msg.type === 'room:speaking' &&
              msg.roomId &&
              typeof msg.seatNumber === 'number'
            ) {
              const speakingRoomId = msg.roomId;
              const speakingSeat = msg.seatNumber;
              const speakingNow = Boolean(msg.isSpeaking);
              patchRoomSpeakingInCache(queryClient, speakingRoomId, speakingSeat, speakingNow);
              setState((prev) => ({
                ...prev,
                rooms: prev.rooms.map((r) =>
                  r.id === speakingRoomId
                    ? {
                        ...r,
                        seats: r.seats.map((s) =>
                          s.seatNumber === speakingSeat
                            ? { ...s, isSpeaking: speakingNow }
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
          if (!active || currentGen !== wsGen) return;
          setIsRealtimeConnected(false);
          try {
            ws.close();
          } catch {
            // Ignore close failure
          }
        };

        ws.onclose = () => {
          if (!active || currentGen !== wsGen) return;
          clearWsTimers();
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
          setIsRealtimeConnected(false);
          reconnectTimer = window.setTimeout(() => {
            retryMs = Math.min(10000, Math.round(retryMs * 1.6));
            connectWs();
          }, retryMs);
        };
      } catch {
        if (active && currentGen === wsGen) {
          setIsRealtimeConnected(false);
        }
      }
    };

    const handleResumeSync = () => {
      if (!active || typeof window === 'undefined') return;
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectWs(true);
        return;
      }
      try {
        ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        ws.send(JSON.stringify({ type: 'state:request' }));
      } catch {
        connectWs(true);
      }
    };

    window.addEventListener('online', handleResumeSync);
    document.addEventListener('visibilitychange', handleResumeSync);

    bootstrap();
    connectWs();

    return () => {
      active = false;
      window.removeEventListener('online', handleResumeSync);
      document.removeEventListener('visibilitychange', handleResumeSync);
      sbSub?.data.subscription.unsubscribe();
      teardownWebSocket();
    };
  }, [applyAuthenticatedPayload, savePersistedToken, syncSupabaseUserWithServer]);

  const subscribeRoomTelemetry = useCallback((roomId: string) => {
    if (!roomId) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:telemetry:subscribe',
          roomId,
        })
      );
    }
  }, []);

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
      // Strip private PII (email, phone, room password) before caching UI snapshot in localStorage
      const safeSnapshot: AppState = {
        ...state,
        users: state.users.map(({ email: _email, phone: _phone, ...publicUser }) => publicUser),
        rooms: state.rooms.map(({ password: _password, ...publicRoom }) => publicRoom),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSnapshot));
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
      void apiMutate('/api/user/follow', {
        body: { targetUserId, following: !alreadyFollowing },
      });
      showToast(
        alreadyFollowing
          ? `تم إلغاء متابعة ${target.name}`
          : `✨ بدأت متابعة ${target.name} الآن!`,
        alreadyFollowing ? 'info' : 'success'
      );
    },
    [currentUser.id, followedUserIds, state.users, apiMutate, showToast]
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
                diamonds: Math.max(0, Number((u.diamonds + deltaDiamonds).toFixed(2))),
              }
            : u
        ),
      }));
      if (userId === currentUserIdRef.current) {
        void apiMutate('/api/games/payout', {
          body: { deltaGold, deltaDiamonds },
        });
      } else if (isOwner) {
        void apiMutate('/api/system/user/adjust-gold', {
          body: { userId, deltaGold, deltaDiamonds },
        });
      }
    },
    [isOwner, apiMutate]
  );

  const transferAgencyGold = useCallback(
    (recipientId: string, baseGold: number, agentName = 'وكالة رياض'): boolean => {
      if (!isApprovedAgent) {
        showToast('🚫 ممنوع (403): التحويل متاح فقط بعد موافقة المالك (ID: 900) على فتح وكالتك', 'error');
        return false;
      }
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
    [isApprovedAgent, state.users, state.currentUserId, apiMutate, showToast]
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
      void apiMutate('/api/user/entry', { body: { entry } });
      showToast(`تم تفعيل الدخولية: ${entry}`, 'success');
    },
    [apiMutate, showToast]
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
        users: prev.users.map((u) => {
          if (u.id !== userId) return u;
          if (u.id === PRIMARY_ADMIN_ID) return { ...u, isVerifiedAgent: true };
          const nextVerified = !u.isVerifiedAgent;
          return {
            ...u,
            isVerifiedAgent: nextVerified,
            role: nextVerified ? 'AGENCY_AGENT' : 'USER',
          };
        }),
      }));
      void apiMutate('/api/system/user/verify-agent', { body: { userId } });
      showToast('تم تحديث حالة اعتماد الوكالة بنجاح', 'success');
    },
    [isOwner, apiMutate, showToast]
  );

  const switchUserAccount = useCallback(
    (userId: string) => {
      if (!isPrimaryAdmin) {
        showToast('🚫 تبديل الحسابات متاح للإدارة الأساسية (ID: 900) فقط', 'error');
        return;
      }
      const target = state.users.find((u) => u.id === userId);
      if (!target) return;
      void issueSessionToken(userId).then((token) => {
        if (!token) {
          showToast('تعذر تبديل الجلسة', 'error');
          return;
        }
        currentUserIdRef.current = userId;
        setState((prev) => ({ ...prev, currentUserId: userId }));
        if (
          ((activeTab === 'agency-dashboard' || activeTab === 'system') &&
            !isPrimaryAdminUser(target)) ||
          (activeTab === 'agencies' && !isApprovedAgentUser(target))
        ) {
          setActiveTabState('rooms');
        }
        showToast(`تم التبديل إلى حساب ${target.name} (ID: ${target.id})`, 'info');
      });
    },
    [isPrimaryAdmin, state.users, activeTab, issueSessionToken, showToast]
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
            const hasPass = Boolean(patch.password.trim());
            next.hasPassword = hasPass;
            next.isLocked = hasPass;
            delete next.password;
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

  const completeTaskProgress = useCallback(
    (taskId: string) => {
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, progress: t.target } : t)),
      }));
      void apiMutate(`/api/tasks/${taskId}/progress`);
    },
    [apiMutate]
  );

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
      void apiMutate(`/api/tasks/${taskId}/claim`);
      showToast(`تم استلام مكافأة المهمة: +${task.rewardGold.toLocaleString('en-US')} ذهب!`, 'success');
    },
    [state.tasks, apiMutate, showToast]
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
      void apiMutate('/api/user/aristocrat', { body: { tierName, costGold } });
      showToast(`مبروك! أصبحت الآن برتبة ${tierName} في الارستقراط`, 'success');
      return true;
    },
    [currentUser.gold, apiMutate, showToast]
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
    void apiMutate('/api/user/svip');
    showToast(`تمت ترقيتك إلى SVIP ${currentUser.svip + 1}!`, 'success');
    return true;
  }, [currentUser.svip, currentUser.gold, apiMutate, showToast]);

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

  const recordGameBet = useCallback(
    (amount: number) => {
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
      void apiMutate('/api/games/bet', { body: { amount } });
    },
    [apiMutate]
  );

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
    void apiMutate('/api/jackpot/claim');
    triggerRoyalDragon(currentUser.name);
    showToast(
      `🏆 مبروك! فتحت صندوق الجاك بوت الملكي: +50,000,000 ذهبية و +250 ماسة!`,
      'success'
    );
    return true;
  }, [state.jackpotProgress, currentUser.name, apiMutate, showToast, triggerRoyalDragon]);

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
    void apiMutate('/api/cashback/claim');
    showToast(`💸 تم استلام عودة 8% لليوم: +${refund.toLocaleString('en-US')} ذهبية!`, 'success');
    return refund;
  }, [state.dailyStakedGold, state.cashbackClaimedBase, apiMutate, showToast]);

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
    void apiMutate('/api/streak/claim');
    showToast(
      `🎁 مكافأة اليوم ${nextDay}: +${gReward.toLocaleString('en-US')} ذهب · +${dReward} ماسة · +${xpReward} XP!`,
      'success'
    );
    return true;
  }, [state.lastCheckInDate, state.streakDay, apiMutate, showToast]);

  const purchaseAgentWholesalePack = useCallback(
    (gold: number, priceUsd: number) => {
      if (!isApprovedAgent) {
        showToast('🚫 ممنوع (403): شراء مخزون الوكلاء متاح فقط بعد اعتماد الوكالة من المالك', 'error');
        return;
      }
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
    [isApprovedAgent, apiMutate, showToast]
  );

  const sendRechargeInvite = useCallback((): number => {
    if (!isApprovedAgent) {
      showToast('🚫 ممنوع (403): دعوة إعادة الشحن متاحة فقط للوكلاء المعتمدين من المالك', 'error');
      return 0;
    }
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
  }, [isApprovedAgent, apiMutate, showToast]);

  const submitAgencyRequest = useCallback(
    async (agencyTitle: string, contactNote?: string): Promise<boolean> => {
      if (isApprovedAgent) {
        showToast('حسابك معتمد بالفعل كوكالة شحن', 'info');
        return false;
      }
      const cleanTitle = agencyTitle.trim();
      if (cleanTitle.length < 3) {
        showToast('يرجى إدخال اسم الوكالة المطلوب (3 أحرف على الأقل)', 'warning');
        return false;
      }
      const alreadyPending = state.agencyRequests.some(
        (r) => r.userId === currentUser.id && r.status === 'pending'
      );
      if (alreadyPending) {
        showToast('لديك طلب فتح وكالة قيد المراجعة بالفعل لدى المالك (ID: 900)', 'info');
        return false;
      }

      const res = await apiMutate('/api/agency/request', {
        body: { agencyTitle: cleanTitle, contactNote: (contactNote || '').trim() },
      });

      if (!res.ok) {
        const errMsg = String(res.data?.error || 'تعذر إرسال طلب فتح الوكالة، حاول مجدداً');
        showToast(errMsg, 'error');
        return false;
      }

      if (res.data?.state) {
        setState(normalizeStatePayload(res.data.state as Partial<AppState>, currentUser.id));
      } else {
        const localReq: AgencyApplicationRequest = {
          id: `agreq-${Date.now().toString().slice(-6)}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          agencyTitle: cleanTitle,
          contactNote: (contactNote || '').trim() || undefined,
          status: 'pending',
          createdAt: 'الآن',
        };
        setState((prev) => ({
          ...prev,
          agencyRequests: [localReq, ...prev.agencyRequests],
        }));
      }

      showToast(
        'تم إرسال طلب فتح الوكالة بنجاح! بانتظار موافقة المالك (ID: 900) لتفعيل البوابة.',
        'success'
      );
      return true;
    },
    [isApprovedAgent, state.agencyRequests, currentUser, apiMutate, showToast]
  );

  const registerAsAgent = submitAgencyRequest;

  const approveAgencyRequest = useCallback(
    async (requestId: string): Promise<boolean> => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): اعتماد طلبات الوكالات مخصص للمالك (ID: 900) فقط', 'error');
        return false;
      }
      const res = await apiMutate(`/api/agency/requests/${encodeURIComponent(requestId)}/approve`);
      if (!res.ok) {
        showToast(String(res.data?.error || 'تعذر اعتماد طلب الوكالة'), 'error');
        return false;
      }
      if (res.data?.state) {
        setState(normalizeStatePayload(res.data.state as Partial<AppState>, currentUser.id));
      }
      showToast('تمت الموافقة على الطلب وتفعيل وكالة الشحن بنجاح!', 'success');
      return true;
    },
    [isOwner, currentUser.id, apiMutate, showToast]
  );

  const rejectAgencyRequest = useCallback(
    async (requestId: string): Promise<boolean> => {
      if (!isOwner) {
        showToast('🚫 ممنوع (403): رفض طلبات الوكالات مخصص للمالك (ID: 900) فقط', 'error');
        return false;
      }
      const res = await apiMutate(`/api/agency/requests/${encodeURIComponent(requestId)}/reject`);
      if (!res.ok) {
        showToast(String(res.data?.error || 'تعذر رفض الطلب'), 'error');
        return false;
      }
      if (res.data?.state) {
        setState(normalizeStatePayload(res.data.state as Partial<AppState>, currentUser.id));
      }
      showToast('تم رفض طلب فتح الوكالة', 'info');
      return true;
    },
    [isOwner, currentUser.id, apiMutate, showToast]
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

      const prevRatio = host.giftsReceivedGold / Math.max(1, host.targetGold);
      const nextRatio = nextTotal / Math.max(1, host.targetGold);
      const crossedGolden80 = prevRatio < 0.8 && nextRatio >= 0.8 && !reachedTarget;

      void apiMutate('/api/agency/host/boost', { body: { hostId, amountGold: safeGain } });

      if (reachedTarget) {
        showToast(
          `🏆 تهانينا! وصل المضيف ${host.name} إلى الهدف الربحي اليومي (+1M عمولة تحفيزية)!`,
          'success'
        );
      } else if (crossedGolden80) {
        const pct = Math.min(99, Math.round(nextRatio * 100));
        const remaining = Math.max(0, host.targetGold - nextTotal);
        showToast(
          `⚡ تنبيه ذهبي: وصل المضيف ${host.name} إلى ${pct}% من هدفه اليومي! المتبقي ${remaining.toLocaleString('en-US')} ذهب فقط لإتمام 100%`,
          'warning'
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

  const createInviteLink = useCallback(
    async (roomId?: string): Promise<InviteLinkRecord | null> => {
      const room = roomId ? state.rooms.find((r) => r.id === roomId) : undefined;
      const result = await apiMutate('/api/invites/create', {
        body: roomId ? { roomId } : {},
      });
      if (result.ok && result.data?.invite) {
        const created = result.data.invite as InviteLinkRecord;
        showToast(
          room
            ? `🔗 تم إنشاء رابط دعوة مباشر لغرفة «${room.title}» (${created.code})`
            : `🔗 تم إنشاء رابط دعوة جديد (${created.code})`,
          'success'
        );
        return created;
      }
      // Offline / local fallback
      const fallbackCode = `RC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const localInvite: InviteLinkRecord = {
        code: fallbackCode,
        inviterId: currentUser.id,
        inviterName: currentUser.name,
        roomId: room?.id,
        roomTitle: room?.title,
        uses: 0,
        rewardGold: 1_000_000,
        createdAt: 'الآن',
      };
      setState((prev) => ({
        ...prev,
        invites: [localInvite, ...prev.invites].slice(0, 40),
      }));
      showToast(`🔗 تم إنشاء رابط دعوة (${fallbackCode})`, 'success');
      return localInvite;
    },
    [state.rooms, currentUser.id, currentUser.name, apiMutate, showToast]
  );

  const redeemInviteCode = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return false;
      const result = await apiMutate(`/api/invites/${encodeURIComponent(code)}/redeem`);
      if (result.ok) {
        const targetRoomId = (result.data?.targetRoomId as string | null) || null;
        showToast('🎉 تم تفعيل رابط الدعوة بنجاح! حصلت على +500,000 ذهبية ترحيبية', 'success');
        if (targetRoomId) {
          setActiveRoomIdState(targetRoomId);
          setMinimizedRoomId(null);
        }
        return true;
      }
      const localInvite = state.invites.find((inv) => inv.code.toUpperCase() === code);
      if (!localInvite) {
        showToast('كود الدعوة غير صالح أو منتهي الصلاحية', 'error');
        return false;
      }
      setState((prev) => ({
        ...prev,
        agentInviteCount: prev.agentInviteCount + 1,
        invites: prev.invites.map((inv) =>
          inv.code.toUpperCase() === code ? { ...inv, uses: inv.uses + 1 } : inv
        ),
        users: prev.users.map((u) =>
          u.id === prev.currentUserId ? { ...u, gold: u.gold + 500_000 } : u
        ),
      }));
      showToast('🎉 تم تفعيل رابط الدعوة بنجاح! (+500,000 ذهبية)', 'success');
      if (localInvite.roomId) {
        setActiveRoomIdState(localInvite.roomId);
        setMinimizedRoomId(null);
      }
      return true;
    },
    [apiMutate, state.invites, showToast]
  );

  const announceGameWinInRoom = useCallback(
    (gameName: string, icon: string, payout: number) => {
      const targetRoomId = activeRoomId || minimizedRoomId;
      if (!targetRoomId || !Number.isFinite(payout) || payout <= 0) return;
      const heatBoost = Math.min(500_000, Math.max(10_000, Math.floor(payout * 0.25)));
      const msgText = `${icon} فاز ${currentUser.name} بـ +${payout.toLocaleString('en-US')} ذهبية في ${gameName}! (+${heatBoost.toLocaleString('en-US')} حرارة للغرفة)`;
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) => {
          if (r.id !== targetRoomId) return r;
          const nextHeat = r.heat + heatBoost;
          return {
            ...r,
            heat: nextHeat,
            wealthBadge: computeWealthBadge(nextHeat) || r.wealthBadge,
            messages: [
              ...r.messages.slice(-30),
              {
                id: `gwin-${Date.now()}`,
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderLevel: currentUser.level,
                text: msgText,
                type: 'achievement',
                timestamp: 'الآن',
              },
            ],
          };
        }),
      }));
      void apiMutate(`/api/rooms/${targetRoomId}/game-win`, {
        body: { gameName, icon, payout },
      });
    },
    [activeRoomId, minimizedRoomId, currentUser.id, currentUser.name, currentUser.level, apiMutate]
  );

  // Automatically redeem any pending referral code if an already-signed-in user opens an invite URL
  useEffect(() => {
    if (!isAuthenticated || !pendingReferralCode) return;
    if (currentUser.referredBy) {
      try {
        localStorage.removeItem(PENDING_REFERRAL_KEY);
      } catch {
        // ignore
      }
      setPendingReferralCode(null);
      return;
    }
    const codeToRedeem = pendingReferralCode;
    void redeemInviteCode(codeToRedeem).finally(() => {
      try {
        localStorage.removeItem(PENDING_REFERRAL_KEY);
      } catch {
        // ignore
      }
      setPendingReferralCode(null);
    });
  }, [isAuthenticated, pendingReferralCode, currentUser.referredBy, redeemInviteCode]);

  const resetDemoData = useCallback(() => {
    if (!isOwner) {
      showToast('🚫 ممنوع (403): استعادة النظام للمالك فقط', 'error');
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }
    suppressNextLevelTriggerRef.current = true;
    setLevelUpModal(null);
    setState(DEFAULT_STATE);
    setActiveRoomIdState(null);
    setMinimizedRoomId(null);
    void apiMutate('/api/system/reset');
    showToast('تمت استعادة الإعدادات الافتراضية لرياض شات', 'info');
  }, [isOwner, apiMutate, showToast]);

  const unreadNotificationsCount = notifications.reduce(
    (acc, n) => acc + (n.read ? 0 : 1),
    0
  );

  const dismissLiveNotificationBanner = useCallback((notificationId: string) => {
    setLiveNotificationBanners((prev) => prev.filter((b) => b.id !== notificationId));
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
      if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
      const res = await fetch(resolveApiUrl('/api/notifications'), {
        credentials: 'include',
        headers,
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        notifications?: InAppNotification[];
        followedRoomIds?: string[];
        preferences?: NotificationPreferences;
      };
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
      if (Array.isArray(data.followedRoomIds)) setFollowedRoomIds(data.followedRoomIds);
      if (data.preferences) setNotificationPrefs(data.preferences);
    } catch {
      // Ignore transient network failures
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshNotifications();
    } else {
      setNotifications([]);
      setFollowedRoomIds([]);
      setLiveNotificationBanners([]);
    }
  }, [isAuthenticated, currentUser.id, refreshNotifications]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
      await fetch(
        resolveApiUrl(`/api/notifications/${encodeURIComponent(notificationId)}/read`),
        {
          method: 'POST',
          credentials: 'include',
          headers,
          body: '{}',
        }
      );
    } catch {
      // Optimistic state already updated
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
      await fetch(resolveApiUrl('/api/notifications/read-all'), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: '{}',
      });
    } catch {
      // Ignore network errors
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    setNotifications([]);
    setLiveNotificationBanners([]);
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
      await fetch(resolveApiUrl('/api/notifications'), {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      showToast('تم مسح سجل الإشعارات', 'info');
    } catch {
      // Ignore network errors
    }
  }, [showToast]);

  const updateNotificationPrefs = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      setNotificationPrefs((prev) => ({ ...prev, ...patch }));
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
        const res = await fetch(resolveApiUrl('/api/notifications/preferences'), {
          method: 'PATCH',
          credentials: 'include',
          headers,
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const data = (await res.json()) as { preferences?: NotificationPreferences };
          if (data.preferences) setNotificationPrefs(data.preferences);
        }
      } catch {
        // Keep local toggle
      }
    },
    []
  );

  const toggleFollowRoom = useCallback(
    async (roomId: string): Promise<boolean> => {
      const wasFollowing = followedRoomIds.includes(roomId);
      setFollowedRoomIds((prev) =>
        wasFollowing ? prev.filter((id) => id !== roomId) : [...prev, roomId]
      );
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
        const res = await fetch(
          resolveApiUrl(`/api/rooms/${encodeURIComponent(roomId)}/follow`),
          {
            method: 'POST',
            credentials: 'include',
            headers,
            body: '{}',
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          following?: boolean;
          followedRoomIds?: string[];
          error?: string;
        };
        if (!res.ok) {
          // Rollback optimistic change on server rejection
          setFollowedRoomIds((prev) =>
            wasFollowing ? [...prev, roomId] : prev.filter((id) => id !== roomId)
          );
          showToast(data.error || 'تعذر تحديث متابعة الغرفة', 'error');
          return wasFollowing;
        }
        if (Array.isArray(data.followedRoomIds)) {
          setFollowedRoomIds(data.followedRoomIds);
        }
        const nowFollowing = Boolean(data.following);
        showToast(
          nowFollowing
            ? 'تمت متابعة الغرفة — سيصلك إشعار فوري عند بدء أي بث مباشر فيها'
            : 'تم إلغاء متابعة الغرفة',
          nowFollowing ? 'success' : 'info'
        );
        return nowFollowing;
      } catch {
        setFollowedRoomIds((prev) =>
          wasFollowing ? [...prev, roomId] : prev.filter((id) => id !== roomId)
        );
        return wasFollowing;
      }
    },
    [followedRoomIds, showToast]
  );

  const startRoomLiveBroadcast = useCallback(
    async (
      roomId: string,
      topic?: string
    ): Promise<{ ok: boolean; notifiedCount?: number }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
        const res = await fetch(
          resolveApiUrl(`/api/rooms/${encodeURIComponent(roomId)}/live/start`),
          {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ topic: topic || '' }),
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          notifiedCount?: number;
          throttled?: boolean;
          state?: Partial<AppState>;
        };
        if (!res.ok) {
          showToast(data.error || 'تعذر بدء البث المباشر', 'error');
          return { ok: false };
        }
        if (data.state) {
          setState((prev) => ({
            ...normalizeStatePayload(data.state!, prev.currentUserId),
            currentUserId: prev.currentUserId,
          }));
        }
        const count = data.notifiedCount ?? 0;
        showToast(
          data.throttled
            ? 'البث المباشر نشط بالفعل'
            : count > 0
            ? `تم بدء البث المباشر وإرسال إشعار فوري إلى ${count} مستخدم`
            : 'تم تفعيل البث المباشر للغرفة بنجاح',
          'success'
        );
        return { ok: true, notifiedCount: count };
      } catch {
        showToast('تعذر الاتصال بالخادم لبدء البث المباشر', 'error');
        return { ok: false };
      }
    },
    [showToast]
  );

  const stopRoomLiveBroadcast = useCallback(
    async (roomId: string): Promise<boolean> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        if (authTokenRef.current) headers.Authorization = `Bearer ${authTokenRef.current}`;
        const res = await fetch(
          resolveApiUrl(`/api/rooms/${encodeURIComponent(roomId)}/live/stop`),
          {
            method: 'POST',
            credentials: 'include',
            headers,
            body: '{}',
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          state?: Partial<AppState>;
        };
        if (!res.ok) {
          showToast(data.error || 'تعذر إنهاء البث المباشر', 'error');
          return false;
        }
        if (data.state) {
          setState((prev) => ({
            ...normalizeStatePayload(data.state!, prev.currentUserId),
            currentUserId: prev.currentUserId,
          }));
        }
        showToast('تم إيقاف شارة البث المباشر للغرفة', 'info');
        return true;
      } catch {
        return false;
      }
    },
    [showToast]
  );

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
        isPrimaryAdmin,
        isApprovedAgent,
        isAuthenticated,
        authLoading,
        pendingReferralCode,
        loginWithEmail,
        registerWithEmail,
        sendPhoneOtp,
        verifyPhoneOtp,
        lastGoogleHint,
        clearGoogleHint,
        loginWithGoogle,
        loginWithFacebook,
        claimOwnerPassword,
        updateAccountCredentials,
        requestOwnerRecoveryCode,
        completeOwnerRecovery,
        verifyRoomPassword,
        agency2faStatus,
        agency2faLoading,
        refreshAgency2FAStatus,
        requestAgency2FA,
        verifyAgency2FA,
        lockAgency2FA,
        trafficSurgeRetrySec,
        dismissTrafficSurgeNotice,
        opsRequest,
        fetchOpsOverview,
        logoutAccount,
        roomTelemetry,
        subscribeRoomTelemetry,
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
        submitAgencyRequest,
        approveAgencyRequest,
        rejectAgencyRequest,
        distributeProfitsAutomatically,
        distributeSingleHostCommission,
        updateHostCommissionRate,
        toggleAutoDistribution,
        setAgencyCommissionSplit,
        addAgencyHost,
        boostHostDailyProfit,
        sendSpeakingState,
        createInviteLink,
        redeemInviteCode,
        announceGameWinInRoom,
        resetDemoData,
        notifications,
        unreadNotificationsCount,
        followedRoomIds,
        notificationPrefs,
        liveNotificationBanners,
        dismissLiveNotificationBanner,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        updateNotificationPrefs,
        toggleFollowRoom,
        startRoomLiveBroadcast,
        stopRoomLiveBroadcast,
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
