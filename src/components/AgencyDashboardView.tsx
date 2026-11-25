import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart3,
  BellRing,
  CheckCircle2,
  Clock,
  Coins,
  Crown,
  Diamond,
  Flame,
  Headphones,
  Lock,
  Mic,
  Plus,
  Radio,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AgencyHostRecord } from '../types';
import { formatCompactNumber, formatFullGold } from '../utils/format';

type DashboardSection = 'all' | 'hosts' | 'rooms' | 'payouts';
type HostStatusFilter = 'all' | 'golden-80' | 'on-mic' | 'online' | 'offline';

const COMMISSION_RATES = [10, 12, 15, 18, 20];
const AGENCY_SPLITS = [10, 15, 20, 25];
const GOLDEN_ALERT_THRESHOLD = 80;

export const AgencyDashboardView: React.FC = () => {
  const {
    state,
    currentUser,
    isPrimaryAdmin,
    setActiveTab,
    setActiveRoomId,
    boostRoomHeat,
    distributeProfitsAutomatically,
    distributeSingleHostCommission,
    updateHostCommissionRate,
    toggleAutoDistribution,
    setAgencyCommissionSplit,
    addAgencyHost,
    boostHostDailyProfit,
    approveAgencyRequest,
    rejectAgencyRequest,
  } = useApp();

  const [section, setSection] = useState<DashboardSection>('all');
  const [hostSearch, setHostSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<HostStatusFilter>('all');
  const [addHostOpen, setAddHostOpen] = useState(false);

  // Daily Profit Target Celebration State
  const [celebrationHost, setCelebrationHost] = useState<{
    id: string;
    name: string;
    avatar: string;
    targetGold: number;
    giftsReceivedGold: number;
    roomTitle: string;
    key: number;
  } | null>(null);
  const celebratedTargetsRef = useRef<Record<string, number>>({});
  const celebrationInitializedRef = useRef(false);
  const celebrationTimerRef = useRef<number | null>(null);

  // 80% Golden Visual Alert State
  const [goldenAlertHost, setGoldenAlertHost] = useState<{
    id: string;
    name: string;
    avatar: string;
    targetGold: number;
    giftsReceivedGold: number;
    percent: number;
    remainingGold: number;
    roomId: string;
    roomTitle: string;
    key: number;
  } | null>(null);
  const goldenAlertedTargetsRef = useRef<Record<string, number>>({});
  const goldenAlertTimerRef = useRef<number | null>(null);

  const triggerGoldenAlert = (host: {
    id: string;
    name: string;
    avatar: string;
    targetGold: number;
    giftsReceivedGold: number;
    roomId: string;
    roomTitle: string;
  }) => {
    const percent = Math.min(
      100,
      Math.round((host.giftsReceivedGold / Math.max(1, host.targetGold)) * 100)
    );
    const remainingGold = Math.max(0, host.targetGold - host.giftsReceivedGold);
    if (goldenAlertTimerRef.current) window.clearTimeout(goldenAlertTimerRef.current);
    setGoldenAlertHost({ ...host, percent, remainingGold, key: Date.now() });
    goldenAlertTimerRef.current = window.setTimeout(() => {
      setGoldenAlertHost(null);
    }, 6500);
  };

  const triggerTargetCelebration = (host: {
    id: string;
    name: string;
    avatar: string;
    targetGold: number;
    giftsReceivedGold: number;
    roomTitle: string;
  }) => {
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    setCelebrationHost({ ...host, key: Date.now() });
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebrationHost(null);
    }, 5500);
  };

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
      if (goldenAlertTimerRef.current) window.clearTimeout(goldenAlertTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!celebrationInitializedRef.current) {
      state.hosts.forEach((h) => {
        const pct = (h.giftsReceivedGold / Math.max(1, h.targetGold)) * 100;
        if (h.giftsReceivedGold >= h.targetGold) {
          celebratedTargetsRef.current[h.id] = h.targetGold;
          goldenAlertedTargetsRef.current[h.id] = h.targetGold;
        } else if (pct >= GOLDEN_ALERT_THRESHOLD) {
          goldenAlertedTargetsRef.current[h.id] = h.targetGold;
        }
      });
      celebrationInitializedRef.current = true;
      return;
    }

    const newlyCompleted = state.hosts.find(
      (h) =>
        h.giftsReceivedGold >= h.targetGold &&
        celebratedTargetsRef.current[h.id] !== h.targetGold
    );

    if (newlyCompleted) {
      celebratedTargetsRef.current[newlyCompleted.id] = newlyCompleted.targetGold;
      goldenAlertedTargetsRef.current[newlyCompleted.id] = newlyCompleted.targetGold;
      triggerTargetCelebration(newlyCompleted);
      return;
    }

    const newlyCrossedGolden80 = state.hosts.find((h) => {
      const pct = (h.giftsReceivedGold / Math.max(1, h.targetGold)) * 100;
      return (
        pct >= GOLDEN_ALERT_THRESHOLD &&
        h.giftsReceivedGold < h.targetGold &&
        goldenAlertedTargetsRef.current[h.id] !== h.targetGold
      );
    });

    if (newlyCrossedGolden80) {
      goldenAlertedTargetsRef.current[newlyCrossedGolden80.id] =
        newlyCrossedGolden80.targetGold;
      triggerGoldenAlert(newlyCrossedGolden80);
    }
  }, [state.hosts]);

  const nonHostUsers = useMemo(
    () => state.users.filter((u) => !state.hosts.some((h) => h.userId === u.id)),
    [state.users, state.hosts]
  );

  const [newHostUserId, setNewHostUserId] = useState(nonHostUsers[0]?.id || state.users[0]?.id || '');
  const [newHostRoomId, setNewHostRoomId] = useState(state.rooms[0]?.id || '');
  const [newHostTarget, setNewHostTarget] = useState('120000000');
  const [newHostRate, setNewHostRate] = useState(15);

  // Compute live host status directly from live room seats
  const liveHosts = useMemo(() => {
    return state.hosts.map((host) => {
      const seatedRoom = state.rooms.find((r) =>
        r.seats.some((s) => s.userId === host.userId)
      );
      const seatInfo = seatedRoom?.seats.find((s) => s.userId === host.userId);
      const effectiveStatus: AgencyHostRecord['status'] = seatInfo
        ? 'on-mic'
        : host.status;
      return {
        ...host,
        effectiveStatus,
        isSpeakingNow: Boolean(seatInfo?.isSpeaking && !seatInfo?.isMuted),
        liveRoomId: seatedRoom?.id || host.roomId,
        liveRoomTitle: seatedRoom?.title || host.roomTitle,
      };
    });
  }, [state.hosts, state.rooms]);

  const filteredHosts = useMemo(() => {
    const q = hostSearch.trim().toLowerCase();
    return liveHosts.filter((h) => {
      const hostPct = Math.round((h.giftsReceivedGold / Math.max(1, h.targetGold)) * 100);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'golden-80'
          ? hostPct >= GOLDEN_ALERT_THRESHOLD
          : h.effectiveStatus === statusFilter);
      const matchesQuery =
        !q ||
        h.name.toLowerCase().includes(q) ||
        h.userId.toLowerCase().includes(q) ||
        h.liveRoomTitle.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [liveHosts, hostSearch, statusFilter]);

  // KPI Aggregates & Smart Daily Target Telemetry
  const totalGiftsRevenue = useMemo(
    () => state.hosts.reduce((sum, h) => sum + h.giftsReceivedGold, 0),
    [state.hosts]
  );
  const dailyTargetSummary = useMemo(() => {
    const totalTargetGold = liveHosts.reduce((sum, h) => sum + Math.max(1, h.targetGold), 0);
    const totalAchievedGold = liveHosts.reduce((sum, h) => sum + h.giftsReceivedGold, 0);
    const rawPercent =
      totalTargetGold > 0 ? Math.round((totalAchievedGold / totalTargetGold) * 100) : 0;
    const clampedPercent = Math.min(100, rawPercent);
    const remainingTotalGold = Math.max(0, totalTargetGold - totalAchievedGold);
    const goldenZoneHosts = liveHosts
      .map((h) => {
        const pct = Math.min(
          100,
          Math.round((h.giftsReceivedGold / Math.max(1, h.targetGold)) * 100)
        );
        return {
          ...h,
          percent: pct,
          remainingGold: Math.max(0, h.targetGold - h.giftsReceivedGold),
        };
      })
      .filter((h) => h.percent >= GOLDEN_ALERT_THRESHOLD && h.giftsReceivedGold < h.targetGold)
      .sort((a, b) => b.percent - a.percent);
    const completedHostsCount = liveHosts.filter((h) => h.giftsReceivedGold >= h.targetGold).length;
    const reached80OrMoreCount = goldenZoneHosts.length + completedHostsCount;
    return {
      totalTargetGold,
      totalAchievedGold,
      rawPercent,
      clampedPercent,
      remainingTotalGold,
      goldenZoneHosts,
      completedHostsCount,
      reached80OrMoreCount,
      isAgencyGoldenAlert: clampedPercent >= GOLDEN_ALERT_THRESHOLD || goldenZoneHosts.length > 0,
    };
  }, [liveHosts]);
  const totalPendingCommissions = useMemo(
    () => state.hosts.reduce((sum, h) => sum + h.pendingCommissionGold, 0),
    [state.hosts]
  );
  const totalDistributableGold = state.hostBonusPoolGold + totalPendingCommissions;
  const activeOnMicCount = useMemo(
    () => liveHosts.filter((h) => h.effectiveStatus === 'on-mic').length,
    [liveHosts]
  );

  const roomTelemetry = useMemo(() => {
    const totalListeners = state.rooms.reduce((sum, r) => sum + r.listeners, 0);
    const totalOccupiedMics = state.rooms.reduce(
      (sum, r) => sum + r.seats.filter((s) => Boolean(s.userId)).length,
      0
    );
    const totalMics = state.rooms.reduce((sum, r) => sum + r.totalMics, 0);
    const maxHeat = Math.max(1, ...state.rooms.map((r) => r.heat));
    return {
      totalListeners,
      totalOccupiedMics,
      totalMics,
      occupancyPercent: totalMics > 0 ? Math.round((totalOccupiedMics / totalMics) * 100) : 0,
      maxHeat,
    };
  }, [state.rooms]);

  // Automated Split Breakdown Preview
  const splitPreview = useMemo(() => {
    const pool = state.hostBonusPoolGold;
    const agencyShare = Math.floor((pool * state.agencyCommissionSplit) / 100);
    const hostsBonusPool = Math.max(0, pool - agencyShare);
    const totalWeight = state.hosts.reduce(
      (sum, h) => sum + Math.max(1, h.giftsReceivedGold),
      0
    );
    const perHost = state.hosts.map((h) => {
      const bonusShare =
        totalWeight > 0
          ? Math.floor((hostsBonusPool * Math.max(1, h.giftsReceivedGold)) / totalWeight)
          : 0;
      return {
        hostId: h.id,
        name: h.name,
        avatar: h.avatar,
        pending: h.pendingCommissionGold,
        bonusShare,
        totalPayout: h.pendingCommissionGold + bonusShare,
      };
    });
    const hostsTotalPayout = perHost.reduce((s, p) => s + p.totalPayout, 0);
    return { agencyShare, hostsBonusPool, hostsTotalPayout, perHost };
  }, [state.hostBonusPoolGold, state.agencyCommissionSplit, state.hosts]);

  const handleOpenAddHost = () => {
    setNewHostUserId(nonHostUsers[0]?.id || state.users[0]?.id || '');
    setNewHostRoomId(state.rooms[0]?.id || '');
    setAddHostOpen(true);
  };

  const handleSubmitAddHost = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = addAgencyHost(
      newHostUserId,
      newHostRoomId,
      Number(newHostTarget.replace(/[^\d]/g, '')) || 100_000_000,
      newHostRate
    );
    if (ok) setAddHostOpen(false);
  };

  const statusBadge = (status: AgencyHostRecord['status']) => {
    if (status === 'on-mic') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-500/25 border border-blue-400/50 text-sky-200 text-[11px] font-bold whitespace-nowrap">
          <Mic className="w-3 h-3 text-sky-300" />
          <span>على المايك</span>
        </span>
      );
    }
    if (status === 'online') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-200 text-[11px] font-bold whitespace-nowrap">
          <Radio className="w-3 h-3 text-blue-300" />
          <span>متصل</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/80 border border-violet-500/20 text-slate-400 text-[11px] font-bold whitespace-nowrap">
        <span>غير متصل</span>
      </span>
    );
  };

  if (!isPrimaryAdmin) {
    return null;
  }

  return (
    <div className="space-y-5 text-white">
      {/* Glowing Purple & Blue Executive Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C0F47] via-[#120B33] to-[#0B173F] border border-violet-400/45 p-5 sm:p-6 shadow-[0_0_38px_rgba(124,58,237,0.3)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -left-16 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-16 w-64 h-64 rounded-full bg-violet-600/25 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white flex items-center justify-center shadow-[0_0_18px_rgba(99,102,241,0.65)] shrink-0">
                <Crown className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
                لوحة تحكم الوكالة
              </h1>
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-400/45 text-sky-300 text-xs font-mono-num font-bold">
                ID: {currentUser.id} · {currentUser.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/90 max-w-2xl">
              مراقبة أداء المضيفين لحظياً، تتبّع إشغال وحرارة الغرف المباشرة، وتوزيع الأرباح والعمولات بشكل آلي ودقيق.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('agencies')}
              className="h-11 px-4 rounded-xl bg-[#181042] hover:bg-[#22175C] border border-violet-400/40 text-violet-100 text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <Wallet className="w-4 h-4 text-sky-300" />
              <span>بوابة الشحن والتحويل</span>
            </button>

            <button
              type="button"
              onClick={toggleAutoDistribution}
              className={`h-11 px-4 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                state.autoDistributeEnabled
                  ? 'bg-blue-500/20 border-sky-400/60 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.3)]'
                  : 'bg-[#140D36] border-violet-500/30 text-slate-300'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  state.autoDistributeEnabled
                    ? 'bg-sky-400 shadow-[0_0_8px_#38BDF8] animate-pulse'
                    : 'bg-slate-500'
                }`}
              />
              <span>التوزيع الآلي: {state.autoDistributeEnabled ? 'مُفعل' : 'متوقف'}</span>
            </button>

            <button
              type="button"
              onClick={() => distributeProfitsAutomatically('auto')}
              className="h-11 px-5 rounded-xl bg-gradient-to-l from-violet-600 via-indigo-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-display font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(99,102,241,0.55)] transition-all active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <Zap className="w-4 h-4" />
              <span>توزيع الأرباح والعمولات الآن</span>
            </button>
          </div>
        </div>

        {/* Sub-view Switcher */}
        <div className="relative mt-5 flex items-center gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: 'all', label: 'نظرة شاملة', icon: BarChart3 },
              { id: 'hosts', label: `أداء المضيفين (${liveHosts.length})`, icon: Users },
              { id: 'rooms', label: `الغرف المباشرة (${state.rooms.length})`, icon: Radio },
              { id: 'payouts', label: 'التوزيع الآلي والأرباح', icon: Sparkles },
            ] as Array<{ id: DashboardSection; label: string; icon: React.FC<{ className?: string }> }>
          ).map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`h-10 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-[0_0_16px_rgba(124,58,237,0.5)]'
                    : 'bg-[#0E0828]/85 hover:bg-[#191045] text-indigo-200 border border-violet-500/30'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Host Daily Profit Target Celebration Animation */}
      <AnimatePresence>
        {celebrationHost && (
          <motion.section
            key={celebrationHost.key}
            initial={{ opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#2A1166] via-[#17124B] to-[#0D255E] border-2 border-amber-300/80 p-5 sm:p-6 shadow-[0_0_45px_rgba(251,191,36,0.35),0_0_32px_rgba(124,58,237,0.45)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent animate-gold-sweep"
            />

            {/* Floating Celebration Confetti Particles */}
            {[
              { id: 'c1', emoji: '🏆', x: '8%', y: '18%', delay: 0.05 },
              { id: 'c2', emoji: '✨', x: '22%', y: '75%', delay: 0.12 },
              { id: 'c3', emoji: '🪙', x: '78%', y: '20%', delay: 0.08 },
              { id: 'c4', emoji: '👑', x: '88%', y: '72%', delay: 0.16 },
              { id: 'c5', emoji: '✨', x: '50%', y: '12%', delay: 0.1 },
            ].map((p) => (
              <motion.span
                key={p.id}
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.4, y: 14 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0.5, 1.25, 1, 0.7],
                  y: [14, -10, -24, -36],
                }}
                transition={{ duration: 2.4, delay: p.delay, repeat: Infinity }}
                style={{ left: p.x, top: p.y }}
                className="pointer-events-none absolute text-lg sm:text-xl select-none"
              >
                {p.emoji}
              </motion.span>
            ))}

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    className="absolute -inset-2 rounded-full border-2 border-dashed border-amber-300/85"
                  />
                  <motion.span
                    aria-hidden="true"
                    animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.9, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="absolute -inset-1 rounded-full bg-gradient-to-tr from-violet-500 via-blue-400 to-amber-300 blur-sm"
                  />
                  <img
                    src={celebrationHost.avatar}
                    alt={celebrationHost.name}
                    referrerPolicy="no-referrer"
                    className="relative w-16 h-16 rounded-full object-cover border-2 border-amber-300"
                  />
                  <motion.span
                    animate={{ y: [0, -4, 0], rotate: [-8, 8, -8] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 flex items-center justify-center shadow-lg border border-yellow-100"
                  >
                    <Trophy className="w-4 h-4" />
                  </motion.span>
                </div>

                <div className="space-y-1 text-center sm:text-right min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/60 text-amber-200 text-[11px] font-extrabold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>إنجاز الهدف الربحي اليومي 100%</span>
                  </div>
                  <h3 className="text-base sm:text-xl font-display font-extrabold text-white">
                    مبروك! وصل المضيف {celebrationHost.name} إلى تارجت اليوم
                  </h3>
                  <p className="text-xs sm:text-sm text-sky-200 font-mono-num">
                    حقق {formatCompactNumber(celebrationHost.giftsReceivedGold)} /{' '}
                    {formatCompactNumber(celebrationHost.targetGold)} ذهب في «{celebrationHost.roomTitle}» (+1M عمولة تحفيزية)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCelebrationHost(null)}
                aria-label="إغلاق الاحتفال"
                className="w-9 h-9 rounded-full bg-[#110A30]/80 hover:bg-[#1E1352] border border-amber-300/40 text-amber-200 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Live 80% Golden Visual Alert Notification Banner */}
      <AnimatePresence>
        {goldenAlertHost && !celebrationHost && (
          <motion.section
            key={goldenAlertHost.key}
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#2A1D07] via-[#1C1438] to-[#120B33] border border-amber-400/80 p-4 sm:p-5 animate-gold-aura"
            role="status"
            aria-live="polite"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-300/20 to-transparent animate-gold-sweep"
            />
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={goldenAlertHost.avatar}
                    alt={goldenAlertHost.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]"
                  />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow animate-golden-icon-glow">
                    <BellRing className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="space-y-1 text-center sm:text-right min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-extrabold text-amber-300">
                    <span>تنبيه ذهبي · تجاوز عتبة 80% من الهدف اليومي</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num tabular-nums animate-golden-text-shimmer">
                      {goldenAlertHost.percent}%
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-lg font-display font-extrabold text-white">
                    المضيف {goldenAlertHost.name} على وشك إتمام تارجت اليوم!
                  </h3>
                  <p className="text-xs text-amber-100/90 font-mono-num tabular-nums">
                    المحقق {formatCompactNumber(goldenAlertHost.giftsReceivedGold)} /{' '}
                    {formatCompactNumber(goldenAlertHost.targetGold)} ذهب · المتبقي{' '}
                    <span className="font-extrabold text-amber-300">
                      {formatCompactNumber(goldenAlertHost.remainingGold)}
                    </span>{' '}
                    ذهب فقط في «{goldenAlertHost.roomTitle}»
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveRoomId(goldenAlertHost.roomId)}
                  className="h-10 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                >
                  <span>دخول لدعم المضيف</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setGoldenAlertHost(null)}
                  aria-label="إغلاق التنبيه الذهبي"
                  className="w-10 h-10 rounded-xl bg-[#110A30]/80 hover:bg-[#1E1352] border border-amber-400/40 text-amber-200 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Owner Pending Agency Opening Requests Queue */}
      {(() => {
        const pendingReqs = state.agencyRequests.filter((r) => r.status === 'pending');
        if (pendingReqs.length === 0) return null;
        return (
          <section className="rounded-3xl bg-gradient-to-l from-[#2A1B4E] via-[#170F3D] to-[#120B33] border border-amber-400/60 p-4 sm:p-5 space-y-3 shadow-[0_0_24px_rgba(251,191,36,0.16)]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-300 shrink-0" />
                <h2 className="text-sm sm:text-base font-display font-extrabold text-white">
                  طلبات فتح وكالات جديدة بانتظار موافقتك ({pendingReqs.length})
                </h2>
              </div>
              <span className="text-[11px] font-bold text-amber-200">
                صلاحية المالك ID: 900
              </span>
            </div>
            <div className="space-y-2.5">
              {pendingReqs.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-[#0D0829]/90 border border-amber-400/35 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={req.userAvatar}
                      alt={req.userName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover border border-amber-300/60 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-display font-bold text-white truncate">
                        {req.agencyTitle}
                      </div>
                      <div className="text-xs text-slate-300 font-mono-num">
                        {req.userName} (ID: {req.userId}) · {req.createdAt}
                      </div>
                      {req.contactNote && (
                        <div className="text-[11px] text-amber-200/85 truncate">{req.contactNote}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void approveAgencyRequest(req.id)}
                      className="h-9 px-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>موافقة وفتح الوكالة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void rejectAgencyRequest(req.id)}
                      className="h-9 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-xs font-bold cursor-pointer"
                    >
                      رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* 4 Glowing Purple/Blue KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-[#120B33] border border-violet-500/40 p-4 shadow-[0_0_20px_rgba(124,58,237,0.18)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-violet-200 font-semibold">إيرادات هدايا المضيفين</span>
            <span className="w-8 h-8 rounded-xl bg-violet-500/25 border border-violet-400/45 text-violet-200 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-mono-num font-black text-white">
            {formatCompactNumber(totalGiftsRevenue)}
          </div>
          <div className="text-[11px] text-sky-300 font-mono-num">
            {formatFullGold(totalGiftsRevenue)} ذهبية
          </div>
        </div>

        <div className="rounded-2xl bg-[#120B33] border border-blue-400/50 p-4 shadow-[0_0_24px_rgba(59,130,246,0.22)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-sky-200 font-semibold">مجمع الأرباح للتوزيع</span>
            <span className="w-8 h-8 rounded-xl bg-blue-500/25 border border-blue-400/45 text-sky-300 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-mono-num font-black text-sky-300">
            {formatCompactNumber(totalDistributableGold)}
          </div>
          <div className="text-[11px] text-violet-200 font-mono-num">
            عمولات: {formatCompactNumber(totalPendingCommissions)} · بونص: {formatCompactNumber(state.hostBonusPoolGold)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#120B33] border border-violet-500/40 p-4 shadow-[0_0_20px_rgba(124,58,237,0.18)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-violet-200 font-semibold">المضيفون على المايك</span>
            <span className="w-8 h-8 rounded-xl bg-indigo-500/25 border border-indigo-400/45 text-indigo-200 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-mono-num font-black text-white">
            {activeOnMicCount}{' '}
            <span className="text-sm font-bold text-indigo-300">/ {liveHosts.length}</span>
          </div>
          <div className="text-[11px] text-indigo-200">
            متابعة حية لنشاط المضيفين بالغرف
          </div>
        </div>

        <div className="rounded-2xl bg-[#120B33] border border-blue-400/45 p-4 shadow-[0_0_20px_rgba(59,130,246,0.18)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-sky-200 font-semibold">مستمعو الغرف والإشغال</span>
            <span className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/45 text-sky-300 flex items-center justify-center">
              <Headphones className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-mono-num font-black text-white">
            {roomTelemetry.totalListeners.toLocaleString('en-US')}
          </div>
          <div className="text-[11px] text-sky-300 font-mono-num">
            إشغال المايكات: {roomTelemetry.totalOccupiedMics}/{roomTelemetry.totalMics} ({roomTelemetry.occupancyPercent}%)
          </div>
        </div>
      </section>

      {/* Smart Agency Daily Target Progress Bar + 80% Golden Alerts Hub */}
      {(section === 'all' || section === 'hosts') && (
        <section
          className={`relative overflow-hidden rounded-3xl p-4 sm:p-6 space-y-4 transition-all ${
            dailyTargetSummary.isAgencyGoldenAlert
              ? 'bg-gradient-to-l from-[#1E1538] via-[#150E35] to-[#120B33] border border-amber-400/65 shadow-[0_0_28px_rgba(251,191,36,0.18)]'
              : 'bg-[#120B33] border border-violet-500/40 shadow-[0_0_24px_rgba(124,58,237,0.16)]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target
                  className={`w-5 h-5 shrink-0 ${
                    dailyTargetSummary.isAgencyGoldenAlert
                      ? 'text-amber-300 animate-golden-icon-glow'
                      : 'text-sky-400'
                  }`}
                />
                <h2 className="text-base sm:text-lg font-display font-extrabold text-white">
                  شريط التقدم الذكي للهدف اليومي للمضيفين
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-indigo-200/85 font-mono-num tabular-nums">
                <span>
                  إجمالي المحقق:{' '}
                  <strong className="text-white">
                    {formatCompactNumber(dailyTargetSummary.totalAchievedGold)}
                  </strong>{' '}
                  / {formatCompactNumber(dailyTargetSummary.totalTargetGold)} ذهب
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    dailyTargetSummary.goldenZoneHosts.length > 0
                      ? 'text-amber-300 font-bold'
                      : 'text-indigo-200/80'
                  }
                >
                  تنبيه ذهبي (80%+): {dailyTargetSummary.goldenZoneHosts.length} مضيف
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-sky-300">
                  مكتمل 100%: {dailyTargetSummary.completedHostsCount} / {liveHosts.length}
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-2 sm:text-left shrink-0">
              <span
                className={`text-2xl sm:text-3xl font-mono-num tabular-nums font-black ${
                  dailyTargetSummary.clampedPercent >= GOLDEN_ALERT_THRESHOLD
                    ? 'animate-golden-text-shimmer'
                    : 'text-sky-300'
                }`}
              >
                {dailyTargetSummary.clampedPercent}%
              </span>
              <span className="text-xs text-indigo-200/80">إنجاز يومي</span>
            </div>
          </div>

          {/* Smart RTL Progress Track with 80% Golden Threshold Marker */}
          <div className="space-y-2">
            <div
              className={`relative h-3.5 w-full rounded-full bg-[#07041A] border p-0.5 overflow-hidden ${
                dailyTargetSummary.clampedPercent >= GOLDEN_ALERT_THRESHOLD
                  ? 'border-amber-400/75 shadow-[0_0_16px_rgba(251,191,36,0.28)]'
                  : 'border-violet-500/40'
              }`}
              role="progressbar"
              aria-label="نسبة إنجاز الهدف اليومي الإجمالي للمضيفين"
              aria-valuenow={dailyTargetSummary.clampedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`relative h-full rounded-full overflow-hidden transition-all duration-500 ${
                  dailyTargetSummary.clampedPercent >= GOLDEN_ALERT_THRESHOLD
                    ? 'bg-gradient-to-l from-amber-500 via-yellow-300 to-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.8)]'
                    : 'bg-gradient-to-l from-violet-500 via-indigo-400 to-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.55)]'
                }`}
                style={{
                  width: `${
                    dailyTargetSummary.clampedPercent > 0
                      ? Math.max(3, dailyTargetSummary.clampedPercent)
                      : 0
                  }%`,
                }}
              >
                {dailyTargetSummary.clampedPercent >= GOLDEN_ALERT_THRESHOLD && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-milestone-shine"
                  />
                )}
              </div>

              {/* Exact 80% Golden Threshold Notch (RTL: grows right-to-left) */}
              <div
                aria-hidden="true"
                style={{ right: `${GOLDEN_ALERT_THRESHOLD}%` }}
                className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-amber-300/90 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono-num tabular-nums text-indigo-300/80">
              <span>0%</span>
              <span className="text-amber-300 font-bold">
                عتبة التنبيه الذهبي 80%
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Active Golden Visual Alerts Strip for Hosts at 80%–99% */}
          {dailyTargetSummary.goldenZoneHosts.length > 0 && (
            <div className="pt-3 border-t border-amber-400/25 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <BellRing className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 sm:mt-0 animate-golden-icon-glow" />
                <div className="text-xs text-amber-100 leading-relaxed">
                  <strong className="text-amber-300 font-extrabold">
                    تنبيه ذهبي نشط ({dailyTargetSummary.goldenZoneHosts.length}):
                  </strong>{' '}
                  {dailyTargetSummary.goldenZoneHosts
                    .map(
                      (h) =>
                        `${h.name} (${h.percent}% · متبقي ${formatCompactNumber(h.remainingGold)})`
                    )
                    .join(' · ')}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatusFilter('golden-80')}
                className="h-9 px-3.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/60 text-amber-200 text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0 self-start md:self-auto transition-colors"
              >
                عرض مضيفي التنبيه الذهبي
              </button>
            </div>
          )}
        </section>
      )}

      {/* SECTION 1: Hosts Performance Monitor */}
      {(section === 'all' || section === 'hosts') && (
        <section className="rounded-3xl bg-[#120B33] border border-violet-500/40 p-4 sm:p-6 shadow-[0_0_28px_rgba(124,58,237,0.2)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-display font-extrabold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-violet-400" />
                <span>مراقبة أداء المضيفين وتحقيق الأهداف</span>
              </h2>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                عدّل نسبة عمولة أي مضيف أو اصرف مستحقاته فوراً مع تتبع ساعات البث والهدايا والتنبيه الذهبي عند 80%
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddHost}
              className="h-10 px-4 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-[0_0_16px_rgba(99,102,241,0.45)] whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة مضيف جديد</span>
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-indigo-300 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={hostSearch}
                onChange={(e) => setHostSearch(e.target.value)}
                placeholder="ابحث باسم المضيف، رقم ID، أو الغرفة..."
                className="w-full h-11 pr-10 pl-3 rounded-xl bg-[#09051D] border border-violet-500/40 text-xs sm:text-sm text-white placeholder:text-indigo-300/50 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  {
                    id: 'golden-80',
                    label: `تنبيه ذهبي +80% (${dailyTargetSummary.reached80OrMoreCount})`,
                  },
                  { id: 'on-mic', label: 'على المايك' },
                  { id: 'online', label: 'متصل' },
                  { id: 'offline', label: 'غير متصل' },
                ] as Array<{ id: HostStatusFilter; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === f.id
                      ? f.id === 'golden-80'
                        ? 'bg-amber-400 text-amber-950 shadow-[0_0_14px_rgba(251,191,36,0.5)]'
                        : 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                      : f.id === 'golden-80' && dailyTargetSummary.reached80OrMoreCount > 0
                      ? 'bg-amber-400/15 text-amber-200 border border-amber-400/55 hover:bg-amber-400/25'
                      : 'bg-[#09051D] text-indigo-200 border border-violet-500/30 hover:border-blue-400/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Host Cards Grid */}
          <div className="space-y-3">
            {filteredHosts.length === 0 ? (
              <div className="rounded-2xl bg-[#09051D] border border-violet-500/30 p-8 text-center text-xs text-indigo-300">
                لا يوجد مضيفون مطابقون لمعايير البحث الحالية.
              </div>
            ) : (
              filteredHosts.map((host) => {
                const rawTargetPercent = Math.round(
                  (host.giftsReceivedGold / Math.max(1, host.targetGold)) * 100
                );
                const targetPercent = Math.min(100, rawTargetPercent);
                const hasReachedDailyTarget = host.giftsReceivedGold >= host.targetGold;
                const isGoldenAlertZone =
                  targetPercent >= GOLDEN_ALERT_THRESHOLD && !hasReachedDailyTarget;
                const remainingGold = Math.max(0, host.targetGold - host.giftsReceivedGold);
                const remainingToGolden80 = Math.max(
                  0,
                  Math.ceil(host.targetGold * 0.8) - host.giftsReceivedGold
                );

                return (
                  <div
                    key={host.id}
                    className={`rounded-2xl p-4 transition-all space-y-3.5 ${
                      hasReachedDailyTarget
                        ? 'bg-gradient-to-l from-[#1E1438] via-[#120B33] to-[#0D1640] border border-amber-300/75 shadow-[0_0_26px_rgba(251,191,36,0.22),0_0_22px_rgba(99,102,241,0.22)]'
                        : isGoldenAlertZone
                        ? 'bg-gradient-to-l from-[#24190A] via-[#130C33] to-[#0D0726] border border-amber-400/75 shadow-[0_0_24px_rgba(251,191,36,0.2)]'
                        : 'bg-[#0D0726] border border-violet-500/35 hover:border-blue-400/60 shadow-[0_4px_20px_rgba(9,5,29,0.5)]'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                      {/* Identity & Room */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {host.isSpeakingNow && (
                            <span
                              aria-hidden="true"
                              className="absolute -inset-1 rounded-full bg-gradient-to-tr from-violet-500 to-blue-400 opacity-75 blur-[3px] animate-pulse"
                            />
                          )}
                          {isGoldenAlertZone && !host.isSpeakingNow && (
                            <span
                              aria-hidden="true"
                              className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 opacity-65 blur-[3px]"
                            />
                          )}
                          <img
                            src={host.avatar}
                            alt={host.name}
                            referrerPolicy="no-referrer"
                            className={`relative w-12 h-12 rounded-full object-cover border-2 ${
                              hasReachedDailyTarget || isGoldenAlertZone
                                ? 'border-amber-300'
                                : host.effectiveStatus === 'on-mic'
                                ? 'border-sky-400'
                                : 'border-violet-400/60'
                            }`}
                          />
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-extrabold text-sm sm:text-base text-white truncate">
                              {host.name}
                            </span>
                            <span className="text-[11px] font-mono-num tabular-nums text-sky-300">
                              ID:{host.userId}
                            </span>
                            {statusBadge(host.effectiveStatus)}
                            {isGoldenAlertZone && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-300 whitespace-nowrap">
                                <BellRing className="w-3.5 h-3.5 text-amber-300 animate-golden-icon-glow" />
                                <span>تنبيه ذهبي · {targetPercent}%</span>
                              </span>
                            )}
                            {hasReachedDailyTarget && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-300 whitespace-nowrap">
                                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                                <span>الهدف اليومي مكتمل</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-indigo-200/80 flex-wrap">
                            <span className="truncate">الغرفة: {host.liveRoomTitle}</span>
                            <span className="inline-flex items-center gap-1 font-mono-num tabular-nums text-violet-300">
                              <Clock className="w-3.5 h-3.5 text-sky-400" />
                              {host.hoursLive.toFixed(1)} ساعة بث
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Live Revenue, Commission Rate & Actions */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 justify-between lg:justify-end">
                        <div className="rounded-xl bg-[#160F3D] border border-violet-500/30 px-3 py-2 text-center min-w-[92px]">
                          <div className="text-[10px] text-indigo-300">الماس المكتسب</div>
                          <div className="font-mono-num tabular-nums font-extrabold text-xs sm:text-sm text-sky-300 flex items-center justify-center gap-1">
                            <Diamond className="w-3.5 h-3.5 text-sky-400" />
                            <span>{host.diamondsEarned.toLocaleString('en-US')}</span>
                          </div>
                        </div>

                        <div className="rounded-xl bg-[#160F3D] border border-blue-400/35 px-3 py-2 text-center min-w-[110px]">
                          <div className="text-[10px] text-sky-200">العمولة المعلقة</div>
                          <div className="font-mono-num tabular-nums font-extrabold text-xs sm:text-sm text-white">
                            {formatCompactNumber(host.pendingCommissionGold)}{' '}
                            <span className="text-sky-300">({host.commissionRate}%)</span>
                          </div>
                        </div>

                        <select
                          aria-label={`نسبة عمولة ${host.name}`}
                          value={host.commissionRate}
                          onChange={(e) =>
                            updateHostCommissionRate(host.id, Number(e.target.value))
                          }
                          className="h-10 px-2.5 rounded-xl bg-[#181042] border border-violet-400/45 text-xs font-mono-num font-bold text-white focus:outline-none focus:border-sky-400 cursor-pointer"
                        >
                          {COMMISSION_RATES.map((rate) => (
                            <option key={rate} value={rate} className="bg-[#120B33] text-white">
                              عمولة {rate}%
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => boostHostDailyProfit(host.id, 5_000_000)}
                          title="تسجيل +5M أرباح هدايا للمضيف"
                          className="h-10 px-3 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 border border-violet-400/50 text-violet-100 text-xs font-mono-num font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-sky-300" />
                          <span>+5M أرباح</span>
                        </button>

                        {hasReachedDailyTarget && (
                          <button
                            type="button"
                            onClick={() =>
                              triggerTargetCelebration({
                                id: host.id,
                                name: host.name,
                                avatar: host.avatar,
                                targetGold: host.targetGold,
                                giftsReceivedGold: host.giftsReceivedGold,
                                roomTitle: host.liveRoomTitle,
                              })
                            }
                            aria-label={`عرض احتفال إنجاز ${host.name}`}
                            title="عرض احتفال تحقيق الهدف"
                            className="h-10 px-3 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/60 text-amber-200 text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Trophy className="w-3.5 h-3.5 text-amber-300" />
                            <span>احتفال</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={host.pendingCommissionGold <= 0}
                          onClick={() => distributeSingleHostCommission(host.id)}
                          className={`h-10 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                            host.pendingCommissionGold > 0
                              ? 'bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white cursor-pointer shadow-[0_0_14px_rgba(99,102,241,0.45)]'
                              : 'bg-[#17103B] text-slate-500 border border-violet-500/20 cursor-not-allowed'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>صرف العمولة</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveRoomId(host.liveRoomId)}
                          className="h-10 px-3 rounded-xl bg-[#191147] hover:bg-[#231863] border border-blue-400/40 text-sky-200 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>دخول الغرفة</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Smart Daily Target Progress Bar with 80% Golden Alert */}
                    <div className="space-y-2 pt-1 border-t border-white/5">
                      {isGoldenAlertZone && (
                        <div className="flex items-center justify-between gap-2 text-xs text-amber-200 bg-amber-400/12 border border-amber-400/40 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <BellRing className="w-4 h-4 text-amber-300 shrink-0 animate-golden-icon-glow" />
                            <span className="truncate font-bold">
                              تنبيه ذهبي · وصل المضيف إلى{' '}
                              <span className="font-mono-num tabular-nums text-amber-300">
                                {targetPercent}%
                              </span>{' '}
                              من هدفه اليومي — متبقي{' '}
                              <span className="font-mono-num tabular-nums text-amber-300">
                                {formatCompactNumber(remainingGold)}
                              </span>{' '}
                              ذهب فقط لإتمام 100%
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              triggerGoldenAlert({
                                id: host.id,
                                name: host.name,
                                avatar: host.avatar,
                                targetGold: host.targetGold,
                                giftsReceivedGold: host.giftsReceivedGold,
                                roomId: host.liveRoomId,
                                roomTitle: host.liveRoomTitle,
                              })
                            }
                            className="text-[11px] font-extrabold text-amber-300 hover:text-amber-100 underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            إبراز التنبيه
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] font-mono-num tabular-nums">
                        <span className="text-indigo-200">
                          الهدف اليومي:{' '}
                          <span className="text-white font-bold">
                            {formatCompactNumber(host.giftsReceivedGold)}
                          </span>{' '}
                          / {formatCompactNumber(host.targetGold)} ذهب
                        </span>
                        <span
                          className={`font-extrabold ${
                            hasReachedDailyTarget || isGoldenAlertZone
                              ? 'text-amber-300'
                              : 'text-sky-300'
                          }`}
                        >
                          {targetPercent}%{' '}
                          {hasReachedDailyTarget
                            ? '· مكتمل'
                            : isGoldenAlertZone
                            ? '· تنبيه ذهبي'
                            : ''}
                        </span>
                      </div>

                      <div
                        className={`relative h-3 w-full rounded-full bg-[#07041A] border p-0.5 overflow-hidden ${
                          hasReachedDailyTarget || isGoldenAlertZone
                            ? 'border-amber-400/75 shadow-[0_0_12px_rgba(251,191,36,0.28)]'
                            : 'border-violet-500/35'
                        }`}
                        role="progressbar"
                        aria-label={`نسبة إنجاز الهدف اليومي للمضيف ${host.name}`}
                        aria-valuenow={targetPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`relative h-full rounded-full overflow-hidden transition-all duration-500 ${
                            hasReachedDailyTarget
                              ? 'bg-gradient-to-l from-amber-400 via-yellow-300 to-amber-500 shadow-[0_0_16px_rgba(251,191,36,0.85)]'
                              : isGoldenAlertZone
                              ? 'bg-gradient-to-l from-amber-500 via-yellow-300 to-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.75)]'
                              : 'bg-gradient-to-l from-violet-500 via-indigo-400 to-blue-400 shadow-[0_0_12px_rgba(56,189,248,0.6)]'
                          }`}
                          style={{
                            width: `${targetPercent > 0 ? Math.max(3, targetPercent) : 0}%`,
                          }}
                        >
                          {(hasReachedDailyTarget || isGoldenAlertZone) && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-milestone-shine"
                            />
                          )}
                        </div>

                        {/* 80% Golden Threshold Marker */}
                        <div
                          aria-hidden="true"
                          style={{ right: `${GOLDEN_ALERT_THRESHOLD}%` }}
                          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-amber-300/85"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-indigo-300/80 font-mono-num tabular-nums flex-wrap">
                        {hasReachedDailyTarget ? (
                          <span className="text-amber-300 font-bold">
                            تم إنجاز الهدف اليومي بالكامل ({rawTargetPercent}%)
                          </span>
                        ) : isGoldenAlertZone ? (
                          <span className="text-amber-300 font-bold">
                            تجاوز عتبة 80% الذهبية · المتبقي لإتمام الهدف:{' '}
                            {formatCompactNumber(remainingGold)} ذهب
                          </span>
                        ) : (
                          <span>
                            المتبقي لعتبة التنبيه الذهبي (80%):{' '}
                            {formatCompactNumber(remainingToGolden80)} ذهب
                          </span>
                        )}
                        <span className="text-amber-300/85">عتبة التنبيه 80%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* SECTION 2: Live Rooms Telemetry */}
      {(section === 'all' || section === 'rooms') && (
        <section className="rounded-3xl bg-[#120B33] border border-blue-400/45 p-4 sm:p-6 shadow-[0_0_28px_rgba(59,130,246,0.2)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-display font-extrabold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" />
                <span>إحصائيات الغرف المباشرة ومراقبة الإشغال</span>
              </h2>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                رصد مباشر لعدد المستمعين، نسبة إشغال المايكات، ومؤشر حرارة التفاعل لكل غرفة
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/20 border border-sky-400/45 text-sky-200 text-xs font-bold self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>بث إحصائي مباشر</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {state.rooms.map((room) => {
              const occupiedSeats = room.seats.filter((s) => Boolean(s.userId));
              const micRatio = Math.round(
                (occupiedSeats.length / Math.max(1, room.totalMics)) * 100
              );
              const heatRatio = Math.max(
                8,
                Math.round((room.heat / roomTelemetry.maxHeat) * 100)
              );

              return (
                <div
                  key={room.id}
                  className="rounded-2xl bg-[#0D0726] border border-violet-500/35 hover:border-sky-400/55 p-4 space-y-3.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={room.ownerAvatar}
                        alt={room.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-2xl object-cover border border-blue-400/50 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-display font-extrabold text-sm sm:text-base text-white truncate">
                            {room.title}
                          </h3>
                          {room.isLocked && (
                            <Lock className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-indigo-200/80 flex items-center gap-2 mt-0.5">
                          <span>
                            {room.flag} {room.ownerName}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-200 font-bold">
                            {room.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left font-mono-num shrink-0">
                      <div className="text-sm font-black text-sky-300">
                        {room.listeners.toLocaleString('en-US')}
                      </div>
                      <div className="text-[10px] text-indigo-300">مستمع</div>
                    </div>
                  </div>

                  {/* Comparative Heat & Mic Occupancy Bars */}
                  <div className="grid grid-cols-2 gap-3 text-[11px] font-mono-num">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-violet-200">
                        <span>إشغال المايكات</span>
                        <span className="font-bold text-white">
                          {occupiedSeats.length}/{room.totalMics}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#07041A] border border-violet-500/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-violet-500 to-indigo-400"
                          style={{ width: `${Math.max(8, micRatio)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sky-200">
                        <span>مؤشر الحرارة</span>
                        <span className="font-bold text-sky-300">
                          {formatCompactNumber(room.heat)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#07041A] border border-blue-400/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-blue-500 to-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                          style={{ width: `${heatRatio}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Speakers Avatars & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-violet-500/20">
                    <div className="flex items-center -space-x-2 space-x-reverse">
                      {occupiedSeats.slice(0, 5).map((seat) => (
                        <img
                          key={seat.seatNumber}
                          src={seat.avatar || room.ownerAvatar}
                          alt={seat.userName || 'متحدث'}
                          referrerPolicy="no-referrer"
                          className={`w-7 h-7 rounded-full object-cover border-2 ${
                            seat.isSpeaking ? 'border-sky-400' : 'border-[#0D0726]'
                          }`}
                        />
                      ))}
                      {occupiedSeats.length === 0 && (
                        <span className="text-[11px] text-indigo-300/70">لا يوجد متحدثون حالياً</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => boostRoomHeat(room.id, 1_000_000)}
                        className="h-9 px-3 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 border border-violet-400/45 text-violet-100 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Flame className="w-3.5 h-3.5 text-sky-300" />
                        <span>+1M حرارة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveRoomId(room.id)}
                        className="h-9 px-3.5 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>مراقبة الغرفة</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 3: Automated Profit & Commission Distribution Engine */}
      {(section === 'all' || section === 'payouts') && (
        <section className="rounded-3xl bg-[#120B33] border border-violet-400/45 p-4 sm:p-6 shadow-[0_0_32px_rgba(124,58,237,0.24)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-display font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-400" />
                <span>محرك التوزيع الآلي للأرباح والعمولات</span>
              </h2>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                اضبط نسبة اقتطاع الوكالة وعاين الحصص الدقيقة لكل مضيف قبل تنفيذ التسوية الفورية
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-indigo-200 font-bold">نسبة الوكالة من المجمع:</span>
              {AGENCY_SPLITS.map((pct) => {
                const active = state.agencyCommissionSplit === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAgencyCommissionSplit(pct)}
                    className={`h-9 px-3 rounded-xl font-mono-num text-xs font-extrabold cursor-pointer transition-all ${
                      active
                        ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-[0_0_14px_rgba(99,102,241,0.55)]'
                        : 'bg-[#09051D] text-indigo-200 border border-violet-500/30 hover:border-blue-400/50'
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distribution Preview Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-[#0D0726] border border-violet-500/35 p-4 space-y-1">
              <div className="text-xs text-violet-200">حصة الوكالة الصافية ({state.agencyCommissionSplit}%)</div>
              <div className="text-lg sm:text-xl font-mono-num font-black text-violet-300">
                +{formatCompactNumber(splitPreview.agencyShare)}
              </div>
              <div className="text-[11px] text-indigo-300/80 font-mono-num">
                {formatFullGold(splitPreview.agencyShare)} ذهبية
              </div>
            </div>

            <div className="rounded-2xl bg-[#0D0726] border border-blue-400/45 p-4 space-y-1">
              <div className="text-xs text-sky-200">إجمالي تحويلات المضيفين</div>
              <div className="text-lg sm:text-xl font-mono-num font-black text-sky-300">
                +{formatCompactNumber(splitPreview.hostsTotalPayout)}
              </div>
              <div className="text-[11px] text-indigo-300/80 font-mono-num">
                يشمل العمولات المعلقة + {100 - state.agencyCommissionSplit}% من البونص
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-[#1C114A] to-[#111D4D] border border-sky-400/50 p-4 flex flex-col justify-between gap-2.5">
              <div className="text-xs text-white font-bold flex items-center justify-between">
                <span>تنفيذ التسوية لجميع الحسابات</span>
                <span className="font-mono-num text-sky-300">{state.hosts.length} مضيفين</span>
              </div>
              <button
                type="button"
                disabled={totalDistributableGold <= 0}
                onClick={() => distributeProfitsAutomatically('manual')}
                className={`w-full h-11 rounded-xl font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  totalDistributableGold > 0
                    ? 'bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.45)]'
                    : 'bg-[#09051D] text-slate-500 border border-violet-500/20 cursor-not-allowed'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>
                  {totalDistributableGold > 0
                    ? `توزيع ${formatCompactNumber(totalDistributableGold)} ذهب الآن`
                    : 'تمت تسوية جميع الأرباح ✓'}
                </span>
              </button>
            </div>
          </div>

          {/* Per-Host Breakdown Preview */}
          <div className="rounded-2xl bg-[#0D0726] border border-violet-500/30 p-4 space-y-3">
            <div className="text-xs font-display font-bold text-indigo-100">
              معاينة حصص المضيفين في الدورة الحالية:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {splitPreview.perHost.map((item) => (
                <div
                  key={item.hostId}
                  className="rounded-xl bg-[#150E3B] border border-violet-500/25 p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={item.avatar}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-blue-400/50 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{item.name}</div>
                      <div className="text-[10px] text-indigo-300 font-mono-num">
                        عمولة {formatCompactNumber(item.pending)} + حافز {formatCompactNumber(item.bonusShare)}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-num font-extrabold text-xs text-sky-300 shrink-0">
                    +{formatCompactNumber(item.totalPayout)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution Ledger */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-display font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              <span>سجل التوزيعات والعمولات المنفذة ({state.distributions.length})</span>
            </h3>
            <div className="divide-y divide-violet-500/20 rounded-2xl bg-[#0D0726] border border-violet-500/30 px-4">
              {state.distributions.map((dist) => (
                <div
                  key={dist.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          dist.mode === 'auto'
                            ? 'bg-blue-500/25 text-sky-300 border border-sky-400/40'
                            : 'bg-violet-500/25 text-violet-200 border border-violet-400/40'
                        }`}
                      >
                        {dist.mode === 'auto' ? 'توزيع آلي' : 'صرف يدوي'}
                      </span>
                      <span className="font-bold text-white">{dist.note}</span>
                    </div>
                    <div className="text-[11px] text-indigo-300 font-mono-num">
                      {dist.timestamp} · شمل {dist.hostsCount} مضيفين
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono-num shrink-0">
                    <span className="text-sky-300 font-extrabold">
                      للمضيفين: +{formatCompactNumber(dist.hostsShareGold)} 🪙
                    </span>
                    {dist.agencyShareGold > 0 && (
                      <span className="text-violet-300 font-bold">
                        للوكالة: +{formatCompactNumber(dist.agencyShareGold)} 🪙
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Add Host Modal */}
      {addHostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040212]/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitAddHost}
            className="w-full max-w-md rounded-3xl bg-[#120B33] border border-violet-400/50 p-5 sm:p-6 space-y-4 shadow-[0_0_40px_rgba(124,58,237,0.45)] text-white"
          >
            <div className="flex items-center justify-between border-b border-violet-500/30 pb-3">
              <h3 className="text-base font-display font-extrabold flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" />
                <span>تعيين مضيف جديد في الوكالة</span>
              </h3>
              <button
                type="button"
                onClick={() => setAddHostOpen(false)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-full bg-[#1C124D] hover:bg-[#271A69] flex items-center justify-center text-indigo-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {nonHostUsers.length === 0 ? (
              <div className="rounded-2xl bg-[#09051D] border border-violet-500/30 p-4 text-xs text-indigo-200 leading-relaxed">
                جميع الأعضاء المسجلين حالياً منضمون بالفعل إلى قائمة مضيفي الوكالة.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-indigo-200">
                    اختر العضو المراد ترقيته لمضيف:
                  </label>
                  <select
                    value={newHostUserId}
                    onChange={(e) => setNewHostUserId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#09051D] border border-violet-500/40 text-sm text-white focus:outline-none focus:border-sky-400"
                  >
                    {nonHostUsers.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#09051D] text-white">
                        {u.name} (ID: {u.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-indigo-200">
                    الغرفة الصوتية المخصصة:
                  </label>
                  <select
                    value={newHostRoomId}
                    onChange={(e) => setNewHostRoomId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#09051D] border border-violet-500/40 text-sm text-white focus:outline-none focus:border-sky-400"
                  >
                    {state.rooms.map((r) => (
                      <option key={r.id} value={r.id} className="bg-[#09051D] text-white">
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-indigo-200">
                      التارجت المستهدف (ذهب):
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newHostTarget}
                      onChange={(e) => setNewHostTarget(e.target.value.replace(/[^\d]/g, ''))}
                      className="w-full h-11 px-3 rounded-xl bg-[#09051D] border border-violet-500/40 text-sm font-mono-num text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-indigo-200">
                      نسبة العمولة:
                    </label>
                    <select
                      value={newHostRate}
                      onChange={(e) => setNewHostRate(Number(e.target.value))}
                      className="w-full h-11 px-3 rounded-xl bg-[#09051D] border border-violet-500/40 text-sm font-mono-num text-white focus:outline-none focus:border-sky-400"
                    >
                      {COMMISSION_RATES.map((rate) => (
                        <option key={rate} value={rate} className="bg-[#09051D] text-white">
                          {rate}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-display font-extrabold text-sm cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                >
                  اعتماد المضيف في الوكالة
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
