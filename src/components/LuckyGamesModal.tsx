import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ChevronLeft,
  ClipboardList,
  Coins,
  Crown,
  HelpCircle,
  History,
  Info,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GAME_FOODIE_ICON_PATH, GAME_FRUIT_ICON_PATH } from '../data/seedData';
import { Top3Winner } from '../types';
import { formatCompactNumber, formatFullGold } from '../utils/format';

export type LuckyGameKind = 'launcher' | 'fruit' | 'foodie';

interface LuckyGamesModalProps {
  open: boolean;
  initialMode?: LuckyGameKind;
  onClose: () => void;
}

const CHIPS = [
  { value: 100_000_000, label: '100M', isOrange: false },
  { value: 10_000_000, label: '10M', isOrange: false },
  { value: 1_000_000, label: '1M', isOrange: false },
  { value: 100_000, label: '100K', isOrange: false },
  { value: 10_000, label: '10K', isOrange: true },
];

// 8 Fruits around a 3x3 grid matching Screenshot a4abf4b9 (bright pastel tiles + royal cabinet)
const FRUIT_SLOTS = [
  {
    id: 'orange',
    name: 'برتقال',
    icon: '🍊',
    mult: 5,
    gridArea: '1 / 1',
    tileBg: 'from-[#67E8F9] via-[#38BDF8] to-[#0284C7] border-[#BAE6FD]',
  },
  {
    id: 'kiwi',
    name: 'كيوي',
    icon: '🥝',
    mult: 5,
    gridArea: '1 / 2',
    tileBg: 'from-[#D9F99D] via-[#A3E635] to-[#65A30D] border-[#ECFCCB]',
  },
  {
    id: 'tomato',
    name: 'طماطم',
    icon: '🍅',
    mult: 5,
    gridArea: '1 / 3',
    tileBg: 'from-[#E9D5FF] via-[#C084FC] to-[#9333EA] border-[#F3E8FF]',
  },
  {
    id: 'avocado',
    name: 'أفوكادو',
    icon: '🥑',
    mult: 45,
    gridArea: '2 / 1',
    tileBg: 'from-[#C7D2FE] via-[#818CF8] to-[#4F46E5] border-[#E0E7FF]',
  },
  {
    id: 'watermelon',
    name: 'بطيخ',
    icon: '🍉',
    mult: 5,
    gridArea: '2 / 3',
    tileBg: 'from-[#86EFAC] via-[#4ADE80] to-[#16A34A] border-[#DCFCE7]',
  },
  {
    id: 'lemon',
    name: 'ليمون',
    icon: '🍋',
    mult: 25,
    gridArea: '3 / 1',
    tileBg: 'from-[#FEF08A] via-[#FACC15] to-[#CA8A04] border-[#FEF9C3]',
  },
  {
    id: 'dates',
    name: 'تمر',
    icon: '🌰',
    mult: 15,
    gridArea: '3 / 2',
    tileBg: 'from-[#FED7AA] via-[#FB923C] to-[#C2410C] border-[#FFEDD5]',
  },
  {
    id: 'pomegranate',
    name: 'رمان',
    icon: '🍎',
    mult: 10,
    gridArea: '3 / 3',
    tileBg: 'from-[#FECDD3] via-[#FB7185] to-[#BE123C] border-[#FFE4E6]',
  },
];

// 8 Dishes arranged around the Foodie Dog Ferris Wheel matching Screenshot 1b3e39a2
const FOODIE_WHEEL = [
  { id: 'tomato', name: 'طماطم', icon: '🍅', mult: 5, x: 50, y: 12, kind: 'veg' as const },
  { id: 'carrot', name: 'جزر', icon: '🥕', mult: 5, x: 78, y: 23, kind: 'veg' as const },
  { id: 'corn', name: 'ذرة', icon: '🌽', mult: 5, x: 89, y: 49, kind: 'veg' as const },
  { id: 'cabbage', name: 'خس', icon: '🥬', mult: 5, x: 78, y: 76, kind: 'veg' as const, hot: true },
  { id: 'lobster', name: 'كركند', icon: '🦞', mult: 10, x: 50, y: 88, kind: 'meat' as const },
  { id: 'steak', name: 'لحم', icon: '🥩', mult: 15, x: 22, y: 76, kind: 'meat' as const },
  { id: 'fish', name: 'سمك', icon: '🐟', mult: 25, x: 11, y: 49, kind: 'meat' as const },
  { id: 'chicken', name: 'دجاج', icon: '🍗', mult: 45, x: 22, y: 23, kind: 'meat' as const },
];

interface HistoryEntry {
  round: number;
  time: string;
  bets: Array<{ icon: string; amount: number }>;
  winIcon: string;
  payout: number;
}

function playArcadeTone(enabled: boolean, kind: 'chip' | 'tick' | 'win') {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (kind === 'chip') {
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } else if (kind === 'tick') {
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Audio playback optional
  }
}

const CONFETTI_PIECES = [
  { id: 1, x: '10%', color: '#FDE047', delay: 0 },
  { id: 2, x: '22%', color: '#38BDF8', delay: 0.12 },
  { id: 3, x: '36%', color: '#A855F7', delay: 0.05 },
  { id: 4, x: '50%', color: '#34D399', delay: 0.18 },
  { id: 5, x: '64%', color: '#FB7185', delay: 0.08 },
  { id: 6, x: '78%', color: '#FACC15', delay: 0.15 },
  { id: 7, x: '89%', color: '#60A5FA', delay: 0.04 },
];

interface RoundTop3PodiumModalProps {
  round: number;
  winningIcon: string;
  winningName: string;
  winningMult: number;
  personalPayout: number;
  winners: Top3Winner[];
  accentTheme: 'purple' | 'crimson';
}

const RoundTop3PodiumModal: React.FC<RoundTop3PodiumModalProps> = ({
  round,
  winningIcon,
  winningName,
  winningMult,
  personalPayout,
  winners,
  accentTheme,
}) => {
  // Display Rank 2 | Rank 1 (center elevated) | Rank 3 side-by-side horizontally
  const rank1 = winners.find((w) => w.rank === 1) || winners[0];
  const rank2 = winners.find((w) => w.rank === 2) || winners[1];
  const rank3 = winners.find((w) => w.rank === 3) || winners[2];
  const podiumOrder = [rank2, rank1, rank3].filter(Boolean) as Top3Winner[];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className={`absolute inset-x-3 top-10 sm:top-12 max-h-[calc(100%-3rem)] overflow-y-auto z-30 rounded-3xl border-2 border-yellow-300 p-3 sm:p-4 text-center text-white shadow-[0_0_45px_rgba(251,191,36,0.45)] ${
        accentTheme === 'purple'
          ? 'bg-gradient-to-b from-[#4C1D95]/98 via-[#2E1065]/98 to-[#170936]/98'
          : 'bg-gradient-to-b from-[#991B1B]/98 via-[#5B0F1B]/98 to-[#2B060D]/98'
      }`}
    >
      {/* Celebratory Confetti Particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {CONFETTI_PIECES.map((c) => (
          <motion.span
            key={c.id}
            initial={{ y: -14, opacity: 1, rotate: 0 }}
            animate={{ y: 260, opacity: [1, 1, 0], rotate: [0, 180, 360] }}
            transition={{ duration: 2.2, delay: c.delay, repeat: Infinity }}
            style={{ left: c.x, backgroundColor: c.color }}
            className="absolute top-0 w-2.5 h-2.5 rounded-xs shadow"
          />
        ))}
      </div>

      {/* Round Winning Item + Personal Payout Above Top 3 */}
      <div className="relative z-10 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-l from-amber-300 to-yellow-400 text-amber-950 text-xs font-black shadow">
          <Sparkles className="w-3.5 h-3.5" />
          <span>أعلى 3 فائزين — جولة {round}</span>
        </div>

        <div className="flex items-center justify-center gap-3 bg-black/35 border border-yellow-300/35 rounded-2xl px-3 py-2">
          <span className="text-4xl drop-shadow">{winningIcon}</span>
          <div className="text-right">
            <div className="text-xs font-display font-extrabold text-yellow-200">
              الفائز: {winningName} (×{winningMult})
            </div>
            <div className="text-xs sm:text-sm font-mono-num font-black text-emerald-300">
              {personalPayout > 0
                ? `ربحك الشخصي: +${formatFullGold(personalPayout)} 🪙`
                : 'حظاً أوفر في الجولة القادمة!'}
            </div>
          </div>
        </div>

        {/* Horizontal Side-by-Side Top 3 Podium (Rank 2 · Rank 1 · Rank 3) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end pt-2">
          {podiumOrder.map((winner) => {
            const isFirst = winner.rank === 1;
            const isSecond = winner.rank === 2;
            const ringStyle = isFirst
              ? 'border-amber-300 shadow-[0_0_22px_rgba(253,224,71,0.9)]'
              : isSecond
              ? 'border-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.75)]'
              : 'border-orange-300 shadow-[0_0_14px_rgba(253,186,116,0.7)]';
            const podiumBg = isFirst
              ? 'bg-gradient-to-b from-amber-400/30 to-amber-950/60 border-amber-300/75 pb-3 pt-4'
              : 'bg-white/10 border-white/25 py-2.5';

            return (
              <div
                key={`${winner.id}-${winner.rank}`}
                className={`rounded-2xl border px-1.5 flex flex-col items-center justify-end gap-1.5 ${podiumBg}`}
              >
                <div className="relative">
                  <Crown
                    className={`w-5 h-5 mx-auto -mb-1.5 relative z-10 fill-current ${
                      isFirst
                        ? 'text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,1)]'
                        : isSecond
                        ? 'text-sky-300'
                        : 'text-orange-300'
                    }`}
                  />
                  <img
                    src={winner.avatar}
                    alt={winner.name}
                    referrerPolicy="no-referrer"
                    className={`rounded-full object-cover border-2 ${ringStyle} ${
                      isFirst ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-11 h-11 sm:w-12 sm:h-12'
                    }`}
                  />
                  <span
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-[1px] rounded-full text-[9px] font-mono-num font-black border border-white/60 ${
                      isFirst
                        ? 'bg-amber-400 text-amber-950'
                        : isSecond
                        ? 'bg-sky-400 text-slate-950'
                        : 'bg-orange-400 text-amber-950'
                    }`}
                  >
                    #{winner.rank}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-white truncate w-full px-1 mt-0.5">
                  {winner.name}
                </div>

                <div
                  className={`font-mono-num font-black leading-none bg-gradient-to-b from-yellow-200 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${
                    isFirst ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
                  }`}
                >
                  +{formatCompactNumber(winner.wonGold)} 🪙
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export const LuckyGamesModal: React.FC<LuckyGamesModalProps> = ({
  open,
  initialMode = 'launcher',
  onClose,
}) => {
  const {
    state,
    currentUser,
    adjustUserGold,
    recordGameBet,
    claimDailyCashback,
    announceGameWinInRoom,
    openWallet,
    showToast,
  } = useApp();

  const [mode, setMode] = useState<LuckyGameKind>(initialMode);
  const [selectedChip, setSelectedChip] = useState<number>(10_000);
  const [soundOn, setSoundOn] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  // Fruit Slot state
  const [fruitRound, setFruitRound] = useState(606);
  const [fruitTime, setFruitTime] = useState(25);
  const [fruitPhase, setFruitPhase] = useState<'betting' | 'spinning' | 'result'>('betting');
  const [fruitBets, setFruitBets] = useState<Record<string, number>>({});
  const [lastFruitBets, setLastFruitBets] = useState<Record<string, number>>({});
  const [fruitSweepIdx, setFruitSweepIdx] = useState<number | null>(null);
  const [fruitWinnerId, setFruitWinnerId] = useState<string>('tomato');
  const [fruitHistoryIcons, setFruitHistoryIcons] = useState<string[]>([
    '🍅', '🍋', '🍋', '🍅', '🍅', '🍊', '🍉', '🍎', '🍊',
  ]);
  const [fruitDailyProfit, setFruitDailyProfit] = useState(207_095_000);
  const [fruitLastPayout, setFruitLastPayout] = useState(0);
  const [fruitHistoryOpen, setFruitHistoryOpen] = useState(false);
  const [fruitHistory, setFruitHistory] = useState<HistoryEntry[]>([
    {
      round: 605,
      time: 'منذ دقيقة',
      bets: [
        { icon: '🍊', amount: 1_000_000 },
        { icon: '🥝', amount: 500_000 },
      ],
      winIcon: '🍊',
      payout: 5_000_000,
    },
  ]);

  // Foodie Dog state
  const [foodieRound, setFoodieRound] = useState(833);
  const [foodieTime, setFoodieTime] = useState(20);
  const [foodiePhase, setFoodiePhase] = useState<'betting' | 'spinning' | 'result'>('betting');
  const [foodieBets, setFoodieBets] = useState<Record<string, number>>({});
  const [lastFoodieBets, setLastFoodieBets] = useState<Record<string, number>>({});
  const [foodieSweepIdx, setFoodieSweepIdx] = useState<number | null>(null);
  const [foodieWinnerId, setFoodieWinnerId] = useState<string>('corn');
  const [foodieRecentIcons, setFoodieRecentIcons] = useState<string[]>([
    '🍅', '🍗', '🥬', '🍅', '🌽', '🍅', '🌽',
  ]);
  const [foodieDailyRevenue, setFoodieDailyRevenue] = useState(1_770_000_000);
  const [foodieLastPayout, setFoodieLastPayout] = useState(0);
  const [foodieHistoryOpen, setFoodieHistoryOpen] = useState(false);
  const [foodieHistory, setFoodieHistory] = useState<HistoryEntry[]>([
    {
      round: 832,
      time: 'الآن',
      bets: [
        { icon: '🥬', amount: 10_000_000 },
        { icon: '🐟', amount: 10_000_000 },
        { icon: '🥕', amount: 10_000_000 },
      ],
      winIcon: '🥬',
      payout: 50_000_000,
    },
    {
      round: 831,
      time: 'منذ دقيقة',
      bets: [
        { icon: '🥩', amount: 20_000_000 },
        { icon: '🍗', amount: 10_000_000 },
      ],
      winIcon: '🥩',
      payout: 300_000_000,
    },
  ]);

  const sweepTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setFoodieHistoryOpen(false);
      setFruitHistoryOpen(false);
      setRulesOpen(false);
      setRankingOpen(false);
    }
  }, [open, initialMode]);

  useEffect(() => {
    return () => {
      if (sweepTimerRef.current) window.clearInterval(sweepTimerRef.current);
    };
  }, []);

  const winBias = useMemo(() => {
    if (state.gameLuckMode === 'generous') return 0.6;
    if (state.gameLuckMode === 'balanced') return 0.42;
    return 0.26;
  }, [state.gameLuckMode]);

  // Countdown tick for Fruit Slot
  useEffect(() => {
    if (!open || mode !== 'fruit') return;
    if (fruitPhase === 'betting') {
      const id = window.setInterval(() => {
        setFruitTime((prev) => {
          if (prev <= 1) {
            setFruitPhase('spinning');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => window.clearInterval(id);
    }
  }, [open, mode, fruitPhase]);

  // Spin sweep for Fruit Slot
  useEffect(() => {
    if (!open || mode !== 'fruit' || fruitPhase !== 'spinning') return;

    const betKeys = Object.keys(fruitBets).filter((k) => fruitBets[k] > 0);
    let targetIdx = Math.floor(Math.random() * FRUIT_SLOTS.length);
    if (betKeys.length > 0 && Math.random() < winBias) {
      const luckyId = betKeys[Math.floor(Math.random() * betKeys.length)];
      const found = FRUIT_SLOTS.findIndex((f) => f.id === luckyId);
      if (found >= 0) targetIdx = found;
    }

    let step = 0;
    const totalSteps = 16 + targetIdx;
    const interval = window.setInterval(() => {
      setFruitSweepIdx(step % FRUIT_SLOTS.length);
      playArcadeTone(soundOn, 'tick');
      step += 1;
      if (step > totalSteps) {
        window.clearInterval(interval);
        const winner = FRUIT_SLOTS[targetIdx];
        setFruitWinnerId(winner.id);
        setFruitHistoryIcons((prev) => [winner.icon, ...prev].slice(0, 9));

        const stakedOnWinner = fruitBets[winner.id] || 0;
        const payout = Math.round(stakedOnWinner * winner.mult * state.diceMultiplier);
        setFruitLastPayout(payout);
        if (payout > 0) {
          adjustUserGold(currentUser.id, payout);
          setFruitDailyProfit((p) => p + payout);
          playArcadeTone(soundOn, 'win');
          announceGameWinInRoom('لعبة الفواكه', winner.icon, payout);
          showToast(`🍊 فوز رائع في الفواكه! +${formatFullGold(payout)} ذهب`, 'success');
        }
        const betItems = Object.entries(fruitBets)
          .filter(([, amt]) => amt > 0)
          .map(([id, amount]) => ({
            icon: FRUIT_SLOTS.find((f) => f.id === id)?.icon || '🍊',
            amount,
          }));
        if (betItems.length > 0) {
          setLastFruitBets(fruitBets);
          setFruitHistory((prev) => [
            {
              round: fruitRound,
              time: 'الآن',
              bets: betItems,
              winIcon: winner.icon,
              payout,
            },
            ...prev.slice(0, 11),
          ]);
        }
        setFruitPhase('result');
        window.setTimeout(() => {
          setFruitBets({});
          setFruitRound((r) => r + 1);
          setFruitTime(25);
          setFruitSweepIdx(null);
          setFruitPhase('betting');
        }, 3800);
      }
    }, 90);
    return () => window.clearInterval(interval);
  }, [open, mode, fruitPhase]);

  // Countdown tick for Foodie Dog
  useEffect(() => {
    if (!open || mode !== 'foodie') return;
    if (foodiePhase === 'betting') {
      const id = window.setInterval(() => {
        setFoodieTime((prev) => {
          if (prev <= 1) {
            setFoodiePhase('spinning');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => window.clearInterval(id);
    }
  }, [open, mode, foodiePhase]);

  // Spin sweep for Foodie Dog
  useEffect(() => {
    if (!open || mode !== 'foodie' || foodiePhase !== 'spinning') return;

    const betKeys = Object.keys(foodieBets).filter((k) => foodieBets[k] > 0);
    let targetIdx = Math.floor(Math.random() * FOODIE_WHEEL.length);
    if (betKeys.length > 0 && Math.random() < winBias) {
      const luckyId = betKeys[Math.floor(Math.random() * betKeys.length)];
      const found = FOODIE_WHEEL.findIndex((f) => f.id === luckyId);
      if (found >= 0) targetIdx = found;
    }

    let step = 0;
    const totalSteps = 16 + targetIdx;
    const interval = window.setInterval(() => {
      setFoodieSweepIdx(step % FOODIE_WHEEL.length);
      playArcadeTone(soundOn, 'tick');
      step += 1;
      if (step > totalSteps) {
        window.clearInterval(interval);
        const winner = FOODIE_WHEEL[targetIdx];
        setFoodieWinnerId(winner.id);
        setFoodieRecentIcons((prev) => [...prev.slice(-6), winner.icon]);

        const stakedOnWinner = foodieBets[winner.id] || 0;
        const payout = Math.round(stakedOnWinner * winner.mult * state.diceMultiplier);
        setFoodieLastPayout(payout);

        if (payout > 0) {
          adjustUserGold(currentUser.id, payout);
          setFoodieDailyRevenue((p) => p + payout);
          playArcadeTone(soundOn, 'win');
          announceGameWinInRoom('عجلة الخضروات واللحوم', winner.icon, payout);
          showToast(`🐶 مبروك! فزت في الخضروات واللحوم بـ +${formatFullGold(payout)} ذهب`, 'success');
        }

        const betItems = Object.entries(foodieBets)
          .filter(([, amt]) => amt > 0)
          .map(([id, amount]) => ({
            icon: FOODIE_WHEEL.find((w) => w.id === id)?.icon || '🍽️',
            amount,
          }));

        if (betItems.length > 0) {
          setLastFoodieBets(foodieBets);
          setFoodieHistory((prev) => [
            {
              round: foodieRound,
              time: 'الآن',
              bets: betItems,
              winIcon: winner.icon,
              payout,
            },
            ...prev.slice(0, 11),
          ]);
        }

        setFoodiePhase('result');
        window.setTimeout(() => {
          setFoodieBets({});
          setFoodieRound((r) => r + 1);
          setFoodieTime(20);
          setFoodieSweepIdx(null);
          setFoodiePhase('betting');
        }, 3800);
      }
    }, 90);
    return () => window.clearInterval(interval);
  }, [open, mode, foodiePhase]);

  if (!open) return null;

  const pendingCashback = Math.floor(Math.max(0, state.dailyStakedGold - state.cashbackClaimedBase) * 0.08);

  const placeFruitBet = (fruitId: string) => {
    if (fruitPhase !== 'betting') return;
    if (currentUser.gold < selectedChip) {
      showToast('رصيد الذهب غير كافٍ — اضغط + للشحن من المحفظة', 'warning');
      return;
    }
    playArcadeTone(soundOn, 'chip');
    adjustUserGold(currentUser.id, -selectedChip);
    recordGameBet(selectedChip);
    setFruitBets((prev) => ({
      ...prev,
      [fruitId]: (prev[fruitId] || 0) + selectedChip,
    }));
  };

  const repeatFruitBet = () => {
    if (fruitPhase !== 'betting') return;
    const totalNeeded = Object.values(lastFruitBets).reduce((a, b) => a + b, 0);
    if (totalNeeded <= 0) {
      showToast('اختر أي فاكهة أولاً ثم استخدم تكرار في الجولة التالية', 'info');
      return;
    }
    if (currentUser.gold < totalNeeded) {
      showToast('رصيد الذهب غير كافٍ لتكرار الرهان السابق', 'warning');
      return;
    }
    playArcadeTone(soundOn, 'chip');
    adjustUserGold(currentUser.id, -totalNeeded);
    recordGameBet(totalNeeded);
    setFruitBets((prev) => {
      const merged = { ...prev };
      Object.entries(lastFruitBets).forEach(([k, v]) => {
        merged[k] = (merged[k] || 0) + v;
      });
      return merged;
    });
    showToast('تم تكرار رهان الجولة السابقة بنجاح!', 'success');
  };

  const placeFoodieBet = (dishId: string) => {
    if (foodiePhase !== 'betting') return;
    if (currentUser.gold < selectedChip) {
      showToast('رصيد الذهب غير كافٍ — اضغط + لشحن محفظتك', 'warning');
      return;
    }
    playArcadeTone(soundOn, 'chip');
    adjustUserGold(currentUser.id, -selectedChip);
    recordGameBet(selectedChip);
    setFoodieBets((prev) => ({
      ...prev,
      [dishId]: (prev[dishId] || 0) + selectedChip,
    }));
  };

  const repeatFoodieBet = () => {
    if (foodiePhase !== 'betting') return;
    const totalNeeded = Object.values(lastFoodieBets).reduce((a, b) => a + b, 0);
    if (totalNeeded <= 0) {
      showToast('اختر أي طبق على العجلة أولاً ثم كرر رهانك في الجولة القادمة', 'info');
      return;
    }
    if (currentUser.gold < totalNeeded) {
      showToast('رصيد الذهب غير كافٍ لتكرار الرهان السابق', 'warning');
      return;
    }
    playArcadeTone(soundOn, 'chip');
    adjustUserGold(currentUser.id, -totalNeeded);
    recordGameBet(totalNeeded);
    setFoodieBets((prev) => {
      const merged = { ...prev };
      Object.entries(lastFoodieBets).forEach(([k, v]) => {
        merged[k] = (merged[k] || 0) + v;
      });
      return merged;
    });
    showToast('تم تكرار رهان الجولة السابقة!', 'success');
  };

  const betBasket = (kind: 'veg' | 'meat') => {
    if (foodiePhase !== 'betting') return;
    const items = FOODIE_WHEEL.filter((i) => i.kind === kind).map((i) => i.id);
    const totalNeeded = selectedChip * items.length;
    if (currentUser.gold < totalNeeded) {
      showToast(
        `تحتاج إلى ${formatCompactNumber(totalNeeded)} ذهب للرهان على سلة ${
          kind === 'veg' ? 'الخضروات' : 'اللحوم'
        }`,
        'warning'
      );
      return;
    }
    playArcadeTone(soundOn, 'chip');
    adjustUserGold(currentUser.id, -totalNeeded);
    recordGameBet(totalNeeded);
    setFoodieBets((prev) => {
      const next = { ...prev };
      items.forEach((id) => {
        next[id] = (next[id] || 0) + selectedChip;
      });
      return next;
    });
    showToast(
      `تم الرهان على سلة ${kind === 'veg' ? 'الخضروات 🥗' : 'اللحمة 🥩'} (×4 أطباق)!`,
      'success'
    );
  };

  const totalFruitStaked = Object.values(fruitBets).reduce((a, b) => a + b, 0);
  const totalFoodieStaked = Object.values(foodieBets).reduce((a, b) => a + b, 0);
  const fruitWinnerObj = FRUIT_SLOTS.find((f) => f.id === fruitWinnerId) || FRUIT_SLOTS[2];
  const foodieWinnerObj = FOODIE_WHEEL.find((w) => w.id === foodieWinnerId) || FOODIE_WHEEL[0];
  const sortedPlayers = [...state.users].sort((a, b) => b.gold - a.gold);
  const topWinner = sortedPlayers[0];

  const buildTop3Winners = (personalPayout: number, roundSeed: number, mult: number): Top3Winner[] => {
    const basePool = state.users.filter((u) => u.id !== currentUser.id);
    const candidates: Array<{ id: string; name: string; avatar: string; wonGold: number }> = [];
    if (personalPayout > 0) {
      candidates.push({
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        wonGold: personalPayout,
      });
    }
    basePool.forEach((u, idx) => {
      const simulatedBet = ((roundSeed + idx * 3) % 4 + 1) * 1_000_000;
      candidates.push({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        wonGold: simulatedBet * Math.min(25, mult),
      });
    });
    return candidates
      .sort((a, b) => b.wonGold - a.wonGold)
      .slice(0, 3)
      .map((c, idx) => ({
        ...c,
        rank: (idx + 1) as 1 | 2 | 3,
      }));
  };

  const fruitTop3 = buildTop3Winners(fruitLastPayout, fruitRound, fruitWinnerObj.mult);
  const foodieTop3 = buildTop3Winners(foodieLastPayout, foodieRound, foodieWinnerObj.mult);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/15 to-transparent">
      <div className="absolute inset-0" onClick={onClose} aria-label="العودة إلى الغرفة" />

      <AnimatePresence mode="wait">
        {/* MODE 1: CLEAN 2-GAME LAUNCHER ("الفواكه والخضروات") */}
        {mode === 'launcher' && (
          <motion.div
            key="launcher"
            initial={{ y: 260, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 260, opacity: 0 }}
            className="relative z-10 w-full max-w-lg rounded-t-3xl p-[3px] overflow-hidden shadow-[0_-10px_48px_rgba(168,85,247,0.68)]"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
            <div className="relative z-10 max-h-[78dvh] overflow-y-auto overflow-x-hidden rounded-t-[21px] bg-gradient-to-b from-[#2A1154] via-[#1C0A3B] to-[#120628] p-4 pb-5 text-white space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="سهم الخروج للغرفة"
                  title="الخروج للغرفة"
                  className="group relative w-9 h-9 rounded-full p-[2px] overflow-hidden flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.5)] active:scale-95 transition-transform shrink-0"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                  <span className="relative z-10 w-full h-full rounded-full bg-[#241046] group-hover:bg-[#351866] text-white flex items-center justify-center transition-colors">
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </span>
                </button>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-display font-extrabold text-white truncate">
                    ألعاب الحظ الحصرية
                  </h2>
                  <p className="text-[11px] text-purple-200/80 truncate">
                    اختر لعبتك المفضلة وابدأ الجولة فوراً
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="group relative w-9 h-9 rounded-full p-[2px] overflow-hidden flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.45)] active:scale-95 transition-transform shrink-0"
              >
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                <span className="relative z-10 w-full h-full rounded-full bg-[#241046] group-hover:bg-rose-600/80 text-white flex items-center justify-center transition-colors">
                  <X className="w-4 h-4" />
                </span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Game 1: الفواكه (Bespoke 3D Slot Icon + Animated Purple Frame) */}
              <button
                type="button"
                onClick={() => setMode('fruit')}
                className="group relative rounded-2xl p-[2.5px] overflow-hidden shadow-[0_10px_28px_rgba(124,58,237,0.48)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
                <div className="relative z-10 h-full rounded-[14px] bg-gradient-to-b from-[#3E187C] via-[#280E56] to-[#170733] p-3 text-center flex flex-col items-center justify-between gap-2.5">
                  <div className="text-[11px] font-bold text-amber-300 tabular-nums whitespace-nowrap">
                    حتى ×45 · 25 ث
                  </div>

                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-[2.5px] overflow-hidden animate-soft-white-glow bg-white/15">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                    <div className="relative z-10 w-full h-full rounded-[13px] overflow-hidden bg-[#1D0B42]">
                      <img
                        src={GAME_FRUIT_ICON_PATH}
                        alt="لعبة الفواكه"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover scale-[1.12] group-hover:scale-[1.18] transition-transform duration-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="font-display font-extrabold text-sm sm:text-base text-white">
                      لعبة الفواكه
                    </div>
                    <div className="text-[11px] text-purple-200/85">
                      ماكينة الفواكه الملكية
                    </div>
                  </div>

                  <span className="relative inline-flex items-center justify-center rounded-full p-[1.5px] overflow-hidden shadow-[0_4px_14px_rgba(168,85,247,0.5)]">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                    <span className="relative z-10 px-4 py-1.5 rounded-full bg-gradient-to-l from-[#7C3AED] to-[#5B21B6] group-hover:from-[#8B5CF6] group-hover:to-[#6D28D9] text-white text-[11px] font-extrabold whitespace-nowrap transition-colors">
                      العب الآن ←
                    </span>
                  </span>
                </div>
              </button>

              {/* Game 2: الخضروات واللحوم (Bespoke 3D Foodie Wheel Icon + Animated Purple Frame) */}
              <button
                type="button"
                onClick={() => setMode('foodie')}
                className="group relative rounded-2xl p-[2.5px] overflow-hidden shadow-[0_10px_28px_rgba(124,58,237,0.48)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
                <div className="relative z-10 h-full rounded-[14px] bg-gradient-to-b from-[#3A1B7A] via-[#231054] to-[#140736] p-3 text-center flex flex-col items-center justify-between gap-2.5">
                  <div className="text-[11px] font-bold text-sky-300 tabular-nums whitespace-nowrap">
                    لحمة &amp; خضروات · 20 ث
                  </div>

                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-[2.5px] overflow-hidden animate-soft-white-glow bg-white/15">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                    <div className="relative z-10 w-full h-full rounded-[13px] overflow-hidden bg-[#1D0B42]">
                      <img
                        src={GAME_FOODIE_ICON_PATH}
                        alt="لعبة الخضروات وعجلة الطعام"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover scale-[1.08] group-hover:scale-[1.15] transition-transform duration-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="font-display font-extrabold text-sm sm:text-base text-white">
                      لعبة الخضروات
                    </div>
                    <div className="text-[11px] text-purple-200/85">
                      عجلة الطعام الذهبية
                    </div>
                  </div>

                  <span className="relative inline-flex items-center justify-center rounded-full p-[1.5px] overflow-hidden shadow-[0_4px_14px_rgba(168,85,247,0.5)]">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                    <span className="relative z-10 px-4 py-1.5 rounded-full bg-gradient-to-l from-[#7C3AED] to-[#5B21B6] group-hover:from-[#8B5CF6] group-hover:to-[#6D28D9] text-white text-[11px] font-extrabold whitespace-nowrap transition-colors">
                      العب الآن ←
                    </span>
                  </span>
                </div>
              </button>
            </div>
            </div>
          </motion.div>
        )}

        {/* MODE 2: FRUIT SLOT (نظيف، مكبر لأهم العناصر، وبإطار بنفسجي متحرك جذاب) */}
        {mode === 'fruit' && (
          <motion.div
            key="fruit"
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 300, opacity: 0 }}
            className="relative z-10 w-full max-w-lg rounded-t-3xl p-[3px] overflow-hidden shadow-[0_-10px_48px_rgba(168,85,247,0.72)]"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
            <div className="relative z-10 max-h-[79dvh] overflow-y-auto overflow-x-hidden rounded-t-[21px] bg-gradient-to-b from-[#5B21B6] via-[#43148E] to-[#260957] text-white">
              {/* Compact Top Header + Slim Jackpot Strip */}
              <div className="px-3 pt-2 pb-1.5 space-y-1.5 bg-[#3B0F7A]/90 border-b border-violet-300/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="سهم الخروج من اللعبة"
                      title="الخروج للغرفة"
                      className="h-8 px-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 border border-yellow-100 flex items-center justify-center gap-1 cursor-pointer shadow text-xs font-black whitespace-nowrap"
                    >
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.75]" />
                      <span>خروج</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRulesOpen((v) => !v)}
                      aria-label="تعليمات اللعبة"
                      className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/22 flex items-center justify-center text-white cursor-pointer"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFruitHistoryOpen(true)}
                      aria-label="سجل الجولات"
                      className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/22 flex items-center justify-center text-white cursor-pointer"
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoundOn((s) => !s)}
                      aria-label="الصوت"
                      className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/22 flex items-center justify-center text-violet-100 cursor-pointer"
                    >
                      {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMode('foodie')}
                      className="px-2.5 py-1 rounded-full bg-sky-400 hover:bg-sky-300 text-slate-950 text-[11px] font-black cursor-pointer shadow whitespace-nowrap shrink-0"
                    >
                      🐶 الخضروات
                    </button>
                  <span className="text-xs font-mono-num font-black text-amber-200 whitespace-nowrap shrink-0">
                      #{fruitRound}
                    </span>
                  </div>
                </div>
              </div>

              {rulesOpen && (
                <div className="mx-3 mt-2 rounded-2xl bg-white text-slate-900 p-3 text-xs space-y-1 shadow-xl">
                  <div className="flex items-center justify-between font-display font-black text-violet-800">
                    <span>قواعد لعبة الفواكه (Fruit Slot)</span>
                    <button type="button" onClick={() => setRulesOpen(false)} className="cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p>1. اختر قيمة الرهان من الأزرار السفلية (10K إلى 100M).</p>
                  <p>2. اضغط على أي فاكهة لوضع رهانك قبل انتهاء عداد الـ 25 ثانية (أفوكادو حتى ×45).</p>
                  <p>3. استمتع بميزة استرداد نقدي يومي 8% على رهاناتك!</p>
                </div>
              )}

              {/* Clean Balance & Daily Profit Row */}
              <div className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => openWallet('gold')}
                    aria-label="شحن الرصيد"
                    className="w-6 h-6 rounded-full bg-gradient-to-b from-amber-300 to-orange-500 text-amber-950 flex items-center justify-center font-black cursor-pointer shadow shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                  <div className="font-mono-num font-black text-sm sm:text-base text-white whitespace-nowrap">
                    {formatCompactNumber(currentUser.gold)} <span className="text-amber-300 text-xs">رصيدك 🪙</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono-num font-bold text-amber-200 whitespace-nowrap">
                    مكسب: {formatCompactNumber(fruitDailyProfit)}
                  </span>
                  <button
                    type="button"
                    onClick={claimDailyCashback}
                    title="اضغط لاستلام عودة 8% من رهانات اليوم"
                    className="px-2.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-[10.5px] font-black whitespace-nowrap shrink-0 cursor-pointer shadow"
                  >
                    عودة 8% {pendingCashback > 0 ? `+${formatCompactNumber(pendingCashback)}` : ''}
                  </button>
                </div>
              </div>

              {/* ENLARGED 3x3 Fruit Grid inside Animated Purple Glowing Frame */}
              <div className="relative mx-2.5 rounded-2xl p-[3px] overflow-hidden shadow-[0_0_28px_rgba(168,85,247,0.55)]">
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
                <div className="relative z-10 rounded-[13px] bg-[#1E0B3B] p-1.5">
                  <div className="grid grid-cols-3 gap-2 relative">
                    {FRUIT_SLOTS.map((fruit, idx) => {
                      const betOnThis = fruitBets[fruit.id] || 0;
                      const isHighlighted = fruitSweepIdx === idx;
                      const isWinner = fruitPhase === 'result' && fruitWinnerId === fruit.id;

                      return (
                        <button
                          key={fruit.id}
                          type="button"
                          style={{ gridArea: fruit.gridArea }}
                          onClick={() => placeFruitBet(fruit.id)}
                          className={`relative rounded-xl px-1.5 py-2 flex flex-col items-center justify-center min-h-[80px] sm:min-h-[92px] transition-all cursor-pointer border-2 ${
                            isHighlighted || isWinner
                              ? 'bg-gradient-to-b from-yellow-200 via-amber-300 to-yellow-500 border-white text-slate-950 ring-4 ring-white shadow-[0_0_24px_rgba(255,255,255,0.95)] scale-[1.04] z-10'
                              : `bg-gradient-to-b ${fruit.tileBg} text-white hover:brightness-110 active:scale-[0.97] shadow-md`
                          }`}
                        >
                          {betOnThis > 0 && (
                            <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-rose-600 border border-white text-white text-[9.5px] font-mono-num font-black shadow leading-none">
                              {formatCompactNumber(betOnThis)}
                            </span>
                          )}
                          <span className={`text-4xl sm:text-[44px] drop-shadow-md leading-none ${betOnThis > 0 ? 'mt-2' : ''}`}>
                            {fruit.icon}
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-display font-black mt-1 drop-shadow-xs leading-none whitespace-nowrap ${
                              isHighlighted || isWinner ? 'text-amber-950' : 'text-white'
                            }`}
                          >
                            {fruit.mult} مرة
                          </span>
                        </button>
                      );
                    })}

                    {/* Enlarged Center Digital Countdown Box (row 2 col 2) */}
                    <div
                      style={{ gridArea: '2 / 2' }}
                      className="rounded-xl bg-gradient-to-b from-[#4C1D95] via-[#2E1065] to-[#170638] border-2 border-violet-300/80 flex flex-col items-center justify-center p-1 shadow-[inset_0_0_20px_rgba(192,132,252,0.4)]"
                    >
                      <span className="text-[10.5px] font-extrabold text-violet-100 mb-0.5 whitespace-nowrap">
                        وقت الجولة
                      </span>
                      <span className="text-4xl sm:text-5xl font-mono-num font-black tracking-wider text-white leading-none drop-shadow-[0_0_14px_rgba(192,132,252,0.95)]">
                        {fruitPhase === 'spinning' ? '••' : String(fruitTime).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean Stake + Repeat Bar */}
              <div className="px-3 pt-2 flex items-center justify-between gap-2">
                <div className="px-3 py-1 rounded-full bg-black/35 border border-violet-300/35 text-xs font-mono-num font-black text-amber-200 whitespace-nowrap">
                  رهانك: {formatCompactNumber(totalFruitStaked)} 🪙
                </div>
                <button
                  type="button"
                  onClick={repeatFruitBet}
                  className="px-4 py-1 rounded-full bg-gradient-to-b from-[#FDE047] to-[#D97706] border border-yellow-100 text-amber-950 font-black text-xs shadow cursor-pointer flex items-center gap-1.5 hover:brightness-105 active:scale-95 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>يكرر</span>
                </button>
              </div>

              {/* Larger 5-Col Chip Buttons */}
              <div className="px-2.5 py-2 grid grid-cols-5 gap-1.5">
                {CHIPS.map((chip) => {
                  const active = selectedChip === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setSelectedChip(chip.value)}
                      className={`relative h-10 sm:h-11 rounded-full border-b-4 font-mono-num font-black text-[11px] sm:text-xs flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                        chip.isOrange
                          ? 'bg-gradient-to-b from-[#FB923C] to-[#EA580C] border-[#9A3412] text-white'
                          : 'bg-gradient-to-b from-[#4ADE80] to-[#16A34A] border-[#14532D] text-white'
                      } ${active ? 'ring-3 ring-white -translate-y-0.5 scale-[1.03]' : 'opacity-90 hover:opacity-100'}`}
                    >
                      <span className="flex items-center gap-0.5 drop-shadow whitespace-nowrap">
                        <span className="w-3.5 h-3.5 rounded-full bg-yellow-300 text-amber-950 text-[8.5px] flex items-center justify-center font-black shrink-0">
                          $
                        </span>
                        <span>{chip.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Clean Compact Recent Results Strip (Latest 7 without clutter) */}
              <div className="mx-2.5 mb-2.5 rounded-xl bg-black/30 border border-violet-300/25 px-2.5 py-1.5 flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold text-violet-200 shrink-0">الأخير:</span>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {fruitHistoryIcons.slice(0, 7).map((ic, idx) => (
                    <span
                      key={idx}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0 ${
                        idx === 0
                          ? 'bg-violet-500/45 border border-white/70 ring-1 ring-violet-300'
                          : 'bg-white/10 border border-white/15'
                      }`}
                    >
                      {ic}
                    </span>
                  ))}
                </div>
              </div>

            {/* Top 3 Horizontal Podium Result Modal inside Fruit Slot */}
            <AnimatePresence>
              {fruitPhase === 'result' && (
                <RoundTop3PodiumModal
                  round={fruitRound}
                  winningIcon={fruitWinnerObj.icon}
                  winningName={fruitWinnerObj.name}
                  winningMult={fruitWinnerObj.mult}
                  personalPayout={fruitLastPayout}
                  winners={fruitTop3}
                  accentTheme="purple"
                />
              )}
            </AnimatePresence>

            {/* Fruit Slot History Sheet */}
            {fruitHistoryOpen && (
              <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-3">
                <div className="w-full rounded-2xl bg-gradient-to-b from-[#6D28D9] to-[#3B0764] border-2 border-yellow-300 text-white p-4 space-y-3 max-h-[82%] overflow-y-auto shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/25 pb-2">
                    <span className="text-base font-display font-black">سجل جولات الفواكه</span>
                    <button
                      type="button"
                      onClick={() => setFruitHistoryOpen(false)}
                      className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {fruitHistory.map((row) => (
                    <div
                      key={row.round}
                      className="grid grid-cols-3 items-center gap-2 text-xs bg-white/10 rounded-xl p-2.5 text-center"
                    >
                      <div>
                        <div className="font-mono-num font-extrabold">جولة {row.round}</div>
                        <div className="text-[10px] text-purple-200">{row.time}</div>
                      </div>
                      <div className="font-mono-num">
                        {row.bets.map((b, i) => (
                          <div key={i}>
                            {b.icon} {formatCompactNumber(b.amount)}
                          </div>
                        ))}
                      </div>
                      <div className="font-mono-num font-black text-yellow-300">
                        {row.winIcon} +{formatCompactNumber(row.payout)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </motion.div>
        )}

        {/* MODE 3: FOODIE DOG FERRIS WHEEL (مكبرة مع إطار أبيض متحرك خفيف وجذاب) */}
        {mode === 'foodie' && (
          <motion.div
            key="foodie"
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 300, opacity: 0 }}
            className="relative z-10 w-full max-w-lg rounded-t-3xl p-[3px] overflow-hidden shadow-[0_-10px_48px_rgba(255,255,255,0.45)]"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
            <div className="relative z-10 max-h-[82dvh] overflow-y-auto overflow-x-hidden rounded-t-[21px] bg-[#1DA1F2] bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:18px_18px] text-slate-900">
            {/* Sky Blue Top Controls Row */}
            <div className="px-3.5 pt-2.5 pb-1.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="سهم الخروج من اللعبة"
                  title="الخروج للغرفة"
                  className="relative h-8 rounded-full p-[1.5px] overflow-hidden cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.55)] active:scale-95 transition-transform"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                  <span className="relative z-10 h-full px-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 flex items-center justify-center gap-1 font-black text-xs">
                    <Undo2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>خروج</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRulesOpen((v) => !v)}
                  aria-label="تعليمات"
                  className="relative w-8 h-8 rounded-full p-[1.5px] overflow-hidden cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.45)]"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                  <span className="relative z-10 w-full h-full rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSoundOn((s) => !s)}
                  aria-label="الصوت"
                  className="relative w-8 h-8 rounded-full p-[1.5px] overflow-hidden cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.45)]"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                  <span className="relative z-10 w-full h-full rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center">
                    {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('fruit')}
                  className="relative h-8 rounded-full p-[1.5px] overflow-hidden cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.45)]"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                  <span className="relative z-10 h-full px-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black flex items-center">
                    🍊 الفواكه
                  </span>
                </button>
              </div>

              <span className="font-mono-num font-black text-xs text-slate-900 bg-white/90 border border-white px-3 py-1 rounded-full shadow-sm">
                جولة {foodieRound} لليوم
              </span>
            </div>

            {rulesOpen && (
              <div className="mx-3 mb-1.5 rounded-2xl bg-white px-3 py-2 text-xs text-slate-800 space-y-1 shadow-xl">
                <div className="flex items-center justify-between font-bold text-sky-700">
                  <span>قواعد لعبة الخضروات واللحوم</span>
                  <button type="button" onClick={() => setRulesOpen(false)} className="cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p>1. حدد المبلغ من الشريط الخشبي بالأسفل، ثم اضغط على أي طبق حول العجلة.</p>
                <p>2. يمكنك الرهان دفعة واحدة على سلة «لحمة» (يسار) أو سلة «خضروات» (يمين).</p>
              </div>
            )}

            {/* Enlarged Crimson Ferris Wheel Stage with Soft Animated White Frames */}
            <div className="relative w-full px-1.5 py-1 flex items-center justify-center select-none">
              <div className="relative w-[316px] h-[274px] sm:w-[356px] sm:h-[308px]">
                {/* Ferris Wheel Stand Legs */}
                <div className="absolute left-1/2 bottom-0 -translate-x-10 w-3 h-28 bg-[#991B1B] rotate-12 rounded-full opacity-90" />
                <div className="absolute left-1/2 bottom-0 translate-x-7 w-3 h-28 bg-[#991B1B] -rotate-12 rounded-full opacity-90" />

                {/* Crimson Outer Wheel Rim + Soft White Halo */}
                <div className="absolute inset-4 rounded-full border-[6px] border-[#DC2626] ring-2 ring-white/60 shadow-[0_0_24px_rgba(255,255,255,0.55),inset_0_0_22px_rgba(127,29,29,0.45)] animate-soft-white-glow" />
                <div className="absolute inset-9 rounded-full border-2 border-dashed border-yellow-200/85" />

                {/* Enlarged Center Winking Corgi Holding Juice + Timer + Soft White Animated Ring */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-24 h-24 sm:w-[106px] sm:h-[106px] rounded-full p-[3px] overflow-hidden shadow-[0_0_22px_rgba(255,255,255,0.72)]">
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                  <div className="relative z-10 w-full h-full rounded-full bg-gradient-to-b from-[#FEF3C7] via-[#FDE68A] to-[#EA580C] border-2 border-[#DC2626] flex flex-col items-center justify-center text-center">
                    <span className="text-3xl sm:text-4xl leading-none">🐶🥤</span>
                    <span className="text-lg sm:text-xl font-mono-num font-black text-white drop-shadow mt-1 leading-none">
                      {foodiePhase === 'spinning' ? '••' : `${foodieTime}s`}
                    </span>
                  </div>
                </div>

                {/* 8 Enlarged Circular Dish Baskets with Soft Animated White Frames */}
                {FOODIE_WHEEL.map((item, idx) => {
                  const betOnThis = foodieBets[item.id] || 0;
                  const isSwept = foodieSweepIdx === idx;
                  const isWinner = foodiePhase === 'result' && foodieWinnerId === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => placeFoodieBet(item.id)}
                      style={{ left: `${item.x}%`, top: `${item.y}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] rounded-full p-[2.5px] overflow-hidden transition-all cursor-pointer ${
                        isSwept || isWinner
                          ? 'scale-112 shadow-[0_0_24px_rgba(255,255,255,0.98)] z-30'
                          : 'hover:scale-105 shadow-[0_0_16px_rgba(255,255,255,0.58)]'
                      }`}
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                      <span
                        className={`relative z-10 w-full h-full rounded-full flex flex-col items-center justify-center ${
                          isSwept || isWinner
                            ? 'bg-gradient-to-b from-[#FEF08A] via-[#FACC15] to-[#EA580C] text-slate-950'
                            : betOnThis > 0
                            ? 'bg-gradient-to-b from-[#DCFCE7] to-[#86EFAC] border border-emerald-600 text-slate-950'
                            : item.kind === 'veg'
                            ? 'bg-gradient-to-b from-[#F5E6CA] to-[#D4A373] border border-[#7F1D1D]/70 text-slate-950'
                            : 'bg-gradient-to-b from-[#FDE68A] to-[#C2884A] border border-[#7F1D1D]/70 text-slate-950'
                        }`}
                      >
                        {betOnThis > 0 && (
                          <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 px-1.5 py-[1px] rounded-full bg-rose-600 text-white text-[8.5px] font-mono-num font-black whitespace-nowrap shadow">
                            {formatCompactNumber(betOnThis)}
                          </span>
                        )}
                        <span className="text-2xl sm:text-[28px] leading-none">{item.icon}</span>
                        <span className="text-[9px] font-display font-bold text-rose-800 leading-tight mt-0.5">
                          {betOnThis > 0 ? 'رهانك' : 'أنت:'}
                        </span>
                        <span className="text-[11px] font-mono-num font-black leading-none">
                          x{item.mult}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Outer Edge Enlarged Repeat + Meat / Veg Baskets with Soft Animated White Frames */}
              <button
                type="button"
                onClick={repeatFoodieBet}
                className="absolute left-2 top-2 rounded-full p-[2px] overflow-hidden shadow-[0_0_14px_rgba(255,255,255,0.65)] cursor-pointer active:scale-95 transition-transform"
              >
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                <span className="relative z-10 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-900 text-[11px] font-black flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>يكرر</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => betBasket('meat')}
                className="absolute left-1.5 bottom-1.5 rounded-2xl p-[2px] overflow-hidden shadow-[0_0_14px_rgba(255,255,255,0.58)] cursor-pointer group active:scale-95 transition-transform"
              >
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                <span className="relative z-10 px-2 py-1.5 rounded-[14px] bg-[#78350F]/90 flex flex-col items-center">
                  <span className="text-2xl sm:text-[26px] drop-shadow group-hover:scale-110 transition-transform leading-none">🥩</span>
                  <span className="mt-1 px-2 py-0.5 rounded-md bg-[#8B5A2B] border border-amber-200/80 text-white text-[10px] font-black shadow whitespace-nowrap">
                    لحمة
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => betBasket('veg')}
                className="absolute right-1.5 bottom-1.5 rounded-2xl p-[2px] overflow-hidden shadow-[0_0_14px_rgba(255,255,255,0.58)] cursor-pointer group active:scale-95 transition-transform"
              >
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                <span className="relative z-10 px-2 py-1.5 rounded-[14px] bg-[#14532D]/90 flex flex-col items-center">
                  <span className="text-2xl sm:text-[26px] drop-shadow group-hover:scale-110 transition-transform leading-none">🥗</span>
                  <span className="mt-1 px-2 py-0.5 rounded-md bg-[#16A34A] border border-emerald-200/80 text-white text-[10px] font-black shadow whitespace-nowrap">
                    خضروات
                  </span>
                </span>
              </button>
            </div>

            {/* Enlarged Warm Wooden Bet Strip wrapped in Soft Animated White Frame */}
            <div className="relative mx-2 rounded-t-2xl p-[2px] overflow-hidden shadow-[0_0_16px_rgba(255,255,255,0.5)]">
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
              <div className="relative z-10 rounded-t-[14px] bg-gradient-to-b from-[#FDE68A] via-[#F5C065] to-[#D99B43] px-2.5 py-2 space-y-1.5 shadow-inner">
                <div className="text-center text-xs font-display font-black text-[#451A03]">
                  الخطوة: حدد المبلغ &gt; انقر للمراهنة
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {CHIPS.map((chip) => {
                    const active = selectedChip === chip.value;
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => setSelectedChip(chip.value)}
                        className={`relative rounded-xl p-[2px] overflow-hidden cursor-pointer transition-all ${
                          active
                            ? 'shadow-[0_0_16px_rgba(255,255,255,0.92)] scale-105'
                            : 'hover:scale-[1.02]'
                        }`}
                      >
                        <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                        <span
                          className={`relative z-10 w-full rounded-[10px] py-1.5 px-0.5 flex flex-col items-center gap-1 ${
                            active
                              ? 'bg-[#78350F]'
                              : 'bg-[#B45309]/70 hover:bg-[#92400E]/85'
                          }`}
                        >
                          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 border border-yellow-100 text-amber-950 font-black text-xs flex items-center justify-center shadow">
                            $
                          </span>
                          <span className="px-2 py-[1px] rounded-full bg-white text-slate-900 font-mono-num font-black text-[10px] leading-tight">
                            {chip.label}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Enlarged Crimson Bottom Info Panel */}
            <div className="bg-gradient-to-b from-[#DC2626] to-[#991B1B] text-white px-3 py-2.5 space-y-2">
              {/* Row 1: تاريخي | الإيرادات اليومية | Player Balance + */}
              <div className="grid grid-cols-[auto_1fr_1.15fr] gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setFoodieHistoryOpen(true)}
                  className="relative h-10 rounded-full p-[1.5px] overflow-hidden cursor-pointer shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                  <span className="relative z-10 h-full px-3.5 rounded-full bg-[#FFF7ED] hover:bg-white text-slate-900 font-display font-black text-xs flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <History className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>تاريخي</span>
                  </span>
                </button>

                <div className="relative h-10 rounded-full p-[1.5px] overflow-hidden shadow-[0_0_10px_rgba(255,255,255,0.4)] min-w-0">
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                  <div className="relative z-10 w-full h-full rounded-full bg-[#FFF7ED] text-slate-900 px-2.5 flex flex-col items-center justify-center min-w-0">
                    <span className="text-[9px] font-bold text-slate-600 leading-tight whitespace-nowrap">
                      الإيرادات اليومية
                    </span>
                    <span className="font-mono-num font-black text-[11px] text-amber-800 leading-tight truncate max-w-full">
                      {formatCompactNumber(foodieDailyRevenue)} 🪙
                    </span>
                  </div>
                </div>

                <div className="relative h-10 rounded-full p-[1.5px] overflow-hidden shadow-[0_0_10px_rgba(255,255,255,0.4)] min-w-0">
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                  <div className="relative z-10 w-full h-full rounded-full bg-[#FFF7ED] text-slate-900 px-2 flex items-center justify-between gap-1.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => openWallet('gold')}
                      aria-label="شحن الذهب"
                      className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </button>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-[9px] font-bold truncate leading-tight">{currentUser.name}</div>
                      <div className="text-[10.5px] font-mono-num font-black text-amber-700 truncate leading-tight">
                        {formatCompactNumber(currentUser.gold)} 🪙
                      </div>
                    </div>
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover border border-amber-400 shrink-0"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: نتائج Strip with "نجم جديدة" */}
              <div className="rounded-xl bg-[#B91C1C] border border-rose-300/40 px-2.5 py-1.5 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {foodieRecentIcons.map((ic, i) => {
                    const isNewest = i === foodieRecentIcons.length - 1;
                    return (
                      <div key={i} className="relative flex flex-col items-center shrink-0">
                        <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm shadow">
                          {ic}
                        </span>
                        {isNewest && (
                          <span className="mt-0.5 px-1 rounded bg-yellow-300 text-amber-950 text-[7px] font-black leading-none py-[1px]">
                            نجم جديدة
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="text-[11px] font-display font-black text-yellow-100 shrink-0">
                  نتائج:
                </span>
              </div>

              {/* Row 3: Interactive Leaderboard Row ("الترتيب") */}
              <button
                type="button"
                onClick={() => setRankingOpen(true)}
                className="w-full rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] border border-rose-300/40 px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-1.5 font-mono-num text-[11px] font-black text-yellow-200">
                  <ChevronLeft className="w-3.5 h-3.5 text-white" />
                  <span>{topWinner.gold.toLocaleString('en-US')}</span>
                  <Coins className="w-3 h-3 text-yellow-300" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-white truncate max-w-[100px]">
                    {topWinner.name}
                  </span>
                  <img
                    src={topWinner.avatar}
                    alt={topWinner.name}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover border border-yellow-300"
                  />
                  <span className="text-[11px] font-mono-num font-black text-yellow-200">1</span>
                  <span className="text-[11px] font-display font-black text-white border-r border-white/25 pr-1.5">
                    الترتيب
                  </span>
                </div>
              </button>
            </div>

            {/* Top 3 Horizontal Podium Result Modal inside Foodie Dog Wheel */}
            <AnimatePresence>
              {foodiePhase === 'result' && (
                <RoundTop3PodiumModal
                  round={foodieRound}
                  winningIcon={foodieWinnerObj.icon}
                  winningName={foodieWinnerObj.name}
                  winningMult={foodieWinnerObj.mult}
                  personalPayout={foodieLastPayout}
                  winners={foodieTop3}
                  accentTheme="crimson"
                />
              )}
            </AnimatePresence>

            {/* Foodie History Drawer Modal ("تاريخي") */}
            {foodieHistoryOpen && (
              <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-3">
                <div className="w-full rounded-2xl bg-gradient-to-b from-[#38BDF8] to-[#0284C7] border-2 border-sky-100 text-white p-4 space-y-3 max-h-[85%] overflow-y-auto shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/30 pb-2">
                    <span className="text-base font-display font-black">تاريخي</span>
                    <button
                      type="button"
                      onClick={() => setFoodieHistoryOpen(false)}
                      className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 text-xs font-extrabold text-sky-50 pb-1.5 border-b border-white/25 text-center">
                    <span>الجولة</span>
                    <span>تفاصيل الرهان</span>
                    <span>الربح</span>
                  </div>

                  {foodieHistory.map((row) => (
                    <div
                      key={row.round}
                      className="grid grid-cols-3 items-center gap-2 text-xs bg-white/15 rounded-xl p-2.5 text-center"
                    >
                      <div>
                        <div className="font-mono-num font-extrabold">الجولة {row.round}</div>
                        <div className="text-[11px] text-sky-100">{row.time}</div>
                      </div>
                      <div className="space-y-0.5 font-mono-num">
                        {row.bets.map((b, i) => (
                          <div key={i}>
                            {b.icon} {formatCompactNumber(b.amount)}
                          </div>
                        ))}
                      </div>
                      <div className="font-mono-num font-black text-yellow-300">
                        {row.winIcon} +{formatCompactNumber(row.payout)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard Modal ("الترتيب") */}
            {rankingOpen && (
              <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-3">
                <div className="w-full rounded-2xl bg-white text-slate-900 border-2 border-amber-300 p-4 space-y-3 max-h-[85%] overflow-y-auto shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-base font-display font-black flex items-center gap-1.5 text-rose-700">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>قائمة المتصدرين اليومية</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRankingOpen(false)}
                      className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sortedPlayers.map((u, idx) => (
                      <div
                        key={u.id}
                        className="rounded-xl bg-amber-50/70 border border-amber-200 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-400 to-orange-500 text-white font-mono-num font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <img
                            src={u.avatar}
                            alt={u.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border border-amber-300 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate">
                              {u.name} {u.flag}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono-num">
                              ID:{u.id} · Lv.{u.level}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-mono-num font-black text-amber-700 shrink-0">
                          {formatCompactNumber(u.gold)} 🪙
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
