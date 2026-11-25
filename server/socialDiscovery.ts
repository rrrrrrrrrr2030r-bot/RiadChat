export const SOCIAL_INTEREST_OPTIONS = [
  'طرب',
  'دردشة',
  'مسابقات',
  'وكالات',
  'ألعاب الحظ',
  'بث مباشر',
] as const;

export type SocialInterestTag = (typeof SOCIAL_INTEREST_OPTIONS)[number];

const INTEREST_WHITELIST = new Set<string>(SOCIAL_INTEREST_OPTIONS);
const MAX_VISITED_ROOMS_PER_USER = 40;
const MAX_DISMISSED_PER_USER = 100;

export interface RoomVisitEntry {
  count: number;
  lastVisitedAt: number;
}

export interface PersistedSocialDiscoveryState {
  roomVisitsByUser: Record<string, Record<string, RoomVisitEntry>>;
  interestsByUser: Record<string, SocialInterestTag[]>;
  dismissedByUser: Record<string, string[]>;
}

export interface SocialUserSource {
  id: string;
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
  isBanned?: boolean;
}

export interface SocialRoomSource {
  id: string;
  title: string;
  ownerId: string;
  category: string;
  heat: number;
  listeners: number;
  isLive?: boolean;
  seats: Array<{ userId: string | null }>;
  messages: Array<{ senderId: string; type?: string }>;
}

export interface SocialHostSource {
  userId: string;
  roomId: string;
}

export interface SharedRoomSummary {
  roomId: string;
  roomTitle: string;
  category: string;
  viewerVisitCount: number;
}

export interface SuggestedContactDTO {
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
  suggestions: SuggestedContactDTO[];
  explicitInterests: SocialInterestTag[];
  inferredInterests: SocialInterestTag[];
  availableInterests: SocialInterestTag[];
  mostVisitedRooms: MostVisitedRoomSummary[];
  dismissedCount: number;
}

export function createDefaultSocialDiscoveryState(): PersistedSocialDiscoveryState {
  return {
    roomVisitsByUser: {},
    interestsByUser: {},
    dismissedByUser: {},
  };
}

function normalizeInterestList(raw: unknown): SocialInterestTag[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<SocialInterestTag>();
  for (const item of raw) {
    const clean = String(item || '').trim();
    if (INTEREST_WHITELIST.has(clean)) {
      seen.add(clean as SocialInterestTag);
    }
  }
  return Array.from(seen);
}

function mapRoomCategoryToInterest(category: string): SocialInterestTag | null {
  const clean = String(category || '').trim();
  if (INTEREST_WHITELIST.has(clean)) {
    return clean as SocialInterestTag;
  }
  return null;
}

export class SocialDiscoveryManager {
  private state: PersistedSocialDiscoveryState = createDefaultSocialDiscoveryState();

  load(persisted?: Partial<PersistedSocialDiscoveryState> | null): void {
    if (!persisted || typeof persisted !== 'object') {
      this.state = createDefaultSocialDiscoveryState();
      return;
    }

    const roomVisitsByUser: Record<string, Record<string, RoomVisitEntry>> = {};
    if (persisted.roomVisitsByUser && typeof persisted.roomVisitsByUser === 'object') {
      for (const [uid, visits] of Object.entries(persisted.roomVisitsByUser)) {
        if (!visits || typeof visits !== 'object') continue;
        const cleanMap: Record<string, RoomVisitEntry> = {};
        for (const [rid, entry] of Object.entries(visits)) {
          if (entry && typeof entry === 'object') {
            const count = Math.max(1, Math.floor(Number(entry.count) || 1));
            const lastVisitedAt = Math.max(0, Math.floor(Number(entry.lastVisitedAt) || Date.now()));
            cleanMap[rid] = { count, lastVisitedAt };
          }
        }
        roomVisitsByUser[uid] = cleanMap;
      }
    }

    const interestsByUser: Record<string, SocialInterestTag[]> = {};
    if (persisted.interestsByUser && typeof persisted.interestsByUser === 'object') {
      for (const [uid, tags] of Object.entries(persisted.interestsByUser)) {
        interestsByUser[uid] = normalizeInterestList(tags);
      }
    }

    const dismissedByUser: Record<string, string[]> = {};
    if (persisted.dismissedByUser && typeof persisted.dismissedByUser === 'object') {
      for (const [uid, ids] of Object.entries(persisted.dismissedByUser)) {
        if (Array.isArray(ids)) {
          dismissedByUser[uid] = Array.from(
            new Set(ids.map((v) => String(v || '').trim()).filter(Boolean))
          ).slice(0, MAX_DISMISSED_PER_USER);
        }
      }
    }

    this.state = {
      roomVisitsByUser,
      interestsByUser,
      dismissedByUser,
    };
  }

  exportState(): PersistedSocialDiscoveryState {
    return this.state;
  }

  recordRoomVisit(userId: string, roomId: string): RoomVisitEntry {
    const uid = String(userId || '').trim();
    const rid = String(roomId || '').trim();
    const now = Date.now();
    if (!uid || !rid) {
      return { count: 0, lastVisitedAt: now };
    }
    if (!this.state.roomVisitsByUser[uid]) {
      this.state.roomVisitsByUser[uid] = {};
    }
    const existing = this.state.roomVisitsByUser[uid][rid];
    const next: RoomVisitEntry = {
      count: existing ? existing.count + 1 : 1,
      lastVisitedAt: now,
    };
    this.state.roomVisitsByUser[uid][rid] = next;

    // Trim oldest entries if user visited many rooms
    const entries = Object.entries(this.state.roomVisitsByUser[uid]);
    if (entries.length > MAX_VISITED_ROOMS_PER_USER) {
      entries.sort((a, b) => b[1].count * 1000000 + b[1].lastVisitedAt - (a[1].count * 1000000 + a[1].lastVisitedAt));
      this.state.roomVisitsByUser[uid] = Object.fromEntries(entries.slice(0, MAX_VISITED_ROOMS_PER_USER));
    }
    return next;
  }

  getRoomVisits(userId: string): Record<string, RoomVisitEntry> {
    return this.state.roomVisitsByUser[userId] || {};
  }

  getExplicitInterests(userId: string): SocialInterestTag[] {
    return [...(this.state.interestsByUser[userId] || [])];
  }

  updateInterests(userId: string, rawInterests: unknown): SocialInterestTag[] {
    const clean = normalizeInterestList(rawInterests);
    this.state.interestsByUser[userId] = clean;
    return clean;
  }

  getDismissedIds(userId: string): string[] {
    return [...(this.state.dismissedByUser[userId] || [])];
  }

  dismissSuggestion(userId: string, targetUserId: string): string[] {
    const target = String(targetUserId || '').trim();
    if (!target || target === userId) return this.getDismissedIds(userId);
    const next = Array.from(new Set([target, ...this.getDismissedIds(userId)])).slice(
      0,
      MAX_DISMISSED_PER_USER
    );
    this.state.dismissedByUser[userId] = next;
    return next;
  }

  restoreDismissed(userId: string): void {
    this.state.dismissedByUser[userId] = [];
  }

  private getUserRoomAffinityIds(
    userId: string,
    allRooms: SocialRoomSource[],
    hosts: SocialHostSource[],
    followedRoomIds: string[]
  ): Map<string, number> {
    const weights = new Map<string, number>();
    const visits = this.getRoomVisits(userId);
    for (const [roomId, entry] of Object.entries(visits)) {
      weights.set(roomId, (weights.get(roomId) || 0) + Math.min(25, entry.count * 3));
    }
    for (const roomId of followedRoomIds) {
      weights.set(roomId, (weights.get(roomId) || 0) + 5);
    }
    for (const host of hosts) {
      if (host.userId === userId) {
        weights.set(host.roomId, (weights.get(host.roomId) || 0) + 6);
      }
    }
    for (const room of allRooms) {
      if (room.ownerId === userId) {
        weights.set(room.id, (weights.get(room.id) || 0) + 8);
      }
      if (room.seats.some((s) => s.userId === userId)) {
        weights.set(room.id, (weights.get(room.id) || 0) + 7);
      }
      const chatCount = room.messages.reduce(
        (acc, m) => acc + (m.senderId === userId && m.type !== 'system' ? 1 : 0),
        0
      );
      if (chatCount > 0) {
        weights.set(room.id, (weights.get(room.id) || 0) + Math.min(8, chatCount * 2));
      }
    }
    return weights;
  }

  private inferInterestsForUser(
    userId: string,
    allRooms: SocialRoomSource[],
    hosts: SocialHostSource[],
    followedRoomIds: string[]
  ): SocialInterestTag[] {
    const roomById = new Map(allRooms.map((r) => [r.id, r]));
    const affinity = this.getUserRoomAffinityIds(userId, allRooms, hosts, followedRoomIds);
    const interestScores = new Map<SocialInterestTag, number>();

    for (const [roomId, weight] of affinity.entries()) {
      const room = roomById.get(roomId);
      if (!room) continue;
      const mapped = mapRoomCategoryToInterest(room.category);
      if (mapped) {
        interestScores.set(mapped, (interestScores.get(mapped) || 0) + weight);
      }
      if (room.isLive) {
        interestScores.set('بث مباشر', (interestScores.get('بث مباشر') || 0) + Math.max(1, Math.floor(weight / 2)));
      }
    }

    return Array.from(interestScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 4);
  }

  buildSnapshot(params: {
    viewer: SocialUserSource;
    allUsers: SocialUserSource[];
    allRooms: SocialRoomSource[];
    hosts: SocialHostSource[];
    viewerFollowedRoomIds: string[];
    getFollowedRoomsForUser: (uid: string) => string[];
    limit?: number;
  }): SocialDiscoverySnapshot {
    const {
      viewer,
      allUsers,
      allRooms,
      hosts,
      viewerFollowedRoomIds,
      getFollowedRoomsForUser,
      limit = 16,
    } = params;

    const roomById = new Map(allRooms.map((r) => [r.id, r]));
    const viewerVisits = this.getRoomVisits(viewer.id);
    const viewerRoomAffinity = this.getUserRoomAffinityIds(
      viewer.id,
      allRooms,
      hosts,
      viewerFollowedRoomIds
    );
    const explicitInterests = this.getExplicitInterests(viewer.id);
    const inferredInterests = this.inferInterestsForUser(
      viewer.id,
      allRooms,
      hosts,
      viewerFollowedRoomIds
    );
    const viewerInterestSet = new Set<SocialInterestTag>([
      ...explicitInterests,
      ...inferredInterests,
    ]);
    const dismissedSet = new Set(this.getDismissedIds(viewer.id));

    const mostVisitedRooms: MostVisitedRoomSummary[] = Object.entries(viewerVisits)
      .map(([roomId, entry]) => {
        const room = roomById.get(roomId);
        if (!room) return null;
        return {
          roomId: room.id,
          roomTitle: room.title,
          category: room.category,
          visitCount: entry.count,
          lastVisitedAt: entry.lastVisitedAt,
        };
      })
      .filter((item): item is MostVisitedRoomSummary => Boolean(item))
      .sort((a, b) => b.visitCount - a.visitCount || b.lastVisitedAt - a.lastVisitedAt)
      .slice(0, 6);

    const ranked: Array<{ dto: SuggestedContactDTO; rawScore: number }> = [];

    for (const candidate of allUsers) {
      if (!candidate || candidate.id === viewer.id) continue;
      if (candidate.isBanned) continue;
      if (dismissedSet.has(candidate.id)) continue;

      const candidateFollowedRooms = getFollowedRoomsForUser(candidate.id);
      const candidateRoomAffinity = this.getUserRoomAffinityIds(
        candidate.id,
        allRooms,
        hosts,
        candidateFollowedRooms
      );
      const candidateInterests = new Set<SocialInterestTag>([
        ...this.getExplicitInterests(candidate.id),
        ...this.inferInterestsForUser(candidate.id, allRooms, hosts, candidateFollowedRooms),
      ]);

      // 1. Shared most-visited / interacted rooms
      const sharedRooms: SharedRoomSummary[] = [];
      let roomOverlapPoints = 0;
      for (const [roomId, viewerWeight] of viewerRoomAffinity.entries()) {
        const candWeight = candidateRoomAffinity.get(roomId);
        if (!candWeight) continue;
        const room = roomById.get(roomId);
        if (!room) continue;
        const visitCount = viewerVisits[roomId]?.count || 1;
        sharedRooms.push({
          roomId: room.id,
          roomTitle: room.title,
          category: room.category,
          viewerVisitCount: visitCount,
        });
        roomOverlapPoints += Math.min(34, viewerWeight * 2 + candWeight * 1.5);
      }
      sharedRooms.sort((a, b) => b.viewerVisitCount - a.viewerVisitCount);

      // 2. Shared interests (explicit + inferred)
      const sharedInterests: SocialInterestTag[] = [];
      for (const tag of SOCIAL_INTEREST_OPTIONS) {
        if (viewerInterestSet.has(tag) && candidateInterests.has(tag)) {
          sharedInterests.push(tag);
        }
      }
      const interestPoints = Math.min(32, sharedInterests.length * 11);

      // 3. Active room presence
      const activeRoom =
        allRooms.find((r) => r.seats.some((s) => s.userId === candidate.id)) ||
        allRooms.find((r) => r.ownerId === candidate.id && r.isLive) ||
        null;

      // 4. Country & engagement affinity
      const sameCountry = Boolean(viewer.country && candidate.country && viewer.country === candidate.country);
      const countryPoints = sameCountry ? 10 : 0;
      const activityPoints =
        (activeRoom ? 8 : 0) +
        Math.min(8, Math.floor((candidate.level || 1) / 3)) +
        (candidate.isVerifiedAgent ? 4 : 0);

      const rawScore = roomOverlapPoints + interestPoints + countryPoints + activityPoints;
      const matchScore = Math.min(98, Math.max(52, Math.round(52 + Math.min(46, rawScore * 0.65))));

      let reasonSummary = '';
      if (sharedRooms.length > 0 && sharedInterests.length > 0) {
        reasonSummary = `غرفة مشتركة: ${sharedRooms[0].roomTitle} · اهتمام: ${sharedInterests[0]}`;
      } else if (sharedRooms.length > 0) {
        reasonSummary = `يتواجد في «${sharedRooms[0].roomTitle}» من غرفك المفضلة`;
      } else if (sharedInterests.length > 0) {
        reasonSummary = `اهتمامات مشتركة: ${sharedInterests.slice(0, 2).join(' · ')}`;
      } else if (activeRoom) {
        reasonSummary = `نشط حالياً في غرفة «${activeRoom.title}»`;
      } else if (sameCountry) {
        reasonSummary = `من ${candidate.country} ونشط في غرف الصوت`;
      } else {
        reasonSummary = `عضو نشط في مجتمع رياض شات · Lv.${candidate.level}`;
      }

      ranked.push({
        rawScore,
        dto: {
          userId: candidate.id,
          name: candidate.name,
          avatar: candidate.avatar,
          role: candidate.role,
          level: candidate.level,
          svip: candidate.svip,
          title: candidate.title,
          country: candidate.country,
          flag: candidate.flag,
          followers: candidate.followers,
          isVerifiedAgent: candidate.isVerifiedAgent,
          matchScore,
          sharedRooms: sharedRooms.slice(0, 3),
          sharedInterests: sharedInterests.slice(0, 4),
          activeRoomId: activeRoom?.id || null,
          activeRoomTitle: activeRoom?.title || null,
          reasonSummary,
        },
      });
    }

    ranked.sort((a, b) => b.rawScore - a.rawScore || b.dto.level - a.dto.level);

    return {
      suggestions: ranked.slice(0, limit).map((item) => item.dto),
      explicitInterests,
      inferredInterests,
      availableInterests: [...SOCIAL_INTEREST_OPTIONS],
      mostVisitedRooms,
      dismissedCount: dismissedSet.size,
    };
  }
}
