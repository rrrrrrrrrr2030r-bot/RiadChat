import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Briefcase,
  ChevronRight,
  Coins,
  Heart,
  History,
  RefreshCw,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WALLET_GOLD_PACKS } from '../data/seedData';
import { formatCompactNumber, formatDiamonds, formatFullGold } from '../utils/format';

const GOLD_SPARKLES = [
  { id: 1, x: -24, y: -18, delay: 0 },
  { id: 2, x: 26, y: -22, delay: 0.08 },
  { id: 3, x: -34, y: 12, delay: 0.14 },
  { id: 4, x: 34, y: 14, delay: 0.2 },
  { id: 5, x: 0, y: -32, delay: 0.05 },
  { id: 6, x: 16, y: 28, delay: 0.18 },
];

export const WalletView: React.FC = () => {
  const {
    state,
    currentUser,
    isApprovedAgent,
    walletInitialTab,
    setActiveTab,
    exchangeDiamondsToGold,
    purchaseWalletPack,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<'gold' | 'diamonds'>(walletInitialTab);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangeAmount, setExchangeAmount] = useState('10');
  const [historyOpen, setHistoryOpen] = useState(false);

  // Gold & Diamonds Glow Animation State
  const [displayGold, setDisplayGold] = useState<number>(currentUser.gold);
  const [displayDiamonds, setDisplayDiamonds] = useState<number>(currentUser.diamonds);
  const [goldGlowActive, setGoldGlowActive] = useState(false);
  const [goldGlowKey, setGoldGlowKey] = useState(0);
  const [goldGainDelta, setGoldGainDelta] = useState(0);
  const [diamondsGainDelta, setDiamondsGainDelta] = useState(0);
  const [glowingPackId, setGlowingPackId] = useState<string | null>(null);

  const prevUserIdRef = useRef<string>(currentUser.id);
  const prevGoldRef = useRef<number>(currentUser.gold);
  const prevDiamondsRef = useRef<number>(currentUser.diamonds);
  const glowTimerRef = useRef<number | null>(null);
  const packTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setTab(walletInitialTab);
  }, [walletInitialTab]);

  useEffect(() => {
    return () => {
      if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
      if (packTimerRef.current) window.clearTimeout(packTimerRef.current);
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
      setGoldGlowActive(false);
      setGoldGainDelta(0);
      setDiamondsGainDelta(0);
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
      setGoldGainDelta(goldIncreased ? newGold - oldGold : 0);
      setDiamondsGainDelta(diamondsIncreased ? newDiamonds - oldDiamonds : 0);
      setGoldGlowActive(true);
      setGoldGlowKey((k) => k + 1);

      if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
      glowTimerRef.current = window.setTimeout(() => {
        setGoldGlowActive(false);
      }, 2300);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const startTime = performance.now();
      const duration = 760;

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

  const handleExchangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(exchangeAmount);
    if (exchangeDiamondsToGold(num)) {
      setExchangeOpen(false);
      setTab('gold');
    }
  };

  const handlePackPurchase = (packId: string, gold: number, usd: string) => {
    setGlowingPackId(packId);
    if (packTimerRef.current) window.clearTimeout(packTimerRef.current);
    packTimerRef.current = window.setTimeout(() => setGlowingPackId(null), 1000);
    purchaseWalletPack(gold, usd);
  };

  const handleFriendRecharge = () => {
    const link = `${window.location.origin}/?agent=200016&friend=${currentUser.id}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    showToast('تم نسخ رابط مساعدة الأصدقاء للشحن بنجاح!', 'success');
  };

  const activeDelta = tab === 'diamonds' ? diamondsGainDelta : goldGainDelta;

  return (
    <div
      className={`max-w-3xl mx-auto rounded-3xl overflow-hidden bg-white border transition-all duration-300 text-slate-900 ${
        goldGlowActive
          ? 'border-amber-300 animate-gold-aura'
          : 'border-slate-200/80 shadow-sm'
      }`}
    >
      {/* Top Colored Hero with Gold Glow Effect */}
      <div
        className={`relative overflow-hidden px-4 sm:px-6 pt-4 pb-6 text-white transition-all duration-300 ${
          tab === 'diamonds'
            ? goldGlowActive
              ? 'bg-gradient-to-b from-[#38BDF8] via-[#27A6FF] to-[#F59E0B]/70'
              : 'bg-gradient-to-b from-[#33B6FF] via-[#27A6FF] to-[#1D92FA]'
            : goldGlowActive
            ? 'bg-gradient-to-b from-[#FFD54F] via-[#F9B000] to-[#EA7D00]'
            : 'bg-gradient-to-b from-[#F9B900] via-[#F49E00] to-[#EE8600]'
        }`}
      >
        {/* Radiant Gold Sweep Light Overlay */}
        {goldGlowActive && (
          <div
            key={`sweep-${goldGlowKey}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-100/55 to-transparent animate-gold-sweep"
          />
        )}

        {/* Top Bar: Back > | Tabs ذهبيات / الماسي | History Icon */}
        <div className="relative z-10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('me')}
            aria-label="رجوع"
            className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          <div className="flex items-center gap-6 text-base sm:text-lg font-display">
            <button
              type="button"
              onClick={() => setTab('gold')}
              className={`relative py-1 cursor-pointer transition-opacity flex items-center gap-1.5 ${
                tab === 'gold'
                  ? 'font-extrabold text-white opacity-100'
                  : 'font-semibold text-white/75 hover:opacity-100'
              }`}
            >
              <span>ذهبيات</span>
              {goldGlowActive && goldGainDelta > 0 && tab !== 'gold' && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-300 text-amber-950 text-[10px] font-mono-num font-black animate-bounce">
                  +ذهب
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('diamonds')}
              className={`relative py-1 cursor-pointer transition-opacity flex items-center gap-1.5 ${
                tab === 'diamonds'
                  ? 'font-extrabold text-white opacity-100'
                  : 'font-semibold text-white/75 hover:opacity-100'
              }`}
            >
              <span>الماسي</span>
              {goldGlowActive && diamondsGainDelta > 0 && tab !== 'diamonds' && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-300 text-amber-950 text-[10px] font-mono-num font-black animate-bounce">
                  +ماس
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="سجل العمليات"
            className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
          >
            <History className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Balance + Decorative Vector / Glowing Coin Graphic */}
        <div className="relative z-10 mt-5 flex items-center justify-between gap-4">
          <div className="relative space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/90">توازن</span>
              <AnimatePresence>
                {goldGlowActive && activeDelta > 0 && (
                  <motion.span
                    key={`gain-${goldGlowKey}-${tab}`}
                    initial={{ opacity: 0, y: 12, scale: 0.75 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -14, scale: 0.85 }}
                    transition={{ duration: 0.35 }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-yellow-200 text-xs font-mono-num font-black shadow-[0_0_16px_rgba(254,240,138,0.95)]"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>+{formatCompactNumber(activeDelta)}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <motion.div
              key={`bal-${tab}-${goldGlowKey}`}
              animate={
                goldGlowActive
                  ? {
                      scale: [1, 1.07, 1],
                      filter: [
                        'drop-shadow(0 0 0px rgba(254,240,138,0))',
                        'drop-shadow(0 0 18px rgba(254,240,138,0.95))',
                        'drop-shadow(0 0 8px rgba(253,224,71,0.55))',
                      ],
                    }
                  : { scale: 1 }
              }
              transition={{ duration: 0.65 }}
              className="text-3xl sm:text-4xl font-mono-num font-extrabold tracking-tight text-white"
            >
              {tab === 'diamonds'
                ? formatDiamonds(displayDiamonds)
                : formatFullGold(displayGold)}
            </motion.div>
          </div>

          {tab === 'diamonds' ? (
            <svg
              viewBox="0 0 120 96"
              className="w-32 h-24 sm:w-36 sm:h-28 opacity-45 shrink-0"
              aria-hidden="true"
            >
              <polygon points="24,10 96,10 116,36 60,92 4,36" fill="#BCEEFF" />
              <polygon points="24,10 60,10 42,36 4,36" fill="#E0F7FF" />
              <polygon points="60,10 96,10 116,36 78,36" fill="#8FE3FF" />
              <polygon points="42,36 78,36 60,92" fill="#70D8FF" />
              <polygon points="4,36 42,36 60,92" fill="#A5EAFF" />
              <polygon points="78,36 116,36 60,92" fill="#50CCFF" />
            </svg>
          ) : (
            <div className="relative flex items-center justify-center shrink-0">
              {goldGlowActive && (
                <>
                  <motion.span
                    key={`halo-${goldGlowKey}`}
                    initial={{ scale: 0.8, opacity: 0.9 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1.1, repeat: 1 }}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border-4 border-yellow-200 shadow-[0_0_24px_rgba(254,240,138,0.9)]"
                  />
                  {GOLD_SPARKLES.map((sp) => (
                    <motion.span
                      key={`${goldGlowKey}-${sp.id}`}
                      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0.4, 1.25, 0.5],
                        x: sp.x * 1.4,
                        y: sp.y * 1.4,
                      }}
                      transition={{ duration: 1.0, delay: sp.delay }}
                      aria-hidden="true"
                      className="pointer-events-none absolute text-yellow-100 drop-shadow-[0_0_8px_rgba(254,240,138,1)]"
                    >
                      <Sparkles className="w-4 h-4" />
                    </motion.span>
                  ))}
                </>
              )}

              <motion.div
                key={`coin-${goldGlowKey}`}
                animate={
                  goldGlowActive
                    ? {
                        rotateY: [0, 360],
                        scale: [1, 1.14, 1],
                      }
                    : { rotateY: 0, scale: 1 }
                }
                transition={{ duration: 0.8, ease: 'easeOut' }}
                aria-hidden="true"
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 flex items-center justify-center text-5xl font-extrabold transition-all shrink-0 ${
                  goldGlowActive
                    ? 'bg-gradient-to-br from-yellow-200/60 to-amber-300/40 border-yellow-100 text-white shadow-[0_0_32px_rgba(254,240,138,0.95)]'
                    : 'bg-white/15 border-white/25 text-white/55'
                }`}
              >
                $
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {tab === 'diamonds' ? (
        <div className="p-5 sm:p-7 space-y-6 bg-[#F7FAFE]">
          <p className="text-xs sm:text-sm text-[#1F7BD8] font-medium leading-relaxed text-right">
            يمكنك الحصول على الماس عن طريق تلقي الهدايا. ويتم تحديث البيانات كل عشر دقائق · مستوى الثروة والنشاط ≥ 5
          </p>

          <div className="space-y-3.5 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setExchangeOpen(true)}
              className="w-full h-13 rounded-full bg-gradient-to-l from-[#32AAFF] to-[#2BB8FF] hover:from-[#269DF0] hover:to-[#20ACEF] text-white font-display font-bold text-base shadow-md shadow-sky-400/25 cursor-pointer transition-transform active:scale-[0.99]"
            >
              استبدال الذهبية
            </button>

            {isApprovedAgent && (
              <button
                type="button"
                onClick={() => setActiveTab('agencies')}
                className="w-full h-13 rounded-full bg-[#15D16B] hover:bg-[#11BC5F] text-white font-display font-bold text-base shadow-md shadow-emerald-400/25 cursor-pointer transition-transform active:scale-[0.99]"
              >
                تحويل الاموال
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#F6F7FB] pb-6 space-y-4">
          {/* Announcement Strip */}
          <div className="bg-[#FFF9E6] border-b border-amber-200/70 px-4 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm text-amber-600 font-medium">
            <Volume2 className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">{state.globalAnnouncement}</span>
          </div>

          {/* 3x2 Gold Packages Grid */}
          <div className="px-4 sm:px-6 grid grid-cols-3 gap-3">
            {WALLET_GOLD_PACKS.map((pack) => {
              const isPackGlowing = glowingPackId === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => handlePackPurchase(pack.id, pack.gold, pack.usd)}
                  className={`rounded-xl bg-white overflow-hidden flex flex-col justify-between transition-all active:scale-[0.97] cursor-pointer border ${
                    isPackGlowing
                      ? 'border-amber-400 ring-2 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.65)] scale-[1.03]'
                      : 'border-slate-200/80 hover:border-amber-300 hover:shadow-md'
                  }`}
                >
                  <div className="px-2 py-4 flex flex-col items-center gap-2">
                    <span
                      className={`w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-2 border-amber-200 text-amber-950 font-extrabold text-sm flex items-center justify-center transition-transform ${
                        isPackGlowing
                          ? 'scale-115 shadow-[0_0_16px_rgba(251,191,36,0.9)]'
                          : 'shadow-sm'
                      }`}
                    >
                      $
                    </span>
                    <span className="font-mono-num font-extrabold text-sm sm:text-base text-slate-900">
                      {pack.gold}
                    </span>
                  </div>
                  <div className="w-full py-1.5 bg-[#F5A300] text-white text-xs sm:text-sm font-mono-num font-bold text-center">
                    $US {pack.usd}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Quick Links */}
          <div className="px-4 sm:px-6 pt-2 space-y-2.5 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className="w-full h-12 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 px-4 flex items-center justify-center gap-2.5 text-sm font-bold text-slate-800 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-4 h-4 text-amber-500" />
              <span>موقع الشحن</span>
            </button>

            {isApprovedAgent && (
              <button
                type="button"
                onClick={() => setActiveTab('agencies')}
                className="w-full h-12 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 px-4 flex items-center justify-center gap-2.5 text-sm font-bold text-slate-800 cursor-pointer shadow-xs"
              >
                <Briefcase className="w-4 h-4 text-amber-500" />
                <span>وكيل الشحن</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleFriendRecharge}
              className="w-full h-11 rounded-xl hover:bg-white/70 px-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer"
            >
              <Heart className="w-4 h-4 text-rose-500" />
              <span>مساعدة الأصدقاء للشحن</span>
            </button>
          </div>
        </div>
      )}

      {/* Exchange Diamonds Modal */}
      {exchangeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold">استبدال الماس بالذهبية</h3>
              <button
                type="button"
                onClick={() => setExchangeOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleExchangeSubmit} className="space-y-3">
              <div className="text-xs text-slate-500">
                كل 1 ماسة = 15,000 ذهبية · المتاح: {formatDiamonds(currentUser.diamonds)} ماسة
              </div>
              <input
                type="number"
                min={1}
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-300 font-mono-num text-sm focus:outline-none focus:border-sky-500"
              />
              <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800 flex items-center justify-between">
                <span>ستحصل على:</span>
                <span className="font-mono-num font-bold flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  {formatFullGold(Math.max(0, Math.floor(Number(exchangeAmount) || 0)) * 15_000)}
                </span>
              </div>
              <button
                type="submit"
                className="w-full h-11 rounded-full bg-gradient-to-l from-[#32AAFF] to-[#2BB8FF] text-white font-bold text-sm cursor-pointer"
              >
                تأكيد الاستبدال الآن
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 space-y-3 shadow-2xl text-slate-900 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-display font-bold">سجل العمليات المالية</h3>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {state.transfers.map((tr) => (
                <div key={tr.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{tr.recipientName} (ID:{tr.recipientId})</div>
                    <div className="text-slate-400">{tr.agentName} · {tr.timestamp}</div>
                  </div>
                  <div className="font-mono-num font-bold text-emerald-600">
                    +{formatFullGold(tr.totalGold)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
