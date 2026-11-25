import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flame, Radio, Users, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { InAppNotification } from '../types';

export const LiveNotificationBanner: React.FC = () => {
  const {
    liveNotificationBanners,
    dismissLiveNotificationBanner,
    markNotificationRead,
    setActiveRoomId,
    setActiveTab,
    state,
    showToast,
  } = useApp();

  if (liveNotificationBanners.length === 0) return null;

  const handleJoin = (notif: InAppNotification) => {
    dismissLiveNotificationBanner(notif.id);
    void markNotificationRead(notif.id);
    const roomExists = state.rooms.some((r) => r.id === notif.roomId);
    if (!roomExists) {
      showToast('هذه الغرفة غير متاحة حالياً', 'warning');
      setActiveTab('rooms');
      return;
    }
    setActiveRoomId(notif.roomId);
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-16 inset-x-0 z-50 flex flex-col items-center gap-2.5 px-3 sm:px-4"
    >
      <AnimatePresence>
        {liveNotificationBanners.map((notif) => {
          const isFollowed = notif.kind === 'followed_room_live';
          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto w-full max-w-md rounded-2xl bg-slate-950/95 backdrop-blur-md text-white shadow-2xl border p-3 flex items-center gap-3 ${
                isFollowed ? 'border-emerald-400/60' : 'border-amber-400/60'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={notif.roomAvatar}
                  alt={notif.roomTitle}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-cover border border-white/20"
                />
                <span
                  className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full border-2 border-slate-950 flex items-center justify-center text-white ${
                    isFollowed ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                >
                  {isFollowed ? (
                    <Radio className="w-3 h-3" />
                  ) : (
                    <Flame className="w-3 h-3" />
                  )}
                </span>
              </div>

              <div className="flex-1 min-w-0 space-y-0.5 text-right">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold">
                  <span className={isFollowed ? 'text-emerald-300' : 'text-amber-300'}>
                    {isFollowed ? 'بث مباشر · غرفة تتابعها' : 'بث مباشر · غرفة شائعة'}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="inline-flex items-center gap-0.5 text-slate-300 font-mono-num tabular-nums">
                    <Users className="w-2.5 h-2.5" />
                    {notif.listeners}
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-display font-extrabold text-white truncate">
                  {notif.roomTitle}
                </div>
                <div className="text-[11px] text-slate-300 truncate">{notif.message}</div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleJoin(notif)}
                  className={`min-h-[38px] px-3 rounded-xl text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                    isFollowed
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  انضم الآن
                </button>
                <button
                  type="button"
                  onClick={() => dismissLiveNotificationBanner(notif.id)}
                  aria-label="إغلاق الإشعار"
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
