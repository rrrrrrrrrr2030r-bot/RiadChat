import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Sparkles, X } from 'lucide-react';
import { VoiceRoom } from '../types';
import { formatCompactNumber } from '../utils/format';

interface RoomEngagementCardProps {
  room: VoiceRoom;
  onClose?: () => void;
}

type EngagementSeriesMode = 'all' | 'interaction' | 'voiceGifts';

interface EngagementPoint {
  id: number;
  label: string;
  interaction: number;
  voiceGifts: number;
  listeners: number;
}

function formatTimeLabel(date: Date): string {
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${mins}:${secs}`;
}

export const RoomEngagementCard: React.FC<RoomEngagementCardProps> = ({ room, onClose }) => {
  const [seriesMode, setSeriesMode] = useState<EngagementSeriesMode>('all');
  const [isExpandedHeight, setIsExpandedHeight] = useState(false);

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

  const computeSnapshot = () => {
    const msgBoost = Math.min(48, room.messages.length * 3);
    const seatBoost = occupiedSeatsCount * 6 + speakingSeatsCount * 9;
    const listenerBoost = Math.min(35, Math.round(room.listeners * 0.45));
    const interactionBase = Math.max(18, 22 + msgBoost + listenerBoost + Math.round(seatBoost * 0.6));
    const heatScore = room.heat > 0 ? Math.min(45, Math.round(Math.log10(room.heat + 10) * 6)) : 0;
    const voiceGiftsBase = Math.max(12, 14 + seatBoost + giftMessagesCount * 7 + heatScore);
    return { interactionBase, voiceGiftsBase };
  };

  const prevCountsRef = useRef({
    roomId: room.id,
    messages: room.messages.length,
    heat: room.heat,
    occupied: occupiedSeatsCount,
    speaking: speakingSeatsCount,
  });

  const buildSeedHistory = (): EngagementPoint[] => {
    const now = Date.now();
    const { interactionBase, voiceGiftsBase } = computeSnapshot();
    return Array.from({ length: 12 }, (_, idx) => {
      const pointTime = new Date(now - (11 - idx) * 2500);
      const waveA = Math.round(Math.sin(idx * 0.75) * 7 + Math.cos(idx * 0.45) * 4);
      const waveB = Math.round(Math.cos(idx * 0.65) * 6 + Math.sin(idx * 0.9) * 3);
      return {
        id: idx,
        label: formatTimeLabel(pointTime),
        interaction: Math.max(8, interactionBase + waveA),
        voiceGifts: Math.max(6, voiceGiftsBase + waveB),
        listeners: room.listeners,
      };
    });
  };

  const [points, setPoints] = useState<EngagementPoint[]>(buildSeedHistory);
  const nextIdRef = useRef(12);

  useEffect(() => {
    if (prevCountsRef.current.roomId !== room.id) {
      prevCountsRef.current = {
        roomId: room.id,
        messages: room.messages.length,
        heat: room.heat,
        occupied: occupiedSeatsCount,
        speaking: speakingSeatsCount,
      };
      nextIdRef.current = 12;
      setPoints(buildSeedHistory());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  useEffect(() => {
    const prev = prevCountsRef.current;
    if (prev.roomId !== room.id) return;

    const msgDelta = Math.max(0, room.messages.length - prev.messages);
    const heatDelta = Math.max(0, room.heat - prev.heat);
    const seatDelta =
      Math.abs(occupiedSeatsCount - prev.occupied) + Math.max(0, speakingSeatsCount - prev.speaking);

    if (msgDelta === 0 && heatDelta === 0 && seatDelta === 0) return;

    prevCountsRef.current = {
      roomId: room.id,
      messages: room.messages.length,
      heat: room.heat,
      occupied: occupiedSeatsCount,
      speaking: speakingSeatsCount,
    };

    const { interactionBase, voiceGiftsBase } = computeSnapshot();
    const interactionSpike = msgDelta * 14 + seatDelta * 8 + (heatDelta > 0 ? 10 : 0);
    const voiceGiftSpike = (heatDelta > 0 ? 18 : 0) + seatDelta * 12 + msgDelta * 4;

    setPoints((current) => [
      ...current.slice(-11),
      {
        id: nextIdRef.current++,
        label: formatTimeLabel(new Date()),
        interaction: Math.min(180, interactionBase + interactionSpike),
        voiceGifts: Math.min(180, voiceGiftsBase + voiceGiftSpike),
        listeners: room.listeners,
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, room.messages.length, room.heat, occupiedSeatsCount, speakingSeatsCount, room.listeners]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const { interactionBase, voiceGiftsBase } = computeSnapshot();
      const tick = nextIdRef.current;
      const jitterA = Math.round(Math.sin(tick * 0.85) * 6 + (Math.random() - 0.45) * 8);
      const jitterB = Math.round(Math.cos(tick * 0.7) * 5 + (Math.random() - 0.45) * 7);

      setPoints((current) => [
        ...current.slice(-11),
        {
          id: nextIdRef.current++,
          label: formatTimeLabel(new Date()),
          interaction: Math.max(8, interactionBase + jitterA),
          voiceGifts: Math.max(6, voiceGiftsBase + jitterB),
          listeners: room.listeners,
        },
      ]);
    }, 2500);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, room.listeners, room.messages.length, room.heat, occupiedSeatsCount, speakingSeatsCount]);

  const latestPoint = points[points.length - 1];
  const peakInteraction = useMemo(
    () => Math.max(...points.map((p) => Math.max(p.interaction, p.voiceGifts))),
    [points]
  );

  return (
    <section
      aria-label="تحليل تفاعل الغرفة اللحظي"
      className="w-full text-white"
    >
      {/* Clean Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500/35 to-blue-500/35 border border-sky-400/45 flex items-center justify-center shadow-[0_0_14px_rgba(96,165,250,0.45)] shrink-0">
            <Activity className="w-4.5 h-4.5 text-sky-300" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-display font-extrabold text-white truncate">
                نبض التفاعل اللحظي
              </h3>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-sky-300 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span>مباشر</span>
              </span>
            </div>
            <div className="text-[11px] text-indigo-200/85 font-mono-num tabular-nums truncate">
              {latestPoint?.interaction ?? 0} تفاعل · {occupiedSeatsCount} على المايك · {formatCompactNumber(room.heat)} كأس
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpandedHeight((v) => !v)}
            aria-label={isExpandedHeight ? 'تصغير حجم الرسم البياني' : 'توسيع حجم الرسم البياني'}
            title={isExpandedHeight ? 'تصغير الرسم' : 'توسيع الرسم'}
            className="w-9 h-9 rounded-full bg-white/[0.07] hover:bg-white/15 border border-white/10 text-sky-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة التفاعل"
              className="w-9 h-9 rounded-full bg-white/[0.07] hover:bg-rose-600/80 border border-white/10 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="تصفية مؤشرات التفاعل"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.06] border border-white/10"
        >
          {[
            { id: 'all' as const, label: 'الكل' },
            { id: 'interaction' as const, label: 'التفاعل' },
            { id: 'voiceGifts' as const, label: 'الصوت والهدايا' },
          ].map((tab) => {
            const active = seriesMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSeriesMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.55)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-mono-num font-bold text-indigo-200 tabular-nums shrink-0">
          الذروة: {peakInteraction}
        </span>
      </div>

      {/* Real-Time Recharts AreaChart */}
      <div
        dir="ltr"
        className={`mt-3 w-full transition-all duration-200 ${
          isExpandedHeight ? 'h-[220px]' : 'h-[168px]'
        }`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="riadPurpleAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A855F7" stopOpacity={0.55} />
                <stop offset="65%" stopColor="#7C3AED" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>

              <linearGradient id="riadBlueAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.5} />
                <stop offset="65%" stopColor="#2563EB" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>

              <filter id="glowPurpleLine" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.8" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="glowBlueLine" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid
              stroke="rgba(167, 139, 250, 0.14)"
              strokeDasharray="3 4"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: '#A5B4FC', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={26}
            />
            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(147, 197, 253, 0.35)', strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                return (
                  <div
                    dir="rtl"
                    className="rounded-xl bg-[#0D0829]/95 border border-indigo-400/50 px-3 py-2 text-[11px] text-white shadow-[0_6px_20px_rgba(99,102,241,0.45)] backdrop-blur-md space-y-1"
                  >
                    <div className="font-mono-num font-bold text-sky-300 border-b border-white/10 pb-0.5">
                      الوقت: {label}
                    </div>
                    {payload.map((entry) => {
                      const isInteraction = entry.dataKey === 'interaction';
                      return (
                        <div
                          key={String(entry.dataKey)}
                          className="flex items-center justify-between gap-3 tabular-nums"
                        >
                          <span
                            className={
                              isInteraction ? 'text-violet-300 font-bold' : 'text-sky-300 font-bold'
                            }
                          >
                            {isInteraction ? 'التفاعل اللحظي' : 'الصوت والهدايا'}
                          </span>
                          <span className="font-mono-num font-extrabold text-white">
                            {entry.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />

            {(seriesMode === 'all' || seriesMode === 'interaction') && (
              <Area
                type="monotone"
                dataKey="interaction"
                name="التفاعل اللحظي"
                stroke="#C084FC"
                strokeWidth={2.75}
                fill="url(#riadPurpleAreaFill)"
                filter="url(#glowPurpleLine)"
                isAnimationActive={false}
                activeDot={{
                  r: 4.5,
                  fill: '#E9D5FF',
                  stroke: '#9333EA',
                  strokeWidth: 2,
                }}
              />
            )}

            {(seriesMode === 'all' || seriesMode === 'voiceGifts') && (
              <Area
                type="monotone"
                dataKey="voiceGifts"
                name="الصوت والهدايا"
                stroke="#38BDF8"
                strokeWidth={2.75}
                fill="url(#riadBlueAreaFill)"
                filter="url(#glowBlueLine)"
                isAnimationActive={false}
                activeDot={{
                  r: 4.5,
                  fill: '#E0F2FE',
                  stroke: '#2563EB',
                  strokeWidth: 2,
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Clean Legend Footer */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-3 text-[11px] text-slate-300">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.95)]" />
            <span className="text-purple-200 font-bold">تفاعل المستخدمين</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.95)]" />
            <span className="text-sky-200 font-bold">الصوت والهدايا</span>
          </span>
        </div>
        <span className="text-[10.5px] text-slate-300/80">تحديث كل 2.5 ثانية</span>
      </div>
    </section>
  );
};
