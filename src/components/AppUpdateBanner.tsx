import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import {
  checkForAppUpdate,
  cleanupRefreshQueryParam,
  forceRefreshApp,
} from '../utils/cacheBuster';

export const AppUpdateBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    cleanupRefreshQueryParam();
    let mounted = true;

    const runCheck = async () => {
      const { hasUpdate, latestVersion: ver } = await checkForAppUpdate();
      if (!mounted) return;
      if (hasUpdate) {
        setLatestVersion(ver);
        setUpdateAvailable(true);
        setDismissed(false);
      }
    };

    void runCheck();
    const timer = window.setInterval(runCheck, 60_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    };

    const handleOnline = () => {
      void runCheck();
    };

    const handleSwControllerChange = () => {
      if (!mounted) return;
      setUpdateAvailable(true);
      setDismissed(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('controllerchange', handleSwControllerChange);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleSwControllerChange);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleApplyUpdate = async () => {
    setRefreshing(true);
    await forceRefreshApp(latestVersion);
  };

  return (
    <div
      dir="rtl"
      role="status"
      className="fixed top-3 inset-x-3 z-[90] mx-auto max-w-lg rounded-2xl bg-[#160E3B]/95 border border-violet-400/50 px-3.5 py-2.5 text-white shadow-[0_10px_32px_rgba(79,70,229,0.5)] backdrop-blur-md flex items-center justify-between gap-2.5"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(124,58,237,0.55)]">
          <Sparkles className="w-4 h-4 text-white" />
        </span>
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-display font-extrabold truncate">
            يتوفر تحديث جديد لتطبيق رياض شات
          </div>
          <div className="text-[11px] text-indigo-200/90 truncate">
            حدّث الآن لمسح الكاش القديم وتحميل أحدث المزايا فوراً
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleApplyUpdate}
          disabled={refreshing}
          className="min-h-[40px] px-3.5 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:brightness-110 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-70 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'جارٍ التحديث...' : 'تحديث الآن'}</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="إغلاق إشعار التحديث"
          className="min-w-[36px] min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
