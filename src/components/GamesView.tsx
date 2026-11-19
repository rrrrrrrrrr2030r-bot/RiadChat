import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Coins,
  Crown,
  Flame,
  Gamepad2,
  Gift,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { JACKPOT_TARGET, useApp } from '../context/AppContext';
import { GAME_FOODIE_ICON_PATH, GAME_FRUIT_ICON_PATH } from '../data/seedData';
import { formatCompactNumber, formatFullGold } from '../utils/format';
import { LuckyGameKind, LuckyGamesModal } from './LuckyGamesModal';

interface GamesViewProps {
  onClose?: () => void;
}

export const GamesView: React.FC<GamesViewProps> = ({ onClose }) => {
  const {
    state,
    currentUser,
    activeRoomId,
    setActiveTab,
    claimJackpotChest,
    claimDailyCashback,
    openWallet,
  } = useApp();

  const [luckyModalOpen, setLuckyModalOpen] = useState(false);
  const [luckyModalMode, setLuckyModalMode] = useState<LuckyGameKind>('fruit');

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setActiveTab('rooms');
    }
  };

  const openGame = (mode: 'fruit' | 'foodie') => {
    setLuckyModalMode(mode);
    setLuckyModalOpen(true);
  };

  const luckLabel =
    state.gameLuckMode === 'generous'
      ? 'سخي جداً'
      : state.gameLuckMode === 'balanced'
      ? 'متوازن'
      : 'تحدي';

  const jackpotPercent = Math.min(100, Math.round((state.jackpotProgress / JACKPOT_TARGET) * 100));
  const jackpotReady = state.jackpotProgress >= JACKPOT_TARGET;
  const pendingCashback = Math.floor(
    Math.max(0, state.dailyStakedGold - state.cashbackClaimedBase) * 0.08
  );
  const topPlayers = [...state.users].sort((a, b) => b.gold - a.gold).slice(0, 4);

  return (
    <>
      {!luckyModalOpen && (
        <div
          className={`fixed inset-x-0 z-30 flex items-end sm:items-center justify-center p-2.5 sm:p-4 bg-slate-950/45 backdrop-blur-[1.5px] ${
            activeRoomId ? 'top-24 bottom-16 sm:top-20 sm:bottom-16' : 'top-14 bottom-16 lg:bottom-0'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="صالة الفواكه والخضروات"
        >
      {/* Click outside translucent scrim to return to room/rooms */}
      <div
        className="absolute inset-0"
        onClick={handleClose}
        aria-label="العودة إلى الغرفة"
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-lg sm:max-w-xl max-h-full rounded-3xl p-[2.5px] overflow-hidden shadow-[0_20px_60px_rgba(109,40,217,0.52)] flex flex-col"
      >
        <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
        <div className="relative z-10 flex flex-col max-h-full rounded-[21px] bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFF] to-[#EEF2FF] text-slate-900 overflow-hidden">
        {/* Compact Sticky Modal Header (Exit Arrow + Balance + Close) */}
        <div className="px-3.5 sm:px-4 py-2.5 bg-gradient-to-l from-[#1E1148] via-[#2D186B] to-[#1A1042] text-white border-b border-violet-400/35 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleClose}
              aria-label="العودة للغرفة"
              className="group relative h-8 rounded-full p-[1.5px] overflow-hidden shrink-0 cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.45)] active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
              <span className="relative z-10 h-full px-3 rounded-full bg-[#2B155E] group-hover:bg-[#3A1E7A] text-white font-black text-[11px] flex items-center gap-1 whitespace-nowrap">
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>خروج</span>
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-display font-extrabold text-white truncate flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-violet-300 shrink-0" />
                <span className="truncate">صالة الفواكه والخضروات</span>
              </h1>
              <div className="text-[10px] text-violet-200 truncate">
                الحظ: {luckLabel} · المضاعف{' '}
                <span className="font-mono-num font-bold text-amber-300">
                  x{state.diceMultiplier}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => openWallet('gold')}
              className="h-8 px-2.5 rounded-full bg-amber-400/15 hover:bg-amber-400/25 border border-amber-300/50 flex items-center gap-1.5 text-xs cursor-pointer transition-colors"
            >
              <Coins className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="font-mono-num font-black text-amber-200 whitespace-nowrap">
                {formatCompactNumber(currentUser.gold)}
              </span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              aria-label="إغلاق نافذة الألعاب"
              className="group relative w-8 h-8 rounded-full p-[1.5px] overflow-hidden flex items-center justify-center cursor-pointer shrink-0 active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
              <span className="relative z-10 w-full h-full rounded-full bg-[#24124F] group-hover:bg-rose-600/80 text-white flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body with Proportional Game Cards */}
        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
          {/* ONLY 2 FEATURED GAMES: الفواكه & الخضروات واللحوم */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: لعبة الفواكه (Bespoke 3D Slot Emblem + Animated Purple Frame) */}
            <button
              type="button"
              onClick={() => openGame('fruit')}
              className="group relative rounded-2xl p-[2px] overflow-hidden shadow-[0_10px_28px_rgba(109,40,217,0.35)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
              <div className="relative z-10 h-full rounded-[14px] bg-gradient-to-br from-[#3D1878] via-[#281054] to-[#160834] p-3.5 text-right text-white flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 space-y-1">
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                      <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span className="whitespace-nowrap tabular-nums">جائزة كبرى ×45 · 25 ث</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-display font-extrabold text-white leading-tight truncate">
                      لعبة الفواكه
                    </h2>
                    <p className="text-[11px] text-purple-100/90 leading-snug line-clamp-2">
                      ماكينة الفواكه الملكية وشبكة 3×3 بمكافآت حتى 45 مرة.
                    </p>
                  </div>
                  <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl p-[2.5px] overflow-hidden shrink-0 animate-soft-white-glow bg-white/15">
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
                </div>

                <div className="pt-2.5 border-t border-white/15 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-purple-200/90 truncate">
                    3 بكرات · سحب فوري
                  </span>
                  <span className="relative inline-flex items-center justify-center rounded-full p-[1.5px] overflow-hidden shrink-0 shadow-[0_4px_12px_rgba(168,85,247,0.45)]">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                    <span className="relative z-10 px-3.5 py-1.5 rounded-full bg-gradient-to-l from-[#7C3AED] to-[#5B21B6] text-white text-[11px] font-black whitespace-nowrap">
                      العب الآن ←
                    </span>
                  </span>
                </div>
              </div>
            </button>

            {/* Card 2: لعبة الخضروات واللحوم (Bespoke 3D Foodie Wheel Emblem + Animated Purple Frame) */}
            <button
              type="button"
              onClick={() => openGame('foodie')}
              className="group relative rounded-2xl p-[2px] overflow-hidden shadow-[0_10px_28px_rgba(109,40,217,0.35)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
              <div className="relative z-10 h-full rounded-[14px] bg-gradient-to-br from-[#371A77] via-[#221054] to-[#130736] p-3.5 text-right text-white flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 space-y-1">
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300">
                      <Sparkles className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      <span className="whitespace-nowrap tabular-nums">لحمة &amp; خضروات ×45 · 20 ث</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-display font-extrabold text-white leading-tight truncate">
                      الخضروات واللحوم
                    </h2>
                    <p className="text-[11px] text-purple-100/90 leading-snug line-clamp-2">
                      عجلة الطعام السريعة مع الشيف كـورجي ومضاعفات الجولات الذهبية.
                    </p>
                  </div>
                  <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl p-[2.5px] overflow-hidden shrink-0 animate-soft-white-glow bg-white/15">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-soft-white-ring" />
                    <div className="relative z-10 w-full h-full rounded-[13px] overflow-hidden bg-[#1D0B42]">
                      <img
                        src={GAME_FOODIE_ICON_PATH}
                        alt="الخضروات واللحوم"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover scale-[1.08] group-hover:scale-[1.15] transition-transform duration-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/15 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-purple-200/90 truncate">
                    عجلة المهرجان · 8 أطباق
                  </span>
                  <span className="relative inline-flex items-center justify-center rounded-full p-[1.5px] overflow-hidden shrink-0 shadow-[0_4px_12px_rgba(168,85,247,0.45)]">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                    <span className="relative z-10 px-3.5 py-1.5 rounded-full bg-gradient-to-l from-[#7C3AED] to-[#5B21B6] text-white text-[11px] font-black whitespace-nowrap">
                      العب الآن ←
                    </span>
                  </span>
                </div>
              </div>
            </button>
          </section>

          {/* Compact Rewards Strip: 600M Jackpot + 8% Daily Cashback */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Jackpot 600M Chest */}
            <div className="rounded-2xl bg-gradient-to-l from-[#10B981] to-[#059669] border border-emerald-300/70 p-3 text-white shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-display font-extrabold text-xs sm:text-sm min-w-0">
                  <Gift className="w-4 h-4 text-yellow-300 shrink-0" />
                  <span className="truncate">صندوق الجاك بوت (600M)</span>
                </div>
                <span className="text-xs font-mono-num font-black text-yellow-200 shrink-0">
                  {jackpotPercent}%
                </span>
              </div>

              <div className="h-4.5 rounded-full bg-emerald-950/50 border border-emerald-200/60 p-0.5 overflow-hidden relative flex items-center justify-center">
                <div
                  className="absolute inset-y-0 right-0 bg-gradient-to-l from-yellow-300 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${jackpotPercent}%` }}
                />
                <span className="relative z-10 text-[10px] font-mono-num font-black text-white drop-shadow">
                  {formatCompactNumber(state.jackpotProgress)} / 600M
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-emerald-50 truncate">
                  الجائزة: +50M ذهبية و +250 ماسة
                </span>
                <button
                  type="button"
                  onClick={claimJackpotChest}
                  className={`px-3 py-1 rounded-full text-[11px] font-black cursor-pointer shadow whitespace-nowrap shrink-0 transition-transform active:scale-95 ${
                    jackpotReady
                      ? 'bg-yellow-300 text-amber-950 animate-bounce'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                >
                  {jackpotReady ? 'استلام +50M!' : 'تحقق الآن'}
                </button>
              </div>
            </div>

            {/* Daily 8% Cashback Widget */}
            <div className="rounded-2xl bg-gradient-to-l from-amber-500 via-orange-500 to-rose-500 border border-amber-300/70 p-3 text-white shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-display font-extrabold text-xs sm:text-sm min-w-0">
                  <Zap className="w-4 h-4 text-yellow-200 shrink-0" />
                  <span className="truncate">استرداد عودة 8%</span>
                </div>
                <span className="text-[10px] font-mono-num font-black text-yellow-100 whitespace-nowrap shrink-0">
                  اليوم: {formatCompactNumber(state.dailyStakedGold)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="min-w-0">
                  <div className="text-[10px] text-amber-50">المستحق الآن</div>
                  <div className="text-xs sm:text-sm font-mono-num font-black text-yellow-200 truncate">
                    +{formatFullGold(pendingCashback)} 🪙
                  </div>
                </div>
                <button
                  type="button"
                  onClick={claimDailyCashback}
                  className="px-3.5 py-1.5 rounded-full bg-white text-orange-700 hover:bg-yellow-100 text-[11px] font-black cursor-pointer shadow whitespace-nowrap shrink-0 transition-transform active:scale-95"
                >
                  استلام 8%
                </button>
              </div>
            </div>
          </section>

          {/* Compact Top Players Leaderboard inside Modal */}
          <section className="rounded-2xl bg-white border border-slate-200/90 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs sm:text-sm font-display font-extrabold text-slate-900 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span>متصدرو الألعاب والثروة اليوم</span>
              </h2>
              <span className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">
                تحديث فوري
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topPlayers.map((u, idx) => (
                <div
                  key={u.id}
                  className="rounded-xl bg-slate-50 border border-slate-200/80 px-2.5 py-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full font-mono-num font-black text-[11px] flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-amber-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-800'
                          : 'bg-orange-200 text-orange-900'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <img
                      src={u.avatar}
                      alt={u.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-amber-300 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1">
                        <span className="truncate">{u.name}</span>
                        {idx === 0 && (
                          <Crown className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono-num truncate">
                        ID:{u.id} · Lv.{u.level}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono-num font-black text-amber-600 whitespace-nowrap shrink-0">
                    {formatCompactNumber(u.gold)} 🪙
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
        </div>
      </motion.div>
    </div>
      )}

      {/* Interactive Fruits & Vegetables Game Drawer */}
      <LuckyGamesModal
        open={luckyModalOpen}
        initialMode={luckyModalMode}
        onClose={() => setLuckyModalOpen(false)}
      />
    </>
  );
};
