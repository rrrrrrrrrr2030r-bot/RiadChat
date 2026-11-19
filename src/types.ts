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

