import type {
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

import avatarRiadImg from '../assets/images/avatar_riad_1794519702310.jpg';
import avatarAhmedImg from '../assets/images/avatar_agent_ahmed_1794519702042.jpg';
import avatarNawafImg from '../assets/images/avatar_host_nawaf_1794519702919.jpg';
import coverSuvImg from '../assets/images/room_cover_desert_suv_1794963320069.jpg';
import coverOceanImg from '../assets/images/room_cover_night_ocean_1794963320976.jpg';
import coverGentlemanImg from '../assets/images/room_cover_gentleman_bw_1794963320157.jpg';
import agencyBannerImg from '../assets/images/agency_treasure_banner_1794963320575.jpg';
import royalDragonImg from '../assets/images/royal_dragon_gift_1794519702649.jpg';
import gameFruitImg from '../assets/images/game_fruit_modern_1795018052661.jpg';
import gameFoodieImg from '../assets/images/game_veggie_modern_1795018054357.jpg';

export const APP_ICON_PATH = '/assets/aistudio/1795053392389_370a02c2.jpg';
export const AVATAR_RIAD_PATH = avatarRiadImg;
export const AVATAR_AHMED_PATH = avatarAhmedImg;
export const AVATAR_NAWAF_PATH = avatarNawafImg;
export const COVER_SUV_PATH = coverSuvImg;
export const COVER_OCEAN_PATH = coverOceanImg;
export const COVER_GENTLEMAN_PATH = coverGentlemanImg;
export const AGENCY_BANNER_PATH = agencyBannerImg;
export const ROYAL_DRAGON_PATH = royalDragonImg;
export const GAME_FRUIT_ICON_PATH = gameFruitImg;
export const GAME_FOODIE_ICON_PATH = gameFoodieImg;

const ASSET_FILENAME_MAP: Record<string, string> = {
  'riad_app_icon_1794519701539.jpg': APP_ICON_PATH,
  '1795053392389_370a02c2.jpg': APP_ICON_PATH,
  'avatar_riad_1794519702310.jpg': AVATAR_RIAD_PATH,
  'avatar_agent_ahmed_1794519702042.jpg': AVATAR_AHMED_PATH,
  'avatar_host_nawaf_1794519702919.jpg': AVATAR_NAWAF_PATH,
  'room_cover_desert_suv_1794963320069.jpg': COVER_SUV_PATH,
  'room_cover_night_ocean_1794963320976.jpg': COVER_OCEAN_PATH,
  'room_cover_gentleman_bw_1794963320157.jpg': COVER_GENTLEMAN_PATH,
  'agency_treasure_banner_1794963320575.jpg': AGENCY_BANNER_PATH,
  'royal_dragon_gift_1794519702649.jpg': ROYAL_DRAGON_PATH,
  'game_fruit_modern_1795018052661.jpg': GAME_FRUIT_ICON_PATH,
  'game_veggie_modern_1795018054357.jpg': GAME_FOODIE_ICON_PATH,
};

export function normalizeAssetPath(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return AVATAR_RIAD_PATH;
  const trimmed = raw.trim();
  if (!trimmed) return AVATAR_RIAD_PATH;

  if (ASSET_FILENAME_MAP[trimmed]) {
    return ASSET_FILENAME_MAP[trimmed];
  }

  for (const [filename, resolvedUrl] of Object.entries(ASSET_FILENAME_MAP)) {
    if (trimmed.includes(filename)) {
      return resolvedUrl;
    }
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }

  return AVATAR_RIAD_PATH;
}

export interface RoomThemeOption {
  id: RoomThemeId;
  name: string;
  subtitle: string;
  previewBg: string;
}

export const ROOM_THEMES: RoomThemeOption[] = [
  {
    id: 'ocean-stars',
    name: 'موجة البحر',
    subtitle: 'أزرق سماوي ليلي متلألئ بالنجوم',
    previewBg: 'from-[#0A183D] via-[#0E285E] to-[#08122E]',
  },
  {
    id: 'cosmic-purple',
    name: 'المجرة الملكية',
    subtitle: 'بنفسجي عميق مع إضاءة نيون فاخرة',
    previewBg: 'from-[#2A1058] via-[#1B0D44] to-[#0B0622]',
  },
  {
    id: 'ramadan-green',
    name: 'ليالي الزمرد',
    subtitle: 'أخضر زمردي هادئ بلمسة ذهبية',
    previewBg: 'from-[#063A2E] via-[#082C26] to-[#051B18]',
  },
  {
    id: 'royal-gold',
    name: 'القصر الذهبي',
    subtitle: 'ذهبي ملكي داكن للمناسبات الكبرى',
    previewBg: 'from-[#422806] via-[#2B1907] to-[#140B04]',
  },
];

export interface WalletGoldPack {
  id: string;
  gold: number;
  usd: string;
}

export const WALLET_GOLD_PACKS: WalletGoldPack[] = [
  { id: 'wp-1', gold: 1_000_000, usd: '0.99' },
  { id: 'wp-5', gold: 5_000_000, usd: '4.99' },
  { id: 'wp-10', gold: 10_000_000, usd: '9.99' },
  { id: 'wp-25', gold: 25_000_000, usd: '24.99' },
  { id: 'wp-50', gold: 50_000_000, usd: '49.99' },
  { id: 'wp-100', gold: 100_000_000, usd: '99.99' },
];

export interface AgencyQuickPack {
  id: string;
  label: string;
  gold: number;
  usd: number;
}

export const AGENCY_QUICK_PACKS: AgencyQuickPack[] = [
  { id: 'aq-1', label: '1M', gold: 1_000_000, usd: 1 },
  { id: 'aq-5', label: '5M', gold: 5_000_000, usd: 5 },
  { id: 'aq-10', label: '10M', gold: 10_000_000, usd: 10 },
  { id: 'aq-20', label: '20M', gold: 20_000_000, usd: 20 },
  { id: 'aq-50', label: '50M', gold: 50_000_000, usd: 50 },
  { id: 'aq-100', label: '100M', gold: 100_000_000, usd: 100 },
  { id: 'aq-200', label: '200M', gold: 200_000_000, usd: 200 },
  { id: 'aq-500', label: '500M', gold: 500_000_000, usd: 500 },
  { id: 'aq-1000', label: '1B', gold: 1_000_000_000, usd: 1000 },
];

export interface AgentStockPack {
  id: string;
  gold: number;
  usd: number;
  bonusText: string;
}

export const AGENT_STOCK_PACKS: AgentStockPack[] = [
  { id: 'stock-100', gold: 125_000_000, usd: 100, bonusText: '+25% بونص وكالة' },
  { id: 'stock-250', gold: 325_000_000, usd: 250, bonusText: '+30% بونص وكالة' },
  { id: 'stock-500', gold: 675_000_000, usd: 500, bonusText: '+35% بونص وكالة' },
  { id: 'stock-1000', gold: 1_400_000_000, usd: 1000, bonusText: '+40% بونص النخبة' },
];

export const STORE_PACKAGES: StorePackage[] = [
  {
    id: 'pkg-knight',
    name: 'باقة فارس رياض',
    badgeText: 'الأكثر طلباً',
    gold: 25_000_000,
    bonusGold: 6_250_000,
    diamonds: 1_200,
    priceUsd: 25,
    accentTheme: 'purple',
    entryItem: 'سيارة رياضية نيون 3D',
    titleGrant: 'فارس الغرف',
    perks: [
      'دخولية سيارة رياضية نيون 3D في جميع الغرف',
      'بونص فوري +25% ذهب مجاني',
      'إطار ملف شخصي بنفسجي متوهج',
    ],
  },
  {
    id: 'pkg-duke',
    name: 'باقة دوق السهرة',
    badgeText: 'بونص مضاعف',
    gold: 100_000_000,
    bonusGold: 30_000_000,
    diamonds: 5_500,
    priceUsd: 99,
    accentTheme: 'amber',
    entryItem: 'يخت الخليج الملكي 3D',
    titleGrant: 'دوق الملوك',
    perks: [
      'دخولية يخت الخليج الملكي 3D بإشعار عام',
      'بونص فوري +30% ذهب مجاني',
      'أولوية الظهور في قائمة كبار الشخصيات',
    ],
  },
  {
    id: 'pkg-emperor',
    name: 'باقة الإمبراطور الذهبي',
    badgeText: 'VIP النخبة',
    gold: 500_000_000,
    bonusGold: 175_000_000,
    diamonds: 30_000,
    priceUsd: 499,
    accentTheme: 'crimson',
    entryItem: 'طائرة رياض الخاصة 3D',
    titleGrant: 'إمبراطور رياض',
    perks: [
      'دخولية طائرة رياض الخاصة 3D بتأثير سينمائي',
      'بونص فوري +35% ذهب مجاني',
      'لقب «إمبراطور رياض» + 30,000 ماسة ملكية',
    ],
  },
  {
    id: 'pkg-legend',
    name: 'باقة أسطورة التنين الملكي',
    badgeText: 'الباقة القصوى',
    gold: 2_000_000_000,
    bonusGold: 800_000_000,
    diamonds: 150_000,
    priceUsd: 1499,
    accentTheme: 'emerald',
    entryItem: 'التنين الملكي الأسطوري 3D',
    titleGrant: 'أسطورة رياض شات',
    perks: [
      'دخولية التنين الملكي الأسطوري 3D على مستوى التطبيق',
      'بونص فوري +40% ذهب مجاني',
      'امتيازات SVIP كاملة وشارة شرف أبدية',
    ],
  },
];

export const ROOM_GIFTS: GiftItem[] = [
  { id: 'gift-star', name: 'Star', costGold: 400, heatGain: 800, icon: '🌟', category: 'هدية' },
  { id: 'gift-perfume', name: 'Perfume', costGold: 300, heatGain: 600, icon: '🏺', category: 'هدية' },
  { id: 'gift-dombra', name: 'Dombra', costGold: 20_000, heatGain: 35_000, icon: '🪕', category: 'النشاط' },
  { id: 'gift-ourlove', name: 'Our Love', costGold: 499_999, heatGain: 850_000, icon: '💞', category: 'العشاق', badge: '3D' },
  { id: 'gift-rocket', name: 'Palestine Rocket', costGold: 5_000, heatGain: 9_000, icon: '🚀', category: 'النشاط', badge: 'magic' },
  { id: 'gift-bouquet', name: 'Bouquet', costGold: 600, heatGain: 1_100, icon: '💐', category: 'العشاق' },
  { id: 'gift-hi', name: 'Hi', costGold: 300, heatGain: 500, icon: '💬', category: 'هدية' },
  { id: 'gift-dollar', name: 'Dollar Rain', costGold: 9_999, heatGain: 18_000, icon: '🚁', category: 'مكافأة', badge: 'magic' },
  { id: 'gift-crown', name: 'تاج الملوك', costGold: 250_000, heatGain: 350_000, icon: '👑', category: 'شرف', badge: '3D' },
  { id: 'gift-diamond', name: 'ماسة ملكية', costGold: 1_000_000, heatGain: 1_500_000, icon: '💎', category: 'شرف', badge: '3D' },
  { id: 'gift-love-ring', name: 'خاتم العشاق', costGold: 150_000, heatGain: 240_000, icon: '💍', category: 'العشاق', badge: '3D' },
  { id: 'gift-event-trophy', name: 'كأس النشاط', costGold: 75_000, heatGain: 120_000, icon: '🏆', category: 'مكافأة' },
  { id: 'gift-car', name: 'سيارة فيراري', costGold: 5_000_000, heatGain: 7_500_000, icon: '🏎️', category: 'SVIP', badge: '3D' },
  {
    id: 'gift-dragon',
    name: 'التنين الملكي',
    costGold: 100_000_000,
    heatGain: 180_000_000,
    icon: '🐉',
    isGrand: true,
    category: 'SVIP',
    badge: '3D',
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
    referralCode: 'RIYADH900',
  },
];

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
    description: 'مرحبا بكم في الغرفة الرسمية لوكالة رياض ID:900',
    welcomeMessage: 'أهلاً وسهلاً بكم في الانطلاقة الرسمية لرياض شات',
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
    listeners: 0,
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
        text: 'أهلاً وسهلاً بكم في الغرفة الرسمية لمنصة رياض شات — مرحباً بالجميع!',
        type: 'system',
        timestamp: 'الآن',
      },
    ],
  },
];

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
];

export const INITIAL_TRANSFERS: AgencyTransfer[] = [];

export const INITIAL_MODERATORS: ModeratorRecord[] = [];

export const INITIAL_REPORTS: ReportRecord[] = [];

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
    progress: 0,
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

export const INITIAL_DISTRIBUTIONS: CommissionDistribution[] = [];
