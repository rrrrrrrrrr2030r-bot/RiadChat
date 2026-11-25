import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  AgencyApplicationRequest,
  AgencyHostRecord,
  AgencyTransfer,
  CommissionDistribution,
  DailyTask,
  DiceMultiplier,
  GameLuckMode,
  InviteLinkRecord,
  ModeratorRecord,
  ReportRecord,
  RoomTelemetryPoint,
  RoomThemeId,
  UserAccount,
  UserRole,
  VisitorChatRequirement,
  VoiceRoom,
} from './src/types.ts';
import {
  AGENCY_2FA_SESSION_MS,
  Agency2FAManager,
  dispatchAgencyOtp,
  isEmailDeliveryConfigured,
  isSmsDeliveryConfigured,
  maskEmail,
  maskPhone,
  type Agency2FAChannel,
} from './server/agency2fa.ts';
import {
  DATABASE_MIGRATIONS,
  applyMigrationTransactionally,
  dryRunMigrationOnCopy,
} from './migrations/index.ts';
import {
  DAILY_BACKUP_RETENTION_DAYS,
  DataProtectionManager,
  assertSafeDeleteCondition,
  validateSafeWebhookUrl,
  type DataGovernanceState,
} from './server/dataProtection.ts';
import {
  StateIndexManager,
  TrafficSurgeProtector,
  UptimeHealthMonitor,
  WriteBatchPool,
  paginateItems,
  runProgressiveStressTest,
  type StressTestReport,
} from './server/highTraffic.ts';
import {
  LiveNotificationManager,
  type InAppNotification,
  type PersistedNotificationsState,
} from './server/liveNotifications.ts';
import {
  OwnerRecoveryManager,
  maskIpAddress,
  type OwnerRecoveryAuditEntry,
} from './server/ownerRecovery.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_ADMIN_ID = '900';
const SESSION_COOKIE_NAME = 'riad_chat_session';
// Cryptographically secure ephemeral secret if SESSION_SECRET is not configured (never a hardcoded string)
const SESSION_SECRET =
  (process.env.SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const DB_ENCRYPTION_KEY_RAW = (process.env.DB_ENCRYPTION_KEY || '').trim();
const DB_ENCRYPTION_KEY = DB_ENCRYPTION_KEY_RAW
  ? crypto.scryptSync(DB_ENCRYPTION_KEY_RAW, 'riad-chat-db-aes256gcm-v1', 32)
  : null;

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
  invites: InviteLinkRecord[];
  agencyRequests: AgencyApplicationRequest[];
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

function applyServerXpGain(user: UserAccount, gain: number): void {
  let nextLevel = Math.max(1, Math.floor(user.level || 1));
  let nextXp = Math.max(0, Math.floor(user.xp || 0)) + Math.max(0, Math.floor(gain));
  while (nextXp >= 1200 + (nextLevel - 1) * 100) {
    nextXp -= 1200 + (nextLevel - 1) * 100;
    nextLevel += 1;
  }
  user.level = nextLevel;
  user.xp = nextXp;
}

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
      referralCode: 'RIYADH900',
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
  ];

  const transfers: AgencyTransfer[] = [];
  const reports: ReportRecord[] = [];
  const distributions: CommissionDistribution[] = [];

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

  return {
    currentUserId: '900',
    users,
    rooms,
    transfers,
    moderators: [],
    reports,
    tasks,
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
    hosts,
    distributions,
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
}

interface AuthCredentialRecord {
  userId: string;
  email?: string;
  phone?: string;
  googleId?: string;
  facebookId?: string;
  supabaseUid?: string;
  passwordHash?: string;
  passwordSalt?: string;
  tokenVersion?: number;
}

interface RoomPasswordHashRecord {
  hash: string;
  salt: string;
}

interface PersistedDbPayload {
  schemaVersion: number;
  nextUserNumericId: number;
  state: ServerAppState;
  credentials: AuthCredentialRecord[];
  roomPasswordHashes?: Record<string, RoomPasswordHashRecord>;
  governance?: DataGovernanceState;
  notifications?: PersistedNotificationsState;
  ownerRecoveryAudit?: OwnerRecoveryAuditEntry[];
}

interface EncryptedDbEnvelope {
  encrypted: true;
  alg: 'aes-256-gcm';
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'riyadh-chat-db.json');

function createDefaultGovernanceState(): DataGovernanceState {
  return {
    readOnlyAutomationMode: true,
    alertWebhookUrl: (process.env.ALERT_WEBHOOK_URL || '').trim(),
    backupWebhookUrl: (process.env.BACKUP_WEBHOOK_URL || '').trim(),
    appliedMigrations: [],
    lastDryRuns: {},
    lastRestoreDrill: null,
    lastOffsitePushAt: null,
    archivedRooms: [],
    archivedModerators: [],
  };
}

let governanceState: DataGovernanceState = createDefaultGovernanceState();
let lastStressTestReport: StressTestReport | null = null;

function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, 'hex');
    if (derived.length !== stored.length) return false;
    return crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

function encryptDatabasePayload(plaintextJson: string): string {
  if (!DB_ENCRYPTION_KEY) return plaintextJson;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DB_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: EncryptedDbEnvelope = {
    encrypted: true,
    alg: 'aes-256-gcm',
    v: 1,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('base64'),
  };
  return JSON.stringify(envelope);
}

function decryptDatabasePayload(rawFileText: string): {
  parsed: Partial<PersistedDbPayload>;
  wasEncrypted: boolean;
} {
  const parsedUnknown = JSON.parse(rawFileText) as Partial<EncryptedDbEnvelope> &
    Partial<PersistedDbPayload>;
  if (parsedUnknown && parsedUnknown.encrypted === true && parsedUnknown.alg === 'aes-256-gcm') {
    if (!DB_ENCRYPTION_KEY) {
      throw new Error('Encrypted database detected but DB_ENCRYPTION_KEY is not configured');
    }
    const iv = Buffer.from(String(parsedUnknown.iv || ''), 'hex');
    const tag = Buffer.from(String(parsedUnknown.tag || ''), 'hex');
    const ciphertext = Buffer.from(String(parsedUnknown.data || ''), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', DB_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return {
      parsed: JSON.parse(plaintext) as Partial<PersistedDbPayload>,
      wasEncrypted: true,
    };
  }
  return {
    parsed: parsedUnknown as Partial<PersistedDbPayload>,
    wasEncrypted: false,
  };
}

function normalizeEmail(raw?: string): string {
  return String(raw || '').trim().toLowerCase();
}

function normalizePhone(raw?: string): string {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

const RAW_ENV_ADMIN_EMAIL = normalizeEmail(process.env.PRIMARY_ADMIN_EMAIL || '');
const PRIMARY_ADMIN_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(RAW_ENV_ADMIN_EMAIL)
  ? RAW_ENV_ADMIN_EMAIL
  : 'rrrrrrrrrr2030r@gmail.com';
const ENV_PRIMARY_ADMIN_PASSWORD = (process.env.PRIMARY_ADMIN_PASSWORD || '').trim();

let roomPasswordHashes: Record<string, RoomPasswordHashRecord> = {};

function migrateLegacyRoomPasswords(state: ServerAppState): boolean {
  let changed = false;
  for (const room of state.rooms) {
    if (typeof room.password === 'string') {
      const clean = room.password.trim();
      if (clean && !roomPasswordHashes[room.id]) {
        roomPasswordHashes[room.id] = hashPassword(clean);
      }
      delete room.password;
      changed = true;
    }
    const hasHash = Boolean(roomPasswordHashes[room.id]);
    if (room.hasPassword !== hasHash) {
      room.hasPassword = hasHash;
      changed = true;
    }
    if (hasHash && !room.isLocked) {
      room.isLocked = true;
      changed = true;
    }
  }
  return changed;
}

function buildDefaultCredentials(users: UserAccount[]): AuthCredentialRecord[] {
  const creds: AuthCredentialRecord[] = [];
  const ownerPass = ENV_PRIMARY_ADMIN_PASSWORD ? hashPassword(ENV_PRIMARY_ADMIN_PASSWORD) : null;
  for (const u of users) {
    if (u.id === PRIMARY_ADMIN_ID) {
      u.email = PRIMARY_ADMIN_EMAIL;
      u.phone = u.phone || '+966500000900';
      u.authProvider = u.authProvider || 'email';
      u.referralCode = u.referralCode || 'RIYADH900';
      creds.push({
        userId: u.id,
        email: PRIMARY_ADMIN_EMAIL,
        phone: u.phone,
        ...(ownerPass
          ? { passwordHash: ownerPass.hash, passwordSalt: ownerPass.salt }
          : {}),
      });
    } else {
      const email = u.email || `user${u.id}@riadchat.app`;
      u.email = email;
      u.referralCode = u.referralCode || `RIAD-${u.id}`;
      u.authProvider = u.authProvider || 'email';
      // Never seed hardcoded default passwords for non-owner accounts
      creds.push({
        userId: u.id,
        email,
      });
    }
  }
  return creds;
}

function syncPrimaryOwnerCredentials(state: ServerAppState, creds: AuthCredentialRecord[]): boolean {
  let changed = false;
  const ownerUser = state.users.find((u) => u.id === PRIMARY_ADMIN_ID);
  if (ownerUser) {
    if (ownerUser.email !== PRIMARY_ADMIN_EMAIL) {
      ownerUser.email = PRIMARY_ADMIN_EMAIL;
      changed = true;
    }
    if (!ownerUser.phone) {
      ownerUser.phone = '+966500000900';
      changed = true;
    }
    if (!ownerUser.referralCode) {
      ownerUser.referralCode = 'RIYADH900';
      changed = true;
    }
  }

  // Ensure no non-owner credential claims the primary owner email
  for (const c of creds) {
    if (c.userId !== PRIMARY_ADMIN_ID && c.email === PRIMARY_ADMIN_EMAIL) {
      c.email = `user${c.userId}@riadchat.app`;
      changed = true;
    }
  }

  const existingOwnerCred = creds.find((c) => c.userId === PRIMARY_ADMIN_ID);
  if (!existingOwnerCred) {
    const ownerPass = ENV_PRIMARY_ADMIN_PASSWORD ? hashPassword(ENV_PRIMARY_ADMIN_PASSWORD) : null;
    creds.unshift({
      userId: PRIMARY_ADMIN_ID,
      email: PRIMARY_ADMIN_EMAIL,
      phone: ownerUser?.phone || '+966500000900',
      ...(ownerPass ? { passwordHash: ownerPass.hash, passwordSalt: ownerPass.salt } : {}),
    });
    changed = true;
  } else {
    if (existingOwnerCred.email !== PRIMARY_ADMIN_EMAIL) {
      existingOwnerCred.email = PRIMARY_ADMIN_EMAIL;
      changed = true;
    }
    // Only overwrite the persisted owner hash when PRIMARY_ADMIN_PASSWORD is explicitly configured in env
    if (
      ENV_PRIMARY_ADMIN_PASSWORD &&
      (!existingOwnerCred.passwordHash ||
        !existingOwnerCred.passwordSalt ||
        !verifyPassword(
          ENV_PRIMARY_ADMIN_PASSWORD,
          existingOwnerCred.passwordHash,
          existingOwnerCred.passwordSalt
        ))
    ) {
      const ownerPass = hashPassword(ENV_PRIMARY_ADMIN_PASSWORD);
      existingOwnerCred.passwordHash = ownerPass.hash;
      existingOwnerCred.passwordSalt = ownerPass.salt;
      changed = true;
    }
  }
  return changed;
}

function isOwnerPasswordClaimRequired(): boolean {
  if (ENV_PRIMARY_ADMIN_PASSWORD) return false;
  const ownerCred = authCredentials.find((c) => c.userId === PRIMARY_ADMIN_ID);
  return !(ownerCred?.passwordHash && ownerCred?.passwordSalt);
}

function ensureUserReferralMetadata(state: ServerAppState) {
  state.users.forEach((u) => {
    if (!u.referralCode) {
      u.referralCode = u.id === PRIMARY_ADMIN_ID ? 'RIYADH900' : `RIAD-${u.id}`;
    }
    if (typeof u.referralCount !== 'number') {
      u.referralCount = 0;
    }
    if (typeof u.referralRewardsGold !== 'number') {
      u.referralRewardsGold = 0;
    }
  });
}

let serverState: ServerAppState = createDefaultState();
let authCredentials: AuthCredentialRecord[] = buildDefaultCredentials(serverState.users);
let nextUserNumericId = 1001;

function purgeLegacyDemoRecords(
  state: ServerAppState,
  creds: AuthCredentialRecord[]
): boolean {
  let changed = false;

  const beforeUsers = state.users.length;
  state.users = state.users.filter((u) => !LEGACY_DEMO_USER_IDS.has(u.id));
  if (state.users.length !== beforeUsers) changed = true;

  if (!state.users.some((u) => u.id === PRIMARY_ADMIN_ID)) {
    state.users.unshift(...createInitialUsers());
    changed = true;
  }

  const validUserIds = new Set(state.users.map((u) => u.id));
  if (!validUserIds.has(state.currentUserId)) {
    state.currentUserId = PRIMARY_ADMIN_ID;
    changed = true;
  }

  const beforeRooms = state.rooms.length;
  state.rooms = state.rooms
    .filter((r) => !LEGACY_DEMO_ROOM_IDS.has(r.id) && !LEGACY_DEMO_USER_IDS.has(r.ownerId))
    .map((r) => {
      const cleanedMessages = (r.messages || []).filter(
        (m) => !LEGACY_DEMO_USER_IDS.has(m.senderId)
      );
      const cleanedSeats = (r.seats || []).map((s) =>
        s.userId && LEGACY_DEMO_USER_IDS.has(s.userId)
          ? {
              ...s,
              userId: null,
              userName: null,
              avatar: null,
              isSpeaking: false,
            }
          : s
      );
      const fixedListeners =
        r.id === 'room-900' && r.listeners === 3653 ? 0 : r.listeners;
      if (
        cleanedMessages.length !== (r.messages || []).length ||
        fixedListeners !== r.listeners
      ) {
        changed = true;
      }
      return {
        ...r,
        listeners: fixedListeners,
        seats: cleanedSeats,
        messages: cleanedMessages,
      };
    });
  if (state.rooms.length !== beforeRooms) changed = true;

  const beforeHosts = state.hosts.length;
  state.hosts = state.hosts.filter(
    (h) => !LEGACY_DEMO_HOST_IDS.has(h.id) && !LEGACY_DEMO_USER_IDS.has(h.userId)
  );
  if (state.hosts.length !== beforeHosts) changed = true;

  const beforeTransfers = state.transfers.length;
  state.transfers = state.transfers.filter(
    (t) =>
      !LEGACY_DEMO_TRANSFER_IDS.has(t.id) && !LEGACY_DEMO_USER_IDS.has(t.recipientId)
  );
  if (state.transfers.length !== beforeTransfers) changed = true;

  const beforeReports = state.reports.length;
  state.reports = state.reports.filter(
    (rep) =>
      !LEGACY_DEMO_REPORT_IDS.has(rep.id) && !LEGACY_DEMO_USER_IDS.has(rep.targetId)
  );
  if (state.reports.length !== beforeReports) changed = true;

  const beforeDist = state.distributions.length;
  state.distributions = state.distributions.filter(
    (d) => !LEGACY_DEMO_DISTRIBUTION_IDS.has(d.id)
  );
  if (state.distributions.length !== beforeDist) changed = true;

  const beforeCreds = creds.length;
  for (let i = creds.length - 1; i >= 0; i--) {
    const c = creds[i];
    if (LEGACY_DEMO_USER_IDS.has(c.userId) || !validUserIds.has(c.userId)) {
      creds.splice(i, 1);
    }
  }
  if (creds.length !== beforeCreds) changed = true;

  return changed;
}

function persistDatabaseNow() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    try {
      fs.chmodSync(DATA_DIR, 0o700);
    } catch {
      // Ignore chmod errors on platforms without POSIX mode support
    }
    // Strip any stray plaintext room passwords before writing to disk
    migrateLegacyRoomPasswords(serverState);
    const payload: PersistedDbPayload = {
      schemaVersion: 4,
      nextUserNumericId,
      state: serverState,
      credentials: authCredentials,
      roomPasswordHashes,
      governance: governanceState,
      notifications: liveNotificationManager.exportState(),
      ownerRecoveryAudit: ownerRecoveryManager.exportAuditLog(),
    };
    const serialized = encryptDatabasePayload(JSON.stringify(payload));
    const tmpPath = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, serialized, { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(tmpPath, 0o600);
    } catch {
      // Ignore chmod error
    }
    fs.renameSync(tmpPath, DB_FILE_PATH);
    try {
      fs.chmodSync(DB_FILE_PATH, 0o600);
    } catch {
      // Ignore chmod error
    }
  } catch (err) {
    console.error('Failed to persist Riyadh Chat database:', err);
  }
}

const stateIndexManager = new StateIndexManager<UserAccount, VoiceRoom, InviteLinkRecord>();
const writeBatchPool = new WriteBatchPool(() => {
  persistDatabaseNow();
}, 150);

const dataProtectionManager = new DataProtectionManager({
  dataDir: DATA_DIR,
  encodePayload: (plaintext) => ({
    body: encryptDatabasePayload(plaintext),
    encrypted: Boolean(DB_ENCRYPTION_KEY),
  }),
  decodePayload: (raw) => {
    const parsedUnknown = JSON.parse(raw) as Partial<EncryptedDbEnvelope>;
    if (parsedUnknown && parsedUnknown.encrypted === true && parsedUnknown.alg === 'aes-256-gcm') {
      if (!DB_ENCRYPTION_KEY) {
        throw new Error('Encrypted backup detected but DB_ENCRYPTION_KEY is not configured');
      }
      const iv = Buffer.from(String(parsedUnknown.iv || ''), 'hex');
      const tag = Buffer.from(String(parsedUnknown.tag || ''), 'hex');
      const ciphertext = Buffer.from(String(parsedUnknown.data || ''), 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', DB_ENCRYPTION_KEY, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    }
    return raw;
  },
});

const agency2faManager = new Agency2FAManager(SESSION_SECRET);
const requireAgency2FA = agency2faManager.createMiddleware<AuthedRequest>();
const liveNotificationManager = new LiveNotificationManager();
const ownerRecoveryManager = new OwnerRecoveryManager();
const trafficSurgeProtector = new TrafficSurgeProtector({
  maxPerIpPerMinute: 180,
  maxConcurrentInFlight: 90,
});

function buildCurrentBackupPayload(): Record<string, unknown> {
  return {
    schemaVersion: 4,
    nextUserNumericId,
    state: serverState,
    credentials: authCredentials,
    roomPasswordHashes,
    governance: governanceState,
    notifications: liveNotificationManager.exportState(),
    ownerRecoveryAudit: ownerRecoveryManager.exportAuditLog(),
  };
}

function loadPersistedDatabase() {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      ensureUserReferralMetadata(serverState);
      migrateLegacyRoomPasswords(serverState);
      stateIndexManager.rebuild(serverState);
      return;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
    const { parsed, wasEncrypted } = decryptDatabasePayload(raw);
    if (parsed && parsed.state && Array.isArray(parsed.state.users) && parsed.state.users.length > 0) {
      const defaults = createDefaultState();
      serverState = {
        ...defaults,
        ...parsed.state,
        invites: Array.isArray(parsed.state.invites) ? parsed.state.invites : defaults.invites,
        agencyRequests: Array.isArray(parsed.state.agencyRequests)
          ? parsed.state.agencyRequests
          : [],
      };
      roomPasswordHashes =
        parsed.roomPasswordHashes && typeof parsed.roomPasswordHashes === 'object'
          ? { ...parsed.roomPasswordHashes }
          : {};
      if (parsed.governance && typeof parsed.governance === 'object') {
        governanceState = {
          ...createDefaultGovernanceState(),
          ...parsed.governance,
          alertWebhookUrl:
            parsed.governance.alertWebhookUrl || (process.env.ALERT_WEBHOOK_URL || '').trim(),
          backupWebhookUrl:
            parsed.governance.backupWebhookUrl || (process.env.BACKUP_WEBHOOK_URL || '').trim(),
        };
      }
      if (parsed.notifications && typeof parsed.notifications === 'object') {
        liveNotificationManager.load(parsed.notifications);
      }
      if (Array.isArray(parsed.ownerRecoveryAudit)) {
        ownerRecoveryManager.loadAuditLog(parsed.ownerRecoveryAudit);
      }
      ensureUserReferralMetadata(serverState);
      if (Array.isArray(parsed.credentials) && parsed.credentials.length > 0) {
        authCredentials = parsed.credentials;
      } else {
        authCredentials = buildDefaultCredentials(serverState.users);
      }
      const demoPurged = purgeLegacyDemoRecords(serverState, authCredentials);
      const roomPasswordsMigrated = migrateLegacyRoomPasswords(serverState);
      // Guarantee primary admin (ID 900) stays bound to configured owner email & persisted/env hash
      const ownerUpdated = syncPrimaryOwnerCredentials(serverState, authCredentials);
      const maxNumeric = serverState.users.reduce((max, u) => {
        const n = Number(u.id);
        return Number.isFinite(n) && n < 500000 ? Math.max(max, n) : max;
      }, 1000);
      const parsedNextId = Number(parsed.nextUserNumericId) || 1001;
      nextUserNumericId =
        serverState.users.length <= 1
          ? 1001
          : Math.max(parsedNextId < 200000 ? parsedNextId : 1001, maxNumeric + 1);
      const needsEncryptionMigration = Boolean(DB_ENCRYPTION_KEY && !wasEncrypted);
      if (
        demoPurged ||
        ownerUpdated ||
        roomPasswordsMigrated ||
        needsEncryptionMigration ||
        Number(parsed.schemaVersion) < 4
      ) {
        schedulePersistDatabase();
      }
    }
  } catch (err) {
    console.warn('Could not load persisted DB, using fresh defaults:', err);
  } finally {
    stateIndexManager.rebuild(serverState);
  }
}

function schedulePersistDatabase() {
  stateIndexManager.rebuild(serverState);
  writeBatchPool.scheduleWrite();
}

loadPersistedDatabase();

// Pending SMS OTP codes (5-minute expiry)
const pendingOtpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

const SERVER_STARTED_AT = Date.now();
function computeServerBuildVersion(): string {
  try {
    const distIndex = path.resolve(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distIndex)) {
      const html = fs.readFileSync(distIndex, 'utf8');
      const digest = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
      return `2.5.${digest}`;
    }
  } catch {
    // fallback to startup timestamp version in dev mode
  }
  return `2.5.dev-${SERVER_STARTED_AT}`;
}
const SERVER_BUILD_VERSION = computeServerBuildVersion();

const DEFAULT_USER_AVATARS = [
  '/assets/avatar-riad.png',
  '/assets/avatar-ahmed.png',
  '/assets/avatar-nawaf.png',
];

function allocateUniqueUserId(): string {
  while (serverState.users.some((u) => u.id === String(nextUserNumericId))) {
    nextUserNumericId += 1;
  }
  const id = String(nextUserNumericId);
  nextUserNumericId += 1;
  return id;
}

function findReferrerByCode(rawCode?: string): {
  referrer: UserAccount | null;
  invite: InviteLinkRecord | null;
} {
  const clean = String(rawCode || '').trim().toUpperCase();
  if (!clean) return { referrer: null, invite: null };

  const invite =
    serverState.invites.find((inv) => inv.code.toUpperCase() === clean) || null;
  if (invite) {
    const referrer = serverState.users.find((u) => u.id === invite.inviterId) || null;
    return { referrer, invite };
  }

  const referrerByCode =
    serverState.users.find(
      (u) =>
        (u.referralCode && u.referralCode.toUpperCase() === clean) ||
        u.id.toUpperCase() === clean
    ) || null;
  return { referrer: referrerByCode, invite: null };
}

function applyReferralOnRegistration(
  newUser: UserAccount,
  rawCode?: string
): {
  applied: boolean;
  referrerId?: string;
  referrerName?: string;
  welcomeGold: number;
  referrerRewardGold: number;
  targetRoomId?: string;
} {
  const { referrer, invite } = findReferrerByCode(rawCode);
  if (!referrer || referrer.id === newUser.id || newUser.referredBy) {
    return { applied: false, welcomeGold: 0, referrerRewardGold: 0 };
  }

  const welcomeGold = 500_000;
  const referrerRewardGold = invite?.rewardGold || 1_000_000;

  newUser.referredBy = referrer.id;
  newUser.gold += welcomeGold;

  referrer.gold += referrerRewardGold;
  referrer.referralCount = (referrer.referralCount || 0) + 1;
  referrer.referralRewardsGold = (referrer.referralRewardsGold || 0) + referrerRewardGold;

  if (invite) {
    invite.uses += 1;
  }
  serverState.agentInviteCount += 1;

  return {
    applied: true,
    referrerId: referrer.id,
    referrerName: referrer.name,
    welcomeGold,
    referrerRewardGold,
    targetRoomId: invite?.roomId,
  };
}

function createNewRegisteredUser(params: {
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  authProvider: 'email' | 'google' | 'facebook' | 'phone' | 'supabase';
  password?: string;
  googleId?: string;
  facebookId?: string;
  supabaseUid?: string;
  referralCode?: string;
}): {
  user: UserAccount;
  referralResult: ReturnType<typeof applyReferralOnRegistration>;
} {
  const id = allocateUniqueUserId();
  const personalCode = `RIAD-${id}`;
  const cleanName = params.name.trim().slice(0, 32) || `عضو ${id}`;
  const avatar =
    params.avatar || DEFAULT_USER_AVATARS[Number(id) % DEFAULT_USER_AVATARS.length];

  const user: UserAccount = {
    id,
    name: cleanName,
    avatar,
    role: 'USER',
    level: 1,
    xp: 120,
    svip: 0,
    aristocratTier: null,
    title: 'عضو جديد',
    country: 'السعودية',
    flag: '🇸🇦',
    gold: 250_000,
    diamonds: 25,
    charisma: 10,
    giftedGold: 0,
    following: 0,
    followers: 0,
    visitors: 1,
    isVerifiedAgent: false,
    isAdmin: false,
    isBanned: false,
    ownedEntries: [],
    email: params.email ? normalizeEmail(params.email) : undefined,
    phone: params.phone ? normalizePhone(params.phone) : undefined,
    authProvider: params.authProvider,
    referralCode: personalCode,
    referralCount: 0,
    referralRewardsGold: 0,
    createdAt: new Date().toISOString(),
  };

  serverState.users.push(user);

  const cred: AuthCredentialRecord = {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    googleId: params.googleId,
    facebookId: params.facebookId,
    supabaseUid: params.supabaseUid,
  };
  if (params.password) {
    const hashed = hashPassword(params.password);
    cred.passwordHash = hashed.hash;
    cred.passwordSalt = hashed.salt;
  }
  authCredentials.push(cred);

  // Auto-create permanent personal referral invite record for the new user
  serverState.invites = [
    {
      code: personalCode,
      inviterId: user.id,
      inviterName: user.name,
      uses: 0,
      rewardGold: 1_000_000,
      createdAt: 'الآن',
    },
    ...serverState.invites,
  ].slice(0, 80);

  const referralResult = applyReferralOnRegistration(user, params.referralCode);
  schedulePersistDatabase();

  return { user, referralResult };
}

// Idempotency cache preventing duplicate credit on retries/double-clicks
const idempotencyCache = new Map<
  string,
  { status: number; body: Record<string, unknown>; createdAt: number }
>();

function getUserTokenVersion(uid: string): number {
  const cred = authCredentials.find((c) => c.userId === uid);
  const v = Number(cred?.tokenVersion || 1);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
}

function signToken(uid: string, role: UserRole): string {
  const tv = getUserTokenVersion(uid);
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      role,
      tv,
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
      tv?: number;
      exp: number;
    };
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    const tokenVer = typeof parsed.tv === 'number' ? parsed.tv : 1;
    if (tokenVer !== getUserTokenVersion(parsed.uid)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  authUser?: UserAccount;
  authViaCookie?: boolean;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function isRequestHttps(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return req.secure || proto === 'https';
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isRequestHttps(req) || process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=86400',
  ];
  if (secure) {
    // Required for HTTPS iframe embeds (AI Studio preview & cross-site auth)
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const secure = isRequestHttps(req) || process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractSessionToken(req: Request): { token: string; fromCookie: boolean } {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return { token: bearer, fromCookie: false };
  }
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME] || '';
  return { token: cookieToken, fromCookie: Boolean(cookieToken) };
}

function resolveOptionalViewerId(req: Request): string | null {
  const { token } = extractSessionToken(req);
  if (!token) return null;
  const verified = verifyToken(token);
  return verified?.uid || null;
}

function sanitizeRoomForClient(room: VoiceRoom): VoiceRoom {
  const { password: _discarded, ...rest } = room;
  const hasPassword = Boolean(roomPasswordHashes[room.id]);
  return {
    ...rest,
    hasPassword,
    isLocked: Boolean(room.isLocked || hasPassword),
  };
}

function sanitizeUserForClient(user: UserAccount, viewerUserId: string | null): UserAccount {
  const canSeePrivatePii =
    Boolean(viewerUserId) && (viewerUserId === user.id || viewerUserId === PRIMARY_ADMIN_ID);
  if (canSeePrivatePii) {
    return { ...user };
  }
  const { email: _email, phone: _phone, ...publicUser } = user;
  return publicUser;
}

function sanitizeStateForClient(
  state: ServerAppState,
  viewerUserId: string | null
): ServerAppState {
  const isViewerOwner = viewerUserId === PRIMARY_ADMIN_ID;
  return {
    ...state,
    users: state.users.map((u) => sanitizeUserForClient(u, viewerUserId)),
    rooms: state.rooms.map((r) => sanitizeRoomForClient(r)),
    moderators: state.moderators.map((m) =>
      isViewerOwner ? m : { ...m, whatsapp: '' }
    ),
  };
}

function getSafeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
    return null;
  } catch {
    // Allow relative asset filenames without schemes (e.g. avatar_riad_1794519702310.jpg)
    if (/^[a-zA-Z0-9._/-]+$/.test(trimmed) && !trimmed.includes('..')) {
      return trimmed;
    }
    return null;
  }
}

async function verifySupabaseAccessToken(accessToken: string): Promise<{
  id: string;
  email?: string;
  phone?: string;
  provider: string;
  name?: string;
  avatar?: string;
} | null> {
  const cleanToken = accessToken.trim();
  if (!cleanToken) return null;
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (
    !supabaseUrl.startsWith('https://') ||
    supabaseUrl.includes('YOUR_PROJECT_REF') ||
    !supabaseKey ||
    supabaseKey.includes('YOUR_SUPABASE_ANON_KEY')
  ) {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        apikey: supabaseKey,
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id?: string;
      email?: string | null;
      phone?: string | null;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    };
    if (!data?.id || typeof data.id !== 'string') return null;
    const meta = data.user_metadata || {};
    const appMeta = data.app_metadata || {};
    const displayName = String(
      meta.full_name || meta.name || meta.display_name || ''
    ).trim();
    const avatar =
      typeof meta.avatar_url === 'string'
        ? meta.avatar_url
        : typeof meta.picture === 'string'
        ? meta.picture
        : undefined;
    return {
      id: data.id,
      email: data.email ? normalizeEmail(data.email) : undefined,
      phone: data.phone ? normalizePhone(data.phone) : undefined,
      provider: typeof appMeta.provider === 'string' ? appMeta.provider : 'supabase',
      name: displayName || undefined,
      avatar: getSafeImageUrl(avatar) || undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Sliding-window in-memory rate limiter for auth, OTP & room password endpoints
function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const buckets = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip =
      String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
        .split(',')[0]
        .trim();
    const key = options.keyFn ? `${ip}:${options.keyFn(req)}` : ip;
    const cutoff = now - options.windowMs;
    const timestamps = (buckets.get(key) || []).filter((ts) => ts > cutoff);
    if (timestamps.length >= options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + options.windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error:
          options.message ||
          'تم تجاوز الحد المسموح من المحاولات، يرجى الانتظار قليلاً ثم إعادة المحاولة',
        code: 'RATE_LIMITED',
        retryAfterSec,
      });
      return;
    }
    timestamps.push(now);
    buckets.set(key, timestamps);
    if (buckets.size > 2000) {
      for (const [bucketKey, list] of buckets.entries()) {
        if (!list.length || list[list.length - 1] <= cutoff) {
          buckets.delete(bucketKey);
        }
      }
    }
    next();
  };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const { token, fromCookie } = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing session token', code: 'AUTH_REQUIRED' });
    return;
  }
  const verified = verifyToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Unauthorized: invalid or expired session token', code: 'AUTH_INVALID' });
    return;
  }
  // CSRF guard for cookie-authenticated state-changing mutations
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  if (fromCookie && isMutation) {
    const requestedWith = String(req.headers['x-requested-with'] || '').toLowerCase();
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (requestedWith !== 'xmlhttprequest' && !contentType.includes('application/json')) {
      res.status(403).json({
        error: 'Forbidden: CSRF verification failed',
        code: 'CSRF_REJECTED',
      });
      return;
    }
  }
  const user = serverState.users.find((u) => u.id === verified.uid);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: user not found', code: 'USER_NOT_FOUND' });
    return;
  }
  req.authUser = user;
  req.authViaCookie = fromCookie;
  next();
}

function requireOwner(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = req.authUser;
  if (!user || user.id !== PRIMARY_ADMIN_ID) {
    res.status(403).json({
      error: `Forbidden: Primary admin ID (${PRIMARY_ADMIN_ID}) required to access this administrative endpoint`,
      code: 'RBAC_FORBIDDEN',
      role: user?.role || 'UNKNOWN',
      userId: user?.id || 'UNKNOWN',
    });
    return;
  }
  next();
}

function requireApprovedAgent(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = req.authUser;
  if (!user || (user.id !== PRIMARY_ADMIN_ID && !user.isVerifiedAgent)) {
    res.status(403).json({
      error: 'ممنوع (403): بوابة الوكالات والتحويل متاحة فقط للوكلاء المعتمدين بعد موافقة المالك (ID: 900)',
      code: 'AGENT_APPROVAL_REQUIRED',
      role: user?.role || 'UNKNOWN',
      userId: user?.id || 'UNKNOWN',
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
  const isProd = process.env.NODE_ENV === 'production';
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Transport security & hardening headers (compatible with preview iframe & voice microphone)
  app.use((req, res, next) => {
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const isLocalReq =
      reqHost.startsWith('localhost') ||
      reqHost.startsWith('127.0.0.1') ||
      reqHost.startsWith('[::1]');

    if (
      isProd &&
      !isLocalReq &&
      req.path !== '/api/health' &&
      String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'http'
    ) {
      res.redirect(301, `https://${reqHost}${req.originalUrl}`);
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), geolocation=(), payment=(), microphone=(self)'
    );
    if (isProd || isRequestHttps(req)) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Trusted CORS middleware for Web, AI Studio preview/shared origins, and Mobile clients
  const extraCorsOrigins = new Set(
    String(process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
  const isAllowedCorsOrigin = (origin: string, req: Request): boolean => {
    const normalized = origin.trim().toLowerCase();
    if (!normalized) return false;
    if (extraCorsOrigins.has(normalized)) return true;
    if (
      normalized.startsWith('exp://') ||
      normalized.startsWith('capacitor://') ||
      normalized.startsWith('ionic://')
    ) {
      return true;
    }
    try {
      const parsed = new URL(origin);
      const host = parsed.hostname.toLowerCase();
      const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      if (reqHost && parsed.host.toLowerCase() === reqHost) return true;
      if (host === 'localhost' || host === '127.0.0.1') return true;
      if (host.endsWith('.run.app') || host === 'riadchat.vercel.app') return true;
      return false;
    } catch {
      return false;
    }
  };
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');
    if (origin && isAllowedCorsOrigin(origin, req)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
      // Reject cross-origin state-changing requests from untrusted origins
      res.status(403).json({ error: 'Forbidden: untrusted origin', code: 'CORS_ORIGIN_DENIED' });
      return;
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Cache-Control, Pragma, Idempotency-Key, X-Idempotency-Key, X-Client-Platform, X-Requested-With, X-Agency-2FA-Token, X-Stress-Client-Id'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(trafficSurgeProtector.middleware());

  // Defense-in-depth response sanitizer: guarantees no route can ever leak plaintext room passwords or other users' PII
  app.use((req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const record = body as Record<string, unknown>;
        const viewerId =
          (req as AuthedRequest).authUser?.id ?? resolveOptionalViewerId(req);
        let cloned: Record<string, unknown> | null = null;
        if (record.state === serverState) {
          cloned = { ...record, state: sanitizeStateForClient(serverState, viewerId) };
        }
        if (
          record.room &&
          typeof record.room === 'object' &&
          'seats' in (record.room as Record<string, unknown>)
        ) {
          cloned = {
            ...(cloned || record),
            room: sanitizeRoomForClient(record.room as VoiceRoom),
          };
        }
        if (cloned) {
          return origJson(cloned);
        }
      }
      return origJson(body);
    }) as typeof res.json;
    next();
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Handle only /ws upgrades so Vite HMR WebSocket upgrades on /__vite_hmr are never aborted
  server.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url || '/', 'http://localhost');
      if (parsedUrl.pathname !== '/ws') {
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  const broadcastJson = (payload: Record<string, unknown>, exclude?: WebSocket) => {
    const serialized = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
  };

  const MAX_TELEMETRY_POINTS = 16;
  let telemetrySeq = 1;
  const roomTelemetryMap = new Map<string, RoomTelemetryPoint[]>();
  const roomEventAccumulator = new Map<
    string,
    { interactionSpike: number; voiceSpike: number; heatGameSpike: number }
  >();

  const formatTelemetryLabel = (ts: number): string => {
    const d = new Date(ts);
    return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const buildTelemetryPoint = (
    room: VoiceRoom,
    ts: number,
    spikes?: { interaction?: number; voice?: number; heatGames?: number }
  ): RoomTelemetryPoint => {
    const activeMics = room.seats.filter((s) => Boolean(s.userId)).length;
    const speakingMics = room.seats.filter((s) => Boolean(s.userId) && !s.isMuted && s.isSpeaking).length;
    const giftsCount = room.messages.filter((m) => m.type === 'gift').length;
    const achievementCount = room.messages.filter((m) => m.type === 'achievement').length;
    const liveClientsBoost = Math.min(20, wss.clients.size * 2);

    const interactionBase =
      18 +
      Math.min(55, room.messages.length * 3) +
      giftsCount * 8 +
      speakingMics * 9 +
      (spikes?.interaction || 0);

    const voiceOnlineBase =
      14 +
      Math.min(48, Math.round(room.listeners * 0.45)) +
      activeMics * 7 +
      speakingMics * 11 +
      liveClientsBoost +
      (spikes?.voice || 0);

    const heatLogScore = room.heat > 0 ? Math.min(60, Math.round(Math.log10(room.heat + 10) * 7.5)) : 8;
    const heatGamesBase =
      12 +
      heatLogScore +
      giftsCount * 6 +
      achievementCount * 10 +
      (spikes?.heatGames || 0);

    return {
      seq: telemetrySeq++,
      timestamp: ts,
      label: formatTelemetryLabel(ts),
      interaction: Math.min(220, Math.max(8, Math.round(interactionBase))),
      voiceOnline: Math.min(220, Math.max(8, Math.round(voiceOnlineBase))),
      heatGames: Math.min(220, Math.max(8, Math.round(heatGamesBase))),
      activeMics,
      speakingMics,
      listeners: room.listeners + Math.max(0, wss.clients.size - 1),
      messagesCount: room.messages.length,
      giftsCount,
      roomHeat: room.heat,
    };
  };

  const ensureRoomTelemetry = (room: VoiceRoom): RoomTelemetryPoint[] => {
    const existing = roomTelemetryMap.get(room.id);
    if (existing && existing.length > 0) return existing;
    const now = Date.now();
    const seed: RoomTelemetryPoint[] = Array.from({ length: 12 }, (_, idx) => {
      const ts = now - (11 - idx) * 3000;
      const base = buildTelemetryPoint(room, ts);
      const offset = idx - 11;
      return {
        ...base,
        interaction: Math.max(8, base.interaction + Math.round(offset * 0.6)),
        voiceOnline: Math.max(8, base.voiceOnline + Math.round(offset * 0.4)),
        heatGames: Math.max(8, base.heatGames + Math.round(offset * 0.5)),
      };
    });
    roomTelemetryMap.set(room.id, seed);
    return seed;
  };

  const recordRoomTelemetry = (
    roomId: string,
    spikes?: { interaction?: number; voice?: number; heatGames?: number },
    immediateBroadcast = true
  ) => {
    const room = serverState.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const history = ensureRoomTelemetry(room);
    if (!immediateBroadcast) {
      const acc = roomEventAccumulator.get(roomId) || {
        interactionSpike: 0,
        voiceSpike: 0,
        heatGameSpike: 0,
      };
      acc.interactionSpike += spikes?.interaction || 0;
      acc.voiceSpike += spikes?.voice || 0;
      acc.heatGameSpike += spikes?.heatGames || 0;
      roomEventAccumulator.set(roomId, acc);
      return;
    }
    const acc = roomEventAccumulator.get(roomId);
    roomEventAccumulator.delete(roomId);
    const point = buildTelemetryPoint(room, Date.now(), {
      interaction: (spikes?.interaction || 0) + (acc?.interactionSpike || 0),
      voice: (spikes?.voice || 0) + (acc?.voiceSpike || 0),
      heatGames: (spikes?.heatGames || 0) + (acc?.heatGameSpike || 0),
    });
    const nextHistory = [...history.slice(-(MAX_TELEMETRY_POINTS - 1)), point];
    roomTelemetryMap.set(roomId, nextHistory);
    broadcastJson({
      type: 'room:telemetry:point',
      roomId,
      point,
    });
  };

  // Authoritative server heartbeat broadcasting live telemetry snapshots only while clients are connected
  const telemetryInterval = setInterval(() => {
    if (wss.clients.size === 0) return;
    serverState.rooms.forEach((room) => {
      recordRoomTelemetry(room.id, undefined, true);
    });
  }, 3000);
  telemetryInterval.unref();

  const wsAuthUserIds = new WeakMap<WebSocket, string | null>();

  const sendSanitizedStateToSocket = (client: WebSocket) => {
    if (client.readyState !== WebSocket.OPEN) return;
    const viewerId = wsAuthUserIds.get(client) ?? null;
    client.send(
      JSON.stringify({
        type: 'state:sync',
        state: sanitizeStateForClient(serverState, viewerId),
      })
    );
  };

  const broadcastStateSync = () => {
    schedulePersistDatabase();
    let cachedPublicFrame: string | null = null;
    wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const viewerId = wsAuthUserIds.get(client) ?? null;
      if (!viewerId) {
        if (!cachedPublicFrame) {
          cachedPublicFrame = JSON.stringify({
            type: 'state:sync',
            state: sanitizeStateForClient(serverState, null),
          });
        }
        client.send(cachedPublicFrame);
      } else {
        client.send(
          JSON.stringify({
            type: 'state:sync',
            state: sanitizeStateForClient(serverState, viewerId),
          })
        );
      }
    });
  };

  const sendNotificationsInitToSocket = (client: WebSocket) => {
    if (client.readyState !== WebSocket.OPEN) return;
    const viewerId = wsAuthUserIds.get(client) ?? null;
    if (!viewerId) return;
    const snapshot = liveNotificationManager.getUserSnapshot(viewerId);
    client.send(
      JSON.stringify({
        type: 'notifications:init',
        ...snapshot,
      })
    );
  };

  const pushLiveNotificationsToSockets = (dispatched: Map<string, InAppNotification>) => {
    if (dispatched.size === 0) return;
    wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const viewerId = wsAuthUserIds.get(client) ?? null;
      if (!viewerId) return;
      const notif = dispatched.get(viewerId);
      if (!notif) return;
      client.send(
        JSON.stringify({
          type: 'notification:new',
          notification: notif,
          unreadCount: liveNotificationManager.getUnreadCount(viewerId),
        })
      );
    });
  };

  const revokeAllUserSessions = (userId: string): number => {
    const cred = authCredentials.find((c) => c.userId === userId);
    if (cred) {
      cred.tokenVersion = getUserTokenVersion(userId) + 1;
    }
    agency2faManager.revokeAllForUser(userId);
    let closedSockets = 0;
    wss.clients.forEach((client) => {
      if (wsAuthUserIds.get(client) === userId) {
        wsAuthUserIds.delete(client);
        closedSockets += 1;
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(
              JSON.stringify({
                type: 'session:revoked',
                reason: 'owner_recovery',
              })
            );
            client.close(4001, 'Session revoked');
          } catch {
            // Ignore socket close error
          }
        }
      }
    });
    return closedSockets + 1;
  };

  const triggerRoomLiveNotifications = (params: {
    room: VoiceRoom;
    hostId: string;
    hostName: string;
    topic?: string;
    explicit?: boolean;
  }) => {
    const result = liveNotificationManager.dispatchLiveStartNotifications({
      room: params.room,
      allRooms: serverState.rooms,
      allUserIds: serverState.users.map((u) => u.id),
      hostId: params.hostId,
      hostName: params.hostName,
      topic: params.topic,
      explicit: params.explicit,
    });
    if (result.dispatched.size > 0) {
      schedulePersistDatabase();
      pushLiveNotificationsToSockets(result.dispatched);
    }
    return result;
  };

  wss.on('connection', (ws, request) => {
    let initialViewerId: string | null = null;
    try {
      const parsedUrl = new URL(request.url || '/ws', 'http://localhost');
      const queryToken = parsedUrl.searchParams.get('token')?.trim() || '';
      const cookies = parseCookies(request.headers.cookie);
      const cookieToken = cookies[SESSION_COOKIE_NAME] || '';
      const rawToken = queryToken || cookieToken;
      if (rawToken) {
        const verified = verifyToken(rawToken);
        if (verified && serverState.users.some((u) => u.id === verified.uid)) {
          initialViewerId = verified.uid;
        }
      }
    } catch {
      initialViewerId = null;
    }
    wsAuthUserIds.set(ws, initialViewerId);

    sendSanitizedStateToSocket(ws);
    sendNotificationsInitToSocket(ws);
    const initialTelemetry: Record<string, RoomTelemetryPoint[]> = {};
    serverState.rooms.forEach((room) => {
      initialTelemetry[room.id] = ensureRoomTelemetry(room);
    });
    ws.send(JSON.stringify({ type: 'room:telemetry:init', telemetryByRoomId: initialTelemetry }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          token?: string;
          ts?: number;
          roomId?: string;
          seatNumber?: number;
          userId?: string;
          isSpeaking?: boolean;
        };

        if (msg.type === 'auth' && typeof msg.token === 'string') {
          const verified = verifyToken(msg.token.trim());
          const verifiedUid =
            verified && serverState.users.some((u) => u.id === verified.uid)
              ? verified.uid
              : null;
          wsAuthUserIds.set(ws, verifiedUid);
          sendSanitizedStateToSocket(ws);
          sendNotificationsInitToSocket(ws);
          return;
        }

        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'pong',
                ts: typeof msg.ts === 'number' ? msg.ts : Date.now(),
                serverTime: Date.now(),
              })
            );
          }
          return;
        }

        if (msg.type === 'state:request') {
          sendSanitizedStateToSocket(ws);
          return;
        }

        if (msg.type === 'room:seats:request' && typeof msg.roomId === 'string') {
          const targetRoomId = msg.roomId.trim();
          if (!targetRoomId || ws.readyState !== WebSocket.OPEN) return;
          const room = serverState.rooms.find((r) => r.id === targetRoomId);
          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'room:seats:sync',
                roomId: targetRoomId,
                notFound: true,
                syncedAt: Date.now(),
              })
            );
            return;
          }
          ws.send(
            JSON.stringify({
              type: 'room:seats:sync',
              roomId: room.id,
              seats: room.seats,
              messages: room.messages.slice(-60),
              listeners: room.listeners,
              heat: room.heat,
              isLocked: Boolean(room.isLocked || roomPasswordHashes[room.id]),
              hasPassword: Boolean(roomPasswordHashes[room.id]),
              syncedAt: Date.now(),
            })
          );
          return;
        }

        if (msg.type === 'room:telemetry:subscribe' && msg.roomId) {
          const room = serverState.rooms.find((r) => r.id === msg.roomId);
          if (!room) return;
          ws.send(
            JSON.stringify({
              type: 'room:telemetry:init',
              roomId: room.id,
              points: ensureRoomTelemetry(room),
            })
          );
          return;
        }

        if (
          msg.type === 'room:speaking' &&
          msg.roomId &&
          typeof msg.seatNumber === 'number'
        ) {
          // Strict server-side WebSocket identity verification: ignore spoofed msg.userId
          const verifiedUserId = wsAuthUserIds.get(ws) ?? null;
          if (!verifiedUserId) return;
          const room = serverState.rooms.find((r) => r.id === msg.roomId);
          if (!room) return;
          const seat = room.seats.find((s) => s.seatNumber === msg.seatNumber);
          if (!seat || seat.userId !== verifiedUserId || seat.isMuted) return;
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
          if (seat.isSpeaking) {
            recordRoomTelemetry(room.id, { interaction: 10, voice: 14 }, false);
          }
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });
  });

  const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 25,
    message: 'تم تجاوز عدد محاولات تسجيل الدخول المسموح بها، يرجى المحاولة بعد قليل',
  });
  const otpRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 8,
    keyFn: (req) => normalizePhone(req.body?.phone) || 'otp',
    message: 'تم إرسال عدد كبير من رموز التحقق لهذا الرقم، يرجى الانتظار',
  });
  const roomPasswordRateLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 12,
    keyFn: (req) => String(req.params?.id || 'room'),
    message: 'تم تجاوز عدد محاولات كلمة مرور الغرفة، يرجى المحاولة لاحقاً',
  });

  // Health, Cache-Busting Version Check & Bootstrap
  app.get('/api/health', (_req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    const hasValidSupabaseUrl =
      supabaseUrl.startsWith('https://') &&
      !supabaseUrl.includes('YOUR_PROJECT_REF') &&
      supabaseUrl.length > 16;
    const hasValidSupabaseKey =
      !supabaseKey.includes('YOUR_SUPABASE_ANON_KEY') &&
      !/\s/.test(supabaseKey) &&
      ((supabaseKey.startsWith('eyJ') && supabaseKey.split('.').length === 3 && supabaseKey.length > 80) ||
        (supabaseKey.startsWith('sb_publishable_') && supabaseKey.length > 24));
    const rawInviteUrl = (process.env.VITE_PUBLIC_INVITE_URL || '').trim();
    const publicInviteUrl = /^https?:\/\//i.test(rawInviteUrl)
      ? rawInviteUrl.replace(/\/+$/, '')
      : 'https://riadchat.vercel.app';
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      ok: true,
      clients: wss.clients.size,
      wsPath: '/ws',
      supabaseLinked: hasValidSupabaseUrl && hasValidSupabaseKey,
      ownerPasswordClaimRequired: isOwnerPasswordClaimRequired(),
      dbEncryptedAtRest: Boolean(DB_ENCRYPTION_KEY),
      publicInviteUrl,
      version: SERVER_BUILD_VERSION,
      serverTime: Date.now(),
      uptimeSec: Math.round(process.uptime()),
    });
  });

  app.get('/api/version', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({
      version: SERVER_BUILD_VERSION,
      startedAt: SERVER_STARTED_AT,
      appName: 'رياض شات',
    });
  });

  app.get('/api/state', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const viewerId = resolveOptionalViewerId(req);
    res.json({ state: sanitizeStateForClient(serverState, viewerId) });
  });

  // ============================================================================
  // REAL MULTI-PROVIDER AUTHENTICATION & REFERRAL ATTRIBUTION ROUTES
  // ============================================================================
  const recentOtpVerifiedUsers = new Map<string, number>();

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const me = req.authUser!;
    const freshToken = signToken(me.id, me.role);
    setSessionCookie(req, res, freshToken);
    res.json({
      ok: true,
      token: freshToken,
      user: sanitizeUserForClient(me, me.id),
      state: sanitizeStateForClient(serverState, me.id),
    });
  });

  app.patch('/api/auth/credentials', requireAuth, authRateLimiter, (req: AuthedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const me = req.authUser!;
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';

    if (!rawPhone && !newPassword) {
      res.status(400).json({ error: 'يرجى تحديد رقم الهاتف الجديد أو كلمة المرور الجديدة' });
      return;
    }

    let nextPhone = '';
    if (rawPhone) {
      nextPhone = normalizePhone(normalizeLoginDigits(rawPhone));
      if (!nextPhone || nextPhone.length < 9 || nextPhone.length > 20) {
        res.status(400).json({ error: 'يرجى إدخال رقم هاتف صحيح مع رمز الدولة' });
        return;
      }
      const phoneTaken = authCredentials.some(
        (c) => c.userId !== me.id && c.phone && c.phone === nextPhone
      );
      if (phoneTaken) {
        res.status(409).json({ error: 'رقم الهاتف مستخدم بالفعل في حساب آخر' });
        return;
      }
    }

    let cred = authCredentials.find((c) => c.userId === me.id);
    if (!cred) {
      cred = {
        userId: me.id,
        email: me.email,
        phone: me.phone,
      };
      authCredentials.push(cred);
    }

    const otpExpiry = recentOtpVerifiedUsers.get(me.id) || 0;
    const hasRecentOtp = otpExpiry > Date.now();
    const hasExistingPassword = Boolean(cred.passwordHash && cred.passwordSalt);

    if (newPassword) {
      if (newPassword.length < 8 || newPassword.length > 128) {
        res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون بين 8 و128 حرفاً' });
        return;
      }
      if (hasExistingPassword && !hasRecentOtp) {
        if (
          !currentPassword ||
          !verifyPassword(currentPassword, cred.passwordHash!, cred.passwordSalt!)
        ) {
          res.status(401).json({
            error: 'يرجى إدخال كلمة المرور الحالية بشكل صحيح أو التحقق أولاً عبر رمز الهاتف (OTP)',
          });
          return;
        }
      }
    } else if (nextPhone && hasExistingPassword && !hasRecentOtp) {
      if (
        !currentPassword ||
        !verifyPassword(currentPassword, cred.passwordHash!, cred.passwordSalt!)
      ) {
        res.status(401).json({
          error: 'يرجى تأكيد كلمة المرور الحالية أو التحقق عبر رمز الهاتف (OTP) قبل تغيير رقم الهاتف',
        });
        return;
      }
    }

    if (nextPhone) {
      cred.phone = nextPhone;
      me.phone = nextPhone;
    }
    if (newPassword) {
      const hashed = hashPassword(newPassword);
      cred.passwordHash = hashed.hash;
      cred.passwordSalt = hashed.salt;
    }

    recentOtpVerifiedUsers.delete(me.id);
    persistDatabaseNow();
    broadcastStateSync();

    res.json({
      ok: true,
      user: sanitizeUserForClient(me, me.id),
      phoneUpdated: Boolean(nextPhone),
      passwordUpdated: Boolean(newPassword),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    agency2faManager.revokeFromRequest(req, res);
    res.json({ ok: true });
  });

  // One-time atomic first-run bootstrap for Primary Owner (ID: 900) when PRIMARY_ADMIN_PASSWORD env is unset
  app.post('/api/auth/owner-claim', authRateLimiter, (req, res) => {
    if (!isOwnerPasswordClaimRequired()) {
      res.status(403).json({
        error: 'تم إعداد كلمة مرور المالك مسبقاً — يرجى تسجيل الدخول بشكل اعتيادي',
        code: 'OWNER_ALREADY_CLAIMED',
      });
      return;
    }
    const rawIdentifier = String(req.body?.email || req.body?.identifier || '').trim();
    const identifier = rawIdentifier
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    const email = normalizeEmail(identifier);
    const password = String(req.body?.password || '');

    if (email !== PRIMARY_ADMIN_EMAIL && identifier !== PRIMARY_ADMIN_ID) {
      res.status(403).json({
        error: 'يجب إدخال البريد الإلكتروني أو المعرف الخاص بالمالك الأساسي (ID: 900)',
      });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'كلمة مرور المالك يجب أن تكون 8 أحرف على الأقل' });
      return;
    }

    const ownerUser = serverState.users.find((u) => u.id === PRIMARY_ADMIN_ID);
    if (!ownerUser) {
      res.status(404).json({ error: 'حساب المالك غير موجود' });
      return;
    }

    const hashed = hashPassword(password);
    let ownerCred = authCredentials.find((c) => c.userId === PRIMARY_ADMIN_ID);
    if (!ownerCred) {
      ownerCred = {
        userId: PRIMARY_ADMIN_ID,
        email: PRIMARY_ADMIN_EMAIL,
        phone: ownerUser.phone || '+966500000900',
      };
      authCredentials.unshift(ownerCred);
    }
    ownerCred.passwordHash = hashed.hash;
    ownerCred.passwordSalt = hashed.salt;
    persistDatabaseNow();

    const token = signToken(ownerUser.id, ownerUser.role);
    setSessionCookie(req, res, token);
    res.json({
      ok: true,
      token,
      user: sanitizeUserForClient(ownerUser, ownerUser.id),
      state: sanitizeStateForClient(serverState, ownerUser.id),
    });
  });

  // ============================================================================
  // OWNER ACCOUNT RECOVERY VIA PRIMARY_ADMIN_EMAIL (ID: 900)
  // ============================================================================
  app.get('/api/auth/owner-recovery/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      ...ownerRecoveryManager.getStatus({
        primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
        isProd,
      }),
    });
  });

  app.post('/api/auth/owner-recovery/request', otpRateLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const ownerUser = serverState.users.find((u) => u.id === PRIMARY_ADMIN_ID);
    const ipHint = maskIpAddress(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''));
    const result = await ownerRecoveryManager.requestRecoveryCode({
      inputEmail: String(req.body?.email || ''),
      primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
      ownerName: ownerUser?.name || 'المالك الرئيسي',
      isProd,
      ipHint,
    });
    schedulePersistDatabase();
    if (!result.ok) {
      if (result.retryAfterSec) {
        res.setHeader('Retry-After', String(result.retryAfterSec));
      }
      res.status(result.status).json({
        error: result.error,
        ...(result.retryAfterSec ? { retryAfterSec: result.retryAfterSec } : {}),
      });
      return;
    }
    res.json({
      ok: true,
      maskedEmail: result.maskedEmail,
      deliveryMode: result.deliveryMode,
      expiresInSec: result.expiresInSec,
      resendCooldownSec: result.resendCooldownSec,
      ...(result.previewOtp ? { previewOtp: result.previewOtp } : {}),
    });
  });

  app.post('/api/auth/owner-recovery/complete', authRateLimiter, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const code = String(req.body?.code || '').trim();
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const ipHint = maskIpAddress(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''));

    if (newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون بين 8 و128 حرفاً' });
      return;
    }

    let nextPhone = '';
    if (rawPhone) {
      nextPhone = normalizePhone(normalizeLoginDigits(rawPhone));
      if (!nextPhone || nextPhone.length < 9 || nextPhone.length > 20) {
        res.status(400).json({ error: 'يرجى إدخال رقم هاتف صحيح مع رمز الدولة (مثال: +967...)' });
        return;
      }
      const phoneTaken = authCredentials.some(
        (c) => c.userId !== PRIMARY_ADMIN_ID && c.phone && c.phone === nextPhone
      );
      if (phoneTaken) {
        res.status(409).json({ error: 'رقم الهاتف مستخدم بالفعل في حساب آخر' });
        return;
      }
    }

    const ownerUser = serverState.users.find((u) => u.id === PRIMARY_ADMIN_ID);
    if (!ownerUser) {
      res.status(404).json({ error: 'حساب المالك الرئيسي غير موجود' });
      return;
    }

    const verified = ownerRecoveryManager.verifyRecoveryCode({ code, ipHint });
    if (!verified.ok) {
      schedulePersistDatabase();
      res.status(verified.status).json({ error: verified.error });
      return;
    }

    let ownerCred = authCredentials.find((c) => c.userId === PRIMARY_ADMIN_ID);
    if (!ownerCred) {
      ownerCred = {
        userId: PRIMARY_ADMIN_ID,
        email: PRIMARY_ADMIN_EMAIL,
        phone: ownerUser.phone || '+966500000900',
        tokenVersion: 1,
      };
      authCredentials.unshift(ownerCred);
    }

    const hashed = hashPassword(newPassword);
    ownerCred.email = PRIMARY_ADMIN_EMAIL;
    ownerCred.passwordHash = hashed.hash;
    ownerCred.passwordSalt = hashed.salt;
    if (nextPhone) {
      ownerCred.phone = nextPhone;
      ownerUser.phone = nextPhone;
    }

    // Revoke ALL prior sessions (HTTP tokens, cookies, WebSockets, and Agency 2FA sessions)
    const revokedSessions = revokeAllUserSessions(PRIMARY_ADMIN_ID);
    ownerRecoveryManager.recordRecoveryCompleted({
      maskedEmail: verified.maskedEmail || maskEmail(PRIMARY_ADMIN_EMAIL),
      deliveryMode: verified.deliveryMode,
      phoneUpdated: Boolean(nextPhone),
      revokedSessions,
      ipHint,
    });
    persistDatabaseNow();
    broadcastStateSync();

    // Sign brand-new session with incremented tokenVersion for immediate login
    const freshToken = signToken(ownerUser.id, ownerUser.role);
    setSessionCookie(req, res, freshToken);
    agency2faManager.clearCookie(req, res);

    res.json({
      ok: true,
      token: freshToken,
      user: sanitizeUserForClient(ownerUser, ownerUser.id),
      state: sanitizeStateForClient(serverState, ownerUser.id),
      phoneUpdated: Boolean(nextPhone),
      revokedSessions,
    });
  });

  app.get('/api/system/owner-recovery-audit', requireAuth, requireOwner, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      status: ownerRecoveryManager.getStatus({
        primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
        isProd,
      }),
      auditLog: ownerRecoveryManager.exportAuditLog(),
    });
  });

  app.post('/api/auth/register', authRateLimiter, (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const referralCode = String(req.body?.referralCode || '').trim();

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'يرجى إدخال اسم العرض (حرفان على الأقل)' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      return;
    }
    if (authCredentials.some((c) => c.email === email)) {
      res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل مسبقاً، يرجى تسجيل الدخول' });
      return;
    }

    const { user, referralResult } = createNewRegisteredUser({
      name,
      email,
      password,
      authProvider: 'email',
      referralCode,
    });

    const token = signToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastStateSync();
    res.status(201).json({
      ok: true,
      token,
      user: sanitizeUserForClient(user, user.id),
      isNewUser: true,
      referral: referralResult,
      state: sanitizeStateForClient(serverState, user.id),
    });
  });

  const normalizeLoginDigits = (value: string): string =>
    value
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

  app.post('/api/auth/login', authRateLimiter, (req, res) => {
    const rawIdentifier = String(req.body?.email || req.body?.identifier || '').trim();
    const identifier = normalizeLoginDigits(rawIdentifier);
    const password = String(req.body?.password || '');
    const email = normalizeEmail(identifier);
    const normalizedPhone = normalizePhone(identifier);

    if (!identifier || !password) {
      res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
      return;
    }

    const cred = authCredentials.find(
      (c) =>
        (c.email && c.email === email) ||
        c.userId === identifier ||
        (c.phone && normalizedPhone.length >= 9 && c.phone === normalizedPhone)
    );
    if (!cred) {
      res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      return;
    }
    if (!cred.passwordHash || !cred.passwordSalt) {
      if (cred.userId === PRIMARY_ADMIN_ID && isOwnerPasswordClaimRequired()) {
        res.status(403).json({
          error: 'يرجى تفعيل كلمة مرور المالك لأول مرة أولاً',
          code: 'OWNER_CLAIM_REQUIRED',
        });
        return;
      }
      res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      return;
    }
    if (!verifyPassword(password, cred.passwordHash, cred.passwordSalt)) {
      res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      return;
    }

    const user = serverState.users.find((u) => u.id === cred.userId);
    if (!user) {
      res.status(404).json({ error: 'الحساب غير موجود' });
      return;
    }
    if (user.isBanned && user.id !== PRIMARY_ADMIN_ID) {
      res.status(403).json({ error: 'تم إيقاف هذا الحساب من قبل الإدارة' });
      return;
    }

    const token = signToken(user.id, user.role);
    setSessionCookie(req, res, token);
    res.json({
      ok: true,
      token,
      user: sanitizeUserForClient(user, user.id),
      isNewUser: false,
      state: sanitizeStateForClient(serverState, user.id),
    });
  });

  app.post('/api/auth/phone/send-otp', otpRateLimiter, (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    if (!phone || phone.length < 9) {
      res.status(400).json({ error: 'يرجى إدخال رقم هاتف صحيح مع رمز الدولة (مثال: +9665...)' });
      return;
    }
    const code = String(crypto.randomInt(100000, 999999));
    pendingOtpStore.set(phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    });
    res.json({
      ok: true,
      phone,
      expiresInSec: 300,
      // Never leak preview OTP codes in production environments
      ...(isProd ? {} : { previewOtp: code }),
    });
  });

  app.post('/api/auth/phone/verify-otp', otpRateLimiter, (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();
    const displayName = String(req.body?.name || '').trim();
    const referralCode = String(req.body?.referralCode || '').trim();

    const record = pendingOtpStore.get(phone);
    if (!record) {
      res.status(400).json({ error: 'لم يتم إرسال رمز تحقق لهذا الرقم أو انتهت صلاحيته' });
      return;
    }
    if (record.expiresAt < Date.now()) {
      pendingOtpStore.delete(phone);
      res.status(400).json({ error: 'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد' });
      return;
    }
    const expectedBuf = Buffer.from(record.code);
    const providedBuf = Buffer.from(code);
    const matches =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);
    if (!matches) {
      record.attempts += 1;
      if (record.attempts >= 5) pendingOtpStore.delete(phone);
      res.status(401).json({ error: 'رمز التحقق غير صحيح' });
      return;
    }

    pendingOtpStore.delete(phone);

    const existingCred = authCredentials.find((c) => c.phone === phone);
    if (existingCred) {
      const user = serverState.users.find((u) => u.id === existingCred.userId);
      if (user) {
        if (user.isBanned && user.id !== PRIMARY_ADMIN_ID) {
          res.status(403).json({ error: 'تم إيقاف هذا الحساب من قبل الإدارة' });
          return;
        }
        recentOtpVerifiedUsers.set(user.id, Date.now() + 15 * 60 * 1000);
        const token = signToken(user.id, user.role);
        setSessionCookie(req, res, token);
        res.json({
          ok: true,
          token,
          user: sanitizeUserForClient(user, user.id),
          isNewUser: false,
          state: sanitizeStateForClient(serverState, user.id),
        });
        return;
      }
    }

    const fallbackName = displayName || `مستخدم ${phone.slice(-4)}`;
    const { user, referralResult } = createNewRegisteredUser({
      name: fallbackName,
      phone,
      authProvider: 'phone',
      referralCode,
    });
    const token = signToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastStateSync();
    res.status(201).json({
      ok: true,
      token,
      user: sanitizeUserForClient(user, user.id),
      isNewUser: true,
      referral: referralResult,
      state: sanitizeStateForClient(serverState, user.id),
    });
  });

  app.post('/api/auth/facebook', authRateLimiter, (req, res) => {
    const facebookId = String(req.body?.facebookId || '').trim();
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || '').trim();
    const avatar = getSafeImageUrl(req.body?.avatar) || undefined;
    const referralCode = String(req.body?.referralCode || '').trim();

    if (!facebookId && !email) {
      res.status(400).json({ error: 'بيانات حساب فيسبوك مطلوبة للمتابعة' });
      return;
    }

    // Strict RBAC & anti-takeover protection: never allow unverified route to claim owner or any existing account
    if (email && email === PRIMARY_ADMIN_EMAIL) {
      res.status(403).json({
        error: 'حساب المالك الأساسي محمي — يرجى تسجيل الدخول عبر كلمة المرور أو جلسة Supabase الموثّقة',
      });
      return;
    }

    const existingCred = authCredentials.find(
      (c) => (facebookId && c.facebookId === facebookId) || (email && c.email === email)
    );
    if (existingCred) {
      res.status(403).json({
        error:
          'هذا الحساب مسجل مسبقاً — لمنع اختطاف الحسابات يرجى تسجيل الدخول عبر كلمة المرور أو مصادقة Supabase الموثّقة',
        code: 'OAUTH_VERIFICATION_REQUIRED',
      });
      return;
    }

    const { user, referralResult } = createNewRegisteredUser({
      name: name || (email ? email.split('@')[0] : 'عضو فيسبوك'),
      email: email || undefined,
      facebookId: facebookId || `fb-${Date.now()}`,
      avatar,
      authProvider: 'facebook',
      referralCode,
    });
    const token = signToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastStateSync();
    res.status(201).json({
      ok: true,
      token,
      user: sanitizeUserForClient(user, user.id),
      isNewUser: true,
      referral: referralResult,
      state: sanitizeStateForClient(serverState, user.id),
    });
  });

  app.post('/api/auth/google', authRateLimiter, (req, res) => {
    const googleId = String(req.body?.googleId || '').trim();
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || '').trim();
    const avatar = getSafeImageUrl(req.body?.avatar) || undefined;
    const referralCode = String(req.body?.referralCode || '').trim();

    if (!googleId && !email) {
      res.status(400).json({ error: 'بيانات حساب جوجل مطلوبة للمتابعة المباشرة' });
      return;
    }

    // Strict RBAC & anti-takeover protection: never allow unverified route to claim owner or any existing account
    if (email && email === PRIMARY_ADMIN_EMAIL) {
      res.status(403).json({
        error: 'حساب المالك الأساسي محمي — يرجى تسجيل الدخول عبر كلمة المرور أو جلسة Supabase الموثّقة',
      });
      return;
    }

    const existingCred = authCredentials.find(
      (c) => (googleId && c.googleId === googleId) || (email && c.email === email)
    );
    if (existingCred) {
      res.status(403).json({
        error:
          'هذا الحساب مسجل مسبقاً — لمنع اختطاف الحسابات يرجى تسجيل الدخول عبر كلمة المرور أو مصادقة Supabase الموثّقة',
        code: 'OAUTH_VERIFICATION_REQUIRED',
      });
      return;
    }

    const { user, referralResult } = createNewRegisteredUser({
      name: name || (email ? email.split('@')[0] : 'عضو جوجل'),
      email: email || undefined,
      googleId: googleId || `google_${email || Date.now()}`,
      avatar,
      authProvider: 'google',
      referralCode,
    });
    const token = signToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastStateSync();
    res.status(201).json({
      ok: true,
      token,
      user: sanitizeUserForClient(user, user.id),
      isNewUser: true,
      referral: referralResult,
      state: sanitizeStateForClient(serverState, user.id),
    });
  });

  // Server-verified Supabase Auth synchronization: strictly validates Supabase JWT via /auth/v1/user
  app.post('/api/auth/supabase-sync', authRateLimiter, async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const accessToken = String(req.body?.accessToken || bearerToken || '').trim();
    const referralCode = String(req.body?.referralCode || '').trim();

    if (!accessToken) {
      res.status(401).json({
        error: 'مطلوب رمز جلسة Supabase الموثّق لإتمام المزامنة',
        code: 'SUPABASE_TOKEN_REQUIRED',
      });
      return;
    }

    const verifiedSb = await verifySupabaseAccessToken(accessToken);
    if (!verifiedSb) {
      res.status(401).json({
        error: 'فشل التحقق من جلسة Supabase — رمز الوصول غير صالح أو منتهي الصلاحية',
        code: 'SUPABASE_TOKEN_INVALID',
      });
      return;
    }

    const supabaseUid = verifiedSb.id;
    const email = verifiedSb.email || '';
    const phone = verifiedSb.phone || '';
    const name = verifiedSb.name || String(req.body?.name || '').trim();
    const avatar = verifiedSb.avatar || getSafeImageUrl(req.body?.avatar) || undefined;
    const provider = verifiedSb.provider;

    const existingCred = authCredentials.find(
      (c) =>
        c.supabaseUid === supabaseUid ||
        (email && c.email === email) ||
        (phone && c.phone === phone)
    );

    if (existingCred) {
      const user = serverState.users.find((u) => u.id === existingCred.userId);
      if (user) {
        if (user.isBanned && user.id !== PRIMARY_ADMIN_ID) {
          res.status(403).json({ error: 'تم إيقاف هذا الحساب من قبل الإدارة' });
          return;
        }
        existingCred.supabaseUid = supabaseUid;
        schedulePersistDatabase();
        const token = signToken(user.id, user.role);
        setSessionCookie(req, res, token);
        res.json({
          ok: true,
          token,
          user: sanitizeUserForClient(user, user.id),
          isNewUser: false,
          state: sanitizeStateForClient(serverState, user.id),
        });
        return;
      }
    }

    const resolvedProvider: 'email' | 'google' | 'facebook' | 'phone' | 'supabase' =
      provider === 'google' ||
      provider === 'facebook' ||
      provider === 'phone' ||
      provider === 'email'
        ? provider
        : 'supabase';

    const { user, referralResult } = createNewRegisteredUser({
      name: name || (email ? email.split('@')[0] : phone ? `عضو ${phone.slice(-4)}` : 'عضو رياض شات'),
      email: email || undefined,
      phone: phone || undefined,
      avatar,
      supabaseUid,
      authProvider: resolvedProvider,
      referralCode,
    });

    const token = signToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastStateSync();
    res.status(201).json({
      ok: true,
      token,
      user: sanitizeUserForClient(user, user.id),
      isNewUser: true,
      referral: referralResult,
      state: sanitizeStateForClient(serverState, user.id),
    });
  });

  // Strict Primary Admin (ID 900) account switch endpoint
  app.post('/api/auth/session', requireAuth, requireOwner, (req: AuthedRequest, res) => {
    const userId = String(req.body?.userId || '').trim();
    const user = serverState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const token = signToken(user.id, user.role);
    setSessionCookie(req, res, token);
    res.json({ token, user: sanitizeUserForClient(user, user.id) });
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

  // ============================================================================
  // AGENCY 2FA (SMS / EMAIL OTP · 30-MINUTE VERIFIED WINDOW FOR AGENTS & OWNER 900)
  // ============================================================================
  const agency2faRateLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 12,
    keyFn: (req) => `agency2fa:${(req as AuthedRequest).authUser?.id || 'anon'}`,
    message: 'تم تجاوز عدد محاولات رمز المصادقة الثنائية — يرجى الانتظار قليلاً',
  });

  app.get('/api/agency/2fa/status', requireAuth, requireApprovedAgent, (req: AuthedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const me = req.authUser!;
    const active = agency2faManager.getActiveSession(req, me.id);
    const cred = authCredentials.find((c) => c.userId === me.id);
    const rawEmail = normalizeEmail(me.email || cred?.email || '');
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : '';
    const rawPhone = normalizePhone(me.phone || cred?.phone || '');
    const phone = rawPhone.replace(/\D/g, '').length >= 8 ? rawPhone : '';
    const remainingSec = active ? Math.max(0, Math.floor((active.exp - Date.now()) / 1000)) : 0;

    res.json({
      ok: true,
      verified: Boolean(active),
      expiresAt: active?.exp || null,
      remainingSec,
      channel: active?.channel || null,
      maskedEmail: maskEmail(email),
      maskedPhone: maskPhone(phone),
      hasEmail: Boolean(email),
      hasPhone: Boolean(phone),
      smsConfigured: isSmsDeliveryConfigured(),
      emailConfigured: isEmailDeliveryConfigured(),
      sessionDurationMin: Math.floor(AGENCY_2FA_SESSION_MS / 60000),
    });
  });

  app.post(
    '/api/agency/2fa/request',
    requireAuth,
    requireApprovedAgent,
    agency2faRateLimiter,
    async (req: AuthedRequest, res) => {
      const me = req.authUser!;
      const channel: Agency2FAChannel = req.body?.channel === 'sms' ? 'sms' : 'email';
      const cred = authCredentials.find((c) => c.userId === me.id);
      const rawDest = String(req.body?.destination || '').trim();

      let destination = '';
      if (channel === 'email') {
        const candidate = rawDest ? normalizeEmail(rawDest) : normalizeEmail(me.email || cred?.email);
        if (!candidate || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
          res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح لاستلام رمز التحقق' });
          return;
        }
        destination = candidate;
      } else {
        const candidate = rawDest ? normalizePhone(rawDest) : normalizePhone(me.phone || cred?.phone);
        if (!candidate || candidate.replace(/\D/g, '').length < 8) {
          res.status(400).json({ error: 'يرجى إدخال رقم هاتف صحيح مع رمز الدولة لاستلام رسالة SMS' });
          return;
        }
        destination = candidate;
      }

      const created = agency2faManager.createChallenge(me.id, channel, destination);
      if (!created.ok || !created.code || !created.challenge) {
        res.status(429).json({
          error: `يرجى الانتظار ${created.retryAfterSec || 60} ثانية قبل طلب رمز جديد`,
          code: 'OTP_COOLDOWN',
          retryAfterSec: created.retryAfterSec || 60,
        });
        return;
      }

      const dispatch = await dispatchAgencyOtp({
        channel,
        destination,
        code: created.code,
        userName: me.name,
        isProd,
      });

      if (!dispatch.ok) {
        res.status(503).json({
          error: dispatch.error || 'تعذر إرسال رمز التحقق الثنائي حالياً',
          deliveryMode: dispatch.deliveryMode,
        });
        return;
      }

      res.json({
        ok: true,
        channel,
        maskedDestination: created.challenge.maskedDestination,
        expiresInSec: 300,
        resendAfterSec: 60,
        deliveryMode: dispatch.deliveryMode,
        ...(dispatch.previewOtp && !isProd ? { previewOtp: dispatch.previewOtp } : {}),
      });
    }
  );

  app.post(
    '/api/agency/2fa/verify',
    requireAuth,
    requireApprovedAgent,
    agency2faRateLimiter,
    (req: AuthedRequest, res) => {
      const me = req.authUser!;
      const submittedCode = String(req.body?.code || '');
      const check = agency2faManager.verifyChallenge(me.id, submittedCode);
      if (!check.ok || !check.channel) {
        res.status(400).json({ error: check.error || 'رمز التحقق غير صالح', code: 'AGENCY_2FA_INVALID' });
        return;
      }

      // Bind newly verified contact channel if user profile lacked one
      if (check.destination) {
        const cred = authCredentials.find((c) => c.userId === me.id);
        if (check.channel === 'email' && !me.email) {
          me.email = check.destination;
          if (cred && !cred.email) cred.email = check.destination;
          schedulePersistDatabase();
        } else if (check.channel === 'sms' && !me.phone) {
          me.phone = check.destination;
          if (cred && !cred.phone) cred.phone = check.destination;
          schedulePersistDatabase();
        }
      }

      const issued = agency2faManager.signToken(me.id, check.channel);
      agency2faManager.setCookie(req, res, issued.token);
      res.json({
        ok: true,
        verified: true,
        channel: check.channel,
        expiresAt: issued.expiresAt,
        remainingSec: Math.floor(AGENCY_2FA_SESSION_MS / 1000),
        token: issued.token,
        agency2faToken: issued.token,
      });
    }
  );

  app.post('/api/agency/2fa/lock', requireAuth, requireApprovedAgent, (req: AuthedRequest, res) => {
    agency2faManager.revokeFromRequest(req, res);
    res.json({ ok: true, verified: false });
  });

  app.post(
    '/api/agency/transfer',
    requireAuth,
    requireApprovedAgent,
    requireAgency2FA,
    (req: AuthedRequest, res) => {
    handleIdempotent(req, res, () => {
      const recipientId = String(req.body?.recipientId || '').trim();
      const baseGold = Math.floor(Number(req.body?.baseGold) || 0);
      const agent = req.authUser!;
      const target = stateIndexManager.usersById.get(recipientId) || serverState.users.find((u) => u.id === recipientId);

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
  }
  );

  app.post(
    '/api/agency/wholesale',
    requireAuth,
    requireApprovedAgent,
    requireAgency2FA,
    (req: AuthedRequest, res) => {
    handleIdempotent(req, res, () => {
      const gold = Math.floor(Number(req.body?.gold) || 0);
      if (gold <= 0) return { status: 400, body: { error: 'Invalid amount' } };
      req.authUser!.gold += gold;
      broadcastStateSync();
      return { status: 200, body: { ok: true, state: serverState } };
    });
  }
  );

  app.post(
    '/api/agency/invite',
    requireAuth,
    requireApprovedAgent,
    requireAgency2FA,
    (req: AuthedRequest, res) => {
    serverState.agentInviteCount += 1;
    req.authUser!.gold += 1_000_000;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  }
  );

  const handleAgencyRequestSubmission = (req: AuthedRequest, res: Response) => {
    const me = req.authUser!;
    if (me.id === PRIMARY_ADMIN_ID || me.isVerifiedAgent) {
      res.status(400).json({ error: 'حسابك معتمد بالفعل كوكالة شحن' });
      return;
    }

    const title = String(req.body?.agencyTitle || '').trim();
    const contactNote = String(req.body?.contactNote || '').trim().slice(0, 180);
    if (title.length < 3) {
      res.status(400).json({ error: 'يرجى إدخال اسم الوكالة المطلوب (3 أحرف على الأقل)' });
      return;
    }

    const existingPending = serverState.agencyRequests.find(
      (r) => r.userId === me.id && r.status === 'pending'
    );
    if (existingPending) {
      res.status(409).json({
        error: 'لديك طلب فتح وكالة قيد المراجعة بالفعل من قِبل المالك (ID: 900)',
        request: existingPending,
        state: serverState,
      });
      return;
    }

    const newReq: AgencyApplicationRequest = {
      id: `agreq-${Date.now().toString().slice(-6)}`,
      userId: me.id,
      userName: me.name,
      userAvatar: me.avatar,
      agencyTitle: title.slice(0, 60),
      contactNote: contactNote || undefined,
      status: 'pending',
      createdAt: new Date().toLocaleString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      }),
    };

    serverState.agencyRequests = [newReq, ...serverState.agencyRequests].slice(0, 100);
    broadcastStateSync();
    res.status(201).json({ ok: true, request: newReq, state: serverState });
  };

  app.post('/api/agency/request', requireAuth, handleAgencyRequestSubmission);
  app.post('/api/agency/register', requireAuth, handleAgencyRequestSubmission);

  app.post('/api/agency/requests/:id/approve', requireAuth, requireOwner, (req: AuthedRequest, res) => {
    const reqId = String(req.params.id || '');
    const record = serverState.agencyRequests.find((r) => r.id === reqId);
    if (!record) {
      res.status(404).json({ error: 'طلب الوكالة غير موجود' });
      return;
    }
    const targetUser = serverState.users.find((u) => u.id === record.userId);
    if (!targetUser) {
      res.status(404).json({ error: 'حساب مقدم الطلب غير موجود' });
      return;
    }

    record.status = 'approved';
    record.reviewedAt = 'الآن';
    record.reviewedBy = req.authUser!.id;

    targetUser.isVerifiedAgent = true;
    if (targetUser.id !== PRIMARY_ADMIN_ID) {
      targetUser.role = 'AGENCY_AGENT';
    }
    targetUser.title = record.agencyTitle;

    broadcastStateSync();
    res.json({ ok: true, request: record, user: targetUser, state: serverState });
  });

  app.post('/api/agency/requests/:id/reject', requireAuth, requireOwner, (req: AuthedRequest, res) => {
    const reqId = String(req.params.id || '');
    const record = serverState.agencyRequests.find((r) => r.id === reqId);
    if (!record) {
      res.status(404).json({ error: 'طلب الوكالة غير موجود' });
      return;
    }

    record.status = 'rejected';
    record.reviewedAt = 'الآن';
    record.reviewedBy = req.authUser!.id;

    broadcastStateSync();
    res.json({ ok: true, request: record, state: serverState });
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

    const occupiedBefore = room.seats.filter((s) => Boolean(s.userId)).length;

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

      const shouldAutoGoLive =
        !room.isLive && (occupiedBefore === 0 || me.id === room.ownerId || me.role === 'OWNER');
      if (shouldAutoGoLive) {
        room.isLive = true;
        room.liveStartedAt = Date.now();
        triggerRoomLiveNotifications({
          room,
          hostId: me.id,
          hostName: me.name,
          explicit: false,
        });
      }
    }

    const occupiedAfter = room.seats.filter((s) => Boolean(s.userId)).length;
    if (occupiedAfter === 0) {
      room.isLive = false;
    }

    broadcastStateSync();
    recordRoomTelemetry(room.id, { interaction: 12, voice: isSteppingDown ? 4 : 18 }, true);
    res.json({ ok: true, room, state: serverState });
  });

  app.post('/api/rooms/:id/verify-password', requireAuth, roomPasswordRateLimiter, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'الغرفة غير موجودة' });
      return;
    }
    const me = req.authUser!;
    if (me.role === 'OWNER' || room.ownerId === me.id) {
      res.json({ ok: true });
      return;
    }
    const record = roomPasswordHashes[room.id];
    if (!record) {
      res.json({ ok: true });
      return;
    }
    const attempt = String(req.body?.password || '').trim();
    if (!attempt || !verifyPassword(attempt, record.hash, record.salt)) {
      res.status(403).json({ error: 'كلمة مرور الغرفة غير صحيحة', code: 'ROOM_PASSWORD_INVALID' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/rooms/:id/mute', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    const seatNumber = Number(req.body?.seatNumber);
    const me = req.authUser!;
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const seat = room.seats.find((s) => s.seatNumber === seatNumber);
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' });
      return;
    }
    const canMute =
      seat.userId === me.id ||
      me.role === 'OWNER' ||
      me.role === 'SUPERVISOR' ||
      room.ownerId === me.id;
    if (!canMute) {
      res.status(403).json({
        error: 'RBAC_FORBIDDEN: يمكنك كتم المايك الخاص بك فقط أو بصلاحية صاحب الغرفة/المشرف',
        code: 'RBAC_FORBIDDEN',
      });
      return;
    }
    seat.isMuted = !seat.isMuted;
    seat.isSpeaking = !seat.isMuted;
    broadcastStateSync();
    recordRoomTelemetry(room.id, { interaction: 8, voice: seat.isMuted ? 2 : 14 }, true);
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
    recordRoomTelemetry(room.id, { interaction: 18, voice: 4 }, true);
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
    recordRoomTelemetry(room.id, { interaction: 24, voice: 6, heatGames: 28 }, true);
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
      id: `room-${Date.now().toString().slice(-5)}-${crypto.randomBytes(2).toString('hex')}`,
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
      isLive: true,
      liveStartedAt: Date.now(),
      followersCount: 0,
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
    triggerRoomLiveNotifications({
      room: newRoom,
      hostId: me.id,
      hostName: me.name,
      topic: description,
      explicit: false,
    });
    broadcastStateSync();
    res.json({ ok: true, room: newRoom, state: serverState });
  });

  // ============================================================================
  // IN-APP LIVE BROADCAST NOTIFICATIONS & ROOM FOLLOW ROUTES
  // ============================================================================
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const me = req.authUser!;
    const snapshot = liveNotificationManager.getUserSnapshot(me.id);
    res.json({ ok: true, ...snapshot });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const notifId = String(req.params.id || '').trim();
    if (!notifId) {
      res.status(400).json({ error: 'معرّف الإشعار مطلوب' });
      return;
    }
    liveNotificationManager.markRead(me.id, notifId);
    schedulePersistDatabase();
    res.json({
      ok: true,
      unreadCount: liveNotificationManager.getUnreadCount(me.id),
    });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const marked = liveNotificationManager.markAllRead(me.id);
    schedulePersistDatabase();
    res.json({ ok: true, marked, unreadCount: 0 });
  });

  app.delete('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    liveNotificationManager.clearAll(me.id);
    schedulePersistDatabase();
    res.json({ ok: true, unreadCount: 0 });
  });

  app.patch('/api/notifications/preferences', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const preferences = liveNotificationManager.updatePreferences(me.id, {
      followedRoomsLive:
        typeof req.body?.followedRoomsLive === 'boolean' ? req.body.followedRoomsLive : undefined,
      popularRoomsLive:
        typeof req.body?.popularRoomsLive === 'boolean' ? req.body.popularRoomsLive : undefined,
      soundEnabled:
        typeof req.body?.soundEnabled === 'boolean' ? req.body.soundEnabled : undefined,
    });
    schedulePersistDatabase();
    res.json({ ok: true, preferences });
  });

  app.post('/api/rooms/:id/follow', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const roomId = String(req.params.id || '').trim();
    const room = stateIndexManager.roomsById.get(roomId) || serverState.rooms.find((r) => r.id === roomId);
    if (!room) {
      res.status(404).json({ error: 'الغرفة غير موجودة' });
      return;
    }
    const result = liveNotificationManager.toggleFollowRoom(me.id, room.id);
    room.followersCount = result.roomFollowersCount;
    broadcastStateSync();
    res.json({
      ok: true,
      roomId: room.id,
      following: result.following,
      followedRoomIds: result.followedRoomIds,
      roomFollowersCount: result.roomFollowersCount,
    });
  });

  app.post('/api/rooms/:id/live/start', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const roomId = String(req.params.id || '').trim();
    const room = stateIndexManager.roomsById.get(roomId) || serverState.rooms.find((r) => r.id === roomId);
    if (!room) {
      res.status(404).json({ error: 'الغرفة غير موجودة' });
      return;
    }
    const isSeatedHost = room.seats.some((s) => s.userId === me.id);
    if (room.ownerId !== me.id && me.role !== 'OWNER' && !isSeatedHost) {
      res.status(403).json({
        error: 'بدء البث المباشر وإرسال الإشعارات متاح لصاحب الغرفة أو المتحدثين على المايك فقط',
      });
      return;
    }

    const topic = String(req.body?.topic || '').trim().slice(0, 90);
    room.isLive = true;
    room.liveStartedAt = Date.now();
    if (topic) {
      room.liveTitle = topic;
    }
    room.messages = [
      ...room.messages.slice(-59),
      {
        id: `msg-live-${Date.now()}`,
        senderId: me.id,
        senderName: me.name,
        senderLevel: me.level,
        text: topic
          ? `🔴 بدأ البث المباشر الآن: ${topic}`
          : `🔴 بدأ ${me.name} البث المباشر الآن في الغرفة — أهلاً بالمتابعين والضيوف!`,
        type: 'system',
        timestamp: 'الآن',
      },
    ];

    const outcome = triggerRoomLiveNotifications({
      room,
      hostId: me.id,
      hostName: me.name,
      topic: topic || room.liveTitle,
      explicit: true,
    });

    broadcastStateSync();
    recordRoomTelemetry(room.id, { interaction: 25, voice: 20 }, true);
    res.json({
      ok: true,
      room,
      notifiedCount: outcome.dispatched.size,
      isPopular: outcome.isPopular,
      throttled: outcome.throttled,
      state: serverState,
    });
  });

  app.post('/api/rooms/:id/live/stop', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const roomId = String(req.params.id || '').trim();
    const room = stateIndexManager.roomsById.get(roomId) || serverState.rooms.find((r) => r.id === roomId);
    if (!room) {
      res.status(404).json({ error: 'الغرفة غير موجودة' });
      return;
    }
    if (room.ownerId !== me.id && me.role !== 'OWNER') {
      res.status(403).json({ error: 'إنهاء البث المباشر متاح لصاحب الغرفة أو المالك فقط' });
      return;
    }
    room.isLive = false;
    broadcastStateSync();
    res.json({ ok: true, room, state: serverState });
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
      const safeCover = getSafeImageUrl(body.coverImage);
      if (safeCover) {
        room.coverImage = safeCover;
        room.ownerAvatar = safeCover;
      }
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
      delete room.password;
      if (cleanPass) {
        roomPasswordHashes[room.id] = hashPassword(cleanPass);
        room.hasPassword = true;
        room.isLocked = true;
      } else {
        delete roomPasswordHashes[room.id];
        room.hasPassword = false;
        room.isLocked = false;
      }
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
    const safeCheck = assertSafeDeleteCondition({ targetId: req.params.id, entityType: 'الغرفة' });
    if (!safeCheck.ok) {
      res.status(400).json({ error: safeCheck.error, code: 'UNSAFE_DELETE_BLOCKED' });
      return;
    }
    const room =
      stateIndexManager.roomsById.get(req.params.id) ||
      serverState.rooms.find((r) => r.id === req.params.id);
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
    // Create automatic pre-archive PITR snapshot + Soft-Delete (Archive) instead of hard deletion
    try {
      dataProtectionManager.createSnapshot({
        kind: 'pitr',
        reason: `archive-room-${room.id}`,
        payloadObject: buildCurrentBackupPayload(),
      });
    } catch {
      // Proceed even if disk snapshot cannot be written
    }
    governanceState.archivedRooms = [
      {
        archivedAt: new Date().toISOString(),
        archivedBy: me.id,
        reason: 'أرشفة بديلة للحذف (قابلة للاستعادة)',
        room: JSON.parse(JSON.stringify(room)) as Record<string, unknown>,
      },
      ...governanceState.archivedRooms.filter((e) => (e.room as { id?: string }).id !== room.id),
    ].slice(0, 50);

    serverState.rooms = serverState.rooms.filter((r) => r.id !== room.id);
    delete roomPasswordHashes[room.id];
    broadcastStateSync();
    res.json({ ok: true, archived: true, state: serverState });
  });

  app.post('/api/rooms/:id/clear', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const me = req.authUser!;
    const canManage = me.role === 'OWNER' || me.role === 'SUPERVISOR' || room.ownerId === me.id;
    if (!canManage) {
      res.status(403).json({
        error: 'RBAC_FORBIDDEN: مسح دردشة الغرفة مخصص لصاحب الغرفة أو المشرفين فقط',
        code: 'RBAC_FORBIDDEN',
      });
      return;
    }
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

  app.post('/api/tasks/:id/progress', requireAuth, (req: AuthedRequest, res) => {
    const task = serverState.tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    task.progress = task.target;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
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
    applyServerXpGain(req.authUser!, nextDay * 40);
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/games/bet', requireAuth, (req: AuthedRequest, res) => {
    const amount = Math.floor(Number(req.body?.amount) || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Invalid bet amount' });
      return;
    }
    const me = req.authUser!;
    const xpGain = Math.min(250, Math.max(8, Math.floor(amount / 15_000)));
    applyServerXpGain(me, xpGain);
    serverState.jackpotProgress = Math.min(JACKPOT_TARGET, serverState.jackpotProgress + amount);
    serverState.dailyStakedGold += amount;
    const task3 = serverState.tasks.find((t) => t.id === 'task-3');
    if (task3) task3.progress = task3.target;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/games/payout', requireAuth, (req: AuthedRequest, res) => {
    const deltaGold = Math.floor(Number(req.body?.deltaGold) || 0);
    const deltaDiamonds = Number(req.body?.deltaDiamonds) || 0;
    if (!Number.isFinite(deltaGold) || !Number.isFinite(deltaDiamonds)) {
      res.status(400).json({ error: 'Invalid delta values' });
      return;
    }
    const me = req.authUser!;
    me.gold = Math.max(0, me.gold + deltaGold);
    me.diamonds = Math.max(0, Number((me.diamonds + deltaDiamonds).toFixed(2)));
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/user/follow', requireAuth, (req: AuthedRequest, res) => {
    const targetUserId = String(req.body?.targetUserId || '');
    const following = Boolean(req.body?.following);
    const me = req.authUser!;
    const target = serverState.users.find((u) => u.id === targetUserId);
    if (!target || target.id === me.id) {
      res.status(400).json({ error: 'Invalid follow target' });
      return;
    }
    const delta = following ? 1 : -1;
    target.followers = Math.max(0, (target.followers || 0) + delta);
    me.following = Math.max(0, (me.following || 0) + delta);
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/user/entry', requireAuth, (req: AuthedRequest, res) => {
    const entry = String(req.body?.entry || '').trim();
    if (!entry) {
      res.status(400).json({ error: 'Entry name required' });
      return;
    }
    const me = req.authUser!;
    if (!me.ownedEntries.includes(entry)) {
      me.ownedEntries.push(entry);
    }
    me.activeEntry = entry;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/user/aristocrat', requireAuth, (req: AuthedRequest, res) => {
    const tierName = String(req.body?.tierName || '').trim();
    const costGold = Math.max(0, Math.floor(Number(req.body?.costGold) || 0));
    const me = req.authUser!;
    if (!tierName || me.gold < costGold) {
      res.status(400).json({ error: 'Invalid aristocrat tier or insufficient gold' });
      return;
    }
    me.gold -= costGold;
    me.aristocratTier = tierName;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  app.post('/api/user/svip', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    if (me.svip >= 7) {
      res.status(400).json({ error: 'Already at max SVIP 7' });
      return;
    }
    const cost = (me.svip + 1) * 50_000_000;
    if (me.gold < cost) {
      res.status(400).json({ error: 'Insufficient gold for SVIP upgrade' });
      return;
    }
    me.gold -= cost;
    me.svip += 1;
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  // Programmatic bridge: announce Lucky Game wins directly inside active voice room & boost heat
  app.post('/api/rooms/:id/game-win', requireAuth, (req: AuthedRequest, res) => {
    const room = serverState.rooms.find((r) => r.id === req.params.id);
    const gameName = String(req.body?.gameName || 'ألعاب الحظ').trim();
    const icon = String(req.body?.icon || '🎰').trim();
    const payout = Math.max(0, Math.floor(Number(req.body?.payout) || 0));
    const me = req.authUser!;
    if (!room || payout <= 0) {
      res.status(400).json({ error: 'Invalid room or payout' });
      return;
    }
    const heatBoost = Math.min(500_000, Math.max(10_000, Math.floor(payout * 0.25)));
    room.heat += heatBoost;
    room.wealthBadge = computeWealthBadge(room.heat) || room.wealthBadge;
    room.messages = [
      ...room.messages.slice(-30),
      {
        id: `gwin-${Date.now()}`,
        senderId: me.id,
        senderName: me.name,
        senderLevel: me.level,
        text: `${icon} فاز ${me.name} بـ +${payout.toLocaleString('en-US')} ذهبية في ${gameName}! (+${heatBoost.toLocaleString('en-US')} حرارة للغرفة)`,
        type: 'achievement',
        timestamp: 'الآن',
      },
    ];
    broadcastStateSync();
    recordRoomTelemetry(room.id, { interaction: 16, heatGames: 32 }, true);
    res.json({ ok: true, heatBoost, state: serverState });
  });

  // Friend Invite Links & Deep-Linking API
  app.get('/api/invites', (_req, res) => {
    res.json({ ok: true, invites: serverState.invites });
  });

  app.get('/api/invites/resolve/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const { referrer, invite } = findReferrerByCode(code);
    if (!referrer) {
      res.status(404).json({ ok: false, error: 'كود الدعوة غير موجود' });
      return;
    }
    res.json({
      ok: true,
      code: invite?.code || referrer.referralCode || code,
      inviterId: referrer.id,
      inviterName: referrer.name,
      inviterAvatar: referrer.avatar,
      roomId: invite?.roomId || null,
      roomTitle: invite?.roomTitle || null,
      welcomeGold: 500_000,
      referrerRewardGold: invite?.rewardGold || 1_000_000,
    });
  });

  app.post('/api/invites/create', requireAuth, (req: AuthedRequest, res) => {
    const me = req.authUser!;
    const roomId = req.body?.roomId ? String(req.body.roomId) : undefined;
    const room = roomId ? serverState.rooms.find((r) => r.id === roomId) : undefined;
    const code = `RC-${me.id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const invite: InviteLinkRecord = {
      code,
      inviterId: me.id,
      inviterName: me.name,
      roomId: room?.id,
      roomTitle: room?.title,
      uses: 0,
      rewardGold: 1_000_000,
      createdAt: 'الآن',
    };
    serverState.invites = [invite, ...serverState.invites].slice(0, 80);
    broadcastStateSync();
    res.json({
      ok: true,
      invite,
      publicUrl: room
        ? `https://riadchat.vercel.app/?invite=${code}&room=${room.id}`
        : `https://riadchat.vercel.app/?invite=${code}`,
      nativeDeepLink: room
        ? `riyadhchat://invite/${code}?room=${room.id}`
        : `riyadhchat://invite/${code}`,
      state: serverState,
    });
  });

  app.post('/api/invites/:code/redeem', requireAuth, (req: AuthedRequest, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const me = req.authUser!;
    const { referrer, invite } = findReferrerByCode(code);
    if (!referrer) {
      res.status(404).json({ error: 'Invite code not found' });
      return;
    }
    if (referrer.id === me.id) {
      res.status(400).json({ error: 'لا يمكنك استخدام كود الدعوة الخاص بك' });
      return;
    }
    if (me.referredBy) {
      res.status(409).json({ error: 'تم ربط حسابك بكود إحالة مسبقاً' });
      return;
    }
    const result = applyReferralOnRegistration(me, code);
    broadcastStateSync();
    res.json({
      ok: true,
      invite,
      referrerName: referrer.name,
      targetRoomId: result.targetRoomId || invite?.roomId || null,
      welcomeGold: result.welcomeGold,
      referrerRewardGold: result.referrerRewardGold,
      state: serverState,
    });
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
    serverState.rooms.forEach((r) => {
      recordRoomTelemetry(r.id, { interaction: 10, heatGames: 25 }, true);
    });
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
    recordRoomTelemetry(room.id, { interaction: 12, heatGames: 30 }, true);
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

  app.delete('/api/system/moderators/:id', requireAuth, requireOwner, (req: AuthedRequest, res) => {
    const safeCheck = assertSafeDeleteCondition({ targetId: req.params.id, entityType: 'المشرف' });
    if (!safeCheck.ok) {
      res.status(400).json({ error: safeCheck.error, code: 'UNSAFE_DELETE_BLOCKED' });
      return;
    }
    const targetMod = serverState.moderators.find((m) => m.id === req.params.id);
    if (!targetMod) {
      res.status(404).json({ error: 'Moderator not found' });
      return;
    }
    governanceState.archivedModerators = [
      {
        archivedAt: new Date().toISOString(),
        archivedBy: req.authUser!.id,
        reason: 'أرشفة مشرف بدل الحذف النهائي',
        moderator: JSON.parse(JSON.stringify(targetMod)) as Record<string, unknown>,
      },
      ...governanceState.archivedModerators.filter(
        (e) => (e.moderator as { id?: string }).id !== targetMod.id
      ),
    ].slice(0, 50);

    serverState.moderators = serverState.moderators.filter((m) => m.id !== req.params.id);
    broadcastStateSync();
    res.json({ ok: true, archived: true, state: serverState });
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
    if (target.id === PRIMARY_ADMIN_ID) {
      target.isVerifiedAgent = true;
    } else {
      target.isVerifiedAgent = !target.isVerifiedAgent;
      target.role = target.isVerifiedAgent ? 'AGENCY_AGENT' : 'USER';
    }
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
    const preservedOwnerCred = authCredentials.find((c) => c.userId === PRIMARY_ADMIN_ID);
    serverState = createDefaultState();
    roomPasswordHashes = {};
    authCredentials = buildDefaultCredentials(serverState.users);
    if (!ENV_PRIMARY_ADMIN_PASSWORD && preservedOwnerCred?.passwordHash && preservedOwnerCred?.passwordSalt) {
      const nextOwnerCred = authCredentials.find((c) => c.userId === PRIMARY_ADMIN_ID);
      if (nextOwnerCred) {
        nextOwnerCred.passwordHash = preservedOwnerCred.passwordHash;
        nextOwnerCred.passwordSalt = preservedOwnerCred.passwordSalt;
      }
    }
    nextUserNumericId = 1001;
    idempotencyCache.clear();
    schedulePersistDatabase();
    broadcastStateSync();
    res.json({ ok: true, state: serverState });
  });

  // ============================================================================
  // INDEXED & PAGINATED DATA ENDPOINTS (O(1) INDEXES + PAGE-BY-PAGE QUERIES)
  // ============================================================================
  app.get('/api/rooms', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const filtered = serverState.rooms.filter((r) => {
      if (category && category !== 'الكل' && r.category !== category) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false;
      return true;
    });
    const paginated = paginateItems(
      filtered.map((r) => sanitizeRoomForClient(r)),
      req.query.page,
      req.query.limit
    );
    res.json({ ok: true, ...paginated });
  });

  app.get('/api/rooms/:id/messages', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    const room = stateIndexManager.roomsById.get(req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const ordered = [...room.messages].reverse();
    const paginated = paginateItems(ordered, req.query.page, req.query.limit || 25);
    res.json({ ok: true, roomId: room.id, ...paginated });
  });

  app.get('/api/users', requireAuth, (req: AuthedRequest, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    const viewerId = req.authUser!.id;
    const q = String(req.query.q || '').trim().toLowerCase();
    const filtered = serverState.users.filter((u) => {
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
    });
    const paginated = paginateItems(
      filtered.map((u) => sanitizeUserForClient(u, viewerId)),
      req.query.page,
      req.query.limit
    );
    res.json({ ok: true, ...paginated });
  });

  app.get('/api/transfers', requireAuth, requireApprovedAgent, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    const paginated = paginateItems(serverState.transfers, req.query.page, req.query.limit);
    res.json({ ok: true, ...paginated });
  });

  // ============================================================================
  // OWNER (ID: 900) DATA PROTECTION, MIGRATIONS, MONITORING & STRESS TEST OPS
  // ============================================================================
  const uptimeMonitor = new UptimeHealthMonitor(() => ({
    wsClients: wss.clients.size,
    activeRequests: trafficSurgeProtector.getStats().activeRequests,
    ownerIntact: Boolean(stateIndexManager.usersById.get(PRIMARY_ADMIN_ID)),
    alertWebhookUrl: governanceState.alertWebhookUrl,
  }));
  uptimeMonitor.start();

  // Automated daily encrypted backup (30-day retention) + periodic restore drill scheduler
  const ensureDailyBackupAndMonthlyDrill = () => {
    try {
      const daily = dataProtectionManager.ensureDailyBackup(buildCurrentBackupPayload());
      const lastDrillTs = governanceState.lastRestoreDrill
        ? Date.parse(governanceState.lastRestoreDrill.ranAt)
        : 0;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (!lastDrillTs || Number.isNaN(lastDrillTs) || Date.now() - lastDrillTs >= thirtyDaysMs) {
        governanceState.lastRestoreDrill = dataProtectionManager.runRestoreDrill(daily.id);
        schedulePersistDatabase();
      }
    } catch (err) {
      console.error('[DataProtection] Scheduled backup/drill error:', err);
    }
  };
  ensureDailyBackupAndMonthlyDrill();
  const dailyBackupInterval = setInterval(ensureDailyBackupAndMonthlyDrill, 6 * 60 * 60 * 1000);
  dailyBackupInterval.unref();

  app.get('/api/ops/overview', requireAuth, requireOwner, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const backups = dataProtectionManager.listBackups();
    const migrations = DATABASE_MIGRATIONS.map((m) => {
      const applied = governanceState.appliedMigrations.find((a) => a.id === m.id) || null;
      const lastDryRun = governanceState.lastDryRuns[m.id] || null;
      return {
        id: m.id,
        filename: m.filename,
        titleAr: m.titleAr,
        descriptionAr: m.descriptionAr,
        createdAt: m.createdAt,
        applied,
        lastDryRun,
      };
    });
    res.json({
      ok: true,
      retentionDays: DAILY_BACKUP_RETENTION_DAYS,
      dbEncryptedAtRest: Boolean(DB_ENCRYPTION_KEY),
      readOnlyAutomationMode: governanceState.readOnlyAutomationMode,
      alertWebhookConfigured: Boolean(governanceState.alertWebhookUrl),
      backupWebhookConfigured: Boolean(governanceState.backupWebhookUrl),
      lastOffsitePushAt: governanceState.lastOffsitePushAt,
      backups,
      lastRestoreDrill: governanceState.lastRestoreDrill,
      migrations,
      archivedRooms: governanceState.archivedRooms.map((e) => ({
        archivedAt: e.archivedAt,
        archivedBy: e.archivedBy,
        reason: e.reason,
        roomId: String((e.room as { id?: string }).id || ''),
        roomTitle: String((e.room as { title?: string }).title || 'غرفة مؤرشفة'),
        ownerName: String((e.room as { ownerName?: string }).ownerName || ''),
      })),
      archivedModerators: governanceState.archivedModerators.map((e) => ({
        archivedAt: e.archivedAt,
        archivedBy: e.archivedBy,
        reason: e.reason,
        moderatorId: String((e.moderator as { id?: string }).id || ''),
        name: String((e.moderator as { name?: string }).name || ''),
        role: String((e.moderator as { role?: string }).role || ''),
      })),
      monitor: uptimeMonitor.getOverview(),
      traffic: trafficSurgeProtector.getStats(),
      indexes: stateIndexManager.getStats(),
      writePool: writeBatchPool.getStats(),
      lastStressTest: lastStressTestReport,
    });
  });

  app.post('/api/ops/backups/create', requireAuth, requireOwner, (req, res) => {
    const reason = String(req.body?.reason || 'manual-owner-backup').slice(0, 40);
    const kind = req.body?.kind === 'daily' ? 'daily' : 'manual';
    writeBatchPool.flushNow();
    const meta = dataProtectionManager.createSnapshot({
      kind,
      reason,
      payloadObject: buildCurrentBackupPayload(),
    });
    res.json({ ok: true, backup: meta, backups: dataProtectionManager.listBackups() });
  });

  app.get('/api/ops/backups/export', requireAuth, requireOwner, (req, res) => {
    const requestedId = String(req.query.backupId || '').trim();
    const backups = dataProtectionManager.listBackups();
    let targetId = requestedId || backups[0]?.id;
    if (!targetId) {
      const created = dataProtectionManager.createSnapshot({
        kind: 'manual',
        reason: 'offsite-export',
        payloadObject: buildCurrentBackupPayload(),
      });
      targetId = created.id;
    }
    const found = dataProtectionManager.readBackupRawEnvelope(targetId);
    if (!found) {
      res.status(404).json({ error: 'النسخة الاحتياطية المطلوبة غير موجودة' });
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${found.meta.filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(found.rawEnvelope);
  });

  app.post('/api/ops/backups/offsite-push', requireAuth, requireOwner, async (req, res) => {
    const targetUrl = String(req.body?.webhookUrl || governanceState.backupWebhookUrl || '').trim();
    const backups = dataProtectionManager.listBackups();
    const backupId = String(req.body?.backupId || backups[0]?.id || '').trim();
    if (!targetUrl) {
      res.status(400).json({ error: 'يرجى ضبط رابط Webhook خارجي (HTTPS) أولاً للنسخ خارج السيرفر' });
      return;
    }
    if (!backupId) {
      res.status(400).json({ error: 'لا توجد نسخة احتياطية لإرسالها' });
      return;
    }
    const pushed = await dataProtectionManager.pushToOffsiteWebhook(targetUrl, backupId);
    if (!pushed.ok) {
      res.status(400).json({ error: pushed.error });
      return;
    }
    governanceState.lastOffsitePushAt = new Date().toISOString();
    schedulePersistDatabase();
    res.json({ ok: true, pushedAt: governanceState.lastOffsitePushAt, backupId });
  });

  app.post('/api/ops/backups/restore-drill', requireAuth, requireOwner, (req, res) => {
    const backupId = typeof req.body?.backupId === 'string' ? req.body.backupId.trim() : undefined;
    const drill = dataProtectionManager.runRestoreDrill(backupId);
    governanceState.lastRestoreDrill = drill;
    schedulePersistDatabase();
    res.json({ ok: true, drill });
  });

  app.post('/api/ops/backups/rollback', requireAuth, requireOwner, (req, res) => {
    if (req.body?.ownerConfirmed !== true) {
      res.status(400).json({
        error: 'مطلوب تأكيد صريح من المالك (ownerConfirmed: true) قبل تنفيذ الاسترجاع',
        code: 'OWNER_CONFIRMATION_REQUIRED',
      });
      return;
    }
    const backups = dataProtectionManager.listBackups();
    const targetId = String(req.body?.backupId || backups[0]?.id || '').trim();
    if (!targetId) {
      res.status(404).json({ error: 'لا توجد لقطة احتياطية صالحة للاسترجاع' });
      return;
    }

    // Always capture a safety pre-rollback PITR snapshot first
    dataProtectionManager.createSnapshot({
      kind: 'pitr',
      reason: 'pre-rollback-safety',
      payloadObject: buildCurrentBackupPayload(),
    });

    const loaded = dataProtectionManager.loadAndVerifyBackup(targetId);
    if (!loaded.ok || !loaded.payload) {
      res.status(400).json({ error: loaded.error || 'فشل التحقق من سلامة النسخة المختارة' });
      return;
    }

    const restored = loaded.payload as Partial<PersistedDbPayload>;
    if (!restored.state || !Array.isArray(restored.state.users)) {
      res.status(400).json({ error: 'بنية النسخة الاحتياطية غير مكتملة' });
      return;
    }

    serverState = restored.state;
    if (Array.isArray(restored.credentials) && restored.credentials.length > 0) {
      authCredentials = restored.credentials;
    }
    if (restored.roomPasswordHashes && typeof restored.roomPasswordHashes === 'object') {
      roomPasswordHashes = { ...restored.roomPasswordHashes };
    }
    if (typeof restored.nextUserNumericId === 'number') {
      nextUserNumericId = restored.nextUserNumericId;
    }
    migrateLegacyRoomPasswords(serverState);
    syncPrimaryOwnerCredentials(serverState, authCredentials);
    stateIndexManager.rebuild(serverState);
    writeBatchPool.flushNow();
    broadcastStateSync();
    res.json({ ok: true, restoredBackupId: targetId, state: serverState });
  });

  app.post('/api/ops/migrations/dry-run', requireAuth, requireOwner, (req, res) => {
    const migrationId = String(req.body?.migrationId || '').trim();
    const result = dryRunMigrationOnCopy(
      serverState as unknown as Record<string, unknown>,
      migrationId
    );
    governanceState.lastDryRuns[migrationId] = result;
    schedulePersistDatabase();
    res.json({ ok: result.passed, result });
  });

  app.post('/api/ops/migrations/apply', requireAuth, requireOwner, (req: AuthedRequest, res) => {
    const migrationId = String(req.body?.migrationId || '').trim();
    if (req.body?.ownerConfirmed !== true) {
      res.status(400).json({
        error: 'مطلوب موافقة وتأكيد المالك قبل تنفيذ الترحيل داخل المعاملة الذرية',
        code: 'OWNER_CONFIRMATION_REQUIRED',
      });
      return;
    }

    const outcome = applyMigrationTransactionally({
      liveState: serverState as unknown as Record<string, unknown>,
      migrationId,
      appliedBy: req.authUser!.id,
      alreadyApplied: governanceState.appliedMigrations,
      createPreSnapshot: (reason) => {
        try {
          const snap = dataProtectionManager.createSnapshot({
            kind: 'pitr',
            reason,
            payloadObject: buildCurrentBackupPayload(),
          });
          return snap.id;
        } catch {
          return undefined;
        }
      },
      commitState: (nextState) => {
        serverState = nextState as unknown as ServerAppState;
        stateIndexManager.rebuild(serverState);
        writeBatchPool.flushNow();
      },
    });

    if (!outcome.ok || !outcome.record) {
      res.status(400).json({ error: outcome.error || 'فشل تطبيق الترحيل وتم التراجع التلقائي' });
      return;
    }

    governanceState.appliedMigrations = [outcome.record, ...governanceState.appliedMigrations];
    writeBatchPool.flushNow();
    broadcastStateSync();
    res.json({ ok: true, record: outcome.record, state: serverState });
  });

  app.post('/api/ops/archive/restore-room/:id', requireAuth, requireOwner, (req, res) => {
    const roomId = String(req.params.id || '').trim();
    const entry = governanceState.archivedRooms.find(
      (e) => (e.room as { id?: string }).id === roomId
    );
    if (!entry) {
      res.status(404).json({ error: 'الغرفة غير موجودة في الأرشيف' });
      return;
    }
    const restoredRoom = entry.room as unknown as VoiceRoom;
    if (!serverState.rooms.some((r) => r.id === restoredRoom.id)) {
      serverState.rooms = [restoredRoom, ...serverState.rooms];
    }
    governanceState.archivedRooms = governanceState.archivedRooms.filter(
      (e) => (e.room as { id?: string }).id !== roomId
    );
    broadcastStateSync();
    res.json({ ok: true, room: restoredRoom, state: serverState });
  });

  app.post('/api/ops/archive/restore-moderator/:id', requireAuth, requireOwner, (req, res) => {
    const modId = String(req.params.id || '').trim();
    const entry = governanceState.archivedModerators.find(
      (e) => (e.moderator as { id?: string }).id === modId
    );
    if (!entry) {
      res.status(404).json({ error: 'المشرف غير موجود في الأرشيف' });
      return;
    }
    const restoredMod = entry.moderator as unknown as ModeratorRecord;
    if (!serverState.moderators.some((m) => m.id === restoredMod.id)) {
      serverState.moderators = [restoredMod, ...serverState.moderators];
    }
    governanceState.archivedModerators = governanceState.archivedModerators.filter(
      (e) => (e.moderator as { id?: string }).id !== modId
    );
    broadcastStateSync();
    res.json({ ok: true, moderator: restoredMod, state: serverState });
  });

  app.post('/api/ops/governance', requireAuth, requireOwner, (req, res) => {
    if (typeof req.body?.readOnlyAutomationMode === 'boolean') {
      governanceState.readOnlyAutomationMode = req.body.readOnlyAutomationMode;
    }
    if (typeof req.body?.alertWebhookUrl === 'string') {
      const check = validateSafeWebhookUrl(req.body.alertWebhookUrl);
      if (!check.ok) {
        res.status(400).json({ error: check.error });
        return;
      }
      governanceState.alertWebhookUrl = check.normalized;
    }
    if (typeof req.body?.backupWebhookUrl === 'string') {
      const check = validateSafeWebhookUrl(req.body.backupWebhookUrl);
      if (!check.ok) {
        res.status(400).json({ error: check.error });
        return;
      }
      governanceState.backupWebhookUrl = check.normalized;
    }
    schedulePersistDatabase();
    res.json({
      ok: true,
      readOnlyAutomationMode: governanceState.readOnlyAutomationMode,
      alertWebhookConfigured: Boolean(governanceState.alertWebhookUrl),
      backupWebhookConfigured: Boolean(governanceState.backupWebhookUrl),
    });
  });

  app.post('/api/ops/monitor/check-now', requireAuth, requireOwner, async (_req, res) => {
    const latest = await uptimeMonitor.runProbeNow();
    res.json({ ok: true, latest, monitor: uptimeMonitor.getOverview() });
  });

  app.post('/api/ops/stress-test', requireAuth, requireOwner, async (_req, res) => {
    const report = await runProgressiveStressTest(PORT);
    lastStressTestReport = report;
    res.json({ ok: true, report });
  });

  // Catch-all for unknown /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Vite dev middleware or static dist serving
  if (!isProd) {
    // Dev-mode self-healing guards for browsers with cached pre-fix HTML or stale dev-sw.js
    app.get('/@vite-plugin-pwa/pwa-entry-point-loaded', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.send('export default function registerDevSW() {}\n');
    });

    app.get('/dev-sw.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
      res.send(
        [
          "self.addEventListener('install', () => { self.skipWaiting(); });",
          "self.addEventListener('activate', (event) => {",
          '  event.waitUntil((async () => {',
          '    try {',
          '      const keys = await caches.keys();',
          '      await Promise.all(keys.map((k) => caches.delete(k)));',
          '    } catch {}',
          '    try {',
          '      await self.registration.unregister();',
          '    } catch {}',
          '  })());',
          '});',
        ].join('\n')
      );
    });

    app.get('/manifest.webmanifest', (_req, res) => {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.json({
        id: '/',
        name: 'رياض شات | غرف الصوت والألعاب والوكالات',
        short_name: 'رياض شات',
        description:
          'منصة رياض شات للغرف الصوتية المباشرة، صالة الألعاب التفاعلية، والوكالات المعتمدة.',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#1A0B3B',
        background_color: '#09071A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      });
    });

    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !hmrDisabled,
        ws: { server, path: '/__vite_hmr' },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (/\.(png|jpe?g|webp|svg|ico|woff2?|ttf)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          }
          if (filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      if (!fs.existsSync(indexHtmlPath)) {
        res.status(503).send('Application build not found. Run npm run build first.');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(indexHtmlPath);
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Riyadh Chat server running on http://0.0.0.0:${PORT} (VERSION=${SERVER_BUILD_VERSION}, JACKPOT_TARGET=${JACKPOT_TARGET})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start Riyadh Chat server:', err);
  process.exit(1);
});
