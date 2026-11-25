import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../App';
import { useMobileApp } from '../context/MobileAppContext';
import type { MobileVoiceRoom } from '../types';
import {
  formatRoomHeat,
  getRoomSharedTags,
  roomSharedTransition,
} from '../animations/roomSharedTransitions';

type RoomsNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Rooms'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface RoomsScreenProps {
  isPrimaryAdmin?: boolean;
  isApprovedAgent?: boolean;
}

interface AnimatedRoomCardProps {
  room: MobileVoiceRoom;
  onOpenRoom: (roomId: string) => void;
}

const AnimatedRoomCard: React.FC<AnimatedRoomCardProps> = React.memo(({ room, onOpenRoom }) => {
  const sharedTags = getRoomSharedTags(room.id);
  const pressScale = useSharedValue(1);

  const pressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.975, { damping: 18, stiffness: 260 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 16, stiffness: 220 });
  };

  const hasValidAvatar = Boolean(room.ownerAvatar && /^https?:\/\//i.test(room.ownerAvatar));

  return (
    <Animated.View style={pressAnimatedStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onOpenRoom(room.id)}
      >
        <Animated.View
          sharedTransitionTag={sharedTags.card}
          sharedTransitionStyle={roomSharedTransition}
          style={styles.roomCard}
        >
          <View style={styles.roomTop}>
            {hasValidAvatar ? (
              <Animated.Image
                source={{ uri: room.ownerAvatar }}
                sharedTransitionTag={sharedTags.avatar}
                sharedTransitionStyle={roomSharedTransition}
                style={styles.ownerAvatar}
              />
            ) : (
              <Animated.View
                sharedTransitionTag={sharedTags.avatar}
                sharedTransitionStyle={roomSharedTransition}
                style={styles.ownerAvatarFallback}
              >
                <Text style={styles.ownerAvatarFallbackText}>
                  {(room.ownerName || 'ر').slice(0, 1)}
                </Text>
              </Animated.View>
            )}

            <View style={styles.roomTitleCol}>
              <Text style={styles.roomTitle} numberOfLines={1}>
                {room.flag} {room.title}
              </Text>
              <Text style={styles.ownerSubtitle} numberOfLines={1}>
                المضيف: {room.ownerName}
              </Text>
            </View>

            <Animated.View
              sharedTransitionTag={sharedTags.heat}
              sharedTransitionStyle={roomSharedTransition}
              style={styles.heatBadge}
            >
              <Text style={styles.heatText}>🏆 {formatRoomHeat(room.heat)}</Text>
            </Animated.View>
          </View>

          <View style={styles.roomMeta}>
            <Text style={styles.metaText}>🎙️ {room.totalMics} مقعد</Text>
            <Text style={styles.metaText}>
              👥 {(room.listeners ?? room.onlineCount ?? 0).toLocaleString('en-US')} متصل
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

export const RoomsScreen: React.FC<RoomsScreenProps> = ({
  isPrimaryAdmin = false,
  isApprovedAgent = false,
}) => {
  const navigation = useNavigation<RoomsNavProp>();
  const {
    state,
    loading,
    connected,
    currentUser,
    isPrimaryAdmin: ctxIsPrimaryAdmin,
    isApprovedAgent: ctxIsApprovedAgent,
    biometricSupported,
    biometricEnabled,
    biometricIcon,
    toggleBiometricLock,
    enterRoom,
    createAndShareInvite,
    refreshState,
    logoutAccount,
  } = useMobileApp();

  const canAccessAdmin = Boolean(isPrimaryAdmin && ctxIsPrimaryAdmin && currentUser?.id === '900');
  const canAccessAgency = Boolean(
    isApprovedAgent &&
      ctxIsApprovedAgent &&
      (currentUser?.id === '900' || currentUser?.isVerifiedAgent === true)
  );
  void canAccessAgency;

  const handleOpenRoom = useCallback(
    (roomId: string) => {
      enterRoom(roomId);
      navigation.navigate('LiveRoom', { roomId });
    },
    [enterRoom, navigation]
  );

  if (loading && !state) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#A78BFA" />
        <Text style={styles.loadingText}>جاري تحميل الغرف الصوتية...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>👑 رياض شات</Text>
          <Text style={styles.subBrand}>
            {currentUser ? `ID: ${currentUser.id} · ` : ''}
            {connected ? 'متصل لحظياً' : 'إعادة الاتصال...'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.goldPill}>
            <Text style={styles.goldText}>
              🪙 {(currentUser?.gold ?? 0).toLocaleString('en-US')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => void createAndShareInvite()}
            activeOpacity={0.85}
          >
            <Text style={styles.inviteBtnText}>دعوة</Text>
          </TouchableOpacity>
          {canAccessAdmin && (
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={() => navigation.navigate('Admin')}
              activeOpacity={0.85}
            >
              <Text style={styles.adminBtnText}>🛡️ الإدارة</Text>
            </TouchableOpacity>
          )}
          {biometricSupported && (
            <TouchableOpacity
              style={[
                styles.biometricToggleBtn,
                biometricEnabled && styles.biometricToggleActive,
              ]}
              onPress={() => void toggleBiometricLock()}
              activeOpacity={0.85}
              accessibilityLabel={
                biometricEnabled ? 'تعطيل الدخول بالبصمة' : 'تفعيل الدخول بالبصمة'
              }
            >
              <Text style={styles.biometricToggleText}>
                {biometricEnabled ? biometricIcon : '🔓'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => void logoutAccount()}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutBtnText}>خروج</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={state?.rooms || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refreshState({ force: true })}
            tintColor="#A78BFA"
          />
        }
        renderItem={({ item }) => (
          <AnimatedRoomCard room={item} onOpenRoom={handleOpenRoom} />
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0620' },
  center: {
    flex: 1,
    backgroundColor: '#0B0620',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,92,246,0.22)',
  },
  brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  subBrand: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goldPill: {
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderColor: 'rgba(251,191,36,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  goldText: { color: '#FDE68A', fontSize: 12, fontWeight: '700' },
  inviteBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inviteBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  adminBtn: {
    backgroundColor: 'rgba(250,204,21,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminBtnText: { color: '#FDE047', fontSize: 11, fontWeight: '800' },
  biometricToggleBtn: {
    backgroundColor: 'rgba(148,163,184,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  biometricToggleActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: 'rgba(52,211,153,0.55)',
  },
  biometricToggleText: { fontSize: 12 },
  logoutBtn: {
    backgroundColor: 'rgba(244,63,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutBtnText: { color: '#FECDD3', fontSize: 11, fontWeight: '700' },
  listContent: { padding: 14, gap: 12 },
  roomCard: {
    backgroundColor: '#160F35',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.32)',
  },
  roomTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.65)',
    backgroundColor: '#1E1B4B',
  },
  ownerAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.65)',
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarFallbackText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  roomTitleCol: { flex: 1 },
  roomTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  ownerSubtitle: { color: '#A5B4FC', fontSize: 11, marginTop: 2, fontWeight: '600' },
  heatBadge: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heatText: { color: '#FCD34D', fontSize: 11, fontWeight: '800' },
  roomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,92,246,0.16)',
  },
  metaText: { color: '#CBD5E1', fontSize: 12 },
});
