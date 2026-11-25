import React, { useEffect, useRef, useState } from 'react';
import { Crown, Diamond, Coins, Shield, UserCheck, ChevronDown, Wallet, Sparkles, LogOut, RefreshCw, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MainTab, UserRole } from '../types';
import { formatCompactNumber, formatDiamonds } from '../utils/format';
import { forceRefreshApp } from '../utils/cacheBuster';
import { APP_ICON_PATH } from '../data/seedData';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationCenter } from './NotificationCenter';

const DESKTOP_NAV: Array<{ id: MainTab; label: string; ownerOnly?: boolean; agentOnly?: boolean }> = [
  { id: 'rooms', label: 'الغرفة' },
  { id: 'games', label: 'لعبة' },
  { id: 'agencies', label: 'الوكالات', agentOnly: true },
  { id: 'agency-dashboard', label: 'لوحة الوكالة', ownerOnly: true },
  { id: 'square', label: 'ساحة' },
  { id: 'messages', label: 'الرسائل' },
  { id: 'me', label: 'أنا' },
];

const ROLE_LABELS: Record<UserRole, { label: string; badgeClass: string }> = {
  OWNER: { label: 'المالك', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  AGENCY_AGENT: { label: 'وكيل شحن', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  HOST: { label: 'مضيف', badgeClass: 'bg-violet-100 text-violet-800 border-violet-300' },
  SUPERVISOR: { label: 'مشرف', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300' },
  USER: { label: 'مستخدم', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const TopBar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setActiveRoomId,
    openWallet,
    currentUser,
    isPrimaryAdmin,
    isApprovedAgent,
    state,
    switchUserAccount,
    logoutAccount,
  } = useApp();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const isOwner = isPrimaryAdmin;

  // Golden Glow pulse & numeric roll-up on gold OR diamonds increase
  const [displayGold, setDisplayGold] = useState(currentUser.gold);
  const [displayDiamonds, setDisplayDiamonds] = useState(currentUser.diamonds);
  const [balanceGlowActive, setBalanceGlowActive] = useState(false);

  const prevUserIdRef = useRef(currentUser.id);
  const prevGoldRef = useRef(currentUser.gold);
  const prevDiamondsRef = useRef(currentUser.diamonds);
  const glowTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (prevUserIdRef.current !== currentUser.id) {
      prevUserIdRef.current = currentUser.id;
      prevGoldRef.current = currentUser.gold;
      prevDiamondsRef.current = currentUser.diamonds;
      setDisplayGold(currentUser.gold);
      setDisplayDiamonds(currentUser.diamonds);
      setBalanceGlowActive(false);
      return;
    }

    const oldGold = prevGoldRef.current;
    const oldDiamonds = prevDiamondsRef.current;
    const newGold = currentUser.gold;
    const newDiamonds = currentUser.diamonds;
    prevGoldRef.current = newGold;
    prevDiamondsRef.current = newDiamonds;

    const goldIncreased = newGold > oldGold;
    const diamondsIncreased = newDiamonds > oldDiamonds;

    if (goldIncreased || diamondsIncreased) {
      setBalanceGlowActive(true);
      if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
      glowTimerRef.current = window.setTimeout(() => {
        setBalanceGlowActive(false);
      }, 2100);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const startTime = performance.now();
      const duration = 680;

      const step = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        if (goldIncreased) {
          setDisplayGold(Math.round(oldGold + (newGold - oldGold) * eased));
        } else {
          setDisplayGold(newGold);
        }
        if (diamondsIncreased) {
          setDisplayDiamonds(Math.round(oldDiamonds + (newDiamonds - oldDiamonds) * eased));
        } else {
          setDisplayDiamonds(newDiamonds);
        }
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setDisplayGold(newGold);
          setDisplayDiamonds(newDiamonds);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    } else {
      setDisplayGold(newGold);
      setDisplayDiamonds(newDiamonds);
    }
  }, [currentUser.gold, currentUser.diamonds, currentUser.id]);

  const handleNav = (tab: MainTab) => {
    if (tab !== 'games') {
      setActiveRoomId(null);
    }
    setActiveTab(tab);
  };

  const visibleNavItems = DESKTOP_NAV.filter(
    (item) => (!item.ownerOnly || isOwner) && (!item.agentOnly || isApprovedAgent)
  );

  return (
    <header className="sticky top-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_8px_rgba(15,23,42,0.03)]">
      <div className="max-w-7xl mx-auto h-full px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('rooms')}
          className="flex items-center gap-1.5 font-display font-extrabold text-sm sm:text-xl tracking-tight whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg px-0.5"
        >
          <span className="w-8 h-8 rounded-xl p-[1.5px] bg-gradient-to-tr from-violet-600 via-fuchsia-400 to-sky-400 shadow-[0_0_10px_rgba(124,58,237,0.3)] shrink-0 flex items-center justify-center overflow-hidden">
            <img
              src={APP_ICON_PATH}
              alt="رياض شات"
              className="w-full h-full rounded-[10px] object-cover object-center"
            />
          </span>
          <span className="text-slate-900">رياض شات</span>
        </button>

        {/* Zone 2: Desktop Single-Line Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-emerald-600 font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Install App, Balance (with Golden Glow), Wallet, Owner Shield & Account Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={() => openWallet('gold')}
            title="محفظة الذهب والماس — اضغط للشحن"
            className={`relative overflow-hidden flex items-center gap-1.5 sm:gap-2 rounded-full px-2 sm:px-3 py-1 text-[11px] sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              balanceGlowActive
                ? 'bg-gradient-to-l from-amber-100 via-yellow-50 to-amber-100 border-amber-400 ring-2 ring-amber-300/75 animate-gold-aura scale-[1.03]'
                : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200'
            }`}
          >
            {balanceGlowActive && (
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse shrink-0" />
            )}
            <span className="flex items-center gap-1 text-amber-600 font-mono-num font-bold">
              <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" />
              {formatCompactNumber(displayGold)}
            </span>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className="flex items-center gap-1 text-sky-600 font-mono-num font-bold">
              <Diamond className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500 shrink-0" />
              {formatDiamonds(displayDiamonds)}
            </span>
          </button>

          <NotificationCenter />

          <button
            type="button"
            onClick={() => openWallet('diamonds')}
            aria-label="المحفظة"
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-violet-600 via-white to-purple-500 shadow-[0_0_10px_rgba(124,58,237,0.25)] transition-transform hover:scale-105 cursor-pointer shrink-0"
          >
            <span className="w-full h-full rounded-full bg-white hover:bg-violet-50 text-violet-700 flex items-center justify-center transition-colors">
              <Wallet className="w-4 h-4" />
            </span>
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => handleNav('system')}
              aria-label="لوحة النظام والإدارة"
              className="group relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full p-[1.5px] overflow-hidden cursor-pointer shrink-0 shadow-[0_0_12px_rgba(124,58,237,0.4)] transition-transform active:scale-95"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
              <span className="relative z-10 w-full h-full rounded-full bg-[#24184A] group-hover:bg-[#312066] text-white flex items-center justify-center transition-colors">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((o) => !o)}
              className="flex items-center gap-1 p-0.5 sm:p-1 rounded-full bg-white border-2 border-violet-500/80 ring-1 ring-white hover:border-violet-600 transition-colors cursor-pointer min-h-[34px] sm:min-h-[38px] shadow-xs"
              aria-label="تبديل الحساب النشط"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-white"
              />
              <ChevronDown className="w-3.5 h-3.5 text-violet-600 ml-1 hidden sm:block" />
            </button>

            {accountMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAccountMenuOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white border border-slate-200 shadow-2xl p-2 z-50 space-y-1.5">
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-500">
                        ID: {currentUser.id}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-violet-50 text-violet-700 border-violet-200 shrink-0">
                      {ROLE_LABELS[currentUser.role].label}
                    </span>
                  </div>

                  {/* Quick Personal Actions */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        handleNav('me');
                      }}
                      className="w-full min-h-[40px] flex items-center gap-2 px-3 py-2 rounded-xl text-right text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-violet-600 shrink-0" />
                      <span>الملف الشخصي والإعدادات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        void forceRefreshApp();
                      }}
                      className="w-full min-h-[40px] flex items-center gap-2 px-3 py-2 rounded-xl text-right text-xs font-bold text-sky-700 hover:bg-sky-50 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>تحديث التطبيق ومسح الكاش</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        void logoutAccount();
                      }}
                      className="w-full min-h-[40px] flex items-center gap-2 px-3 py-2 rounded-xl text-right text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>

                  {/* RBAC Account Switcher — STRICTLY Primary Admin (ID: 900) ONLY */}
                  {isPrimaryAdmin && (
                    <div className="pt-1.5 border-t border-slate-100">
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 flex items-center justify-between">
                        <span>تبديل الحساب (إدارة ID: 900)</span>
                        <span className="text-[10px] font-mono-num text-violet-600">RBAC</span>
                      </div>
                      <div className="mt-1 space-y-1 max-h-56 overflow-y-auto">
                        {state.users.map((u) => {
                          const active = u.id === currentUser.id;
                          const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.USER;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                switchUserAccount(u.id);
                                setAccountMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-right text-xs transition-colors cursor-pointer ${
                                active
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'hover:bg-slate-50 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={u.avatar}
                                  alt={u.name}
                                  referrerPolicy="no-referrer"
                                  className="w-7 h-7 rounded-full object-cover shrink-0"
                                />
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold truncate">{u.name}</span>
                                    <span
                                      className={`px-1.5 py-[1px] rounded-md border text-[9px] font-bold shrink-0 ${roleInfo.badgeClass}`}
                                    >
                                      {roleInfo.label}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono-num">
                                    ID: {u.id}
                                  </div>
                                </div>
                              </div>
                              {active && <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
