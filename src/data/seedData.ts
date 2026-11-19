import {
  AgencyHostRecord,
  AgencyTransfer,
  CommissionDistribution,
  DailyTask,
  GiftItem,
  ModeratorRecord,
  ReportRecord,
  RoomThemeId,
  StorePackage,
  UserAccount,
  VoiceRoom,
} from '../types';

import appIconImg from '../assets/images/riad_app_icon_1794519701539.jpg';
import avatarRiadImg from '../assets/images/avatar_riad_1794519702310.jpg';
import avatarAhmedImg from '../assets/images/avatar_agent_ahmed_1794519702042.jpg';
import avatarNawafImg from '../assets/images/avatar_host_nawaf_1794519702919.jpg';
import royalDragonImg from '../assets/images/royal_dragon_gift_1794519702649.jpg';
import agencyTreasureBannerImg from '../assets/images/agency_treasure_banner_1794963320575.jpg';
import roomCoverSuvImg from '../assets/images/room_cover_desert_suv_1794963320069.jpg';
import roomCoverOceanImg from '../assets/images/room_cover_night_ocean_1794963320976.jpg';
import roomCoverGentlemanImg from '../assets/images/room_cover_gentleman_bw_1794963320157.jpg';
import gameFruitSlotImg from '../assets/images/game_fruit_modern_1795018052661.jpg';
import gameFoodieWheelImg from '../assets/images/game_veggie_modern_1795018054357.jpg';

export const APP_ICON_PATH = appIconImg;
export const AVATAR_RIAD_PATH = avatarRiadImg;
export const AVATAR_AHMED_PATH = avatarAhmedImg;
export const AVATAR_NAWAF_PATH = avatarNawafImg;
export const ROYAL_DRAGON_PATH = royalDragonImg;
export const AGENCY_BANNER_PATH = agencyTreasureBannerImg;
export const COVER_SUV_PATH = roomCoverSuvImg;
export const COVER_OCEAN_PATH = roomCoverOceanImg;
export const COVER_GENTLEMAN_PATH = roomCoverGentlemanImg;
export const GAME_FRUIT_ICON_PATH = gameFruitSlotImg;
export const GAME_FOODIE_ICON_PATH = gameFoodieWheelImg;

export function normalizeAssetPath(path: string | null | undefined, fallback: string = AVATAR_RIAD_PATH): string {
  if (!path) return fallback;
  if (path.includes('riad_app_icon')) return APP_ICON_PATH;
  if (path.includes('avatar_riad')) return AVATAR_RIAD_PATH;
  if (path.includes('avatar_agent_ahmed')) return AVATAR_AHMED_PATH;
  if (path.includes('avatar_host_nawaf')) return AVATAR_NAWAF_PATH;
  if (path.includes('royal_dragon_gift')) return ROYAL_DRAGON_PATH;
  if (path.includes('agency_treasure_banner')) return AGENCY_BANNER_PATH;
  if (path.includes('room_cover_desert_suv')) return COVER_SUV_PATH;
  if (path.includes('room_cover_night_ocean')) return COVER_OCEAN_PATH;
  if (path.includes('room_cover_gentleman_bw')) return COVER_GENTLEMAN_PATH;
  if (path.includes('game_fruit_slot_3d')) return GAME_FRUIT_ICON_PATH;
  if (path.includes('game_foodie_wheel_3d')) return GAME_FOODIE_ICON_PATH;
  return path;
}

export const ROOM_THEMES: Array<{
  id: RoomThemeId;
  name: string;
  subtitle: string;
  previewBg: string;
  badgeColor: string;
}> = [
  {
    id: 'ocean-stars',
    name: 'موجة البحر النجمية',
    subtitle: 'خلفية المحيط الأزرق والنجوم الساطعة',
    previewBg: 'from-[#021B79] via-[#0575E6] to-[#00C6FF]',
    badgeColor: 'text-sky-300',
  },
  {
    id: 'cosmic-purple',
    name: 'الكون البنفسجي الملكي',
    subtitle: 'هالة بنفسجية متوهجة مع إضاءة سهرة',
    previewBg: 'from-[#1E0845] via-[#6D28D9] to-[#2563EB]',
    badgeColor: 'text-violet-300',
  },
  {
    id: 'ramadan-green',
    name: 'ليالي الزخرفة الخضراء',
    subtitle: 'زخارف وهلال رمضاني بإضاءة زمردية',
    previewBg: 'from-[#052E16] via-[#15803D] to-[#16A34A]',
    badgeColor: 'text-emerald-300',
  },
  {
    id: 'royal-gold',
    name: 'القصر الذهبي الفاخر',
    subtitle: 'تدرج عنابي وذهبي للمجالس الملكية',
    previewBg: 'from-[#2A0610] via-[#7F1D1D] to-[#B45309]',
    badgeColor: 'text-amber-300',
  },
];

export const INITIAL_USERS: UserAccount[] = [
  {
    id: '900',
    name: 'رياض | Riad',
    avatar: AVATAR_RIAD_PATH,
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
    avatar: AVATAR_RIAD_PATH,
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
    avatar: AVATAR_AHMED_PATH,
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
    avatar: AVATAR_NAWAF_PATH,
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
    avatar: AVATAR_NAWAF_PATH,
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
    avatar: AVATAR_AHMED_PATH,
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
    avatar: AVATAR_NAWAF_PATH,
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

function createSeats(total: number, occupied: Array<{ seat: number; user: UserAccount; speaking?: boolean }>): VoiceRoom['seats'] {
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

export const INITIAL_ROOMS: VoiceRoom[] = [
  {
    id: 'room-900',
    title: 'وكاله ريــــ1ــــاض',
    ownerId: '900',
    ownerName: 'رياض | Riad',
    ownerAvatar: AVATAR_RIAD_PATH,
    coverImage: AVATAR_RIAD_PATH,
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
    ownerAvatar: COVER_SUV_PATH,
    country: 'السعودية',
    flag: '🇸🇦',
    category: 'دردشة',
    description: 'لا يوجد فتح العاااااب — جلسة خاصة للأصدقاء',
    heat: 0,
    listeners: 3206,
    totalMics: 9,
    isLocked: true,
    jetCount: 0,
    seats: createSeats(9, [{ seat: 1, user: INITIAL_USERS[1], speaking: true }]),
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
    ownerAvatar: COVER_OCEAN_PATH,
    country: 'اليمن',
    flag: '🇾🇪',
    category: 'وكالات',
    description: 'وكالة نواف للشحن للتواصل واتس ... 77 — شحن آمن وفوري للجميع',
    heat: 0,
    listeners: 4242,
    totalMics: 10,
    jetCount: 0,
    seats: createSeats(10, [
      { seat: 1, user: INITIAL_USERS[3], speaking: true },
      { seat: 2, user: INITIAL_USERS[4], speaking: false },
      { seat: 3, user: INITIAL_USERS[5], speaking: true },
      { seat: 4, user: INITIAL_USERS[2], speaking: false },
      { seat: 5, user: INITIAL_USERS[0], speaking: false },
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
    ownerAvatar: COVER_GENTLEMAN_PATH,
    country: 'اليمن',
    flag: '🇾🇪',
    category: 'طرب',
    description: 'مرحبًا ألف منورين 🤍🕺 — سهرة طرب وتحديات',
    heat: 0,
    listeners: 11,
    totalMics: 9,
    isLocked: true,
    jetCount: 0,
    seats: createSeats(9, [{ seat: 1, user: INITIAL_USERS[5], speaking: true }]),
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
    ownerAvatar: AVATAR_NAWAF_PATH,
    country: 'قطر',
    flag: '🇶🇦',
    category: 'مسابقات',
    description: '✦✦ من لا يعرف قدر نفسه، لن يعرف ا...',
    heat: 0,
    listeners: 2074,
    totalMics: 10,
    jetCount: 0,
    seats: createSeats(10, [
      { seat: 1, user: INITIAL_USERS[4], speaking: true },
      { seat: 2, user: INITIAL_USERS[0], speaking: false },
      { seat: 3, user: INITIAL_USERS[2], speaking: false },
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

export const INITIAL_TRANSFERS: AgencyTransfer[] = [
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
  {
    id: 'tr-101',
    recipientId: '882001',
    recipientName: 'سلطان الخليج',
    baseGold: 20_000_000,
    bonusGold: 5_000_000,
    totalGold: 25_000_000,
    agentName: 'وكالة رياض',
    timestamp: 'أمس · 05:15 م',
  },
];

export const STORE_PACKAGES: StorePackage[] = [
  {
    id: 'pkg-knight',
    name: 'باقة الفارس الذهبي (1 مليار)',
    badgeText: 'الأكثر طلباً',
    gold: 1_000_000_000,
    bonusGold: 200_000_000,
    diamonds: 5_000,
    priceUsd: 100,
    perks: [
      '1,000,000,000 ذهب صافي مقابل $100',
      'إطار الفارس الملكي للملف الشخصي',
      '200+ مليون ذهب بونص مجاني فوري',
    ],
    accentTheme: 'amber',
    entryItem: 'دخولية الفارس الذهبي',
  },
  {
    id: 'pkg-emperor',
    name: 'باقة إمبراطور السيرفر (2.5 مليار)',
    badgeText: 'قيمة مضاعفة +30%',
    gold: 2_500_000_000,
    bonusGold: 750_000_000,
    diamonds: 12_000,
    priceUsd: 200,
    perks: [
      '2,500,000,000 ذهب صافي مقابل $200',
      'سيارة فيراري دخول الغرف 3D',
      '750+ مليون ذهب بونص مجاني',
    ],
    accentTheme: 'purple',
    entryItem: 'سيارة فيراري دخول الغرف 3D',
  },
  {
    id: 'pkg-throne',
    name: 'باقة عرش الملوك الفاخرة (5 مليار)',
    badgeText: 'حصري لكبار الداعمين',
    gold: 5_000_000_000,
    bonusGold: 1_750_000_000,
    diamonds: 15_000,
    priceUsd: 399.99,
    perks: [
      'يخت الملوك 3D في المحفظة',
      'لقب ملك المجد بالملف الشخصي',
      '1.75+ مليار ذهب مجاناً',
    ],
    accentTheme: 'crimson',
    entryItem: 'يخت الملوك 3D',
    titleGrant: 'ملك المجد',
  },
  {
    id: 'pkg-legend',
    name: 'باقة الأسطورة الخالدة (10 مليار)',
    badgeText: 'أعلى رتبة بالنظام',
    gold: 10_000_000_000,
    bonusGold: 4_000_000_000,
    diamonds: 40_000,
    priceUsd: 699.99,
    perks: [
      'موكب التنين الملكي 3D عند دخول أي غرفة',
      'ترقية SVIP فورية + شارة الأسطورة',
      '4+ مليار ذهب بونص حصري',
    ],
    accentTheme: 'emerald',
    entryItem: 'موكب التنين الملكي 3D',
    titleGrant: 'الأسطورة الخالدة',
  },
];

export const WALLET_GOLD_PACKS = [
  { id: 'wg-10m', gold: 10_300_000, usd: '10,05' },
  { id: 'wg-5m', gold: 5_100_000, usd: '5,03' },
  { id: 'wg-1m', gold: 1_000_000, usd: '1,00' },
  { id: 'wg-76m', gold: 76_000_000, usd: '74,85' },
  { id: 'wg-52m', gold: 52_500_000, usd: '50,24' },
  { id: 'wg-18m', gold: 18_720_000, usd: '18,09' },
];

export const AGENCY_QUICK_PACKS = [
  { id: 'aq-10', usd: 10, label: '10500000', gold: 10_500_000 },
  { id: 'aq-5', usd: 5, label: '5150000', gold: 5_150_000 },
  { id: 'aq-1', usd: 1, label: '1000000', gold: 1_000_000 },
  { id: 'aq-200', usd: 200, label: '225000000', gold: 225_000_000 },
  { id: 'aq-100', usd: 100, label: '110000000', gold: 110_000_000 },
  { id: 'aq-50', usd: 50, label: '54000000', gold: 54_000_000 },
  { id: 'aq-2000', usd: 2000, label: '2400000000', gold: 2_400_000_000 },
  { id: 'aq-1000', usd: 1000, label: '1175000000', gold: 1_175_000_000 },
  { id: 'aq-500', usd: 500, label: '575000000', gold: 575_000_000 },
];

export const AGENT_STOCK_PACKS = [
  { id: 'as-50', usd: 50, gold: 65_000_000, bonusText: 'خصم وكلاء +30%' },
  { id: 'as-100', usd: 100, gold: 135_000_000, bonusText: 'خصم وكلاء +35%' },
  { id: 'as-500', usd: 500, gold: 700_000_000, bonusText: 'خصم وكلاء +40%' },
  { id: 'as-1000', usd: 1000, gold: 1_500_000_000, bonusText: 'الباقة الملكية +50%' },
];

export const INITIAL_REPORTS: ReportRecord[] = [
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

export const INITIAL_TASKS: DailyTask[] = [
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

export const ROOM_GIFTS: GiftItem[] = [
  { id: 'gift-star', name: 'Star', costGold: 400, heatGain: 800, icon: '🌟', category: 'هدية' },
  { id: 'gift-perfume', name: 'Perfume', costGold: 300, heatGain: 600, icon: '🏺', category: 'هدية' },
  { id: 'gift-dombra', name: 'Dombra', costGold: 20_000, heatGain: 35_000, icon: '🪕', category: 'هدية', badge: 'magic' },
  { id: 'gift-ourlove', name: 'Our Love', costGold: 499_999, heatGain: 850_000, icon: '💞', category: 'هدية', badge: '3D' },
  { id: 'gift-rocket', name: 'Palestine Rocket', costGold: 5_000, heatGain: 9_000, icon: '🚀', category: 'هدية', badge: '3D' },
  { id: 'gift-bouquet', name: 'Bouquet', costGold: 600, heatGain: 1_100, icon: '💐', category: 'هدية' },
  { id: 'gift-hi', name: 'Hi', costGold: 300, heatGain: 500, icon: '💬', category: 'هدية' },
  { id: 'gift-dollar', name: 'Dollar Rain', costGold: 9_999, heatGain: 18_000, icon: '🚁', category: 'هدية', badge: '3D' },
  { id: 'gift-crown', name: 'تاج الملوك', costGold: 250_000, heatGain: 350_000, icon: '👑', category: 'شرف', badge: '3D' },
  { id: 'gift-diamond', name: 'ماسة ملكية', costGold: 1_000_000, heatGain: 1_500_000, icon: '💎', category: 'مكافأة', badge: 'magic' },
  { id: 'gift-love-ring', name: 'خاتم العشاق', costGold: 150_000, heatGain: 240_000, icon: '💍', category: 'العشاق', badge: '3D' },
  { id: 'gift-event-trophy', name: 'كأس النشاط', costGold: 75_000, heatGain: 120_000, icon: '🏆', category: 'النشاط' },
  { id: 'gift-car', name: 'سيارة فيراري', costGold: 5_000_000, heatGain: 7_500_000, icon: '🏎️', category: 'SVIP', badge: '3D' },
  { id: 'gift-dragon', name: 'التنين الملكي', costGold: 100_000_000, heatGain: 180_000_000, icon: '🐉', isGrand: true, category: 'SVIP', badge: '3D' },
];

export const INITIAL_MODERATORS: ModeratorRecord[] = [];

export const INITIAL_AGENCY_HOSTS: AgencyHostRecord[] = [
  {
    id: 'host-900',
    userId: '900',
    name: 'رياض | Riad',
    avatar: AVATAR_RIAD_PATH,
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
    avatar: AVATAR_NAWAF_PATH,
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
    avatar: AVATAR_AHMED_PATH,
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
    avatar: AVATAR_NAWAF_PATH,
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
    avatar: AVATAR_AHMED_PATH,
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

export const INITIAL_DISTRIBUTIONS: CommissionDistribution[] = [
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

