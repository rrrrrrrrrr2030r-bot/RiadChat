import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMobileApp } from '../context/MobileAppContext';

const FRUIT_ITEMS = [
  { id: 'orange', name: 'برتقال', icon: '🍊', mult: 5 },
  { id: 'kiwi', name: 'كيوي', icon: '🥝', mult: 5 },
  { id: 'tomato', name: 'طماطم', icon: '🍅', mult: 5 },
  { id: 'watermelon', name: 'بطيخ', icon: '🍉', mult: 5 },
  { id: 'pomegranate', name: 'رمان', icon: '🍎', mult: 10 },
  { id: 'dates', name: 'تمر', icon: '🌰', mult: 15 },
  { id: 'lemon', name: 'ليمون', icon: '🍋', mult: 25 },
  { id: 'avocado', name: 'أفوكادو', icon: '🥑', mult: 45 },
];

const CHIPS = [10_000, 100_000, 1_000_000, 10_000_000];

interface GamesScreenProps {
  isPrimaryAdmin?: boolean;
  isApprovedAgent?: boolean;
  onCloseModal?: () => void;
}

export const GamesScreen: React.FC<GamesScreenProps> = ({
  isPrimaryAdmin = false,
  onCloseModal,
}) => {
  const {
    state,
    currentUser,
    isPrimaryAdmin: ctxIsPrimaryAdmin,
    activeRoom,
    placeGameBet,
    settleGameWin,
  } = useMobileApp();
  const canAccessAdmin = Boolean(isPrimaryAdmin && ctxIsPrimaryAdmin && currentUser?.id === '900');
  const [selectedChip, setSelectedChip] = useState(100_000);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleBet = async (itemId: string) => {
    if (spinning) return;
    const ok = await placeGameBet(selectedChip);
    if (!ok) return;
    setBets((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + selectedChip }));
  };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setTimeout(async () => {
      const winner = FRUIT_ITEMS[Math.floor(Math.random() * FRUIT_ITEMS.length)];
      const staked = bets[winner.id] || 0;
      const payout = staked * winner.mult;
      if (payout > 0) {
        await settleGameWin('لعبة الفواكه', winner.icon, payout);
        setLastResult(`🎉 فاز ${winner.icon} ${winner.name} (×${winner.mult}) — ربحت +${payout.toLocaleString('en-US')} ذهبية!`);
      } else {
        setLastResult(`نتيجة الجولة: ${winner.icon} ${winner.name} (×${winner.mult})`);
      }
      setBets({});
      setSpinning(false);
    }, 900);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>🎰 ألعاب الحظ المرتبطة بالغرفة</Text>
            <Text style={styles.subtitle}>
              {activeRoom
                ? `مرتبطة مباشرة بغرفة: ${activeRoom.title}`
                : 'العب واجمع نقاط الجاك بوت واسترداد 8% اليومي'}
            </Text>
          </View>
          {onCloseModal && (
            <TouchableOpacity style={styles.closeBtn} onPress={onCloseModal}>
              <Text style={styles.closeText}>إغلاق</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.balanceBar}>
          <Text style={styles.balanceText}>
            🪙 رصيدك: {(currentUser?.gold ?? 0).toLocaleString('en-US')}
            {canAccessAdmin && state ? ` · نمط المالك: ${state.gameLuckMode}` : ''}
          </Text>
        </View>

        {lastResult && (
          <View style={styles.resultBanner}>
            <Text style={styles.resultText}>{lastResult}</Text>
          </View>
        )}

        <View style={styles.grid}>
          {FRUIT_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.tile, (bets[item.id] || 0) > 0 && styles.tileActive]}
              onPress={() => void handleBet(item.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.tileIcon}>{item.icon}</Text>
              <Text style={styles.tileName}>{item.name}</Text>
              <Text style={styles.tileMult}>×{item.mult}</Text>
              {(bets[item.id] || 0) > 0 && (
                <Text style={styles.tileBet}>
                  {(bets[item.id] / 1000).toFixed(0)}K
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chipsRow}>
          {CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={[styles.chip, selectedChip === chip && styles.chipSelected]}
              onPress={() => setSelectedChip(chip)}
            >
              <Text style={styles.chipText}>
                {chip >= 1_000_000 ? `${chip / 1_000_000}M` : `${chip / 1000}K`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.spinBtn, spinning && styles.spinDisabled]}
          onPress={() => void handleSpin()}
          disabled={spinning}
        >
          <Text style={styles.spinText}>
            {spinning ? 'جاري السحب...' : 'ابدأ الجولة الآن 🎲'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#160836' },
  scroll: { padding: 16, gap: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#C4B5FD', fontSize: 12, marginTop: 2 },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  closeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  balanceBar: {
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  balanceText: { color: '#FDE68A', fontSize: 15, fontWeight: '800' },
  resultBanner: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: 'rgba(52,211,153,0.45)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  resultText: { color: '#A7F3D0', fontSize: 13, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  tile: {
    width: '23.5%',
    backgroundColor: '#251355',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  tileActive: {
    borderColor: '#FACC15',
    backgroundColor: '#3B1E80',
  },
  tileIcon: { fontSize: 28 },
  tileName: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginTop: 4 },
  tileMult: { color: '#FDE047', fontSize: 11, fontWeight: '800' },
  tileBet: { color: '#34D399', fontSize: 10, fontWeight: '800', marginTop: 2 },
  chipsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#24144E',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  chipSelected: { backgroundColor: '#7C3AED', borderColor: '#FDE047' },
  chipText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  spinBtn: {
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinDisabled: { opacity: 0.6 },
  spinText: { color: '#1E1B4B', fontSize: 16, fontWeight: '900' },
});
