import { useQuery } from '@tanstack/react-query';
import { mobileApi } from '../services/api';
import {
  MOBILE_QUERY_KEYS,
  MOBILE_STALE_TIME_MS,
} from '../services/queryClient';
import type {
  MobileResolvedInvite,
  MobileServerState,
  MobileUser,
  MobileVoiceRoom,
} from '../types';

export function useMobileServerStateQuery() {
  return useQuery<MobileServerState>({
    queryKey: MOBILE_QUERY_KEYS.serverState,
    queryFn: () => mobileApi.fetchState(),
    staleTime: MOBILE_STALE_TIME_MS,
  });
}

export function useMobileRoomsQuery() {
  return useQuery<MobileServerState, Error, MobileVoiceRoom[]>({
    queryKey: MOBILE_QUERY_KEYS.serverState,
    queryFn: () => mobileApi.fetchState(),
    staleTime: MOBILE_STALE_TIME_MS,
    select: (data) => data.rooms,
  });
}

export function useMobileRoomQuery(roomId: string | null | undefined) {
  return useQuery<MobileServerState, Error, MobileVoiceRoom | null>({
    queryKey: MOBILE_QUERY_KEYS.serverState,
    queryFn: () => mobileApi.fetchState(),
    staleTime: MOBILE_STALE_TIME_MS,
    enabled: Boolean(roomId),
    select: (data) => (roomId ? data.rooms.find((room) => room.id === roomId) ?? null : null),
  });
}

export function useMobileUsersQuery() {
  return useQuery<MobileServerState, Error, MobileUser[]>({
    queryKey: MOBILE_QUERY_KEYS.serverState,
    queryFn: () => mobileApi.fetchState(),
    staleTime: MOBILE_STALE_TIME_MS,
    select: (data) => data.users,
  });
}

export function useMobileResolveInviteQuery(code: string | null | undefined) {
  const cleanCode = (code || '').trim().toUpperCase();
  return useQuery<MobileResolvedInvite | null>({
    queryKey: MOBILE_QUERY_KEYS.resolveInvite(cleanCode),
    queryFn: () => mobileApi.resolveInviteCode(cleanCode),
    enabled: cleanCode.length > 0,
    staleTime: 60_000,
    retry: 1,
  });
}
