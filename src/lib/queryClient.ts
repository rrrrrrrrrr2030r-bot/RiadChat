import { QueryClient } from '@tanstack/react-query';
import type { UserAccount, VoiceRoom } from '../types';
import { resolveApiUrl } from '../utils/apiBase';

export const SERVER_STATE_STALE_TIME_MS = 30_000;
export const SERVER_STATE_GC_TIME_MS = 5 * 60_000;

export const QUERY_KEYS = {
  serverState: ['server', 'state'] as const,
  roomsList: ['rooms', 'list'] as const,
  roomDetail: (roomId: string) => ['rooms', 'detail', roomId] as const,
  usersList: ['users', 'list'] as const,
  currentUserMe: ['users', 'me'] as const,
  resolveInvite: (code: string) => ['invites', 'resolve', code.trim().toUpperCase()] as const,
};

export interface CachedServerStateSlice {
  users: UserAccount[];
  rooms: VoiceRoom[];
  [key: string]: unknown;
}

export interface ResolvedInvitePreview {
  code: string;
  inviterName: string;
  roomTitle?: string | null;
  welcomeGold: number;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: SERVER_STATE_STALE_TIME_MS,
      gcTime: SERVER_STATE_GC_TIME_MS,
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export async function fetchServerStateSnapshot<T extends Record<string, unknown> = CachedServerStateSlice>(
  token?: string
): Promise<T | null> {
  const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(resolveApiUrl('/api/state'), {
    cache: 'no-store',
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch server state (${res.status})`);
  }
  const payload = (await res.json()) as { state?: T };
  return payload.state ?? null;
}

export async function fetchCurrentUserSession(
  token?: string
): Promise<{ user?: UserAccount; token?: string; state?: Record<string, unknown> } | null> {
  const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(resolveApiUrl('/api/auth/me'), {
    cache: 'no-store',
    credentials: 'include',
    headers,
  });
  if (res.status === 401 || res.status === 403) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to verify session (${res.status})`);
  }
  return (await res.json()) as {
    user?: UserAccount;
    token?: string;
    state?: Record<string, unknown>;
  };
}

export async function fetchResolvedInvite(code: string): Promise<ResolvedInvitePreview | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const res = await fetch(resolveApiUrl(`/api/invites/resolve/${encodeURIComponent(clean)}`));
  if (!res.ok) return null;
  const data = (await res.json()) as {
    ok?: boolean;
    code?: string;
    inviterName?: string;
    roomTitle?: string | null;
    welcomeGold?: number;
  };
  if (!data?.ok) return null;
  return {
    code: data.code || clean,
    inviterName: data.inviterName || 'مستخدم رياض شات',
    roomTitle: data.roomTitle ?? null,
    welcomeGold: data.welcomeGold || 500_000,
  };
}

/**
 * Hydrates TanStack Query caches from authoritative HTTP responses or WebSocket `state:sync`
 * frames so room/user views stay fresh without issuing duplicate HTTP `/api/state` requests.
 */
export function hydrateServerStateCache<T extends { rooms?: VoiceRoom[]; users?: UserAccount[] }>(
  client: QueryClient,
  nextState: T
): void {
  client.setQueryData(QUERY_KEYS.serverState, nextState);
  if (Array.isArray(nextState.rooms)) {
    client.setQueryData(QUERY_KEYS.roomsList, nextState.rooms);
    for (const room of nextState.rooms) {
      if (room?.id) {
        client.setQueryData(QUERY_KEYS.roomDetail(room.id), room);
      }
    }
  }
  if (Array.isArray(nextState.users)) {
    client.setQueryData(QUERY_KEYS.usersList, nextState.users);
  }
}

/**
 * Immutably patches a seat's speaking indicator directly in React Query caches on WebSocket
 * `room:speaking` broadcasts with zero extra HTTP traffic.
 */
export function patchRoomSpeakingInCache(
  client: QueryClient,
  roomId: string,
  seatNumber: number,
  isSpeaking: boolean
): void {
  const updateRoom = (room: VoiceRoom): VoiceRoom => {
    if (room.id !== roomId) return room;
    let changed = false;
    const nextSeats = room.seats.map((seat) => {
      if (seat.seatNumber !== seatNumber || seat.isSpeaking === isSpeaking) {
        return seat;
      }
      changed = true;
      return { ...seat, isSpeaking };
    });
    return changed ? { ...room, seats: nextSeats } : room;
  };

  client.setQueryData<VoiceRoom | undefined>(QUERY_KEYS.roomDetail(roomId), (prev) =>
    prev ? updateRoom(prev) : prev
  );
  client.setQueryData<VoiceRoom[] | undefined>(QUERY_KEYS.roomsList, (prev) =>
    prev ? prev.map(updateRoom) : prev
  );
  client.setQueryData<CachedServerStateSlice | undefined>(QUERY_KEYS.serverState, (prev) =>
    prev && Array.isArray(prev.rooms)
      ? { ...prev, rooms: prev.rooms.map(updateRoom) }
      : prev
  );
}

/**
 * Clears user-scoped session queries on logout or session expiry.
 */
export function clearSessionQueries(client: QueryClient): void {
  client.removeQueries({ queryKey: QUERY_KEYS.currentUserMe });
}
