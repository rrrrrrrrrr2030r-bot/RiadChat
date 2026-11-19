import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  AgencyHostRecord,
  AgencyTransfer,
  CommissionDistribution,
  DailyTask,
  DiceMultiplier,
  GameLuckMode,
  ModeratorRecord,
  ReportRecord,
  RoomThemeId,
  UserAccount,
  UserRole,
  VisitorChatRequirement,
  VoiceRoom,
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'riad-chat-rbac-hmac-secret-2026-prod';

interface ServerAppState {
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

const JACKPOT_TARGET = 600_000_000;

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

function createInitialUsers(): UserAccount[] {
  return [
    {
      id: '900',
      name: 'رياض | Riad',
      avatar: 'avatar_riad_1794519702310.jpg',
      role: 'OWNER',
      level: 1,
      xp: 0,
      svip: 0,
      aristocratTier: null,
      title: 'ملك المجد',
      country: 'اليمن',
      flag: '🇾🇪',
      gold: 8_139_073_166,
      diamonds: 1_270.83,
      charisma: 0,
      giftedGold: 0,
      following: 0,
      followers: 0,
      visitors: 0,
      isVerifiedAgent: true,
      isAdmin: true,
      ownedEntries: [],
    },
    {
      id: '10',
      name: 'إدارة رياض',
      avatar: 'avatar_riad_1794519702310.jpg',
      role: 'OWNER',
      level: 1,
      xp: 0,
      svip: 0,
      aristocratTier: null,
      title: 'الإدارة العليا',
      country: 'السعودية',
      flag: '🇸🇦',
      gold: 50_140_000_000,
      diamonds: 1_031_270.83,
      charisma: 0,
      giftedGold: 0,
      following: 0,
      followers: 0,
      visitors: 0,
      isVerifiedAgent: true,
      isAdmin: true,
      ownedEntries: [],
    },
    {
      id: '200016',
      name: 'الوكيل أحمد',
      avatar: 'avatar_agent_ahmed_1794519702042.jpg',
      role: 'AGENCY_AGENT',
      level: 1,
      xp: 0,
      svip: 0,
      aristocratTier: null,
      title: 'وكيل شحن معتمد',
      country: 'السعودية',
      flag: '🇸🇦',
      gold: 18_500_000_000,
      diamonds: 42_500,
      charisma: 0,
      giftedGold: 0,
      following: 0,
      followers: 0,
      visitors: 0,
      isVerifiedAgent: true,
      ownedEntries: [],
    },
    {
      id: '51115',
      name: 'وكالة نواف للشحن',
      avatar: 'avatar_host_nawaf_1794519702919.jpg',
      role: 'AGENCY_AGENT',
      level: 1,
      xp: 0,
      svip: 0,
      aristocratTier: null,
      title: 'عميد الوكلاء',
      country: 'عُمان',
      flag: '🇴🇲',
      gold: 12_400_000_000,
      diamonds: 19_800,
      charisma: 0,
      giftedGold: 0,
      following: 0,
      followers: 0,
      visitors: 0,
      isVerifiedAgent: true,
      ownedEntries: [],
    },
    {
      id: '882001',
      name: 'سلطان الخليج',
      avatar: 'avatar_host_nawaf_1794519702919.jpg',
      role: 'USER',
      level: 1,
      xp: 0,
      svip: 0,
      aristocratTier: null,
      title: 'نجم السهرة',
      country: 'الإمارات',
      flag: '🇦🇪',
      gold: 420_000_000,
      diamonds: 3_400,
      charisma: 0,
      giftedGold: 0,
      following: 0,
      followers: 0,
      visitors: 0,
      ownedEntries: [],
    },
    {
      id: '774100',
      name: 'فهد الطرب',
      avatar: 'avatar_agent_ahmed_1794519702042.jpg',
      role: 'HOST',
      level: 1,
      xp: 0,
      svip: 0,
      aristocratTier: null,
      title: 'عازف العود',
      country: 'الكويت',
      flag: '🇰🇼',
      gold: 185_000_000,
      diamonds: 950,
      charisma: 0,
      giftedGold: 0,
      following: 0,
      followers: 0,
      visitors: 0,
      ownedEntries: [],
    },
    {
      id: '660500',
      name: 'المشرف خالد',
      avatar: 'avatar_host_nawaf_1794519702919.jpg',
      role: 'SUPERVISOR',
      level: 1,
      xp: 0,
      svip: 0,
      aristocratTier: null,
      title: 'مشرف الغرف',
      country: 'قطر',
      flag: '🇶🇦',
      gold: 640_000_000,
      diamonds: 4_800,
      charisma: 0,
      giftedGold: 0,
      following: 0,
      followers: 0,
      visitors: 0,
      ownedEntries: [],
    },
  ];
}

function createSeats(
  total: number,
  occupied: Array<{ seat: number; user: UserAccount; speaking?: boolean }>
): VoiceRoom['seats'] {
  const seats: VoiceRoom['seats'] = [];
  for (let i = 1; i <= total; i++) {
    const match = occupied.find((o) => o.seat === i);
    seats.push({
      seatNumber: i,
      userId: match ? match.user.id : null,
      userName: match ? match.user.name : null,
      avatar: match ? match.user.avatar : null,
      isMuted: false,
      isSpeaking: Boolean(match?.speaking),
      isLocked: false,
    });
  }
  return seats;
}

function createDefaultState(): ServerAppState {
  const users = createInitialUsers();
  const rooms: VoiceRoom[] = [
    {
      id: 'room-900',
      title: 'وكاله ريــــ1ــــاض',
      ownerId: '900',
      ownerName: 'رياض | Riad',
      ownerAvatar: 'avatar_riad_1794519702310.jpg',
      coverImage: 'avatar_riad_1794519702310.jpg',
      country: 'اليمن',
      flag: '🇾🇪',
      category: 'وكالات',
      description: 'مرحبا بكم وكاله 🪙 رياض ID:900',
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
      listeners: 3653,
      totalMics: 20,
      isPinned: true,
      jetCount: 0,
      seats: createSeats(20, []),
      messages: [
        {
          id: 'm1',
          senderId: '900',
          senderName: 'رياض | Riad',
          senderLevel: 1,
          text: 'أهلاً وسهلاً بكم في الغرفة الرسمية — انطلقت الجولة الجديدة!',
          type: 'system',
          timestamp: 'الآن',
        },
        {
          id: 'm2',
          senderId: '200016',
          senderName: 'الوكيل أحمد',
          senderLevel: 1,
          text: 'منورين الغرفة يا ملوك، الشحن الفوري متاح الآن!',
          type: 'chat',
          timestamp: 'منذ 1 د',
        },
      ],
    },
    {
      id: 'room-locked-1',
      title: 'ممنوع الدخول',
      ownerId: '10',
      ownerName: 'إدارة رياض',
      ownerAvatar: 'room_cover_desert_suv_1794963320069.jpg',
      country: 'السعودية',
      flag: '🇸🇦',
      category: 'دردشة',
      description: 'لا يوجد فتح العاااااب — جلسة خاصة للأصدقاء',
      heat: 0,
      listeners: 3206,
      totalMics: 9,
      isLocked: true,
      jetCount: 0,
      seats: createSeats(9, [{ seat: 1, user: users[1], speaking: true }]),
      messages: [
        {
          id: 'm-lock-1',
          senderId: '10',
          senderName: 'إدارة رياض',
          senderLevel: 1,
          text: 'أهلاً وسهلاً بالجميع في الديوانية الخاصة',
          type: 'system',
          timestamp: 'منذ دقيقتين',
        },
      ],
    },
    {
      id: 'room-51115',
      title: 'وكالة شحن ⚔️ نواف ↑ ⚔️',
      ownerId: '51115',
      ownerName: 'وكالة نواف للشحن',
      ownerAvatar: 'room_cover_night_ocean_1794963320976.jpg',
      country: 'اليمن',
      flag: '🇾🇪',
      category: 'وكالات',
      description: 'وكالة نواف للشحن للتواصل واتس ... 77 — شحن آمن وفوري للجميع',
      heat: 0,
      listeners: 4242,
      totalMics: 10,
      jetCount: 0,
      seats: createSeats(10, [
        { seat: 1, user: users[3], speaking: true },
        { seat: 2, user: users[4], speaking: false },
        { seat: 3, user: users[5], speaking: true },
        { seat: 4, user: users[2], speaking: false },
        { seat: 5, user: users[0], speaking: false },
      ]),
      messages: [
        {
          id: 'm3',
          senderId: '51115',
          senderName: 'وكالة نواف للشحن',
          senderLevel: 1,
          text: 'أهلاً وسهلاً بكم في وكالة نواف للشحن الفوري',
          type: 'system',
          timestamp: 'منذ 5 د',
        },
      ],
    },
    {
      id: 'room-774100',
      title: 'وكالة شحن محـطـم',
      ownerId: '774100',
      ownerName: 'فهد الطرب',
      ownerAvatar: 'room_cover_gentleman_bw_1794963320157.jpg',
      country: 'اليمن',
      flag: '🇾🇪',
      category: 'طرب',
      description: 'مرحبًا ألف منورين 🤍🕺 — سهرة طرب وتحديات',
      heat: 0,
      listeners: 11,
      totalMics: 9,
      isLocked: true,
      jetCount: 0,
      seats: createSeats(9, [{ seat: 1, user: users[5], speaking: true }]),
      messages: [
        {
          id: 'm4',
          senderId: '774100',
          senderName: 'فهد الطرب',
          senderLevel: 1,
          text: 'اطلع على المايك وسمعنا إبداعك!',
          type: 'chat',
          timestamp: 'الآن',
        },
      ],
    },
    {
      id: 'room-882001',
      title: '🦅 WC. ✠Oops',
      ownerId: '882001',
      ownerName: 'سلطان الخليج',
      ownerAvatar: 'avatar_host_nawaf_1794519702919.jpg',
      country: 'قطر',
      flag: '🇶🇦',
      category: 'مسابقات',
      description: '✦✦ من لا يعرف قدر نفسه، لن يعرف ا...',
      heat: 0,
      listeners: 2074,
      totalMics: 10,
      jetCount: 0,
      seats: createSeats(10, [
        { seat: 1, user: users[4], speaking: true },
        { seat: 2, user: users[0], speaking: false },
        { seat: 3, user: users[2], speaking: false },
      ]),
      messages: [
        {
          id: 'm5',
          senderId: '882001',
          senderName: 'سلطان الخليج',
          senderLevel: 1,
          text: 'الجولة الحاسمة تبدأ الآن — شدوا الهمة!',
          type: 'chat',
          timestamp: 'منذ دقيقتين',
        },
      ],
    },
  ];

  const hosts: AgencyHostRecord[] = [
    {
      id: 'host-900',
      userId: '900',
      name: 'رياض | Riad',
      avatar: 'avatar_riad_1794519702310.jpg',
      roomId: 'room-900',
      roomTitle: 'وكاله ريــــ1ــــاض',
      hoursLive: 0,
      giftsReceivedGold: 0,
      diamondsEarned: 0,
      targetGold: 200_000_000,
      commissionRate: 18,
      pendingCommissionGold: 0,
      status: 'on-mic',
    },
    {
      id: 'host-51115',
      userId: '51115',
      name: 'وكالة نواف للشحن',
      avatar: 'avatar_host_nawaf_1794519702919.jpg',
      roomId: 'room-51115',
      roomTitle: 'وكالة شحن ⚔️ نواف ↑ ⚔️',
      hoursLive: 0,
      giftsReceivedGold: 0,
      diamondsEarned: 0,
      targetGold: 160_000_000,
      commissionRate: 15,
      pendingCommissionGold: 0,
      status: 'on-mic',
    },
    {
      id: 'host-200016',
      userId: '200016',
      name: 'الوكيل أحمد',
      avatar: 'avatar_agent_ahmed_1794519702042.jpg',
      roomId: 'room-900',
      roomTitle: 'وكاله ريــــ1ــــاض',
      hoursLive: 0,
      giftsReceivedGold: 0,
      diamondsEarned: 0,
      targetGold: 120_000_000,
      commissionRate: 15,
      pendingCommissionGold: 0,
      status: 'online',
    },
    {
      id: 'host-882001',
      userId: '882001',
      name: 'سلطان الخليج',
      avatar: 'avatar_host_nawaf_1794519702919.jpg',
      roomId: 'room-882001',
      roomTitle: '🦅 WC. ✠Oops',
      hoursLive: 0,
      giftsReceivedGold: 0,
      diamondsEarned: 0,
      targetGold: 120_000_000,
      commissionRate: 12,
      pendingCommissionGold: 0,
      status: 'on-mic',
    },
    {
      id: 'host-774100',
      userId: '774100',
      name: 'فهد الطرب',
      avatar: 'avatar_agent_ahmed_1794519702042.jpg',
      roomId: 'room-774100',
      roomTitle: 'وكالة شحن محـطـم',
      hoursLive: 0,
      giftsReceivedGold: 0,
      diamondsEarned: 0,
      targetGold: 100_000_000,
      commissionRate: 12,
      pendingCommissionGold: 0,
      status: 'on-mic',
    },
  ];

  const transfers: AgencyTransfer[] = [
    {
      id: 'tr-105',
      recipientId: '882001',
      recipientName: 'سلطان الخليج',
      baseGold: 100_000_000,
      bonusGold: 25_000_000,
      totalGold: 125_000_000,
      agentName: 'الوكيل أحمد',
      timestamp: 'اليوم · 04:45 م',
    },
    {
      id: 'tr-104',
      recipientId: '774100',
      recipientName: 'فهد الطرب',
      baseGold: 40_000_000,
      bonusGold: 10_000_000,
      totalGold: 50_000_000,
      agentName: 'وكالة رياض',
      timestamp: 'اليوم · 03:20 م',
    },
    {
      id: 'tr-103',
      recipientId: '51115',
      recipientName: 'وكالة نواف للشحن',
      baseGold: 500_000_000,
      bonusGold: 125_000_000,
      totalGold: 625_000_000,
      agentName: 'الوكيل أحمد',
      timestamp: 'أمس · 11:10 م',
    },
    {
      id: 'tr-102',
      recipientId: '900',
      recipientName: 'رياض | Riad',
      baseGold: 2_000_000_000,
      bonusGold: 500_000_000,
      totalGold: 2_500_000_000,
      agentName: 'إدارة النظام',
      timestamp: 'أمس · 09:00 م',
    },
  ];

  const reports: ReportRecord[] = [
    {
      id: 'rep-1',
      reporterName: 'فهد الطرب',
      targetId: '882001',
      targetName: 'سلطان الخليج',
      reason: 'إزعاج في المايك أثناء جولة PK',
      roomTitle: 'تحدي الملوك PK — جولات المليار',
      status: 'pending',
      timestamp: 'منذ 14 دقيقة',
    },
    {
      id: 'rep-2',
      reporterName: 'الوكيل أحمد',
      targetId: '51115',
      targetName: 'وكالة نواف للشحن',
      reason: 'تحقق روتيني من توثيق رقم الوكالة',
      roomTitle: 'وكالة شحن محترم — مرحباً بالجميع',
      status: 'resolved',
      timestamp: 'منذ ساعتين',
    },
  ];

  const tasks: DailyTask[] = [
    {
      id: 'task-1',
      title: 'تسجيل الدخول اليومي الملكي',
      description: 'افتح تطبيق رياض شات واستلم مكافأة الحضور اليومي',
      rewardGold: 500_000,
      rewardDiamonds: 25,
      progress: 1,
      target: 1,
      claimed: false,
    },
    {
      id: 'task-2',
      title: 'المشاركة في غرف الصوت',
      description: 'أرسل رسالة أو اعتلِ المايك في أي غرفة صوتية',
      rewardGold: 1_500_000,
      rewardDiamonds: 50,
      progress: 1,
      target: 1,
      claimed: false,
    },
    {
      id: 'task-3',
      title: 'جولة في ألعاب الحظ',
      description: 'العب جولة واحدة في لعبة الفواكه أو الخضروات واللحوم',
      rewardGold: 3_000_000,
      rewardDiamonds: 100,
      progress: 0,
      target: 1,
      claimed: false,
    },
  ];

  const distributions: CommissionDistribution[] = [
    {
      id: 'dist-102',
      timestamp: 'اليوم · 03:30 م',
      totalPoolGold: 145_000_000,
      hostsCount: 5,
      agencyShareGold: 29_000_000,
      hostsShareGold: 116_000_000,
      mode: 'auto',
      note: 'تسوية آلية مجدولة — دورة العصر (نسبة الوكالة 20%)',
    },
    {
      id: 'dist-101',
      timestamp: 'أمس · 11:59 م',
      totalPoolGold: 210_000_000,
      hostsCount: 5,
      agencyShareGold: 42_000_000,
      hostsShareGold: 168_000_000,
      mode: 'auto',
      note: 'إغلاق الحصاد اليومي وتوزيع أرباح المضيفين',
    },
  ];

  return {
    currentUserId: '900',
    users,
    rooms,
    transfers,
    moderators: [],
    reports,
    tasks,
    globalAnnouncement:
      'مرحباً بكم في منصة رياض شات — شحن الوكالات متاح الآن ببونص +25% على جميع الباقات!',
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
    hosts,
    distributions,
    autoDistributeEnabled: true,
    agencyCommissionSplit: 20,
    hostBonusPoolGold: 0,
  };
}

let serverState: ServerAppState = createDefaultState();

// Idempotency cache preventing duplicate credit on retries/double-clicks
const idempotencyCache = new Map<
  string,
  { status: number; body: Record<string, unknown>; createdAt: number }
>();

function signToken(uid: string, role: UserRole): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      role,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { uid: string; role: UserRole; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid: string;
      role: UserRole;
      exp: number;
    };
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  authUser?: UserAccount;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing session token', code: 'AUTH_REQUIRED' });
    return;
  }
  const verified = verifyToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Unauthorized: invalid or expired session token', code: 'AUTH_INVALID' });
    return;
  }
  const user = serverState.users.find((u) => u.id === verified.uid);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: user not found', code: 'USER_NOT_FOUND' });
    return;
  }
  req.authUser = user;
  next();
}

function requireOwner(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = req.authUser;
  if (!user || user.role !== 'OWNER') {
    res.status(403).json({
      error: 'Forbidden: OWNER role required to access this administrative endpoint',
      code: 'RBAC_FORBIDDEN',
      role: user?.role || 'UNKNOWN',
    });
    return;
  }
  next();
}

function handleIdempotent(
  req: Request,
  res: Response,
  handler: () => { status: number; body: Record<string, unknown> }
) {
  const key = req.header('Idempotency-Key')?.trim();
  if (key && idempotencyCache.has(key)) {
    const cached = idempotencyCache.get(key)!;
    res.status(cached.status).json({ ...cached.body, idempotentReplay: true });
    return;
  }
  const result = handler();
  if (key && result.status < 400) {
    idempotencyCache.set(key, { ...result, createdAt: Date.now() });
    if (idempotencyCache.size > 500) {
      const oldestKey = idempotencyCache.keys().next().value;
      if (oldestKey) idempotencyCache.delete(oldestKey);
    }
  }
  res.status(result.status).json(result.body);
}

const GIFT_CATALOG: Record<string, { name: string; costGold: number; heatGain: number; icon: string }> = {
  'gift-star': { name: 'Star', costGold: 400, heatGain: 800, icon: '🌟' },
  'gift-perfume': { name: 'Perfume', costGold: 300, heatGain: 600, icon: '🏺' },
  'gift-dombra': { name: 'Dombra', costGold: 20_000, heatGain: 35_000, icon: '🪕' },
  'gift-ourlove': { name: 'Our Love', costGold: 499_999, heatGain: 850_000, icon: '💞' },
  'gift-rocket': { name: 'Palestine Rocket', costGold: 5_000, heatGain: 9_000, icon: '🚀' },
  'gift-bouquet': { name: 'Bouquet', costGold: 600, heatGain: 1_100, icon: '💐' },
  'gift-hi': { name: 'Hi', costGold: 300, heatGain: 500, icon: '💬' },
  'gift-dollar': { name: 'Dollar Rain', costGold: 9_999, heatGain: 18_000, icon: '🚁' },
  'gift-crown': { name: 'تاج الملوك', costGold: 250_000, heatGain: 350_000, icon: '👑' },
  'gift-diamond': { name: 'ماسة ملكية', costGold: 1_000_000, heatGain: 1_500_000, icon: '💎' },
  'gift-love-ring': { name: 'خاتم العشاق', costGold: 150_000, heatGain: 240_000, icon: '💍' },
  'gift-event-trophy': { name: 'كأس النشاط', costGold: 75_000, heatGain: 120_000, icon: '🏆' },
  'gift-car': { name: 'سيارة فيراري', costGold: 5_000_000, heatGain: 7_500_000, icon: '🏎️' },
  'gift-dragon': { name: 'التنين الملكي', costGold: 100_000_000, heatGain: 180_000_000, icon: '🐉' },
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const broadcastJson = (payload: Record<string, unknown>, exclude?: WebSocket) => {
    const serialized = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
  };

  const broadcastStateSync = () => {
    broadcastJson({ type: 'state:sync', state: serverState });
  };

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'state:sync', state: serverState }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          roomId?: string;
          seatNumber?: number;
          userId?: string;
          isSpeaking?: boolean;
        };

        if (msg.type === 'state:request') {
          ws.send(JSON.stringify({ type: 'state:sync', state: serverState }));
          return;
        }

        if (
          msg.type === 'room:speaking' &&
          msg.roomId &&
          typeof msg.seatNumber === 'number' &&
          msg.userId
        ) {
          const room = serverState.rooms.find((r) => r.id === msg.roomId);
          if (!room) return;
          const seat = room.seats.find((s) => s.seatNumber === msg.seatNumber);
          if (!seat || seat.userId !== msg.userId || seat.isMuted) return;
          seat.isSpeaking = Boolean(msg.isSpeaking);
          broadcastJson(
            {
              type: 'room:speaking',
              roomId: msg.roomId,
              seatNumber: msg.seatNumber,
              isSpeaking: seat.isSpeaking,
            },
            ws
          );
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });
  });

  // Health & Bootstrap
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, clients: wss.clients.size });
  });

  app.get('/api/state', (_req, res) => {
    res.json({ state: serverState });
  });

  app.post('/api/auth/session', (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    const user = serverState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const token = signToken(user.id, user.role);
    res.json({ token, user });
  });

  // ============================================================================
  // IDEMPOTENT ECONOMY & WALLET ROUTES (Authenticated User)
  // ============================================================================
  app.post('/api/wallet/recharge', requireAuth, (req: AuthedRequest, res) => {
    handleIdempotent(req, res, () => {
      const gold = Math.floor(Number(req.body?.gold) || 0);
      if (gold <= 0) return { status: 400, body: { error: 'Invalid gold amount' } };
      const me = req.authUser!;
      me.gold += gold;
      broadcastStateSync();
      return { status: 200, body: { ok: true, gold: me.gold, state: serverState } };
    });
  });

  app.post('/api/wallet/exchange', requireAuth, (req: AuthedRequest, res) => {
    const diamondAmount = Math.floor(Number(req.body?.diamondAmount) || 0);
    const me = req.authUser!;
    if (diamondAmount <= 0 || me.diamonds < diamondAmount) {
      res.status(400).json({ error: 'Invalid or insufficient diamonds' });
      return;
    }
    const gainedGold = diamondAmount * 15_000;
    me.diamonds = Number((me.diamonds - diamondAmount).toFixed(2));
    me.gold += gainedGold;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/agency/transfer', requireAuth, (req: AuthedRequest, res) => {
    handleIdempotent(req, res, () => {
      const recipientId = String(req.body?.recipientId || '').trim();
      const baseGold = Math.floor(Number(req.body?.baseGold) || 0);
      const agent = req.authUser!;
      const target = serverState.users.find((u) => u.id === recipientId);

      if (!target) return { status: 404, body: { error: 'Recipient not found' } };
      if (baseGold <= 0) return { status: 400, body: { error: 'Invalid transfer amount' } };

      const isSelf = target.id === agent.id;
      if (!isSelf && agent.gold < baseGold) {
        return { status: 400, body: { error: 'Insufficient balance' } };
      }

      const bonusGold = Math.floor(baseGold * 0.25);
      const totalGold = baseGold + bonusGold;

      if (isSelf) {
        agent.gold += bonusGold;
      } else {
        agent.gold = Math.max(0, agent.gold - baseGold);
        target.gold += totalGold;
      }

      const newRecord: AgencyTransfer = {
        id: `tr-${Date.now().toString().slice(-5)}`,
        recipientId: target.id,
        recipientName: target.name,
        baseGold,
        bonusGold,
        totalGold,
        agentName: agent.name,
        timestamp: 'الآن',
      };

      serverState.transfers = [newRecord, ...serverState.transfers];
      serverState.hostBonusPoolGold += Math.floor(baseGold * 0.05);
      broadcastStateSync();

      return { status: 200, body: { ok: true, transfer: newRecord, state: serverState } };
    });
  });

  app.post('/api/agency/wholesale', requireAuth, (req: AuthedRequest, res) => {
    handleIdempotent(req, res, () => {
      const gold = Math.floor(Number(req.body?.gold) || 0);
      if (gold <= 0) return { status: 400, body: { error: 'Invalid amount' } };
      req.authUser!.gold += gold;
      broadcastStateSync();
      return { status: 200, body: { ok: true, state: serverState } };
    });
  });

  app.post('/api/agency/invite', requireAuth, (req: AuthedRequest, res) => {
    serverState.agentInviteCount += 1;
    req.authUser!.gold += 1_000_000;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/agency/register', requireAuth, (req: AuthedRequest, res) => {
    const title = String(req.body?.agencyTitle || '').trim() || `وكالة ${req.authUser!.name}`;
    req.authUser!.isVerifiedAgent = true;
    req.authUser!.title = title;
    req.authUser!.gold += 5_000_000;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  // ============================================================================
  // LIVE ROOMS REAL-TIME SYNC ROUTES (Authenticated User + WS Broadcast)
  // ============================================================================
  app.post('/api/rooms/:id/seat', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    const seatNumber = Number(req.body?.seatNumber);
    const me = req.authUser!;

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if ((me.isBanned || room.bannedUserIds?.includes(me.id)) && me.role !== 'OWNER') {
      res.status(403).json({ error: 'Account restricted from taking mic' });
      return;
    }

    const clickedSeat = room.seats.find((s) => s.seatNumber === seatNumber);
    if (!clickedSeat || clickedSeat.isLocked) {
      res.status(400).json({ error: 'Seat unavailable' });
      return;
    }

    const isSteppingDown = clickedSeat.userId === me.id;
    if (
      !isSteppingDown &&
      room.allowVisitorsOnMic === false &&
      me.role === 'USER' &&
      room.ownerId !== me.id
    ) {
      res.status(403).json({ error: 'Room restricts visitor mics' });
      return;
    }
    if (clickedSeat.userId && !isSteppingDown) {
      res.status(409).json({ error: 'Seat occupied' });
      return;
    }

    if (isSteppingDown) {
      clickedSeat.userId = null;
      clickedSeat.userName = null;
      clickedSeat.avatar = null;
      clickedSeat.isMuted = false;
      clickedSeat.isSpeaking = false;
    } else {
      room.seats.forEach((s) => {
        if (s.userId === me.id) {
          s.userId = null;
          s.userName = null;
          s.avatar = null;
          s.isSpeaking = false;
        }
      });
      clickedSeat.userId = me.id;
      clickedSeat.userName = me.name;
      clickedSeat.avatar = me.avatar;
      clickedSeat.isMuted = false;
      clickedSeat.isSpeaking = true;
    }

    broadcastStateSync();
    res.json({ ok: true, room, state: serverState });
  });

  app.post('/api/rooms/:id/mute', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    const seatNumber = Number(req.body?.seatNumber);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const seat = room.seats.find((s) => s.seatNumber === seatNumber);
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' });
      return;
    }
    seat.isMuted = !seat.isMuted;
    seat.isSpeaking = !seat.isMuted;
    broadcastStateSync();
    res.json({ ok: true, room, state: serverState });
  });

  app.post('/api/rooms/:id/message', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    const text = String(req.body?.text || '').trim();
    const rawType = String(req.body?.type || 'chat');
    const msgType = rawType === 'achievement' ? 'achievement' : 'chat';
    const me = req.authUser!;
    if (!room || !text) {
      res.status(400).json({ error: 'Invalid room or message' });
      return;
    }
    if ((me.isBanned || room.bannedUserIds?.includes(me.id)) && me.role !== 'OWNER') {
      res.status(403).json({ error: 'Banned from chatting' });
      return;
    }
    const reqLevel = room.visitorChatRequirement || 'all';
    const isStaff = me.role === 'OWNER' || me.role === 'SUPERVISOR' || room.ownerId === me.id;
    if (!isStaff && msgType !== 'achievement') {
      if (reqLevel === 'disallowed') {
        res.status(403).json({ error: 'Visitor chat is disabled in this room' });
        return;
      }
      if (reqLevel === 'lv5' && me.level < 5) {
        res.status(403).json({ error: 'Minimum Lv.5 required to chat' });
        return;
      }
      if (reqLevel === 'lv10' && me.level < 10) {
        res.status(403).json({ error: 'Minimum Lv.10 required to chat' });
        return;
      }
    }
    room.messages = [
      ...room.messages.slice(-30),
      {
        id: `m-${Date.now()}`,
        senderId: me.id,
        senderName: me.name,
        senderLevel: me.level,
        text,
        type: msgType,
        timestamp: 'الآن',
      },
    ];
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/rooms/:id/gift', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    const giftId = String(req.body?.giftId || '');
    const recipientId = String(req.body?.recipientId || room?.ownerId || '');
    const quantity = Math.max(1, Math.floor(Number(req.body?.quantity) || 1));
    const gift = GIFT_CATALOG[giftId];
    const me = req.authUser!;

    if (!room || !gift) {
      res.status(400).json({ error: 'Invalid room or gift' });
      return;
    }

    const totalCost = gift.costGold * quantity;
    const totalHeat = gift.heatGain * quantity;
    if (me.gold < totalCost) {
      res.status(400).json({ error: 'Insufficient gold' });
      return;
    }

    const target =
      serverState.users.find((u) => u.id === recipientId) ||
      serverState.users.find((u) => u.id === room.ownerId) ||
      me;
    const diamondBonus = Math.max(1, Math.round(totalCost / 20_000));
    const charismaGain = Math.max(1, Math.round(totalCost / 10_000));

    me.gold -= totalCost;
    me.giftedGold = (me.giftedGold || 0) + totalCost;
    target.diamonds = Number((target.diamonds + diamondBonus).toFixed(2));
    target.charisma = (target.charisma || 0) + charismaGain;
    room.heat += totalHeat;
    room.wealthBadge = computeWealthBadge(room.heat) || room.wealthBadge;
    room.messages = [
      ...room.messages.slice(-30),
      {
        id: `g-${Date.now()}`,
        senderId: me.id,
        senderName: me.name,
        senderLevel: me.level,
        text: `أرسل ${quantity > 1 ? `${quantity}× ` : ''}${gift.icon} ${gift.name} إلى ${target.name} (+${totalHeat.toLocaleString('en-US')} حرارة)`,
        type: 'gift',
        timestamp: 'الآن',
      },
    ];

    serverState.hostBonusPoolGold += Math.floor(totalCost * 0.12);
    serverState.hosts.forEach((h) => {
      if (h.userId === target.id || h.roomId === room.id) {
        h.giftsReceivedGold += totalCost;
        h.diamondsEarned += diamondBonus;
        h.pendingCommissionGold += Math.floor((totalCost * h.commissionRate) / 100);
      }
    });

    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  // ============================================================================
  // STRICT OWNER-ONLY ADMINISTRATIVE & AGENCY ENDPOINTS (403 FORBIDDEN FOR NON-OWNER)
  // ============================================================================
  app.post('/api/agency/distribute', requireAuth, requireOwner, (req: AuthedRequest, res) => {
    const mode: 'auto' | 'manual' = req.body?.mode === 'manual' ? 'manual' : 'auto';
    const pendingTotal = serverState.hosts.reduce((s, h) => s + h.pendingCommissionGold, 0);
    const bonusPool = serverState.hostBonusPoolGold;
    const totalDistributable = pendingTotal + bonusPool;

    if (totalDistributable <= 0) {
      res.status(400).json({ error: 'No pending commission or bonus pool to distribute' });
      return;
    }

    const agencyShare = Math.floor((bonusPool * serverState.agencyCommissionSplit) / 100);
    const hostsPoolShare = Math.max(0, bonusPool - agencyShare);
    const totalWeight = serverState.hosts.reduce(
      (sum, h) => sum + Math.max(1, h.giftsReceivedGold),
      0
    );

    const payoutsByUserId = new Map<string, number>();
    let hostsDistributedTotal = 0;

    serverState.hosts.forEach((h) => {
      const shareFromPool =
        totalWeight > 0
          ? Math.floor((hostsPoolShare * Math.max(1, h.giftsReceivedGold)) / totalWeight)
          : 0;
      const hostTotal = h.pendingCommissionGold + shareFromPool;
      hostsDistributedTotal += hostTotal;
      payoutsByUserId.set(h.userId, (payoutsByUserId.get(h.userId) || 0) + hostTotal);
      h.pendingCommissionGold = 0;
    });

    serverState.hostBonusPoolGold = 0;
    serverState.users.forEach((u) => {
      const hostGain = payoutsByUserId.get(u.id) || 0;
      const agencyGain = u.id === req.authUser!.id ? agencyShare : 0;
      u.gold += hostGain + agencyGain;
    });

    const nowTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const entry: CommissionDistribution = {
      id: `dist-${Date.now().toString().slice(-5)}`,
      timestamp: `الآن · ${nowTime}`,
      totalPoolGold: totalDistributable,
      hostsCount: serverState.hosts.length,
      agencyShareGold: agencyShare,
      hostsShareGold: hostsDistributedTotal,
      mode,
      note:
        mode === 'auto'
          ? `توزيع آلي لـ ${serverState.hosts.length} مضيفين (حصة الوكالة ${serverState.agencyCommissionSplit}%)`
          : `تسوية يدوية فورية لـ ${serverState.hosts.length} مضيفين`,
    };
    serverState.distributions = [entry, ...serverState.distributions];
    broadcastStateSync();
    res.json({ ok: true, entry, state: serverState });
  });

  app.post('/api/agency/payout', requireAuth, requireOwner, (req, res) => {
    const hostId = String(req.body?.hostId || '');
    const host = serverState.hosts.find((h) => h.id === hostId);
    if (!host || host.pendingCommissionGold <= 0) {
      res.status(400).json({ error: 'Host not found or no pending commission' });
      return;
    }
    const payout = host.pendingCommissionGold;
    host.pendingCommissionGold = 0;
    const user = serverState.users.find((u) => u.id === host.userId);
    if (user) user.gold += payout;

    const nowTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
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
    serverState.distributions = [entry, ...serverState.distributions];
    broadcastStateSync();
    res.json({ ok: true, entry, state: serverState });
  });

  app.post('/api/agency/commission', requireAuth, requireOwner, (req, res) => {
    const hostId = String(req.body?.hostId || '');
    const rate = Math.min(30, Math.max(5, Math.round(Number(req.body?.rate) || 15)));
    const host = serverState.hosts.find((h) => h.id === hostId);
    if (!host) {
      res.status(404).json({ error: 'Host not found' });
      return;
    }
    const prevRate = Math.max(1, host.commissionRate);
    host.commissionRate = rate;
    host.pendingCommissionGold =
      host.pendingCommissionGold > 0
        ? Math.round((host.pendingCommissionGold * rate) / prevRate)
        : 0;
    broadcastStateSync();
    res.json({ ok: true, host, state: serverState });
  });

  app.post('/api/agency/split', requireAuth, requireOwner, (req, res) => {
    const pct = Math.min(40, Math.max(5, Math.round(Number(req.body?.pct) || 20)));
    serverState.agencyCommissionSplit = pct;
    broadcastStateSync();
    res.json({ ok: true, agencyCommissionSplit: pct, state: serverState });
  });

  app.post('/api/agency/toggle-auto', requireAuth, requireOwner, (_req, res) => {
    serverState.autoDistributeEnabled = !serverState.autoDistributeEnabled;
    broadcastStateSync();
    res.json({ ok: true, autoDistributeEnabled: serverState.autoDistributeEnabled, state: serverState });
  });

  app.post('/api/agency/host/add', requireAuth, requireOwner, (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    const roomId = String(req.body?.roomId || '');
    const targetGold = Math.max(10_000_000, Number(req.body?.targetGold) || 100_000_000);
    const commissionRate = Math.min(30, Math.max(5, Number(req.body?.commissionRate) || 15));

    const user = serverState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (serverState.hosts.some((h) => h.userId === user.id)) {
      res.status(409).json({ error: 'Host already registered' });
      return;
    }
    const room = serverState.rooms.find((r) => r.id === roomId) || serverState.rooms[0];
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
      targetGold,
      commissionRate,
      pendingCommissionGold: Math.floor((12_000_000 * commissionRate) / 100),
      status: 'online',
    };
    serverState.hosts = [newHost, ...serverState.hosts];
    broadcastStateSync();
    res.json({ ok: true, host: newHost, state: serverState });
  });

  app.post('/api/agency/host/boost', requireAuth, requireOwner, (req, res) => {
    const hostId = String(req.body?.hostId || '');
    const amountGold = Math.max(500_000, Number(req.body?.amountGold) || 5_000_000);
    const host = serverState.hosts.find((h) => h.id === hostId);
    if (!host) {
      res.status(404).json({ error: 'Host not found' });
      return;
    }
    const wasBelow = host.giftsReceivedGold < host.targetGold;
    host.giftsReceivedGold += amountGold;
    host.diamondsEarned += Math.round(amountGold / 20_000);
    const reachedTarget = wasBelow && host.giftsReceivedGold >= host.targetGold;
    const commissionGain = Math.floor((amountGold * host.commissionRate) / 100);
    host.pendingCommissionGold += commissionGain + (reachedTarget ? 1_000_000 : 0);
    serverState.hostBonusPoolGold += Math.floor(amountGold * 0.1);
    broadcastStateSync();
    res.json({ ok: true, reachedTarget, host, state: serverState });
  });

  app.post('/api/rooms/create', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    if (me.isBanned && me.role !== 'OWNER') {
      res.status(403).json({ error: 'Account restricted from creating rooms' });
      return;
    }
    const title = String(req.body?.title || '').trim() || `غرفة ${me.name}`;
    const country = String(req.body?.country || 'اليمن').trim();
    const flag = String(req.body?.flag || '🇾🇪').trim();
    const category = (req.body?.category || 'وكالات') as VoiceRoom['category'];
    const description =
      String(req.body?.description || '').trim() || 'مرحباً بالجميع في غرفتنا الصوتية المباشرة!';
    const totalMics = 20;
    const newRoom: VoiceRoom = {
      id: `room-${Date.now().toString().slice(-5)}`,
      title,
      ownerId: me.id,
      ownerName: me.name,
      ownerAvatar: me.avatar,
      coverImage: me.avatar,
      country,
      flag,
      category,
      description,
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
      seats: createSeats(totalMics, [{ seat: 1, user: me, speaking: true }]),
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderId: me.id,
          senderName: me.name,
          senderLevel: me.level,
          text: 'تم افتتاح الغرفة الصوتية الآن — تفضلوا بالصعود على المايك!',
          type: 'system',
          timestamp: 'الآن',
        },
      ],
    };
    serverState.rooms = [newRoom, ...serverState.rooms];
    broadcastStateSync();
    res.json({ ok: true, room: newRoom, state: serverState });
  });

  app.patch('/api/rooms/:id/settings', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const me = req.authUser!;
    const canManage = me.role === 'OWNER' || me.role === 'SUPERVISOR' || room.ownerId === me.id;
    if (!canManage) {
      res.status(403).json({ error: 'RBAC_FORBIDDEN: Room settings reserved for owner/supervisor' });
      return;
    }

    const body = req.body || {};
    if (typeof body.title === 'string' && body.title.trim()) {
      room.title = body.title.trim().slice(0, 60);
    }
    if (typeof body.description === 'string') {
      room.description = body.description.trim().slice(0, 140);
    }
    if (typeof body.coverImage === 'string' && body.coverImage.trim()) {
      room.coverImage = body.coverImage.trim();
      room.ownerAvatar = body.coverImage.trim();
    }
    if (typeof body.welcomeMessage === 'string') {
      room.welcomeMessage = body.welcomeMessage.trim().slice(0, 80);
    }
    if (
      typeof body.themeId === 'string' &&
      ['ocean-stars', 'cosmic-purple', 'ramadan-green', 'royal-gold'].includes(body.themeId)
    ) {
      room.themeId = body.themeId as RoomThemeId;
    }
    if (typeof body.useThemeFilter === 'boolean') {
      room.useThemeFilter = body.useThemeFilter;
    }
    if (typeof body.password === 'string') {
      const cleanPass = body.password.trim();
      room.password = cleanPass;
      room.isLocked = Boolean(cleanPass);
    }
    if (typeof body.diceCount === 'number' && Number.isFinite(body.diceCount)) {
      room.diceCount = Math.min(3, Math.max(1, Math.round(body.diceCount)));
    }
    if (typeof body.membershipCount === 'number' && Number.isFinite(body.membershipCount)) {
      room.membershipCount = Math.max(0, Math.round(body.membershipCount));
    }
    if (typeof body.membersOnlyEntry === 'boolean') {
      room.membersOnlyEntry = body.membersOnlyEntry;
    }
    if (typeof body.allowVisitorsOnMic === 'boolean') {
      room.allowVisitorsOnMic = body.allowVisitorsOnMic;
    }
    if (typeof body.sendEmojiToChat === 'boolean') {
      room.sendEmojiToChat = body.sendEmojiToChat;
    }
    if (typeof body.autoSleepEnabled === 'boolean') {
      room.autoSleepEnabled = body.autoSleepEnabled;
    }
    if (
      typeof body.visitorChatRequirement === 'string' &&
      ['all', 'disallowed', 'lv5', 'lv10'].includes(body.visitorChatRequirement)
    ) {
      room.visitorChatRequirement = body.visitorChatRequirement as VisitorChatRequirement;
    }
    if (typeof body.totalMics === 'number' && Number.isFinite(body.totalMics)) {
      const nextCount = Math.min(20, Math.max(1, Math.round(body.totalMics)));
      room.totalMics = nextCount;
      const existingBySeat = new Map(room.seats.map((s) => [s.seatNumber, s]));
      const nextSeats: VoiceRoom['seats'] = [];
      for (let i = 1; i <= nextCount; i++) {
        const prevSeat = existingBySeat.get(i);
        nextSeats.push(
          prevSeat
            ? { ...prevSeat, seatNumber: i }
            : {
                seatNumber: i,
                userId: null,
                userName: null,
                avatar: null,
                isMuted: false,
                isSpeaking: false,
                isLocked: false,
              }
        );
      }
      room.seats = nextSeats;
    }

    broadcastStateSync();
    res.json({ ok: true, room, state: serverState });
  });

  app.post('/api/rooms/:id/ban', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const me = req.authUser!;
    const canManage = me.role === 'OWNER' || me.role === 'SUPERVISOR' || room.ownerId === me.id;
    if (!canManage) {
      res.status(403).json({ error: 'RBAC_FORBIDDEN' });
      return;
    }
    const targetId = String(req.body?.userId || '').trim();
    const targetUser = serverState.users.find((u) => u.id === targetId);
    if (!targetUser || targetUser.role === 'OWNER' || targetId === room.ownerId) {
      res.status(400).json({ error: 'Cannot ban room owner or platform owner' });
      return;
    }
    const current = room.bannedUserIds || [];
    const exists = current.includes(targetId);
    room.bannedUserIds = exists ? current.filter((id) => id !== targetId) : [...current, targetId];
    if (!exists) {
      room.seats.forEach((s) => {
        if (s.userId === targetId) {
          s.userId = null;
          s.userName = null;
          s.avatar = null;
          s.isSpeaking = false;
          s.isMuted = false;
        }
      });
    }
    broadcastStateSync();
    res.json({ ok: true, room, state: serverState });
  });

  app.delete('/api/rooms/:id', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const me = req.authUser!;
    const canManage = me.role === 'OWNER' || me.role === 'SUPERVISOR' || room.ownerId === me.id;
    if (!canManage) {
      res.status(403).json({ error: 'RBAC_FORBIDDEN' });
      return;
    }
    if (serverState.rooms.length <= 1) {
      res.status(400).json({ error: 'Cannot delete the last remaining room' });
      return;
    }
    serverState.rooms = serverState.rooms.filter((r) => r.id !== room.id);
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/rooms/:id/clear', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const me = req.authUser!;
    room.messages = [
      {
        id: `clr-${Date.now()}`,
        senderId: me.id,
        senderName: me.name,
        senderLevel: me.level,
        text: 'قام مالك الغرفة بمسح رسالة دردشة الغرفة',
        type: 'system',
        timestamp: 'الآن',
      },
    ];
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/store/purchase', requireAuth, (req: AuthedRequest, res) => {
    handleIdempotent(req, res, () => {
      const gold = Math.max(0, Math.floor(Number(req.body?.gold) || 0));
      const bonusGold = Math.max(0, Math.floor(Number(req.body?.bonusGold) || 0));
      const diamonds = Math.max(0, Math.floor(Number(req.body?.diamonds) || 0));
      const entryItem = req.body?.entryItem ? String(req.body.entryItem) : undefined;
      const titleGrant = req.body?.titleGrant ? String(req.body.titleGrant) : undefined;

      const me = req.authUser!;
      me.gold += gold + bonusGold;
      me.diamonds += diamonds;
      if (entryItem && !me.ownedEntries.includes(entryItem)) {
        me.ownedEntries.push(entryItem);
      }
      if (entryItem) me.activeEntry = entryItem;
      if (titleGrant) me.title = titleGrant;

      broadcastStateSync();
      return { status: 200, body: { ok: true, state: serverState } };
    });
  });

  app.post('/api/tasks/:id/claim', requireAuth, (req: AuthedRequest, res) => {
    const task = serverState.tasks.find((t) => t.id === req.params.id);
    if (!task || task.claimed || task.progress < task.target) {
      res.status(400).json({ error: 'Task not ready or already claimed' });
      return;
    }
    task.claimed = true;
    const me = req.authUser!;
    me.gold += task.rewardGold;
    me.diamonds += task.rewardDiamonds;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/streak/claim', requireAuth, (req: AuthedRequest, res) => {
    const today = new Date().toISOString().slice(0, 10);
    if (serverState.lastCheckInDate === today) {
      res.status(400).json({ error: 'Already claimed today' });
      return;
    }
    const nextDay = serverState.streakDay >= 7 ? 1 : serverState.streakDay + 1;
    const goldRewards = [500_000, 1_000_000, 2_000_000, 4_000_000, 7_500_000, 12_000_000, 25_000_000];
    const diamondRewards = [15, 25, 40, 65, 100, 150, 300];
    serverState.streakDay = nextDay;
    serverState.lastCheckInDate = today;
    req.authUser!.gold += goldRewards[nextDay - 1] || 500_000;
    req.authUser!.diamonds += diamondRewards[nextDay - 1] || 15;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/jackpot/claim', requireAuth, (req: AuthedRequest, res) => {
    if (serverState.jackpotProgress < JACKPOT_TARGET) {
      res.status(400).json({ error: 'Jackpot not full yet' });
      return;
    }
    serverState.jackpotProgress = 0;
    req.authUser!.gold += 50_000_000;
    req.authUser!.diamonds += 250;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/cashback/claim', requireAuth, (req: AuthedRequest, res) => {
    const eligible = Math.max(0, serverState.dailyStakedGold - serverState.cashbackClaimedBase);
    const refund = Math.floor(eligible * 0.08);
    if (refund <= 0) {
      res.status(400).json({ error: 'No pending cashback' });
      return;
    }
    serverState.cashbackClaimedBase = serverState.dailyStakedGold;
    req.authUser!.gold += refund;
    broadcastStateSync();
    res.json({ ok: true, refund, state: serverState });
  });

  app.post('/api/system/announcement', requireAuth, requireOwner, (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'Announcement text required' });
      return;
    }
    serverState.globalAnnouncement = text;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/luck', requireAuth, requireOwner, (req, res) => {
    const mode = req.body?.mode as GameLuckMode;
    if (!['generous', 'balanced', 'strict'].includes(mode)) {
      res.status(400).json({ error: 'Invalid luck mode' });
      return;
    }
    serverState.gameLuckMode = mode;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/multiplier', requireAuth, requireOwner, (req, res) => {
    const mult = Number(req.body?.mult) as DiceMultiplier;
    if (![1, 1.25, 1.5].includes(mult)) {
      res.status(400).json({ error: 'Invalid multiplier' });
      return;
    }
    serverState.diceMultiplier = mult;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/maintenance', requireAuth, requireOwner, (_req, res) => {
    serverState.maintenanceMode = !serverState.maintenanceMode;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/ultra-night', requireAuth, requireOwner, (_req, res) => {
    serverState.ultraNightMode = !serverState.ultraNightMode;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/grant-all', requireAuth, requireOwner, (_req, res) => {
    serverState.users.forEach((u) => {
      u.gold += 1_000_000;
    });
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/treasury', requireAuth, requireOwner, (req: AuthedRequest, res) => {
    req.authUser!.gold += 50_000_000;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/boost-rooms', requireAuth, requireOwner, (_req, res) => {
    serverState.rooms.forEach((r) => {
      r.heat += 10_000_000;
    });
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/rooms/:id/boost', requireAuth, requireOwner, (req, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const amount = Math.max(100_000, Number(req.body?.amount) || 1_000_000);
    room.heat += amount;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/moderators', requireAuth, requireOwner, (req, res) => {
    const record: ModeratorRecord = {
      id: `mod-${Date.now().toString().slice(-5)}`,
      name: String(req.body?.name || '').trim(),
      specialId: String(req.body?.specialId || '').trim(),
      role: String(req.body?.role || 'مشرف غرف صوتية'),
      whatsapp: String(req.body?.whatsapp || ''),
      custodyGold: Math.max(0, Number(req.body?.custodyGold) || 0),
      status: 'active',
      createdAt: 'اليوم',
    };
    serverState.moderators = [record, ...serverState.moderators];
    broadcastStateSync();
    res.json({ ok: true, record, state: serverState });
  });

  app.post('/api/system/moderators/:id/toggle', requireAuth, requireOwner, (req, res) => {
    const mod = serverState.moderators.find((m) => m.id === req.params.id);
    if (!mod) {
      res.status(404).json({ error: 'Moderator not found' });
      return;
    }
    mod.status = mod.status === 'active' ? 'suspended' : 'active';
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.delete('/api/system/moderators/:id', requireAuth, requireOwner, (req, res) => {
    serverState.moderators = serverState.moderators.filter((m) => m.id !== req.params.id);
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/reports/:id', requireAuth, requireOwner, (req, res) => {
    const report = serverState.reports.find((r) => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    report.status = req.body?.status === 'dismissed' ? 'dismissed' : 'resolved';
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/user/ban', requireAuth, requireOwner, (req, res) => {
    const userId = String(req.body?.userId || '');
    const target = serverState.users.find((u) => u.id === userId);
    if (!target || target.role === 'OWNER') {
      res.status(400).json({ error: 'Cannot ban OWNER or unknown user' });
      return;
    }
    target.isBanned = !target.isBanned;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/user/verify-agent', requireAuth, requireOwner, (req, res) => {
    const userId = String(req.body?.userId || '');
    const target = serverState.users.find((u) => u.id === userId);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    target.isVerifiedAgent = !target.isVerifiedAgent;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/user/adjust-gold', requireAuth, requireOwner, (req, res) => {
    const userId = String(req.body?.userId || '');
    const deltaGold = Number(req.body?.deltaGold) || 0;
    const deltaDiamonds = Number(req.body?.deltaDiamonds) || 0;
    const target = serverState.users.find((u) => u.id === userId);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    target.gold = Math.max(0, target.gold + deltaGold);
    target.diamonds = Math.max(0, target.diamonds + deltaDiamonds);
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/system/reset', requireAuth, requireOwner, (_req, res) => {
    serverState = createDefaultState();
    idempotencyCache.clear();
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  // Catch-all for unknown /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Vite dev middleware or static dist serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
          if (filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Riyadh Chat server running on http://0.0.0.0:${PORT} (JACKPOT_TARGET=${JACKPOT_TARGET})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Riyadh Chat server:', err);
  process.exit(1);
});
