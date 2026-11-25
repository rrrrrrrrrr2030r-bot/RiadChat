import crypto from 'crypto';

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

export interface PersistedNotificationsState {
  followedRoomsByUser: Record<string, string[]>;
  preferencesByUser: Record<string, NotificationPreferences>;
  notificationsByUser: Record<string, InAppNotification[]>;
}

export interface RoomNotificationSource {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  coverImage?: string;
  category: string;
  heat: number;
  listeners: number;
  isPinned?: boolean;
  isLive?: boolean;
  liveTitle?: string;
  liveStartedAt?: number;
}

const MAX_NOTIFICATIONS_PER_USER = 60;
const AUTO_LIVE_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes between auto triggers per room
const EXPLICIT_LIVE_DEBOUNCE_MS = 12 * 1000; // 12 seconds anti-double-click debounce

export function createDefaultNotificationPrefs(): NotificationPreferences {
  return {
    followedRoomsLive: true,
    popularRoomsLive: true,
    soundEnabled: true,
  };
}

export function createDefaultPersistedNotificationsState(): PersistedNotificationsState {
  return {
    followedRoomsByUser: {},
    preferencesByUser: {},
    notificationsByUser: {},
  };
}

export class LiveNotificationManager {
  private state: PersistedNotificationsState = createDefaultPersistedNotificationsState();
  private lastAutoEmitByRoom = new Map<string, number>();
  private lastExplicitEmitByRoom = new Map<string, number>();

  load(persisted?: Partial<PersistedNotificationsState> | null): void {
    const base = createDefaultPersistedNotificationsState();
    if (!persisted || typeof persisted !== 'object') {
      this.state = base;
      return;
    }
    this.state = {
      followedRoomsByUser:
        persisted.followedRoomsByUser && typeof persisted.followedRoomsByUser === 'object'
          ? { ...persisted.followedRoomsByUser }
          : {},
      preferencesByUser:
        persisted.preferencesByUser && typeof persisted.preferencesByUser === 'object'
          ? { ...persisted.preferencesByUser }
          : {},
      notificationsByUser:
        persisted.notificationsByUser && typeof persisted.notificationsByUser === 'object'
          ? { ...persisted.notificationsByUser }
          : {},
    };
  }

  exportState(): PersistedNotificationsState {
    return this.state;
  }

  getPreferences(userId: string): NotificationPreferences {
    const existing = this.state.preferencesByUser[userId];
    return {
      ...createDefaultNotificationPrefs(),
      ...(existing || {}),
    };
  }

  updatePreferences(
    userId: string,
    patch: Partial<NotificationPreferences>
  ): NotificationPreferences {
    const current = this.getPreferences(userId);
    const next: NotificationPreferences = {
      followedRoomsLive:
        typeof patch.followedRoomsLive === 'boolean'
          ? patch.followedRoomsLive
          : current.followedRoomsLive,
      popularRoomsLive:
        typeof patch.popularRoomsLive === 'boolean'
          ? patch.popularRoomsLive
          : current.popularRoomsLive,
      soundEnabled:
        typeof patch.soundEnabled === 'boolean' ? patch.soundEnabled : current.soundEnabled,
    };
    this.state.preferencesByUser[userId] = next;
    return next;
  }

  getFollowedRoomIds(userId: string): string[] {
    const list = this.state.followedRoomsByUser[userId];
    return Array.isArray(list) ? [...list] : [];
  }

  isFollowingRoom(userId: string, roomId: string): boolean {
    const list = this.state.followedRoomsByUser[userId];
    return Array.isArray(list) && list.includes(roomId);
  }

  toggleFollowRoom(
    userId: string,
    roomId: string
  ): { following: boolean; followedRoomIds: string[]; roomFollowersCount: number } {
    const existing = new Set(this.getFollowedRoomIds(userId));
    let following = false;
    if (existing.has(roomId)) {
      existing.delete(roomId);
      following = false;
    } else {
      existing.add(roomId);
      following = true;
    }
    const nextList = Array.from(existing);
    this.state.followedRoomsByUser[userId] = nextList;
    return {
      following,
      followedRoomIds: nextList,
      roomFollowersCount: this.getRoomFollowersCount(roomId),
    };
  }

  getRoomFollowersCount(roomId: string): number {
    let count = 0;
    for (const ids of Object.values(this.state.followedRoomsByUser)) {
      if (Array.isArray(ids) && ids.includes(roomId)) {
        count += 1;
      }
    }
    return count;
  }

  getNotificationsForUser(userId: string): InAppNotification[] {
    const list = this.state.notificationsByUser[userId];
    return Array.isArray(list) ? list : [];
  }

  getUnreadCount(userId: string): number {
    return this.getNotificationsForUser(userId).reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  }

  getUserSnapshot(userId: string): {
    notifications: InAppNotification[];
    unreadCount: number;
    followedRoomIds: string[];
    preferences: NotificationPreferences;
  } {
    const notifications = this.getNotificationsForUser(userId);
    const unreadCount = notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
    return {
      notifications,
      unreadCount,
      followedRoomIds: this.getFollowedRoomIds(userId),
      preferences: this.getPreferences(userId),
    };
  }

  markRead(userId: string, notificationId: string): boolean {
    const list = this.state.notificationsByUser[userId];
    if (!Array.isArray(list)) return false;
    let changed = false;
    for (const item of list) {
      if (item.id === notificationId && !item.read) {
        item.read = true;
        changed = true;
      }
    }
    return changed;
  }

  markAllRead(userId: string): number {
    const list = this.state.notificationsByUser[userId];
    if (!Array.isArray(list)) return 0;
    let count = 0;
    for (const item of list) {
      if (!item.read) {
        item.read = true;
        count += 1;
      }
    }
    return count;
  }

  clearAll(userId: string): void {
    this.state.notificationsByUser[userId] = [];
  }

  isPopularRoom(room: RoomNotificationSource, allRooms: RoomNotificationSource[]): boolean {
    if (room.isPinned) return true;
    if (room.heat >= 10_000_000 || room.listeners >= 150) return true;
    const qualified = allRooms.filter((r) => r.heat >= 500_000 || r.listeners >= 25);
    if (qualified.length === 0) return false;
    const ranked = [...qualified].sort(
      (a, b) => b.heat * 0.7 + b.listeners * 100_000 - (a.heat * 0.7 + a.listeners * 100_000)
    );
    const topIds = new Set(ranked.slice(0, 3).map((r) => r.id));
    return topIds.has(room.id);
  }

  dispatchLiveStartNotifications(params: {
    room: RoomNotificationSource;
    allRooms: RoomNotificationSource[];
    allUserIds: string[];
    hostId: string;
    hostName: string;
    topic?: string;
    explicit?: boolean;
  }): {
    dispatched: Map<string, InAppNotification>;
    isPopular: boolean;
    throttled: boolean;
  } {
    const { room, allRooms, allUserIds, hostId, hostName, topic, explicit } = params;
    const now = Date.now();
    const dispatched = new Map<string, InAppNotification>();
    const isPopular = this.isPopularRoom(room, allRooms);

    if (explicit) {
      const lastExplicit = this.lastExplicitEmitByRoom.get(room.id) || 0;
      if (now - lastExplicit < EXPLICIT_LIVE_DEBOUNCE_MS) {
        return { dispatched, isPopular, throttled: true };
      }
      this.lastExplicitEmitByRoom.set(room.id, now);
      this.lastAutoEmitByRoom.set(room.id, now);
    } else {
      const lastAuto = this.lastAutoEmitByRoom.get(room.id) || 0;
      if (now - lastAuto < AUTO_LIVE_COOLDOWN_MS) {
        return { dispatched, isPopular, throttled: true };
      }
      this.lastAutoEmitByRoom.set(room.id, now);
    }

    const cleanTopic = String(topic || room.liveTitle || '').trim().slice(0, 90);
    const baseEventSeed = `${room.id}-${now}-${crypto.randomBytes(3).toString('hex')}`;

    for (const userId of allUserIds) {
      if (!userId || userId === hostId) continue;

      const prefs = this.getPreferences(userId);
      const followsRoom = this.isFollowingRoom(userId, room.id);

      let kind: InAppNotificationKind | null = null;
      if (followsRoom && prefs.followedRoomsLive) {
        kind = 'followed_room_live';
      } else if (isPopular && prefs.popularRoomsLive) {
        kind = 'popular_room_live';
      }

      if (!kind) continue;

      const notification: InAppNotification = {
        id: `notif-${baseEventSeed}-${userId}`,
        kind,
        roomId: room.id,
        roomTitle: room.title,
        roomAvatar: room.coverImage || room.ownerAvatar,
        hostId,
        hostName,
        category: room.category,
        title:
          kind === 'followed_room_live'
            ? `بدأ بث مباشر في غرفة تتابعها`
            : `بث مباشر الآن في غرفة شائعة`,
        message: cleanTopic
          ? `${hostName} بدأ البث في «${room.title}»: ${cleanTopic}`
          : `${hostName} بدأ بثاً مباشراً الآن في «${room.title}» — انضم للاستماع والمشاركة!`,
        ...(cleanTopic ? { topic: cleanTopic } : {}),
        listeners: room.listeners,
        heat: room.heat,
        createdAt: now,
        read: false,
      };

      const existing = this.state.notificationsByUser[userId] || [];
      this.state.notificationsByUser[userId] = [
        notification,
        ...existing.filter((n) => n.id !== notification.id),
      ].slice(0, MAX_NOTIFICATIONS_PER_USER);

      dispatched.set(userId, notification);
    }

    return { dispatched, isPopular, throttled: false };
  }
}
