import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Crown,
  Diamond,
  Download,
  Flame,
  Gift,
  Heart,
  MessageCircle,
  Mic,
  PlusCircle,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { APP_ICON_PATH } from '../data/seedData';
import { formatCompactNumber, formatFullGold } from '../utils/format';
import { ROOM_XP_REWARDS, getLevelProgress } from '../utils/leveling';

type ProfileModal = null | 'tasks' | 'level' | 'honor' | 'svip' | 'aristocrat' | 'wizard';

const ARISTOCRAT_TIERS = [
  { name: 'فارس المنصة', cost: 25_000_000, perks: 'شارة الفارس + لون مميز بالمحادثة' },
  { name: 'دوق الشحن', cost: 100_000_000, perks: 'دخولية ملكية + حماية من الكتم بالغرف' },
  { name: 'أمير الخليج', cost: 250_000_000, perks: 'بونص شحن إضافي + إطار الأمير الذهبي' },
  { name: 'إمبراطور المنصة', cost: 500_000_000, perks: 'أعلى امتيازات VIP + إطلاق إشعار دخول' },
];

export const ProfileView: React.FC = () => {
  const {
    state,
    currentUser,
    setActiveTab,
    openWallet,
    claimTaskReward,
    claimDailyStreakBonus,
    joinAristocratTier,
    upgradeSvip,
    showToast,
  } = useApp();

  const [modal, setModal] = useState<ProfileModal>(null);
  const [celebrationBurst, setCelebrationBurst] = useState(false);

  const isOwner = currentUser.role === 'OWNER';
  const myHostRecord = state.hosts.find((h) => h.userId === currentUser.id);
  const hostTargetPercent = myHostRecord
    ? Math.min(100, Math.round((myHostRecord.giftsReceivedGold / Math.max(1, myHostRecord.targetGold)) * 100))
    : 0;
  const hostTargetReached = Boolean(myHostRecord && myHostRecord.giftsReceivedGold >= myHostRecord.targetGold);

  const handleCopyId = () => {
    navigator.clipboard?.writeText(currentUser.id).catch(() => {});
    showToast(`تم نسخ رقم المعرف ID: ${currentUser.id}`, 'info');
  };

  const handleDownloadBundleConfig = () => {
    const manifest = {
      appName: 'رياض شات - Riad Chat',
      packageId: 'com.riadchat.app',
      version: '2.4.0',
      versionCode: 24,
      platforms: ['android-aab', 'android-apk', 'ios-appstore', 'pwa'],
      orientation: 'portrait',
      themeColor: '#09071A',
      accentColor: '#7C3AED',
      rtl: true,
      lang: 'ar',
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'riad-chat-store-bundle.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم استخراج وتحميل حزمة إعدادات المتجر بنجاح!', 'success');
  };

  const sortedHonorUsers = [...state.users].sort((a, b) => b.gold - a.gold);
  const levelProgress = getLevelProgress(currentUser.level, currentUser.xp);

  return (
    <div className="space-y-5">
      {currentUser.isBanned && (
        <div className="rounded-2xl bg-rose-950/60 border border-rose-500/50 px-4 py-3 text-xs sm:text-sm text-rose-200 font-semibold">
          حسابك مقيد حالياً من الإدارة — تواصل مع الدعم أو أزل التقييد من لوحة النظام.
        </div>
      )}

      {/* Host Daily Target Celebration Banner */}
      {myHostRecord && (
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 text-white shadow-xl ${
            hostTargetReached
              ? 'bg-gradient-to-l from-[#4A2500] via-[#2B125A] to-[#0E2460] border-amber-300/75 shadow-[0_0_28px_rgba(251,191,36,0.3)]'
              : 'bg-gradient-to-l from-[#22124D] to-[#111948] border-violet-400/40'
          }`}
        >
          {hostTargetReached && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-amber-200/35 to-transparent animate-milestone-shine"
            />
          )}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <motion.span
                animate={
                  hostTargetReached || celebrationBurst
                    ? { scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] }
                    : {}
                }
                transition={{ duration: 1.1, repeat: hostTargetReached ? Infinity : 0, repeatDelay: 2.2 }}
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 text-amber-950 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(251,191,36,0.65)]"
              >
                <Trophy className="w-6 h-6" />
              </motion.span>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-display font-extrabold">
                    {hostTargetReached
                      ? '🎉 إنجاز المضيف: تم تحقيق الهدف الربحي اليومي 100%!'
                      : `تقدم الهدف اليومي للمضيف (${hostTargetPercent}%)`}
                  </h2>
                  {hostTargetReached && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-300 text-amber-950 text-[10px] font-black">
                      هدف مكتمل ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 font-mono-num">
                  المحقق: {formatCompactNumber(myHostRecord.giftsReceivedGold)} / {formatCompactNumber(myHostRecord.targetGold)} ذهب · العمولة المعلقة: {formatCompactNumber(myHostRecord.pendingCommissionGold)}
                </p>
              </div>
            </div>

            {hostTargetReached && (
              <button
                type="button"
                onClick={() => {
                  setCelebrationBurst(true);
                  showToast('🎊 مبروك وصولك إلى 100% من الهدف الربحي اليومي للمضيف!', 'success');
                  window.setTimeout(() => setCelebrationBurst(false), 1600);
                }}
                className="px-4 py-2 rounded-full bg-gradient-to-l from-amber-400 to-yellow-300 hover:brightness-110 text-amber-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 shadow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>احتفال الإنجاز</span>
              </button>
            )}
          </div>

          <div className="relative z-10 mt-3 h-2.5 rounded-full bg-black/40 border border-white/15 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                hostTargetReached
                  ? 'bg-gradient-to-l from-amber-300 via-yellow-400 to-emerald-400'
                  : 'bg-gradient-to-l from-violet-500 to-sky-400'
              }`}
              style={{ width: `${Math.max(5, hostTargetPercent)}%` }}
            />
          </div>

          <AnimatePresence>
            {celebrationBurst && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative z-10 mt-2.5 rounded-xl bg-amber-300/20 border border-amber-300/50 px-3 py-1.5 text-center text-xs font-bold text-amber-200"
              >
                ✨ تهانينا! تم تأكيد مكافأة التميز اليومية بنسبة {myHostRecord.commissionRate}% عمولة للمضيف ✨
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}

      {/* Profile Hero Card (Screenshot 8) */}
      <section className="rounded-3xl bg-gradient-to-br from-[#2E1A5B] via-[#1B1344] to-[#0F1B44] border border-violet-500/40 p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="relative w-20 h-20 rounded-2xl p-[2.5px] overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="relative z-10 w-full h-full rounded-[14px] object-cover"
                />
              </div>
              <span className="z-20 absolute -bottom-2 inset-x-2 rounded-lg bg-gradient-to-l from-violet-600 to-purple-500 border border-white/70 text-white text-[11px] font-mono-num font-extrabold text-center py-0.5 shadow-md">
                Lv.{currentUser.level}
              </span>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-display font-extrabold text-white">
                  {currentUser.name} 👑
                </h1>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-l from-violet-600 to-blue-500 text-white text-xs font-mono-num font-bold cursor-pointer hover:from-violet-500 hover:to-blue-400"
                >
                  <span>ID: {currentUser.id}</span>
                  <Copy className="w-3 h-3" />
                </button>
              </div>

              {/* Badges Row */}
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono-num font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/25 text-indigo-200 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-indigo-300" />
                  {currentUser.level}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/25 text-purple-200 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-purple-300" />
                  {(currentUser.charisma ?? 0).toLocaleString('en-US')}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/25 text-sky-200 flex items-center gap-1">
                  <Diamond className="w-3.5 h-3.5 text-sky-300" />
                  {formatCompactNumber(currentUser.giftedGold ?? 0)}
                </span>
                <span className="px-3 py-1 rounded-lg bg-gradient-to-l from-violet-500 to-blue-500 text-white flex items-center gap-1 font-display">
                  <Crown className="w-3.5 h-3.5" />
                  {currentUser.title}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Purple & Blue Gradient Level Progress Bar */}
        <div
          onClick={() => setModal('level')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setModal('level');
            }
          }}
          className="rounded-2xl bg-[#110C2E]/85 hover:bg-[#151039] border border-violet-500/35 p-3.5 sm:p-4 space-y-2.5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-l from-violet-600 to-blue-500 text-white text-xs font-mono-num font-extrabold">
                Lv.{levelProgress.level}
              </span>
              <span className="text-xs sm:text-sm font-display font-bold text-white">
                تقدم المستوى (XP)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono-num">
              <span className="text-sky-300 font-bold">
                {formatFullGold(levelProgress.xp)} / {formatFullGold(levelProgress.requiredXp)} XP
              </span>
              <span className="px-2 py-0.5 rounded-md bg-violet-500/25 border border-blue-400/35 text-violet-200 font-extrabold">
                {levelProgress.percent}%
              </span>
            </div>
          </div>

          <div
            className="h-3.5 w-full rounded-full bg-[#09071A] border border-violet-500/35 p-0.5 overflow-hidden"
            role="progressbar"
            aria-valuenow={levelProgress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="شريط تقدم المستوى"
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-violet-500 via-indigo-500 to-blue-400 shadow-[0_0_12px_rgba(99,102,241,0.55)] transition-all duration-500"
              style={{ width: `${Math.max(4, levelProgress.percent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
            <span className="flex items-center gap-1 text-violet-200">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>يزداد بالتفاعل في الغرف (الدردشة، المايك، الهدايا)</span>
            </span>
            <span className="font-mono-num text-sky-300 font-semibold shrink-0">
              متبقي {formatFullGold(levelProgress.remainingXp)} XP ← Lv.{levelProgress.level + 1}
            </span>
          </div>
        </div>

        {/* Followers / Visitors Stats */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-center">
          <div>
            <div className="text-lg sm:text-xl font-mono-num font-extrabold text-white">
              {currentUser.following}
            </div>
            <div className="text-xs text-slate-300">المتابعة</div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-mono-num font-extrabold text-white">
              {formatCompactNumber(currentUser.followers)}
            </div>
            <div className="text-xs text-slate-300">المتابعين</div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-mono-num font-extrabold text-sky-300">
              {formatCompactNumber(currentUser.visitors)}
            </div>
            <div className="text-xs text-slate-300">الزوار</div>
          </div>
        </div>

        {/* 4 Quick Action Tiles */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setModal('tasks')}
            className="rounded-2xl bg-[#1D1548] hover:bg-[#281E61] border border-violet-500/25 p-3 flex flex-col items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="w-10 h-10 rounded-xl p-[1.5px] bg-gradient-to-tr from-violet-500 via-white to-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.35)] flex items-center justify-center">
              <span className="w-full h-full rounded-[10px] bg-[#221854] text-white flex items-center justify-center">
                <Check className="w-5 h-5 stroke-[3]" />
              </span>
            </span>
            <span className="text-xs font-semibold text-white">مهمة</span>
          </button>

          <button
            type="button"
            onClick={() => setModal('level')}
            className="rounded-2xl bg-[#1D1548] hover:bg-[#281E61] border border-violet-500/25 p-3 flex flex-col items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="w-10 h-10 rounded-xl p-[1.5px] bg-gradient-to-tr from-violet-500 via-white to-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.35)] flex items-center justify-center">
              <span className="w-full h-full rounded-[10px] bg-[#221854] text-violet-100 font-mono-num font-extrabold text-xs flex items-center justify-center">
                LV
              </span>
            </span>
            <span className="text-xs font-semibold text-white">مستوى</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className="rounded-2xl bg-[#1D1548] hover:bg-[#281E61] border border-violet-500/25 p-3 flex flex-col items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="w-10 h-10 rounded-xl p-[1.5px] bg-gradient-to-tr from-violet-500 via-white to-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.35)] flex items-center justify-center">
              <span className="w-full h-full rounded-[10px] bg-[#221854] text-white flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </span>
            </span>
            <span className="text-xs font-semibold text-white">المتجر</span>
          </button>

          <button
            type="button"
            onClick={() => setModal('honor')}
            className="rounded-2xl bg-[#1D1548] hover:bg-[#281E61] border border-violet-500/25 p-3 flex flex-col items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="w-10 h-10 rounded-xl p-[1.5px] bg-gradient-to-tr from-violet-500 via-white to-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.35)] flex items-center justify-center">
              <span className="w-full h-full rounded-[10px] bg-[#221854] text-violet-100 flex items-center justify-center">
                <Star className="w-5 h-5 fill-violet-300" />
              </span>
            </span>
            <span className="text-xs font-semibold text-white">جدار الشرف</span>
          </button>
        </div>
      </section>

      {/* Legendary Feature: 7-Day Daily Streak Check-In */}
      <section className="rounded-3xl bg-white border border-emerald-200/80 p-4 sm:p-5 shadow-xs space-y-3 text-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-display font-extrabold text-slate-900 flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-500" />
              <span>مكافآت الحضور اليومي الأسطورية (7 أيام)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              سجّل حضورك يومياً واحصل على ذهب + ماس + نقاط خبرة لرفع مستواك!
            </p>
          </div>
          <button
            type="button"
            onClick={claimDailyStreakBonus}
            className="px-4 py-2 rounded-full bg-[#15D16B] hover:bg-[#11BC5F] text-white text-xs font-extrabold cursor-pointer shadow-sm shrink-0"
          >
            {state.lastCheckInDate === new Date().toISOString().slice(0, 10)
              ? 'تم الاستلام اليوم ✓'
              : `استلم يوم ${state.streakDay >= 7 ? 1 : state.streakDay + 1}`}
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {[
            { day: 1, reward: '500K' },
            { day: 2, reward: '1M' },
            { day: 3, reward: '2M' },
            { day: 4, reward: '4M' },
            { day: 5, reward: '7.5M' },
            { day: 6, reward: '12M' },
            { day: 7, reward: '25M 👑' },
          ].map((item) => {
            const claimed = item.day <= state.streakDay;
            const isNext = item.day === (state.streakDay >= 7 ? 1 : state.streakDay + 1);
            return (
              <div
                key={item.day}
                className={`rounded-2xl p-2 text-center border transition-all ${
                  claimed
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : isNext
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/50 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="text-[10px] font-bold">يوم {item.day}</div>
                <div className="font-mono-num font-black text-[11px] sm:text-xs mt-1">
                  {claimed ? '✓' : item.reward}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SVIP & Aristocrat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#2D1659] to-[#161038] border border-violet-400/50 p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-display font-extrabold text-white">SVIP</div>
              <div className="text-xs text-slate-300 mt-1">
                رتبتك الحالية: <span className="text-violet-300 font-bold">{currentUser.svip} SVIP</span>
              </div>
            </div>
            <Shield className="w-8 h-8 text-violet-400 shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => setModal('svip')}
            className="self-start px-4 py-2 rounded-xl bg-gradient-to-l from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>تحقق منه الآن</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#132559] to-[#131038] border border-blue-400/50 p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-display font-extrabold text-white">الارستقراط</div>
              <div className="text-xs text-slate-300 mt-1">
                {currentUser.aristocratTier
                  ? `رتبتك: ${currentUser.aristocratTier}`
                  : 'نخبة أمراء المنصة VIP'}
              </div>
            </div>
            <Crown className="w-8 h-8 text-sky-400 shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => setModal('aristocrat')}
            className="self-start px-4 py-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>انضم الآن</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Wallet & Agency & System Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <section className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl p-[1.5px] bg-gradient-to-tr from-violet-500 via-white to-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.3)] shrink-0">
              <div className="w-full h-full rounded-[10px] bg-[#221854] text-white flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-display font-bold text-white">
                المحفظة (الماسي وذهبيات)
              </h2>
              <p className="text-xs text-sky-300 font-mono-num font-bold mt-0.5">
                {formatFullGold(currentUser.gold)} ذهبية · {currentUser.diamonds} ماسة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => openWallet('diamonds')}
              className="h-10 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500 text-sky-200 hover:text-white border border-sky-400/45 font-bold text-xs cursor-pointer"
            >
              الماسي
            </button>
            <button
              type="button"
              onClick={() => openWallet('gold')}
              className="h-10 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-white border border-amber-400/45 font-bold text-xs cursor-pointer"
            >
              ذهبيات
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl p-[1.5px] bg-gradient-to-tr from-violet-500 via-white to-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.3)] shrink-0">
              <div className="w-full h-full rounded-[10px] bg-[#221854] text-white flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-display font-bold text-white">
                تحويل الأموال والإدارة
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                وكيل الشحن وإعدادات النظام الفائق
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('agency-dashboard')}
                className="h-10 px-3 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-bold text-xs cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.4)] whitespace-nowrap"
              >
                لوحة الوكالة
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('agencies')}
              className="h-10 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-200 hover:text-white border border-emerald-400/45 font-bold text-xs cursor-pointer"
            >
              تحويل
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('system')}
                aria-label="مركز النظام والإدارة"
                className="h-10 px-3 rounded-xl bg-violet-500/20 hover:bg-violet-500 text-violet-200 hover:text-white border border-violet-400/45 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>النظام</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Install & Store Bundle Card (Screenshot 1) */}
      <section className="rounded-3xl bg-[#191242] border-2 border-blue-400/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xl shadow-violet-950/50">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-[2px] bg-gradient-to-tr from-violet-500 via-white to-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.4)] shrink-0">
            <img
              src={APP_ICON_PATH}
              alt="أيقونة رياض شات"
              referrerPolicy="no-referrer"
              className="w-full h-full rounded-[14px] object-cover"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-display font-extrabold text-white">
                تثبيت تطبيق «رياض شات» أو استخراج حزمة المتجر
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-l from-violet-500 to-blue-500 text-white text-[11px] font-extrabold">
                جاهز للنشر 100%
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              ثبّت التطبيق مباشرة على هاتفك أو استخرج ملف Google Play (AAB/APK) و App Store!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModal('wizard')}
          className="h-12 px-6 rounded-full bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg shadow-violet-600/30"
        >
          <span>فتح المعالج</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </section>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060414]/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#161038] border border-violet-500/40 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-violet-500/25 pb-3">
              <h3 className="text-base sm:text-lg font-display font-bold text-white">
                {modal === 'tasks' && 'المهام اليومية والمكافآت'}
                {modal === 'level' && `تقدم المستوى — Lv.${currentUser.level}`}
                {modal === 'honor' && 'جدار الشرف — قائمة الأغنياء'}
                {modal === 'svip' && 'امتيازات SVIP الملكية'}
                {modal === 'aristocrat' && 'الرتب الارستقراطية VIP'}
                {modal === 'wizard' && 'معالج تثبيت التطبيق واستخراج حزمة المتجر'}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="w-9 h-9 rounded-full bg-[#241A57] hover:bg-[#2F2270] flex items-center justify-center text-slate-200 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modal === 'tasks' && (
              <div className="space-y-3">
                {state.tasks.map((task) => {
                  const ready = task.progress >= task.target && !task.claimed;
                  return (
                    <div
                      key={task.id}
                      className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{task.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{task.description}</div>
                        <div className="text-xs text-sky-300 font-mono-num mt-1">
                          المكافأة: +{formatFullGold(task.rewardGold)} ذهب · +{task.rewardDiamonds} ماسة
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => claimTaskReward(task.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer ${
                          task.claimed
                            ? 'bg-[#1E1647] text-slate-500'
                            : ready
                            ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white'
                            : 'bg-[#1E1647] text-slate-400'
                        }`}
                      >
                        {task.claimed ? 'تم الاستلام' : ready ? 'استلام' : 'قيد التنفيذ'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {modal === 'level' && (
              <div className="space-y-4 py-1">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#0F0B28] border border-violet-500/35 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-600/30 border border-blue-400/60 flex items-center justify-center text-xl font-mono-num font-extrabold text-sky-300 shrink-0">
                      Lv.{levelProgress.level}
                    </div>
                    <div>
                      <div className="text-sm font-display font-bold text-white">
                        المستوى الحالي: {levelProgress.level}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        الهدف القادم:{' '}
                        <span className="text-sky-300 font-mono-num font-bold">
                          Lv.{levelProgress.level + 1}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left font-mono-num">
                    <div className="text-lg font-extrabold text-violet-300">
                      {levelProgress.percent}%
                    </div>
                    <div className="text-[11px] text-slate-400">مكتمل</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono-num">
                    <span className="text-slate-300">نقاط الخبرة الحالية</span>
                    <span className="text-sky-300 font-bold">
                      {formatFullGold(levelProgress.xp)} / {formatFullGold(levelProgress.requiredXp)} XP
                    </span>
                  </div>
                  <div className="h-4 rounded-full bg-[#0F0B28] border border-violet-500/35 p-0.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-violet-500 via-indigo-500 to-blue-400 shadow-[0_0_12px_rgba(99,102,241,0.55)] transition-all duration-500"
                      style={{ width: `${Math.max(4, levelProgress.percent)}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 font-mono-num text-center">
                    متبقي {formatFullGold(levelProgress.remainingXp)} XP للترقية إلى المستوى التالي
                  </div>
                </div>

                <div className="rounded-2xl bg-[#0F0B28] border border-violet-500/30 p-3.5 space-y-2.5">
                  <div className="text-xs font-display font-bold text-white">
                    طرق كسب الخبرة (XP) داخل الغرف الصوتية:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-[#181140] border border-violet-500/25 px-3 py-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                        <span>رسالة في الدردشة</span>
                      </span>
                      <span className="font-mono-num font-bold text-violet-300">
                        +{ROOM_XP_REWARDS.chatMessage} XP
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#181140] border border-violet-500/25 px-3 py-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <Mic className="w-3.5 h-3.5 text-violet-400" />
                        <span>الصعود على المايك</span>
                      </span>
                      <span className="font-mono-num font-bold text-sky-300">
                        +{ROOM_XP_REWARDS.micAscend} XP
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#181140] border border-violet-500/25 px-3 py-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <Gift className="w-3.5 h-3.5 text-blue-400" />
                        <span>إرسال/استلام هدية</span>
                      </span>
                      <span className="font-mono-num font-bold text-violet-300">
                        +{ROOM_XP_REWARDS.sendGiftBase}+ XP
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#181140] border border-violet-500/25 px-3 py-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                        <span>إنشاء غرفة صوتية</span>
                      </span>
                      <span className="font-mono-num font-bold text-sky-300">
                        +{ROOM_XP_REWARDS.createRoom} XP
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModal(null);
                    setActiveTab('rooms');
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-extrabold text-xs sm:text-sm cursor-pointer"
                >
                  اذهب للغرف الصوتية لزيادة مستواك الآن
                </button>
              </div>
            )}

            {modal === 'honor' && (
              <div className="space-y-2.5">
                {sortedHonorUsers.map((u, idx) => (
                  <div
                    key={u.id}
                    className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-violet-500/25 text-sky-300 font-mono-num font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <img
                        src={u.avatar}
                        alt={u.name}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white truncate">
                          {u.name} {u.flag}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-num">ID:{u.id}</div>
                      </div>
                    </div>
                    <div className="text-xs font-mono-num font-bold text-sky-300 shrink-0">
                      {formatCompactNumber(u.gold)} ذهب
                    </div>
                  </div>
                ))}
              </div>
            )}

            {modal === 'svip' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#0F0B28] border border-violet-400/40 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">رتبتك الحالية: SVIP {currentUser.svip}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      تمنحك مضاعفة خبرة الغرف وإطار ملكي وحماية خاصة
                    </div>
                  </div>
                  <Award className="w-8 h-8 text-violet-400" />
                </div>
                <button
                  type="button"
                  onClick={upgradeSvip}
                  className="w-full h-12 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-extrabold text-sm cursor-pointer"
                >
                  ترقية إلى SVIP {Math.min(7, currentUser.svip + 1)}
                </button>
              </div>
            )}

            {modal === 'aristocrat' && (
              <div className="space-y-3">
                {ARISTOCRAT_TIERS.map((tier) => {
                  const isCurrent = currentUser.aristocratTier === tier.name;
                  return (
                    <div
                      key={tier.name}
                      className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{tier.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{tier.perks}</div>
                      </div>
                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => joinAristocratTier(tier.name, tier.cost)}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs shrink-0 ${
                          isCurrent
                            ? 'bg-[#1D1548] text-sky-300 border border-blue-400/40 cursor-default'
                            : 'bg-gradient-to-l from-blue-600 to-violet-600 text-white cursor-pointer'
                        }`}
                      >
                        {isCurrent ? 'مفعّلة ✓' : `${formatCompactNumber(tier.cost)} ذهب`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {modal === 'wizard' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl bg-[#0F0B28] border border-blue-400/40 p-4">
                  <img
                    src={APP_ICON_PATH}
                    alt="رياض شات"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                  <div>
                    <div className="font-bold text-sm text-white">حزمة رياض شات — الإصدار الرسمي</div>
                    <div className="text-xs text-sky-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>متوافق مع Google Play (AAB/APK) و App Store</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-4 space-y-2 text-xs text-slate-300">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-sky-400" />
                    <span>خطوات التثبيت المباشر على الهاتف:</span>
                  </div>
                  <p>1. افتح قائمة المتصفح واختر «الإضافة إلى الشاشة الرئيسية» للتثبيت الفوري.</p>
                  <p>2. لتصدير حزمة المتجر، قم بتحميل ملف إعدادات البناء أدناه واستخدمه مع Capacitor أو TWA.</p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBundleConfig}
                  className="w-full h-12 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>استخراج حزمة المتجر (AAB / APK / iOS Config)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
