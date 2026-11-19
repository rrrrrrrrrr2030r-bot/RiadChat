/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldAlert, X } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { RoyalDragonOverlay } from './components/RoyalDragonOverlay';
import { LevelUpModal } from './components/LevelUpModal';
import { RoomsView } from './components/RoomsView';
import { LiveRoomView } from './components/LiveRoomView';
import { GamesView } from './components/GamesView';
import { SquareView } from './components/SquareView';
import { MessagesView } from './components/MessagesView';
import { WalletView } from './components/WalletView';
import { AgenciesView } from './components/AgenciesView';
import { AgencyDashboardView } from './components/AgencyDashboardView';
import { StoreView } from './components/StoreView';
import { SystemView } from './components/SystemView';
import { ProfileView } from './components/ProfileView';
import { OfflineIndicator } from './components/OfflineIndicator';

const MainShell: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeRoomId,
    minimizedRoomId,
    restoreMinimizedRoom,
    closeMinimizedRoom,
    currentUser,
    state,
    toasts,
  } = useApp();

  const isOwner = currentUser.role === 'OWNER';

  const minimizedRoom = minimizedRoomId
    ? state.rooms.find((r) => r.id === minimizedRoomId)
    : null;

  const isImmersiveSubpage =
    Boolean(activeRoomId) || activeTab === 'wallet' || activeTab === 'agencies';

  const renderForbiddenNotice = () => (
    <div className="max-w-lg mx-auto mt-10 rounded-3xl bg-[#130D33] border border-rose-500/45 p-6 text-center text-white space-y-4 shadow-2xl">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-display font-extrabold">403 — وصول مقيّد للمالك فقط</h2>
        <p className="text-xs sm:text-sm text-slate-300">
          لوحة تحكم الوكالة وإعدادات النظام متاحة حصرياً لحساب المالك (OWNER).
        </p>
      </div>
      <button
        type="button"
        onClick={() => setActiveTab('rooms')}
        className="px-6 py-2.5 rounded-full bg-gradient-to-l from-violet-600 to-blue-500 hover:brightness-110 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
      >
        العودة إلى الغرف الرئيسية
      </button>
    </div>
  );

  const renderContent = () => {
    if (activeRoomId) {
      return <LiveRoomView />;
    }
    switch (activeTab) {
      case 'rooms':
      case 'games':
        return <RoomsView />;
      case 'square':
        return <SquareView />;
      case 'messages':
        return <MessagesView />;
      case 'wallet':
        return <WalletView />;
      case 'agencies':
        return <AgenciesView />;
      case 'agency-dashboard':
        return isOwner ? <AgencyDashboardView /> : renderForbiddenNotice();
      case 'store':
        return <StoreView />;
      case 'system':
        return isOwner ? <SystemView /> : renderForbiddenNotice();
      case 'me':
        return <ProfileView />;
      default:
        return <RoomsView />;
    }
  };

  return (
    <div
      dir="rtl"
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        state.ultraNightMode
          ? 'bg-[#03020B] bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.34),_rgba(37,99,235,0.2)_48%,_#03020B_82%)] text-[#9D98C8]'
          : activeRoomId
          ? 'bg-[#05010E] text-white'
          : activeTab === 'agency-dashboard'
          ? 'bg-[#07041A] bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.24),_rgba(37,99,235,0.16)_46%,_#07041A_82%)] text-white'
          : 'bg-[#F5F7FA] text-slate-900'
      }`}
    >
      {!isImmersiveSubpage && <TopBar />}
      {!isImmersiveSubpage && <AnnouncementBanner />}

      <main
        className={`flex-1 w-full ${
          activeRoomId
            ? 'max-w-3xl mx-auto sm:px-4 sm:py-3'
            : activeTab === 'wallet' || activeTab === 'agencies'
            ? 'max-w-xl mx-auto'
            : 'max-w-7xl mx-auto px-3 sm:px-6 pt-5 pb-24 lg:pb-12'
        }`}
      >
        {renderContent()}
      </main>

      {!isImmersiveSubpage && <BottomNav />}
      <AnimatePresence>
        {activeTab === 'games' && <GamesView onClose={() => setActiveTab('rooms')} />}
      </AnimatePresence>
      <RoyalDragonOverlay />
      <LevelUpModal />
      <OfflineIndicator />

      {/* Floating Minimized Live Room Bubble (Screenshots 7 & 8) */}
      <AnimatePresence>
        {!activeRoomId && minimizedRoom && (
          <motion.div
            initial={{ opacity: 0, scale: 0.75, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.75, y: 20 }}
            className="fixed bottom-20 left-4 lg:bottom-6 lg:left-6 z-40 flex items-center gap-1"
          >
            <button
              type="button"
              onClick={restoreMinimizedRoom}
              aria-label={`العودة إلى ${minimizedRoom.title}`}
              title={`العودة إلى ${minimizedRoom.title}`}
              className="relative w-14 h-14 rounded-full p-[2.5px] shadow-[0_6px_22px_rgba(168,85,247,0.52)] cursor-pointer hover:scale-105 transition-transform"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full overflow-hidden">
                <span className="absolute -inset-1/2 animate-white-purple-ring" />
              </span>
              <img
                src={minimizedRoom.ownerAvatar}
                alt={minimizedRoom.title}
                referrerPolicy="no-referrer"
                className="relative z-10 w-full h-full rounded-full object-cover border-2 border-white/95"
              />
              <span className="z-20 absolute -bottom-0.5 right-0.5 px-1 py-0.5 rounded-full bg-violet-600 border border-white flex items-end gap-[1.5px]">
                <span className="w-[2px] h-1.5 bg-white rounded-full animate-pulse" />
                <span className="w-[2px] h-2.5 bg-white rounded-full" />
                <span className="w-[2px] h-1 bg-white rounded-full animate-pulse" />
              </span>
            </button>

            <button
              type="button"
              onClick={closeMinimizedRoom}
              aria-label="إغلاق الغرفة المصغرة"
              className="w-6 h-6 -mt-9 rounded-full bg-white hover:bg-rose-500 text-violet-700 hover:text-white border-2 border-violet-500 ring-1 ring-white shadow flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Toast Notification Stack */}
      <div className="pointer-events-none fixed top-16 inset-x-0 z-50 flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`max-w-md rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xl backdrop-blur-md border ${
                t.tone === 'error'
                  ? 'bg-rose-600/95 border-rose-300/40 text-white'
                  : t.tone === 'warning'
                  ? 'bg-amber-500/95 border-amber-200/50 text-slate-950'
                  : t.tone === 'info'
                  ? 'bg-violet-600/95 border-violet-300/40 text-white'
                  : 'bg-emerald-600/95 border-emerald-300/40 text-white'
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}
