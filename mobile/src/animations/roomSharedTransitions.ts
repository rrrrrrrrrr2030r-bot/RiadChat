import { SharedTransition, withSpring } from 'react-native-reanimated';

export const ROOM_SPRING_CONFIG = {
  damping: 20,
  stiffness: 185,
  mass: 0.9,
} as const;

export interface RoomSharedTransitionTags {
  card: string;
  avatar: string;
  heat: string;
}

export function getRoomSharedTags(roomId: string): RoomSharedTransitionTags {
  return {
    card: `room-card-${roomId}`,
    avatar: `room-avatar-${roomId}`,
    heat: `room-heat-${roomId}`,
  };
}

/**
 * Custom Spring Physics Shared Element Transition executed natively on the UI thread.
 * Smoothly morphs room card frame, host avatar, and heat badge between RoomsScreen and LiveRoomScreen.
 */
export const roomSharedTransition = SharedTransition.custom((values) => {
  'worklet';
  return {
    height: withSpring(values.targetHeight, ROOM_SPRING_CONFIG),
    width: withSpring(values.targetWidth, ROOM_SPRING_CONFIG),
    originX: withSpring(values.targetOriginX, ROOM_SPRING_CONFIG),
    originY: withSpring(values.targetOriginY, ROOM_SPRING_CONFIG),
    borderRadius: withSpring(values.targetBorderRadius, ROOM_SPRING_CONFIG),
  };
});

export function formatRoomHeat(heat: number): string {
  const safeHeat = Number.isFinite(heat) ? Math.max(0, heat) : 0;
  if (safeHeat >= 1_000_000) {
    return `${(safeHeat / 1_000_000).toFixed(1)}M`;
  }
  if (safeHeat >= 1_000) {
    return `${(safeHeat / 1_000).toFixed(1)}K`;
  }
  return safeHeat.toLocaleString('en-US');
}
