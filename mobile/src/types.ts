export type UserRole = 'OWNER' | 'AGENCY_AGENT' | 'HOST' | 'SUPERVISOR' | 'USER';

export type MobileAuthProvider = 'email' | 'google' | 'facebook' | 'phone' | 'supabase';

export interface MobileGoogleHint {
  email: string;
  name?: string;
}

export interface MobileUser {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  level: number;
  xp: number;
  svip: number;
  gold: number;
  diamonds: number;
  country: string;
  flag: string;
  email?: string;
  phone?: string;
  authProvider?: MobileAuthProvider;
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  referralRewardsGold?: number;
  isVerifiedAgent?: boolean;
  createdAt?: string;
}

export interface MobileAgencyRequest {
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

export interface UnifiedRbacResult {
  isPrimaryAdmin: boolean;
  isApprovedAgent: boolean;
  userId: string | null;
  supabaseLinked: boolean;
  source: 'supabase+server' | 'server' | 'none';
}

export interface MobileAuthActionResult {
  ok: boolean;
  error?: string;
  redirected?: boolean;
  previewOtp?: string;
}

export interface MobileResolvedInvite {
  code: string;
  inviterId: string;
  inviterName: string;
  inviterAvatar?: string;
  roomId?: string | null;
  roomTitle?: string | null;
  welcomeGold: number;
  referrerRewardGold: number;
}

export interface MobileRoomSeat {
  seatNumber: number;
  userId: string | null;
  userName: string | null;
  avatar: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  isLocked: boolean;
}

export interface MobileRoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderLevel: number;
  text: string;
  type: 'chat' | 'gift' | 'system' | 'achievement';
  timestamp: string;
}

export interface MobileVoiceRoom {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  country: string;
  flag: string;
  category: string;
  heat: number;
  onlineCount?: number;
  listeners?: number;
  totalMics: number;
  autoSleepEnabled?: boolean;
  hasPassword?: boolean;
  seats: MobileRoomSeat[];
  messages: MobileRoomMessage[];
}

export interface MobileInviteLink {
  code: string;
  inviterId: string;
  inviterName: string;
  roomId?: string;
  roomTitle?: string;
  uses: number;
  rewardGold: number;
  createdAt: string;
}

export interface MobileServerState {
  currentUserId: string;
  users: MobileUser[];
  rooms: MobileVoiceRoom[];
  invites: MobileInviteLink[];
  agencyRequests?: MobileAgencyRequest[];
  jackpotProgress: number;
  dailyStakedGold: number;
  cashbackClaimedBase: number;
  diceMultiplier: number;
  gameLuckMode: 'generous' | 'balanced' | 'strict';
  globalAnnouncement: string;
}

export interface MobileAgency2FAStatus {
  required: boolean;
  verified: boolean;
  expiresAt: number | null;
  remainingSec: number;
  verifiedChannel: 'sms' | 'email' | null;
  maskedEmail: string | null;
  maskedPhone: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  windowMinutes: number;
}

export interface MobilePaginatedResponse<T> {
  ok: boolean;
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type MobileNotificationKind = 'followed_room_live' | 'popular_room_live';

export interface MobileInAppNotification {
  id: string;
  kind: MobileNotificationKind;
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

export interface MobileNotificationPrefs {
  followedRoomsLive: boolean;
  popularRoomsLive: boolean;
  soundEnabled: boolean;
}


