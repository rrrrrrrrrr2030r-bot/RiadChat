import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useMobileApp } from '../context/MobileAppContext';

interface InviteFriendsScreenProps {
  isPrimaryAdmin?: boolean;
  isApprovedAgent?: boolean;
}

export const InviteFriendsScreen: React.FC<InviteFriendsScreenProps> = ({
  isPrimaryAdmin = false,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    state,
    currentUser,
    isPrimaryAdmin: ctxIsPrimaryAdmin,
    activeRoomId,
    createAndShareInvite,
    redeemInvite,
  } = useMobileApp();
  const [codeInput, setCodeInput] = useState('');

  const canAccessAdmin = Boolean(isPrimaryAdmin && ctxIsPrimaryAdmin && currentUser?.id === '900');
  const visibleInvites = (state?.invites || []).filter(
    (inv) => canAccessAdmin || !currentUser || inv.inviterId === currentUser.id
  );

  const handleRedeem = async () => {
    const joinedRoomId = await redeemInvite(codeInput);
    setCodeInput('');
    if (joinedRoomId) {
      navigation.navigate('LiveRoom', { roomId: joinedRoomId });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔗 روابط دعوة الأصدقاء</Text>
        <Text style={styles.subtitle}>
          شارك رابط الدعوة عبر واتساب أو تطبيقات الهاتف واربح +1,000,000 ذهبية
        </Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => void createAndShareInvite(activeRoomId || undefined)}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryBtnText}>
            إنشاء ومشاركة رابط دعوة فوري 📤
          </Text>
        </TouchableOpacity>

        <View style={styles.redeemRow}>
          <TextInput
            style={styles.input}
            value={codeInput}
            onChangeText={setCodeInput}
            placeholder="أدخل كود الدعوة (مثال: RIYADH900)"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.redeemBtn} onPress={() => void handleRedeem()}>
            <Text style={styles.redeemText}>تفعيل</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={visibleInvites}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.inviteRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteCode}>{item.code}</Text>
              <Text style={styles.inviteMeta}>
                {item.roomTitle ? `غرفة: ${item.roomTitle} · ` : ''}
                {item.uses} انضمام · بواسطة {item.inviterName}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.miniShare}
              onPress={() => void createAndShareInvite(item.roomId)}
            >
              <Text style={styles.miniShareText}>مشاركة</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0620' },
  header: { padding: 16, gap: 4 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#CBD5E1', fontSize: 12 },
  card: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#160F35',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    gap: 12,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  redeemRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 13,
  },
  redeemBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  redeemText: { color: '#1E1B4B', fontWeight: '800', fontSize: 13 },
  list: { padding: 16, gap: 10 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#140E30',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inviteCode: { color: '#FDE047', fontSize: 14, fontWeight: '800' },
  inviteMeta: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  miniShare: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  miniShareText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
