import { AppState, type AppStateStatus } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';
import type {
  MobileChatMessage,
  MobileMicSeat,
  MobileServerState,
  MobileUser,
  MobileVoiceRoom,
} from '../types';

export const MOBILE_STALE_TIME_MS = 30_000;
export const MOBILE_GC_TIME_MS = 5 * 60_000;

export const MOBILE_QUERY_KEYS = {
  serverState: ['mobile', 'server', 'state'] as const,
  roomsList: ['mobile', 'rooms', 'list'] as const,
  roomDetail: (roomId: string) => ['mobile', 'rooms', 'detail', roomId] as const,
  usersList: ['mobile', 'users', 'list'] as const,
  currentUserMe: ['mobile', 'users', 'me'] as const,
  resolveInvite: (code: string) => ['mobile', 'invites', 'resolve', code.trim().toUpperCase()] as const,
};

export interface MobileRoomSeatsSyncPayload {
  roomId: string;
  seats?: MobileMicSeat[];
  messages?: MobileChatMessage[];
  listeners?: number;
  heat?: number;
  isLocked?: boolean;
  notFound?: boolean;
  syncedAt?: number;
}

export const mobileQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MOBILE_STALE_TIME_MS,
      gcTime: MOBILE_GC_TIME_MS,
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

/**
 * Bridges React Native AppState into TanStack Query's focusManager so backgrounded
 * mobile apps never waste battery or bandwidth on background query refetches.
 */
export function attachMobileAppStateToFocusManager(): () => void {
  const onAppStateChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };
  onAppStateChange(AppState.currentState);
  const sub = AppState.addEventListener('change', onAppStateChange);
  return () => {
    sub.remove();
  };
}

/**
 * Hydrates mobile TanStack Query caches from WebSocket `state:sync` broadcasts and
 * authoritative HTTP responses, eliminating redundant `/api/state` requests.
 */
export function hydrateMobileServerStateCache(
  client: QueryClient,
  nextState: MobileServerState
): void {
  client.setQueryData<MobileServerState>(MOBILE_QUERY_KEYS.serverState, nextState);
  client.setQueryData<MobileVoiceRoom[]>(MOBILE_QUERY_KEYS.roomsList, nextState.rooms);
  client.setQueryData<MobileUser[]>(MOBILE_QUERY_KEYS.usersList, nextState.users);
  for (const room of nextState.rooms) {
    if (room?.id) {
      client.setQueryData<MobileVoiceRoom>(MOBILE_QUERY_KEYS.roomDetail(room.id), room);
    }
  }
}

/**
 * Idempotently merges incoming authoritative room messages by `id` so reconnects
 * or foreground resyncs never duplicate chat entries.
 */
export function mergeRoomMessagesIdempotently(
  existing: MobileChatMessage[],
  incoming: MobileChatMessage[]
): MobileChatMessage[] {
  if (!incoming.length) return existing;
  const byId = new Map<string, MobileChatMessage>();
  for (const msg of existing) {
    if (msg?.id) byId.set(msg.id, msg);
  }
  for (const msg of incoming) {
    if (msg?.id) byId.set(msg.id, msg);
  }
  return Array.from(byId.values()).slice(-80);
}

/**
 * Applies silent authoritative `room:seats:sync` updates (seats, mic states, messages,
 * listeners, and heat) directly into mobile React Query caches.
 */
export function patchMobileRoomSeatsAndMessagesInCache(
  client: QueryClient,
  payload: MobileRoomSeatsSyncPayload
): void {
  if (payload.notFound) {
    client.removeQueries({ queryKey: MOBILE_QUERY_KEYS.roomDetail(payload.roomId) });
    client.setQueryData<MobileVoiceRoom[] | undefined>(MOBILE_QUERY_KEYS.roomsList, (prev) =>
      prev ? prev.filter((room) => room.id !== payload.roomId) : prev
    );
    client.setQueryData<MobileServerState | undefined>(MOBILE_QUERY_KEYS.serverState, (prev) =>
      prev ? { ...prev, rooms: prev.rooms.filter((room) => room.id !== payload.roomId) } : prev
    );
    return;
  }

  const applyPatch = (room: MobileVoiceRoom): MobileVoiceRoom => {
    if (room.id !== payload.roomId) return room;
    return {
      ...room,
      seats: Array.isArray(payload.seats) ? payload.seats : room.seats,
      messages: Array.isArray(payload.messages)
        ? mergeRoomMessagesIdempotently(room.messages, payload.messages)
        : room.messages,
      listeners: typeof payload.listeners === 'number' ? payload.listeners : room.listeners,
      heat: typeof payload.heat === 'number' ? payload.heat : room.heat,
      isLocked: typeof payload.isLocked === 'boolean' ? payload.isLocked : room.isLocked,
    };
  };

  client.setQueryData<MobileVoiceRoom | undefined>(
    MOBILE_QUERY_KEYS.roomDetail(payload.roomId),
    (prev) => (prev ? applyPatch(prev) : prev)
  );
  client.setQueryData<MobileVoiceRoom[] | undefined>(MOBILE_QUERY_KEYS.roomsList, (prev) =>
    prev ? prev.map(applyPatch) : prev
  );
  client.setQueryData<MobileServerState | undefined>(MOBILE_QUERY_KEYS.serverState, (prev) =>
    prev ? { ...prev, rooms: prev.rooms.map(applyPatch) } : prev
  );
}

/**
 * Applies live `room:speaking` seat updates directly into mobile React Query caches
 * without triggering HTTP refetches.
 */
export function patchMobileRoomSpeakingInCache(
  client: QueryClient,
  roomId: string,
  seatNumber: number,
  isSpeaking: boolean
): void {
  const updateRoom = (room: MobileVoiceRoom): MobileVoiceRoom => {
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

  client.setQueryData<MobileVoiceRoom | undefined>(
    MOBILE_QUERY_KEYS.roomDetail(roomId),
    (prev) => (prev ? updateRoom(prev) : prev)
  );
  client.setQueryData<MobileVoiceRoom[] | undefined>(MOBILE_QUERY_KEYS.roomsList, (prev) =>
    prev ? prev.map(updateRoom) : prev
  );
  client.setQueryData<MobileServerState | undefined>(MOBILE_QUERY_KEYS.serverState, (prev) =>
    prev ? { ...prev, rooms: prev.rooms.map(updateRoom) } : prev
  );
}

/**
 * Clears user-scoped mobile session caches immediately upon logout or revocation.
 */
export function clearMobileSessionQueries(client: QueryClient): void {
  client.removeQueries({ queryKey: MOBILE_QUERY_KEYS.currentUserMe });
}
