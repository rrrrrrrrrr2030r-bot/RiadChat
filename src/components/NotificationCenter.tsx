import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Flame,
  Radio,
  Settings2,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { InAppNotification } from '../types';
import { formatCompactNumber } from '../utils/format';

function formatRelativeArabicTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return 'منذ دقيقة';
  if (diffMin === 2) return 'منذ دقيقتين';
  if (diffMin < 11) return `منذ ${diffMin} دقائق`;
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return 'منذ ساعة';
  if (diffHr === 2) return 'منذ ساعتين';
  if (diffHr < 11) return `منذ ${diffHr} ساعات`;
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  const diffDay = Math.floor(diffHr / 24);
  return diffDay === 1 ? 'منذ يوم' : `منذ ${diffDay} أيام`;
}

type FilterTab = 'all' | 'followed' | 'popular';

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadNotificationsCount,
    followedRoomIds,
    notificationPrefs,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    updateNotificationPrefs,
    setActiveRoomId,
    setActiveTab,
    state,
    showToast,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showPrefs, setShowPrefs] = useState(false);

  const filteredNotifications = useMemo(() => {
    if (filter === 'followed') {
      return notifications.filter((n) => n.kind === 'followed_room_live');
    }
    if (filter === 'popular') {
      return notifications.filter((n) => n.kind === 'popular_room_live');
    }
    return notifications;
  }, [notifications, filter]);

  const handleToggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        void refreshNotifications();
      }
      return next;
    });
  };

  const handleOpenRoomFromNotification = (notif: InAppNotification) => {
    if (!notif.read) {
      void markNotificationRead(notif.id);
    }
    const targetRoom = state.rooms.find((r) => r.id === notif.roomId);
    setOpen(false);
    if (!targetRoom) {
      showToast('هذه الغرفة غير متاحة حالياً', 'warning');
      setActiveTab('rooms');
      return;
    }
    setActiveRoomId(targetRoom.id);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label="إشعارات البث المباشر"
        title="إشعارات البث المباشر"
        className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-colors cursor-pointer shrink-0 ${
          open
            ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
            : 'bg-slate-100 hover:bg-violet-50 text-slate-700 hover:text-violet-700 border-slate-200 hover:border-violet-200'
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationsCount > 0 && (
          <span
            aria-label={`${unreadNotificationsCount} إشعارات غير مقروءة`}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono-num tabular-nums font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs"
          >
            {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="مركز إشعارات البث المباشر"
            className="absolute left-0 mt-2 w-[340px] sm:w-[395px] max-w-[calc(100vw-1rem)] rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden text-slate-900"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <Radio className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-display font-extrabold text-slate-900 truncate">
                    إشعارات البث المباشر
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-num tabular-nums">
                    تتابع {followedRoomIds.length} غرفة ·{' '}
                    {unreadNotificationsCount > 0
                      ? `${unreadNotificationsCount} جديد`
                      : 'كل الإشعارات مقروءة'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead()}
                    title="تحديد الكل كمقروء"
                    className="w-8 h-8 rounded-lg hover:bg-emerald-50 text-emerald-700 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPrefs((s) => !s)}
                  title="إعدادات الإشعارات"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    showPrefs
                      ? 'bg-violet-100 text-violet-700'
                      : 'hover:bg-slate-200/70 text-slate-600'
                  }`}
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="إغلاق"
                  className="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline Notification Preferences */}
            {showPrefs && (
              <div className="px-4 py-3 border-b border-slate-100 bg-violet-50/40 space-y-2.5">
                <div className="text-xs font-extrabold text-slate-800">تخصيص تنبيهات البث</div>

                <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer">
                  <span>بث مباشر في الغرف التي أتابعها</span>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.followedRoomsLive}
                    onChange={(e) =>
                      void updateNotificationPrefs({ followedRoomsLive: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer">
                  <span>بث مباشر في الغرف الشائعة</span>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.popularRoomsLive}
                    onChange={(e) =>
                      void updateNotificationPrefs({ popularRoomsLive: e.target.checked })
                    }
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer">
                  <span className="inline-flex items-center gap-1.5">
                    {notificationPrefs.soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-violet-600" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>نغمة تنبيه خفيفة عند وصول بث جديد</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.soundEnabled}
                    onChange={(e) =>
                      void updateNotificationPrefs({ soundEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-violet-600 cursor-pointer"
                  />
                </label>
              </div>
            )}

            {/* Filter Switcher */}
            <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'followed', label: 'غرف أتابعها' },
                  { id: 'popular', label: 'غرف شائعة' },
                ] as Array<{ id: FilterTab; label: string }>
              ).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`min-h-[34px] px-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Notification List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
              {filteredNotifications.length === 0 ? (
                <div className="px-5 py-10 text-center space-y-2">
                  <div className="w-11 h-11 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    لا توجد إشعارات بث مباشر في هذا القسم بعد
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    اضغط زر <strong>متابعة</strong> على أي غرفة صوتية لتصلك تنبيهات فورية لحظة بدء
                    البث المباشر فيها أو في الغرف الشائعة.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isFollowed = notif.kind === 'followed_room_live';
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleOpenRoomFromNotification(notif)}
                      className={`w-full text-right px-3.5 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                        notif.read
                          ? 'bg-white hover:bg-slate-50'
                          : isFollowed
                          ? 'bg-emerald-50/55 hover:bg-emerald-50'
                          : 'bg-amber-50/55 hover:bg-amber-50'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={notif.roomAvatar}
                          alt={notif.roomTitle}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                        />
                        <span
                          className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white ${
                            isFollowed ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                        >
                          {isFollowed ? (
                            <Radio className="w-2.5 h-2.5" />
                          ) : (
                            <Flame className="w-2.5 h-2.5" />
                          )}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                              isFollowed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isFollowed ? 'غرفة تتابعها · بث مباشر' : 'غرفة شائعة · بث مباشر'}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatRelativeArabicTime(notif.createdAt)}
                          </span>
                        </div>

                        <div className="text-xs font-display font-extrabold text-slate-900 truncate">
                          {notif.roomTitle}
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] text-slate-500">
                          <span className="inline-flex items-center gap-1 font-mono-num tabular-nums">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{notif.listeners} مستمع</span>
                            {notif.heat > 0 && (
                              <>
                                <span>·</span>
                                <span>🔥 {formatCompactNumber(notif.heat)}</span>
                              </>
                            )}
                          </span>
                          <span className="font-extrabold text-violet-700">دخول البث ←</span>
                        </div>
                      </div>

                      {!notif.read && (
                        <span
                          aria-hidden="true"
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            isFollowed ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-3.5 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void markAllNotificationsRead()}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  تحديد الكل كمقروء
                </button>
                <button
                  type="button"
                  onClick={() => void clearNotifications()}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>مسح السجل</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
