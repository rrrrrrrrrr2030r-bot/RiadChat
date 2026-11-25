import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ChevronDown, ChevronUp, Maximize2, Minimize2, WifiOff, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RoomTelemetryPoint, VoiceRoom } from '../types';
import { formatCompactNumber } from '../utils/format';

interface RoomEngagementCardProps {
  room: VoiceRoom;
  variant?: 'inline' | 'modal';
  onClose?: () => void;
}

type EngagementSeriesMode = 'all' | 'interaction' | 'voiceOnline' | 'heatGames';
type InlineCardSize = 'collapsed' | 'compact' | 'expanded';

const SERIES_META: Record<
  Exclude<EngagementSeriesMode, 'all'>,
  { label: string; shortLabel: string; colorClass: string; barClass: string }
> = {
  interaction: {
    label: 'التفاعل والهدايا',
    shortLabel: 'التفاعل',
    colorClass: 'text-purple-200',
    barClass: 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.95)]',
  },
  voiceOnline: {
    label: 'المتصلون والمايكات',
    shortLabel: 'المايكات',
    colorClass: 'text-sky-200',
    barClass: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.95)]',
  },
  heatGames: {
    label: 'الحرارة والألعاب',
    shortLabel: 'الحرارة والألعاب',
    colorClass: 'text-amber-200',
    barClass: 'bg-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.95)]',
  },
};

function formatTimeLabel(date: Date): string {
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${mins}:${secs}`;
}

export const RoomEngagementCard: React.FC<RoomEngagementCardProps> = ({
  room,
  variant = 'modal',
  onClose,
}) => {
  const { roomTelemetry, subscribeRoomTelemetry, isRealtimeConnected } = useApp();
  const [seriesMode, setSeriesMode] = useState<EngagementSeriesMode>('all');
  const [inlineSize, setInlineSize] = useState<InlineCardSize>('compact');
  const [modalExpanded, setModalExpanded] = useState(false);

  // Unique SVG gradient/filter IDs so inline + modal instances never collide
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    subscribeRoomTelemetry(room.id);
  }, [room.id, subscribeRoomTelemetry]);

  const occupiedSeatsCount = useMemo(
    () => room.seats.filter((s) => Boolean(s.userId)).length,
    [room.seats]
  );
  const speakingSeatsCount = useMemo(
    () => room.seats.filter((s) => Boolean(s.userId) && !s.isMuted && s.isSpeaking).length,
    [room.seats]
  );
  const giftMessagesCount = useMemo(
    () => room.messages.filter((m) => m.type === 'gift' || m.type === 'achievement').length,
    [room.messages]
  );

  // Authoritative WebSocket telemetry stream (with a single live baseline point only before init packet arrives)
  const points = useMemo<RoomTelemetryPoint[]>(() => {
    const wsPoints = roomTelemetry[room.id];
    if (wsPoints && wsPoints.length > 0) {
      return wsPoints;
    }
    const heatLog = room.heat > 0 ? Math.min(85, Math.round(Math.log10(room.heat + 10) * 9.5)) : 12;
    const baseInteraction = Math.max(
      14,
      18 + Math.min(55, room.messages.length * 3) + giftMessagesCount * 6 + speakingSeatsCount * 7
    );
    const baseVoice = Math.max(
      12,
      14 + occupiedSeatsCount * 7 + speakingSeatsCount * 10 + Math.min(40, Math.round(room.listeners * 0.45))
    );
    return [
      {
        seq: 0,
        timestamp: Date.now(),
        label: formatTimeLabel(new Date()),
        interaction: baseInteraction,
        voiceOnline: baseVoice,
        heatGames: Math.max(12, heatLog),
        activeMics: occupiedSeatsCount,
        speakingMics: speakingSeatsCount,
        listeners: room.listeners,
        messagesCount: room.messages.length,
        giftsCount: giftMessagesCount,
        roomHeat: room.heat,
      },
    ];
  }, [
    roomTelemetry,
    room.id,
    room.heat,
    room.listeners,
    room.messages.length,
    occupiedSeatsCount,
    speakingSeatsCount,
    giftMessagesCount,
  ]);

  const latestPoint = points[points.length - 1];

  const peakValue = useMemo(
    () =>
      Math.max(
        1,
        ...points.map((p) => {
          if (seriesMode === 'interaction') return p.interaction;
          if (seriesMode === 'voiceOnline') return p.voiceOnline;
          if (seriesMode === 'heatGames') return p.heatGames;
          return Math.max(p.interaction, p.voiceOnline, p.heatGames);
        })
      ),
    [points, seriesMode]
  );

  const isInline = variant === 'inline';
  const isCollapsed = isInline && inlineSize === 'collapsed';
  const chartHeightClass = isInline
    ? inlineSize === 'expanded'
      ? 'h-[168px]'
      : 'h-[104px]'
    : modalExpanded
    ? 'h-[228px]'
    : 'h-[176px]';

  const gradPurpleId = `riadPurple-${uid}`;
  const gradBlueId = `riadBlue-${uid}`;
  const gradGoldId = `riadGold-${uid}`;
  const glowPurpleId = `glowPurple-${uid}`;
  const glowBlueId = `glowBlue-${uid}`;
  const glowGoldId = `glowGold-${uid}`;

  return (
    <section
      aria-label="مؤشر تفاعل الغرفة اللحظي"
      className={
        isInline
          ? 'w-full rounded-2xl bg-[#110B30]/82 backdrop-blur-md border border-violet-400/25 shadow-[0_8px_28px_rgba(15,10,48,0.55)] px-3 py-2 text-white transition-all duration-200'
          : 'w-full text-white'
      }
    >
      {/* Header Row */}
      <div
        className={`flex items-center justify-between gap-2 ${
          isCollapsed ? '' : isInline ? 'pb-1.5 border-b border-white/10' : 'pb-3 border-b border-white/10'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`${
              isInline ? 'w-8 h-8 rounded-xl' : 'w-9 h-9 rounded-2xl'
            } bg-gradient-to-br from-violet-500/35 via-blue-500/30 to-amber-400/25 border border-sky-400/40 flex items-center justify-center shadow-[0_0_12px_rgba(96,165,250,0.4)] shrink-0`}
          >
            <Activity className={`${isInline ? 'w-4 h-4' : 'w-4.5 h-4.5'} text-sky-300`} />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`${
                  isInline ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                } font-display font-extrabold text-white truncate`}
              >
                نبض التفاعل اللحظي
              </h3>

              {/* Real WebSocket connection indicator */}
              {isRealtimeConnected ? (
                <span
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300 shrink-0"
                  title="متصل بالبث اللحظي عبر WebSocket"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>مباشر</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-300 shrink-0"
                  title="جارٍ إعادة الاتصال بالبث اللحظي"
                >
                  <WifiOff className="w-3 h-3" />
                  <span>إعادة اتصال</span>
                </span>
              )}
            </div>

            {/* Clean unboxed single-line metrics separated by middots */}
            <div className="text-[10.5px] sm:text-[11px] text-indigo-200/85 font-mono-num tabular-nums truncate">
              <span className="text-purple-200 font-bold">{latestPoint?.interaction ?? 0}</span> تفاعل
              {' · '}
              <span className="text-sky-200 font-bold">
                {latestPoint?.activeMics ?? occupiedSeatsCount}
              </span>{' '}
              مايك
              {' · '}
              <span className="text-amber-300 font-bold">
                {formatCompactNumber(latestPoint?.roomHeat ?? room.heat)}
              </span>{' '}
              حرارة
            </div>
          </div>
        </div>

        {/* Controls (>= 44px touch target on mobile) */}
        <div className="flex items-center gap-1 shrink-0">
          {isInline ? (
            <>
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={() =>
                    setInlineSize((prev) => (prev === 'expanded' ? 'compact' : 'expanded'))
                  }
                  aria-label={inlineSize === 'expanded' ? 'تصغير الرسم البياني' : 'توسيع الرسم البياني'}
                  title={inlineSize === 'expanded' ? 'تصغير' : 'توسيع'}
                  className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-sky-300 flex items-center justify-center cursor-pointer transition-colors"
                >
                  {inlineSize === 'expanded' ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setInlineSize((prev) => (prev === 'collapsed' ? 'compact' : 'collapsed'))
                }
                aria-label={isCollapsed ? 'إظهار الرسم البياني اللحظي' : 'طي الرسم البياني اللحظي'}
                title={isCollapsed ? 'إظهار الرسم' : 'طي البطاقة'}
                className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-white/90 flex items-center justify-center cursor-pointer transition-colors"
              >
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setModalExpanded((v) => !v)}
                aria-label={modalExpanded ? 'تصغير حجم الرسم البياني' : 'توسيع حجم الرسم البياني'}
                title={modalExpanded ? 'تصغير الرسم' : 'توسيع الرسم'}
                className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-full bg-white/[0.07] hover:bg-white/15 border border-white/10 text-sky-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                {modalExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="إغلاق نافذة التفاعل"
                  className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-full bg-white/[0.07] hover:bg-rose-600/80 border border-white/10 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Collapsible Body */}
      {!isCollapsed && (
        <>
          {/* Series Filter Bar */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="تصفية مؤشرات التفاعل"
              className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5"
            >
              {[
                { id: 'all' as const, label: 'الكل' },
                { id: 'interaction' as const, label: isInline ? 'التفاعل' : 'التفاعل والهدايا' },
                { id: 'voiceOnline' as const, label: 'المايكات' },
                { id: 'heatGames' as const, label: 'الحرارة والألعاب' },
              ].map((tab) => {
                const active = seriesMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSeriesMode(tab.id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? tab.id === 'heatGames'
                          ? 'bg-gradient-to-l from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.45)]'
                          : tab.id === 'voiceOnline'
                          ? 'bg-gradient-to-l from-sky-500 to-blue-600 text-white shadow-[0_0_12px_rgba(56,189,248,0.45)]'
                          : 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]'
                        : 'bg-white/[0.05] text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <span className="text-[10.5px] font-mono-num font-bold text-indigo-200/90 tabular-nums shrink-0">
              الذروة {peakValue}
            </span>
          </div>

          {/* Glowing 3-Series WebSocket Recharts AreaChart */}
          <div dir="ltr" className={`mt-2 w-full transition-all duration-200 ${chartHeightClass}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                <defs>
                  {/* 1. Violet / Purple — Interaction & Gifts */}
                  <linearGradient id={gradPurpleId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={0.55} />
                    <stop offset="65%" stopColor="#7C3AED" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>

                  {/* 2. Sky / Electric Blue — Listeners & Active Mics */}
                  <linearGradient id={gradBlueId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.5} />
                    <stop offset="65%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>

                  {/* 3. Royal Gold — Room Heat & Linked Game Wins */}
                  <linearGradient id={gradGoldId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FACC15" stopOpacity={0.48} />
                    <stop offset="65%" stopColor="#F59E0B" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>

                  <filter id={glowPurpleId} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id={glowBlueId} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id={glowGoldId} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid
                  stroke="rgba(167, 139, 250, 0.13)"
                  strokeDasharray="3 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#A5B4FC', fontSize: 9.5 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 9.5 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(147, 197, 253, 0.35)', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const pointData = payload[0]?.payload as RoomTelemetryPoint | undefined;
                    return (
                      <div
                        dir="rtl"
                        className="rounded-xl bg-[#0D0829]/95 border border-indigo-400/50 px-3 py-2 text-[11px] text-white shadow-[0_6px_20px_rgba(99,102,241,0.45)] backdrop-blur-md space-y-1 min-w-[164px]"
                      >
                        <div className="font-mono-num font-bold text-sky-300 border-b border-white/10 pb-0.5 flex items-center justify-between gap-2">
                          <span>الوقت: {label}</span>
                          {pointData && (
                            <span className="text-[10px] text-indigo-200/80">
                              {pointData.listeners} متصل
                            </span>
                          )}
                        </div>
                        {payload.map((entry) => {
                          const key = String(entry.dataKey) as keyof typeof SERIES_META;
                          const meta = SERIES_META[key];
                          if (!meta) return null;
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 tabular-nums"
                            >
                              <span className={`${meta.colorClass} font-bold`}>{meta.label}</span>
                              <span className="font-mono-num font-extrabold text-white">
                                {entry.value}
                              </span>
                            </div>
                          );
                        })}
                        {pointData && (
                          <div className="pt-1 border-t border-white/10 text-[10px] text-slate-300 font-mono-num tabular-nums">
                            {pointData.activeMics} مايك مفتوح · {pointData.speakingMics} يتحدث
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {(seriesMode === 'all' || seriesMode === 'interaction') && (
                  <Area
                    type="monotone"
                    dataKey="interaction"
                    name="التفاعل والهدايا"
                    stroke="#C084FC"
                    strokeWidth={2.5}
                    fill={`url(#${gradPurpleId})`}
                    filter={`url(#${glowPurpleId})`}
                    isAnimationActive={false}
                    activeDot={{
                      r: 4,
                      fill: '#E9D5FF',
                      stroke: '#9333EA',
                      strokeWidth: 2,
                    }}
                  />
                )}

                {(seriesMode === 'all' || seriesMode === 'voiceOnline') && (
                  <Area
                    type="monotone"
                    dataKey="voiceOnline"
                    name="المتصلون والمايكات"
                    stroke="#38BDF8"
                    strokeWidth={2.5}
                    fill={`url(#${gradBlueId})`}
                    filter={`url(#${glowBlueId})`}
                    isAnimationActive={false}
                    activeDot={{
                      r: 4,
                      fill: '#E0F2FE',
                      stroke: '#2563EB',
                      strokeWidth: 2,
                    }}
                  />
                )}

                {(seriesMode === 'all' || seriesMode === 'heatGames') && (
                  <Area
                    type="monotone"
                    dataKey="heatGames"
                    name="الحرارة والألعاب"
                    stroke="#FACC15"
                    strokeWidth={2.4}
                    fill={`url(#${gradGoldId})`}
                    filter={`url(#${glowGoldId})`}
                    isAnimationActive={false}
                    activeDot={{
                      r: 4,
                      fill: '#FEF9C3',
                      stroke: '#D97706',
                      strokeWidth: 2,
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Compact Legend Footer */}
          <div className="mt-2 pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-300">
            <div className="flex items-center gap-3 flex-wrap">
              {(Object.keys(SERIES_META) as Array<keyof typeof SERIES_META>).map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span className={`w-2.5 h-1 rounded-full ${SERIES_META[key].barClass}`} />
                  <span className={`${SERIES_META[key].colorClass} font-bold`}>
                    {isInline ? SERIES_META[key].shortLabel : SERIES_META[key].label}
                  </span>
                </span>
              ))}
            </div>
            <span className="text-[10px] text-indigo-200/75 font-mono-num tabular-nums">
              WebSocket · {latestPoint?.listeners ?? room.listeners} متصل
            </span>
          </div>
        </>
      )}
    </section>
  );
};
