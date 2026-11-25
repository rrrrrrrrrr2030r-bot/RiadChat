export type MainTab =
  | 'rooms'
  | 'games'
  | 'square'
  | 'messages'
  | 'me'
  | 'wallet'
  | 'agencies'
  | 'agency-dashboard'
  | 'store'
  | 'system';

export type UserRole = 'OWNER' | 'AGENCY_AGENT' | 'HOST' | 'SUPERVISOR' | 'USER';

export type GameLuckMode = 'generous' | 'balanced' | 'strict';
export type DiceMultiplier = 1 | 1.25 | 1.5;
export type GameMultiplier = DiceMultiplier;

export interface UserAccount {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  level: number;
  xp: number;
  svip: number;
  aristocratTier: string | null;
  title: string;
  country: string;
  flag: string;
  gold: number;
  diamonds: number;
  charisma?: number;
  giftedGold?: number;
  following: number;
  followers: number;
  visitors: number;
  isVerifiedAgent?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  ownedEntries: string[];
  activeEntry?: string;
  email?: string;
  phone?: string;
  authProvider?: 'email' | 'google' | 'facebook' | 'phone' | 'supabase';
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  referralRewardsGold?: number;
  createdAt?: string;
}

export interface Top3Winner {
  id: string;
  name: string;
  avatar: string;
  wonGold: number;
  rank: 1 | 2 | 3;
}

export interface MicSeat {
  seatNumber: number;
  userId: string | null;
  userName: string | null;
  avatar: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  isLocked: boolean;
}

export interface RoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderLevel: number;
  text: string;
  type: 'chat' | 'gift' | 'system' | 'achievement';
  timestamp: string;
}

export type RoomThemeId = 'ocean-stars' | 'cosmic-purple' | 'ramadan-green' | 'royal-gold';
export type VisitorChatRequirement = 'all' | 'disallowed' | 'lv5' | 'lv10';

export interface VoiceRoom {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  coverImage?: string;
  country: string;
  flag: string;
  category: 'الكل' | 'وكالات' | 'طرب' | 'مسابقات' | 'دردشة';
  description: string;
  welcomeMessage?: string;
  themeId?: RoomThemeId;
  useThemeFilter?: boolean;
  password?: string;
  hasPassword?: boolean;
  diceCount?: number;
  membershipCount?: number;
  membersOnlyEntry?: boolean;
  allowVisitorsOnMic?: boolean;
  sendEmojiToChat?: boolean;
  autoSleepEnabled?: boolean;
  visitorChatRequirement?: VisitorChatRequirement;
  bannedUserIds?: string[];
  heat: number;
  listeners: number;
  totalMics: number;
  wealthBadge?: string;
  isLocked?: boolean;
  isPinned?: boolean;
  isLive?: boolean;
  liveTitle?: string;
  liveStartedAt?: number;
  followersCount?: number;
  jetCount?: number;
  seats: MicSeat[];
  messages: RoomMessage[];
}

export interface AgencyTransfer {
  id: string;
  recipientId: string;
  recipientName: string;
  baseGold: number;
  bonusGold: number;
  totalGold: number;
  agentName: string;
  timestamp: string;
}

export interface ModeratorRecord {
  id: string;
  specialId: string;
  name: string;
  role: string;
  whatsapp: string;
  custodyGold: number;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  reason: string;
  roomTitle: string;
  status: 'pending' | 'resolved' | 'dismissed';
  timestamp: string;
}

export interface DailyTask {
  id: string;
  title: string;
  description: string;
  rewardGold: number;
  rewardDiamonds: number;
  progress: number;
  target: number;
  claimed: boolean;
}

export interface StorePackage {
  id: string;
  name: string;
  badgeText?: string;
  gold: number;
  bonusGold: number;
  diamonds: number;
  priceUsd: number;
  perks: string[];
  accentTheme: 'amber' | 'purple' | 'crimson' | 'emerald';
  entryItem?: string;
  titleGrant?: string;
}

export type GiftCategory = 'هدية' | 'النشاط' | 'العشاق' | 'مكافأة' | 'شرف' | 'SVIP';

export interface GiftItem {
  id: string;
  name: string;
  costGold: number;
  heatGain: number;
  icon: string;
  isGrand?: boolean;
  category?: GiftCategory;
  badge?: '3D' | 'magic';
}

export interface ActiveGiftAnimation {
  id: string;
  roomId: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  quantity: number;
  costGold: number;
  isGrand?: boolean;
}

export interface AgencyHostRecord {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  roomId: string;
  roomTitle: string;
  hoursLive: number;
  giftsReceivedGold: number;
  diamondsEarned: number;
  targetGold: number;
  commissionRate: number;
  pendingCommissionGold: number;
  status: 'on-mic' | 'online' | 'offline';
}

export interface CommissionDistribution {
  id: string;
  timestamp: string;
  totalPoolGold: number;
  hostsCount: number;
  agencyShareGold: number;
  hostsShareGold: number;
  mode: 'auto' | 'manual';
  note: string;
}

export interface InviteLinkRecord {
  code: string;
  inviterId: string;
  inviterName: string;
  roomId?: string;
  roomTitle?: string;
  uses: number;
  rewardGold: number;
  createdAt: string;
}

export interface AgencyApplicationRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  agencyTitle: string;
  contactNote?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface RoomTelemetryPoint {
  seq: number;
  timestamp: number;
  label: string;
  interaction: number;
  voiceOnline: number;
  heatGames: number;
  activeMics: number;
  speakingMics: number;
  listeners: number;
  messagesCount: number;
  giftsCount: number;
  roomHeat: number;
}

export type Agency2FAChannel = 'sms' | 'email';

export interface Agency2FAStatus {
  verified: boolean;
  expiresAt: number | null;
  remainingSec: number;
  channel: Agency2FAChannel | null;
  maskedEmail: string;
  maskedPhone: string;
  hasEmail: boolean;
  hasPhone: boolean;
  smsConfigured: boolean;
  emailConfigured: boolean;
  sessionDurationMin: number;
}

export interface OpsBackupItem {
  id: string;
  kind: 'daily' | 'pitr' | 'manual';
  reason: string;
  createdAt: string;
  sizeBytes: number;
  encrypted: boolean;
  checksumSha256: string;
  filename: string;
}

export interface OpsRestoreDrillResult {
  ranAt: string;
  backupId: string;
  passed: boolean;
  usersVerified: number;
  roomsVerified: number;
  owner900Intact: boolean;
  checksumMatched: boolean;
  durationMs: number;
  error?: string;
}

export interface OpsMigrationItem {
  id: string;
  filename: string;
  titleAr: string;
  descriptionAr: string;
  createdAt: string;
  applied: {
    id: string;
    appliedAt: string;
    appliedBy: string;
    changedCount: number;
    summary: string;
    preSnapshotId?: string;
  } | null;
  lastDryRun: {
    migrationId: string;
    passed: boolean;
    changedCount: number;
    summary: string;
    durationMs: number;
    error?: string;
  } | null;
}

export interface OpsHealthProbe {
  checkedAt: string;
  status: 'healthy' | 'degraded' | 'down';
  responseMs: number;
  eventLoopLagMs: number;
  heapUsedMb: number;
  rssMb: number;
  wsClients: number;
  activeRequests: number;
  note?: string;
}

export interface OpsStressStage {
  stageName: string;
  concurrency: number;
  totalRequests: number;
  okCount: number;
  rateLimited429Count: number;
  errorCount: number;
  rps: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface OpsStressReport {
  ranAt: string;
  targetPath: string;
  durationMs: number;
  peakRps: number;
  saturationStage: string | null;
  stages: OpsStressStage[];
}

export interface OpsOverviewResponse {
  ok: boolean;
  retentionDays: number;
  dbEncryptedAtRest: boolean;
  readOnlyAutomationMode: boolean;
  alertWebhookConfigured: boolean;
  backupWebhookConfigured: boolean;
  lastOffsitePushAt: string | null;
  backups: OpsBackupItem[];
  lastRestoreDrill: OpsRestoreDrillResult | null;
  migrations: OpsMigrationItem[];
  archivedRooms: Array<{
    archivedAt: string;
    archivedBy: string;
    reason: string;
    roomId: string;
    roomTitle: string;
    ownerName: string;
  }>;
  archivedModerators: Array<{
    archivedAt: string;
    archivedBy: string;
    reason: string;
    moderatorId: string;
    name: string;
    role: string;
  }>;
  monitor: {
    intervalSec: number;
    latest: OpsHealthProbe | null;
    uptimePct: number;
    history: OpsHealthProbe[];
    alerts: Array<{
      id: string;
      triggeredAt: string;
      severity: 'warning' | 'critical';
      message: string;
      webhookDispatched: boolean;
    }>;
  };
  traffic: {
    activeRequests: number;
    peakConcurrent: number;
    maxConcurrentInFlight: number;
    maxPerIpPerMinute: number;
    totalServed: number;
    totalRejected429: number;
    retryAfterSec: number;
  };
  indexes: {
    indexedUsers: number;
    indexedRooms: number;
    indexedInvites: number;
    rebuildCount: number;
    lastRebuiltAt: string;
  };
  writePool: {
    coalesceMs: number;
    pendingWrites: number;
    flushedBatches: number;
    lastFlushMs: number;
    lastFlushedAt: string | null;
  };
  lastStressTest: OpsStressReport | null;
}

export type InAppNotificationKind = 'followed_room_live' | 'popular_room_live';

export interface InAppNotification {
  id: string;
  kind: InAppNotificationKind;
  roomId: string;
  roomTitle: string;
  roomAvatar: string;
  hostId: string;
  hostName: string;
  category: string;
  title: string;
  message: string;
  topic?: string;
  listeners: number;
  heat: number;
  createdAt: number;
  read: boolean;
}

export interface NotificationPreferences {
  followedRoomsLive: boolean;
  popularRoomsLive: boolean;
  soundEnabled: boolean;
}

export type SocialInterestTag =
  | 'طرب'
  | 'دردشة'
  | 'مسابقات'
  | 'وكالات'
  | 'ألعاب الحظ'
  | 'بث مباشر';

export interface SharedRoomSummary {
  roomId: string;
  roomTitle: string;
  category: string;
  viewerVisitCount: number;
}

export interface SuggestedContact {
  userId: string;
  name: string;
  avatar: string;
  role: string;
  level: number;
  svip: number;
  title: string;
  country: string;
  flag: string;
  followers: number;
  isVerifiedAgent?: boolean;
  matchScore: number;
  sharedRooms: SharedRoomSummary[];
  sharedInterests: SocialInterestTag[];
  activeRoomId: string | null;
  activeRoomTitle: string | null;
  reasonSummary: string;
}

export interface MostVisitedRoomSummary {
  roomId: string;
  roomTitle: string;
  category: string;
  visitCount: number;
  lastVisitedAt: number;
}

export interface SocialDiscoverySnapshot {
  suggestions: SuggestedContact[];
  explicitInterests: SocialInterestTag[];
  inferredInterests: SocialInterestTag[];
  availableInterests: SocialInterestTag[];
  mostVisitedRooms: MostVisitedRoomSummary[];
  dismissedCount: number;
}

export type OwnerRecoveryAuditEvent =
  | 'code_requested'
  | 'code_rejected'
  | 'locked_out'
  | 'recovery_completed';

export interface OwnerRecoveryAuditEntry {
  id: string;
  timestamp: string;
  event: OwnerRecoveryAuditEvent;
  maskedEmail: string;
  deliveryMode?: 'resend' | 'smtp' | 'dev_preview';
  phoneUpdated?: boolean;
  revokedSessions?: number;
  ipHint: string;
  note: string;
}

export interface OwnerRecoveryStatus {
  emailDeliveryConfigured: boolean;
  devPreviewEnabled: boolean;
  maskedAdminEmailHint: string;
  cooldownRemainingSec: number;
  lockoutRemainingSec: number;
  hasPendingChallenge: boolean;
}






