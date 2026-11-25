import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../App';
import { useMobileApp } from '../context/MobileAppContext';

interface AdminDashboardScreenProps {
  isPrimaryAdmin: boolean;
  isApprovedAgent?: boolean;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  isPrimaryAdmin,
}) => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const {
    state,
    currentUser,
    isPrimaryAdmin: ctxIsPrimaryAdmin,
    addTreasuryGoldAsAdmin,
    boostAllRoomsAsAdmin,
    updateGlobalAnnouncementAsAdmin,
    approveAgencyRequestAsAdmin,
    rejectAgencyRequestAsAdmin,
  } = useMobileApp();

  const [announcementInput, setAnnouncementInput] = useState(
    state?.globalAnnouncement || ''
  );
  const [busy, setBusy] = useState(false);

  const authorized = Boolean(
    isPrimaryAdmin && ctxIsPrimaryAdmin && currentUser?.id === '900'
  );

  // Silent redirect to Rooms whenever authorization is absent or revoked
  useEffect(() => {
    if (!authorized) {
      navigation.navigate('Rooms');
    }
  }, [authorized, navigation]);

  if (!authorized) {
    return null;
  }

  const pendingAgencyRequests = (state?.agencyRequests || []).filter(
    (r) => r.status === 'pending'
  );

  const handleTreasury = async (amount: number) => {
    setBusy(true);
    try {
      await addTreasuryGoldAsAdmin(amount);
    } finally {
      setBusy(false);
    }
  };

  const handleBoostAll = async () => {
    setBusy(true);
    try {
      await boostAllRoomsAsAdmin();
    } finally {
      setBusy(false);
    }
  };

  const handleAnnouncement = async () => {
    if (!announcementInput.trim()) return;
    setBusy(true);
    try {
      await updateGlobalAnnouncementAsAdmin(announcementInput);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>🛡️ لوحة التحكم والإدارة (ID: 900)</Text>
          <Text style={styles.subtitle}>
            صلاحيات حصرية للمالك الأساسي فقط · مرتبطة مباشرة بالخادم وقاعدة البيانات
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>المستخدمون</Text>
            <Text style={styles.statValue}>{state?.users.length ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>الغرف النشطة</Text>
            <Text style={styles.statValue}>{state?.rooms.length ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>روابط الدعوة</Text>
            <Text style={styles.statValue}>{state?.invites.length ?? 0}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 خزينة النظام والغرف</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.goldBtn, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void handleTreasury(100_000_000)}
            >
              <Text style={styles.goldBtnText}>+100M للخزينة</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.violetBtn, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void handleBoostAll()}
            >
              <Text style={styles.violetBtnText}>⚡ تعزيز كافة الغرف</Text>
            </TouchableOpacity>
          </View>
        </View>

        {pendingAgencyRequests.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              📋 طلبات فتح الوكالات بانتظار موافقتك ({pendingAgencyRequests.length})
            </Text>
            {pendingAgencyRequests.map((req) => (
              <View key={req.id} style={styles.requestRow}>
                <Text style={styles.requestTitle}>
                  {req.agencyTitle} · {req.userName} (ID: {req.userId})
                </Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.approveBtn, busy && styles.disabled]}
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        await approveAgencyRequestAsAdmin(req.id);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Text style={styles.approveBtnText}>موافقة وفتح الوكالة</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectBtn, busy && styles.disabled]}
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        await rejectAgencyRequestAsAdmin(req.id);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Text style={styles.rejectBtnText}>رفض</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📢 الإعلان العام للتطبيق</Text>
          <TextInput
            style={styles.input}
            value={announcementInput}
            onChangeText={setAnnouncementInput}
            placeholder="اكتب إعلاناً فورياً لجميع المستخدمين..."
            placeholderTextColor="#94A3B8"
            multiline
          />
          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void handleAnnouncement()}
          >
            <Text style={styles.primaryBtnText}>بث الإعلان العام</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0620' },
  scroll: { padding: 16, gap: 14 },
  header: { gap: 4 },
  title: { color: '#FDE047', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  subtitle: { color: '#C7D2FE', fontSize: 12, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#160F35',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  card: {
    borderRadius: 18,
    backgroundColor: '#160F35',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.32)',
    padding: 14,
    gap: 12,
  },
  cardTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  goldBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldBtnText: { color: '#1E1B4B', fontSize: 13, fontWeight: '900' },
  violetBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  violetBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  input: {
    minHeight: 68,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#FFFFFF',
    padding: 12,
    fontSize: 13,
    textAlign: 'right',
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  requestRow: {
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    padding: 10,
    gap: 8,
  },
  requestTitle: { color: '#FDE68A', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  approveBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: { color: '#052E16', fontSize: 12, fontWeight: '900' },
  rejectBtn: {
    minWidth: 74,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(244,63,94,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  rejectBtnText: { color: '#FECDD3', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
