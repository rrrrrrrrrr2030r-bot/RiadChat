import React, { useEffect, useMemo, useState } from 'react';
import {
  Crown,
  Mic,
  Radio,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserAccount, VoiceRoom } from '../types';
import { formatCompactNumber } from '../utils/format';

interface ActiveHostsPanelProps {
  room: VoiceRoom;
  onInspectHost: (user: UserAccount) => void;
  onClose?: () => void;
}

interface ActiveHostItem {
  userId: string;
  name: string;
  avatar: string;
  flag: string;
  level: number;
  followers: number;
  roomId: string;
  roomTitle: string;
  status: 'on-mic' | 'online';
  isSpeakingNow: boolean;
  isCurrentRoom: boolean;
  userAccount?: UserAccount;
}

export const ActiveHostsPanel: React.FC<ActiveHostsPanelProps> = ({
  room,
  onInspectHost,
  onClose,
}) => {
  const {
    state,
    currentUser,
    isRealtimeConnected,
    followedUserIds,
    toggleFollowUser,
    setActiveRoomId,
  } = useApp();

  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pulseBeat, setPulseBeat] = useState(0);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPulseBeat((prev) => (prev + 1) % 60);
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  const isLiveConnected = browserOnline && isRealtimeConnected;

  const activeHosts = useMemo(() => {
    const hostMap = new Map<string, ActiveHostItem>();

    state.hosts.forEach((host) => {
      const user = state.users.find((u) => u.id === host.userId);
      const hostRoom = state.rooms.find((r) => r.id === host.roomId) || room;
      const seatedMatch = state.rooms
        .flatMap((r) => r.seats.map((s) => ({ room: r, seat: s })))
        .find((entry) => entry.seat.userId === host.userId);

      const isActive = host.status !== 'offline' || Boolean(seatedMatch);
      if (!isActive) return;

      const effectiveRoom = seatedMatch?.room || hostRoom;
      const liveStatus: 'on-mic' | 'online' =
        seatedMatch || host.status === 'on-mic' ? 'on-mic' : 'online';

      hostMap.set(host.userId, {
        userId: host.userId,
        name: user?.name || host.name,
        avatar: user?.avatar || host.avatar,
        flag: user?.flag || effectiveRoom.flag || '🇸🇦',
        level: user?.level || 1,
        followers: user?.followers ?? 0,
        roomId: effectiveRoom.id,
        roomTitle: effectiveRoom.title,
        status: liveStatus,
        isSpeakingNow: Boolean(
          seatedMatch && !seatedMatch.seat.isMuted && seatedMatch.seat.isSpeaking
        ),
        isCurrentRoom: effectiveRoom.id === room.id,
        userAccount: user,
      });
    });

    if (!hostMap.has(room.ownerId)) {
      const ownerUser = state.users.find((u) => u.id === room.ownerId);
      const ownerSeat = room.seats.find((s) => s.userId === room.ownerId);
      hostMap.set(room.ownerId, {
        userId: room.ownerId,
        name: ownerUser?.name || room.ownerName,
        avatar: ownerUser?.avatar || room.ownerAvatar,
        flag: ownerUser?.flag || room.flag || '🇸🇦',
        level: ownerUser?.level || 1,
        followers: ownerUser?.followers ?? 0,
        roomId: room.id,
        roomTitle: room.title,
        status: ownerSeat ? 'on-mic' : 'online',
        isSpeakingNow: Boolean(ownerSeat && !ownerSeat.isMuted && ownerSeat.isSpeaking),
        isCurrentRoom: true,
        userAccount: ownerUser,
      });
    }

    return Array.from(hostMap.values()).sort((a, b) => {
      if (b.followers !== a.followers) return b.followers - a.followers;
      if (a.status !== b.status) return a.status === 'on-mic' ? -1 : 1;
      if (b.level !== a.level) return b.level - a.level;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [state.hosts, state.users, state.rooms, room]);

  return (
    <section
      aria-label="قائمة المضيفين النشطين حسب المتابعين"
      className="w-full text-white"
    >
      {/* Header with Real-Time Connection Status Indicator */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500/35 to-blue-500/35 border border-violet-300/35 flex items-center justify-center shrink-0">
            <Users className="w-4.5 h-4.5 text-violet-200" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-display font-extrabold text-white truncate">
                المضيفون النشطون
              </h3>
              <span className="text-xs font-mono-num font-bold text-indigo-200/80 tabular-nums shrink-0">
                ({activeHosts.length})
              </span>
            </div>
            <p className="text-[11px] text-slate-300/85 truncate">
              مرتبون حسب عدد المتابعين الحاليين
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-[10.5px] font-bold whitespace-nowrap"
            title={
              isLiveConnected
                ? 'اتصال لحظي مباشر بالخادم'
                : browserOnline
                ? 'جارٍ مزامنة الاتصال اللحظي'
                : 'غير متصل بالشبكة'
            }
          >
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              {browserOnline && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isLiveConnected ? 'bg-emerald-400' : 'bg-sky-400'
                  }`}
                />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveConnected
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]'
                    : browserOnline
                    ? 'bg-sky-400'
                    : 'bg-rose-500'
                }`}
              />
            </span>
            {browserOnline ? (
              <Wifi className={`w-3.5 h-3.5 ${isLiveConnected ? 'text-emerald-300' : 'text-sky-300'}`} />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span
              className={
                isLiveConnected
                  ? 'text-emerald-300'
                  : browserOnline
                  ? 'text-sky-300'
                  : 'text-rose-300'
              }
            >
              {isLiveConnected ? 'متصل لحظياً' : browserOnline ? 'مزامنة حية' : 'منقطع'}
            </span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق قائمة المضيفين"
              className="w-9 h-9 rounded-full bg-white/[0.07] hover:bg-rose-600/80 border border-white/10 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Spacious Sorted Host Rows (Zero Ugly Scrollbars) */}
      <div className="mt-3 max-h-[52dvh] overflow-y-auto no-scrollbar space-y-2">
        {activeHosts.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            لا يوجد مضيفون نشطون حالياً
          </div>
        ) : (
          activeHosts.map((host, idx) => {
            const isSelf = host.userId === currentUser.id;
            const isFollowing = followedUserIds.includes(host.userId);
            const rankBadge =
              idx === 0
                ? 'text-amber-300'
                : idx === 1
                ? 'text-slate-200'
                : idx === 2
                ? 'text-orange-300'
                : 'text-indigo-300/80';

            const inspectPayload: UserAccount = host.userAccount || {
              id: host.userId,
              name: host.name,
              avatar: host.avatar,
              role: 'HOST',
              level: host.level,
              xp: 0,
              svip: 0,
              aristocratTier: null,
              title: 'مضيف نشط',
              country: room.country,
              flag: host.flag,
              gold: 0,
              diamonds: 0,
              charisma: 0,
              giftedGold: 0,
              following: 0,
              followers: host.followers,
              visitors: 0,
              ownedEntries: [],
            };

            return (
              <div
                key={host.userId}
                className="flex items-center justify-between gap-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 px-3 py-2.5 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onInspectHost(inspectPayload);
                  }}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-right cursor-pointer"
                >
                  <span
                    className={`w-6 text-center text-xs font-mono-num font-black tabular-nums shrink-0 ${rankBadge}`}
                  >
                    {idx === 0 ? (
                      <Crown className="w-4 h-4 mx-auto fill-amber-300 text-amber-300" />
                    ) : (
                      `#${idx + 1}`
                    )}
                  </span>

                  <div className="relative w-11 h-11 shrink-0">
                    <img
                      src={host.avatar}
                      alt={host.name}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full rounded-full object-cover border-2 ${
                        host.isSpeakingNow
                          ? 'border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.75)]'
                          : host.status === 'on-mic'
                          ? 'border-violet-400/85'
                          : 'border-white/30'
                      }`}
                    />
                    <span
                      aria-label={host.status === 'on-mic' ? 'على المايك الآن' : 'متصل الآن'}
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0E0A2A] ${
                        host.isSpeakingNow
                          ? 'bg-sky-400 animate-pulse'
                          : host.status === 'on-mic'
                          ? 'bg-emerald-400'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs sm:text-sm font-display font-extrabold text-white truncate">
                        {host.name}
                      </span>
                      <span className="text-xs shrink-0">{host.flag}</span>
                      <span className="text-[10px] font-mono-num font-bold text-sky-300 shrink-0">
                        Lv.{host.level}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10.5px] text-indigo-200/85 truncate tabular-nums">
                      <span className="inline-flex items-center gap-1 text-emerald-300 font-bold shrink-0">
                        {host.status === 'on-mic' ? (
                          <>
                            <Mic className="w-3 h-3" />
                            <span>{host.isSpeakingNow ? 'يتحدث الآن' : 'على المايك'}</span>
                          </>
                        ) : (
                          <>
                            <Radio className="w-3 h-3" />
                            <span>متصل الآن</span>
                          </>
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num font-bold text-violet-200 shrink-0">
                        {formatCompactNumber(host.followers)} متابع
                      </span>
                      <span aria-hidden="true" className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline truncate text-slate-300/80">
                        {host.isCurrentRoom ? 'في هذه الغرفة' : host.roomTitle}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!host.isCurrentRoom && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose?.();
                        setActiveRoomId(host.roomId);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-violet-500/35 border border-white/15 text-[11px] font-bold text-sky-200 whitespace-nowrap cursor-pointer transition-colors"
                      title={`الانتقال إلى ${host.roomTitle}`}
                    >
                      دخول
                    </button>
                  )}

                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => toggleFollowUser(host.userId)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                        isFollowing
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30'
                          : 'bg-gradient-to-l from-violet-600 to-blue-500 hover:brightness-110 text-white shadow-[0_2px_12px_rgba(99,102,241,0.45)]'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>متابَع</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 shrink-0" />
                          <span>متابعة</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <span className="sr-only" data-pulse-beat={pulseBeat} />
    </section>
  );
};
