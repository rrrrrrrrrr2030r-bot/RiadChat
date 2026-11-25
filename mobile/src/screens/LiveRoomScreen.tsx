import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { MediaStream } from 'react-native-webrtc';
import type { RootStackParamList } from '../../App';
import {
  useMobileApp,
  type MobileWsConnectionStatus,
} from '../context/MobileAppContext';
import {
  acquireNativeVoiceStream,
  releaseNativeVoiceStream,
} from '../services/nativeBridge';
import { GamesScreen } from './GamesScreen';
import {
  formatRoomHeat,
  getRoomSharedTags,
  roomSharedTransition,
} from '../animations/roomSharedTransitions';

interface ConnectionStatusBadgeProps {
  status: MobileWsConnectionStatus;
  onRetry: () => void;
}

const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = React.memo(
  ({ status, onRetry }) => {
    const pulseOpacity = useSharedValue(1);
    const pulseScale = useSharedValue(1);

    useEffect(() => {
      if (status === 'reconnecting') {
        pulseOpacity.value = withRepeat(
          withSequence(withTiming(0.28, { duration: 520 }), withTiming(1, { duration: 520 })),
          -1,
          false
        );
        pulseScale.value = withRepeat(
          withSequence(withTiming(1.25, { duration: 520 }), withTiming(0.92, { duration: 520 })),
          -1,
          false
        );
      } else {
        cancelAnimation(pulseOpacity);
        cancelAnimation(pulseScale);
        pulseOpacity.value = withTiming(1, { duration: 180 });
        pulseScale.value = withTiming(1, { duration: 180 });
      }
      return () => {
        cancelAnimation(pulseOpacity);
        cancelAnimation(pulseScale);
      };
    }, [pulseOpacity, pulseScale, status]);

    const dotAnimatedStyle = useAnimatedStyle(() => ({
      opacity: pulseOpacity.value,
      transform: [{ scale: pulseScale.value }],
    }));

    const isInteractive = status !== 'connected';
    const visual =
      status === 'connected'
        ? {
            dot: '#22C55E',
            text: '#86EFAC',
            bg: 'rgba(34,197,94,0.14)',
            border: 'rgba(34,197,94,0.42)',
            label: 'متصل',
          }
        : status === 'reconnecting'
        ? {
            dot: '#F59E0B',
            text: '#FDE68A',
            bg: 'rgba(245,158,11,0.16)',
            border: 'rgba(245,158,11,0.48)',
            label: 'إعادة اتصال...',
          }
        : {
            dot: '#EF4444',
            text: '#FCA5A5',
            bg: 'rgba(239,68,68,0.18)',
            border: 'rgba(239,68,68,0.52)',
            label: 'منقطع',
          };

    return (
      <TouchableOpacity
        disabled={!isInteractive}
        onPress={onRetry}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`حالة الاتصال: ${visual.label}`}
        style={[
          styles.connBadge,
          { backgroundColor: visual.bg, borderColor: visual.border },
        ]}
      >
        <Animated.View
          style={[
            styles.connDot,
            { backgroundColor: visual.dot },
            dotAnimatedStyle,
          ]}
        />
        <Text style={[styles.connLabel, { color: visual.text }]} numberOfLines={1}>
          {visual.label}
        </Text>
      </TouchableOpacity>
    );
  }
);

interface LiveRoomScreenProps {
  isPrimaryAdmin?: boolean;
  isApprovedAgent?: boolean;
}

export const LiveRoomScreen: React.FC<LiveRoomScreenProps> = ({ isPrimaryAdmin = false }) => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'LiveRoom'>>();
  const {
    state,
    connectionStatus,
    reconnectWebSocket,
    currentUser,
    isPrimaryAdmin: ctxIsPrimaryAdmin,
    enterRoom,
    leaveRoom,
    toggleSeat,
    toggleMute,
    sendRoomMessage,
    sendRoomGift,
    createAndShareInvite,
    boostRoomAsAdmin,
  } = useMobileApp();

  const canAccessAdmin = Boolean(isPrimaryAdmin && ctxIsPrimaryAdmin && currentUser?.id === '900');

  const roomId = route.params.roomId;
  const room = state?.rooms.find((r) => r.id === roomId) || null;
  const [messageText, setMessageText] = useState('');
  const [gamesOverlayVisible, setGamesOverlayVisible] = useState(false);
  const voiceStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    enterRoom(roomId);
    return () => {
      releaseNativeVoiceStream(voiceStreamRef.current);
      voiceStreamRef.current = null;
      leaveRoom();
    };
  }, [roomId, enterRoom, leaveRoom]);

  const mySeat = room?.seats.find((s) => s.userId === currentUser?.id) || null;

  // Bind native WebRTC microphone lifecycle to user's active unmuted seat
  useEffect(() => {
    let cancelled = false;
    if (mySeat && !mySeat.isMuted) {
      void acquireNativeVoiceStream().then((stream) => {
        if (cancelled) {
          releaseNativeVoiceStream(stream);
          return;
        }
        voiceStreamRef.current = stream;
      });
    } else {
      releaseNativeVoiceStream(voiceStreamRef.current);
      voiceStreamRef.current = null;
    }
    return () => {
      cancelled = true;
    };
  }, [mySeat?.seatNumber, mySeat?.isMuted]);

  if (!room) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>الغرفة غير متاحة حالياً</Text>
      </SafeAreaView>
    );
  }

  const sharedTags = getRoomSharedTags(room.id);
  const hasValidAvatar = Boolean(room.ownerAvatar && /^https?:\/\//i.test(room.ownerAvatar));

  const handleSend = () => {
    if (!messageText.trim()) return;
    void sendRoomMessage(room.id, messageText);
    setMessageText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Shared Element Room Header expanded seamlessly from RoomsScreen card */}
      <Animated.View
        sharedTransitionTag={sharedTags.card}
        sharedTransitionStyle={roomSharedTransition}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
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

          <View style={styles.headerTitleCol}>
            <Text style={styles.roomTitle} numberOfLines={1}>
              {room.flag} {room.title}
            </Text>
            <Text style={styles.roomSub} numberOfLines={1}>
              المضيف: {room.ownerName} · ID:{room.ownerId}
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

        <Animated.View
          entering={FadeIn.delay(110).duration(220)}
          style={styles.headerControlsRow}
        >
          <ConnectionStatusBadge
            status={connectionStatus}
            onRetry={reconnectWebSocket}
          />
          <View style={styles.headerBtns}>
            {canAccessAdmin && (
              <TouchableOpacity
                style={styles.adminBoostBtn}
                onPress={() => void boostRoomAsAdmin(room.id)}
              >
                <Text style={styles.adminBoostText}>⚡ دعم</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => void createAndShareInvite(room.id)}
            >
              <Text style={styles.btnText}>🔗 دعوة</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.btnText}>خروج</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Voice Seats Grid with choreographed staggered Spring entrance */}
      <View style={styles.seatsGrid}>
        {room.seats.slice(0, room.totalMics).map((seat, idx) => {
          const occupied = Boolean(seat.userId);
          return (
            <Animated.View
              key={seat.seatNumber}
              entering={FadeInDown.delay(65 + Math.min(idx, 9) * 26)
                .springify()
                .damping(18)
                .stiffness(190)}
              style={styles.seatWrapper}
            >
              <TouchableOpacity
                style={[
                  styles.seatBox,
                  occupied && styles.seatOccupied,
                  seat.isSpeaking && styles.seatSpeaking,
                ]}
                onPress={() => void toggleSeat(room.id, seat.seatNumber)}
                activeOpacity={0.8}
              >
                <Text style={styles.seatIcon}>
                  {seat.isLocked ? '🔒' : occupied ? (seat.isMuted ? '🔇' : '🎙️') : '🛋️'}
                </Text>
                <Text style={styles.seatLabel} numberOfLines={1}>
                  {seat.userName || `${seat.seatNumber}`}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Live Room Chat (includes programmatic Lucky Game win broadcasts) */}
      <Animated.View entering={FadeIn.delay(145).duration(260)} style={styles.chatContainer}>
        <FlatList
          data={room.messages}
          keyExtractor={(m) => m.id}
          style={styles.chatList}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.msgBubble,
                item.type === 'achievement' && styles.msgAchievement,
              ]}
            >
              <Text style={styles.msgSender}>
                Lv.{item.senderLevel} {item.senderName}:
              </Text>
              <Text style={styles.msgText}>{item.text}</Text>
            </View>
          )}
        />
      </Animated.View>

      {/* Unified Evenly Spaced Room Bottom Controls */}
      <Animated.View
        entering={FadeInDown.delay(175).springify().damping(20).stiffness(175)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.bottomArea}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="اكتب رسالة للغرفة..."
              placeholderTextColor="#94A3B8"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Text style={styles.btnText}>إرسال</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dockRow}>
            <TouchableOpacity
              style={[styles.dockBtn, mySeat && !mySeat.isMuted && styles.dockMicLive]}
              onPress={() => {
                if (mySeat) {
                  void toggleMute(room.id, mySeat.seatNumber);
                } else {
                  const free = room.seats.find((s) => !s.userId && !s.isLocked);
                  if (free) void toggleSeat(room.id, free.seatNumber);
                }
              }}
            >
              <Text style={styles.dockText}>
                {mySeat ? (mySeat.isMuted ? '🔇 كتم' : '🎙️ حي') : '🎙️ صعود'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockGames}
              onPress={() => setGamesOverlayVisible(true)}
            >
              <Text style={styles.dockText}>🎮 الألعاب</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockGift}
              onPress={() => void sendRoomGift(room.id, 'gift-bouquet', room.ownerId)}
            >
              <Text style={styles.dockText}>🎁 هدية</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockInvite}
              onPress={() => void createAndShareInvite(room.id)}
            >
              <Text style={styles.dockText}>🔗 رابط</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Programmatically Linked Games Modal Keeping Voice Room Live */}
      <Modal
        visible={gamesOverlayVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGamesOverlayVisible(false)}
      >
        <GamesScreen
          isPrimaryAdmin={canAccessAdmin}
          onCloseModal={() => setGamesOverlayVisible(false)}
        />
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#03145C' },
  emptyText: { color: '#FFFFFF', textAlign: 'center', marginTop: 40 },
  header: {
    marginHorizontal: 10,
    marginTop: 6,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,66,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.38)',
    gap: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.75)',
    backgroundColor: '#1E1B4B',
  },
  ownerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.75)',
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarFallbackText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  headerTitleCol: { flex: 1 },
  roomTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  roomSub: { color: '#BAE6FD', fontSize: 11, marginTop: 2 },
  heatBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heatText: { color: '#FCD34D', fontSize: 11, fontWeight: '800' },
  headerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  connDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  connLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  headerBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  adminBoostBtn: {
    backgroundColor: 'rgba(250,204,21,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  adminBoostText: { color: '#FDE047', fontSize: 12, fontWeight: '800' },
  shareBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  closeBtn: {
    backgroundColor: 'rgba(225,29,72,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  seatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    rowGap: 8,
  },
  seatWrapper: {
    width: '18.5%',
  },
  seatBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1.5,
    borderColor: '#FACC15',
  },
  seatOccupied: { backgroundColor: 'rgba(124,58,237,0.45)' },
  seatSpeaking: { borderColor: '#34D399' },
  seatIcon: { fontSize: 16 },
  seatLabel: { color: '#E2E8F0', fontSize: 10, marginTop: 2, fontWeight: '600' },
  chatContainer: { flex: 1 },
  chatList: { flex: 1 },
  msgBubble: {
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  msgAchievement: {
    backgroundColor: 'rgba(245,158,11,0.22)',
    borderColor: 'rgba(253,224,71,0.55)',
  },
  msgSender: { color: '#7DD3FC', fontSize: 11, fontWeight: '800' },
  msgText: { color: '#FFFFFF', fontSize: 12, marginTop: 2 },
  bottomArea: {
    backgroundColor: 'rgba(3,10,45,0.9)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  dockRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  dockBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockMicLive: { backgroundColor: '#059669' },
  dockGames: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockGift: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockInvite: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
