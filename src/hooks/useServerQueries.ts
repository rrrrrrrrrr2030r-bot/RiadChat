import { useQuery } from '@tanstack/react-query';
import type { UserAccount, VoiceRoom } from '../types';
import {
  QUERY_KEYS,
  SERVER_STATE_STALE_TIME_MS,
  fetchResolvedInvite,
  fetchServerStateSnapshot,
  type CachedServerStateSlice,
  type ResolvedInvitePreview,
} from '../lib/queryClient';

export function useServerStateQuery() {
  return useQuery<CachedServerStateSlice | null>({
    queryKey: QUERY_KEYS.serverState,
    queryFn: () => fetchServerStateSnapshot<CachedServerStateSlice>(),
    staleTime: SERVER_STATE_STALE_TIME_MS,
  });
}

export function useRoomsQuery() {
  return useQuery<CachedServerStateSlice | null, Error, VoiceRoom[]>({
    queryKey: QUERY_KEYS.serverState,
    queryFn: () => fetchServerStateSnapshot<CachedServerStateSlice>(),
    staleTime: SERVER_STATE_STALE_TIME_MS,
    select: (data) => (Array.isArray(data?.rooms) ? data.rooms : []),
  });
}

export function useRoomQuery(roomId: string | null | undefined) {
  return useQuery<CachedServerStateSlice | null, Error, VoiceRoom | null>({
    queryKey: QUERY_KEYS.serverState,
    queryFn: () => fetchServerStateSnapshot<CachedServerStateSlice>(),
    staleTime: SERVER_STATE_STALE_TIME_MS,
    enabled: Boolean(roomId),
    select: (data) =>
      roomId && Array.isArray(data?.rooms)
        ? data.rooms.find((room) => room.id === roomId) ?? null
        : null,
  });
}

export function useUsersQuery() {
  return useQuery<CachedServerStateSlice | null, Error, UserAccount[]>({
    queryKey: QUERY_KEYS.serverState,
    queryFn: () => fetchServerStateSnapshot<CachedServerStateSlice>(),
    staleTime: SERVER_STATE_STALE_TIME_MS,
    select: (data) => (Array.isArray(data?.users) ? data.users : []),
  });
}

export function useUserByIdQuery(userId: string | null | undefined) {
  return useQuery<CachedServerStateSlice | null, Error, UserAccount | null>({
    queryKey: QUERY_KEYS.serverState,
    queryFn: () => fetchServerStateSnapshot<CachedServerStateSlice>(),
    staleTime: SERVER_STATE_STALE_TIME_MS,
    enabled: Boolean(userId),
    select: (data) =>
      userId && Array.isArray(data?.users)
        ? data.users.find((user) => user.id === userId) ?? null
        : null,
  });
}

export function useResolveInviteQuery(code: string | null | undefined) {
  const cleanCode = (code || '').trim().toUpperCase();
  return useQuery<ResolvedInvitePreview | null>({
    queryKey: QUERY_KEYS.resolveInvite(cleanCode),
    queryFn: () => fetchResolvedInvite(cleanCode),
    enabled: cleanCode.length > 0,
    staleTime: 60_000,
    retry: 1,
  });
}
