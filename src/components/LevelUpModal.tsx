import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Crown, Share2, Sparkles, Star, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLevelProgress } from '../utils/leveling';
import { formatFullGold } from '../utils/format';

const ORBIT_SPARKS = [
  { id: 'sp-1', top: '8%', right: '14%', size: 'w-3 h-3', color: 'text-sky-300', delay: 0 },
  { id: 'sp-2', top: '16%', left: '12%', size: 'w-4 h-4', color: 'text-violet-300', delay: 0.35 },
  { id: 'sp-3', bottom: '28%', right: '8%', size: 'w-3.5 h-3.5', color: 'text-blue-300', delay: 0.7 },
  { id: 'sp-4', bottom: '24%', left: '10%', size: 'w-3 h-3', color: 'text-purple-200', delay: 1.05 },
];

export const LevelUpModal: React.FC = () => {
  const {
    levelUpModal,
    dismissLevelUpModal,
    shareLevelAchievementInRoom,
    currentUser,
    activeRoomId,
  } = useApp();

  useEffect(() => {
    if (!levelUpModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissLevelUpModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [levelUpModal, dismissLevelUpModal]);

  const displayedLevel = currentUser.level;
  const previousLevel = levelUpModal?.previousLevel ?? Math.max(1, displayedLevel - 1);
  const progress = getLevelProgress(displayedLevel, currentUser.xp);

  return (
    <AnimatePresence>
      {levelUpModal && (
        <motion.div
          key="level-up-backdrop"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="level-up-heading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#040212]/80 backdrop-blur-md"
        >
          {/* Backdrop tap dismiss */}
          <div
            className="absolute inset-0"
            onClick={dismissLevelUpModal}
            aria-hidden="true"
          />

          {/* Ambient glowing violet & electric blue backlights */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute w-[360px] h-[360px] sm:w-[440px] sm:h-[440px] rounded-full bg-gradient-to-tr from-violet-600/40 via-blue-500/35 to-sky-400/25 blur-3xl animate-pulse"
          />

          <motion.div
            key={`level-up-card-${displayedLevel}`}
            initial={{ opacity: 0, scale: 0.84, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="relative z-10 w-full max-w-md rounded-3xl p-[2.5px] overflow-hidden animate-purple-blue-aura"
          >
            {/* Rotating purple & blue neon frame */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1/2 animate-purple-blue-ring"
            />

            <div className="relative z-10 rounded-[21px] bg-gradient-to-b from-[#1E1048] via-[#100A2E] to-[#080922] px-5 pt-5 pb-6 text-white overflow-hidden">
              {/* Internal radial spotlight overlays */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 inset-x-0 h-56 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.42),rgba(59,130,246,0.24)_52%,transparent_75%)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-24 inset-x-0 h-44 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.28),transparent_72%)]"
              />

              {/* Floating glowing sparks */}
              {ORBIT_SPARKS.map((spark) => (
                <motion.span
                  key={spark.id}
                  aria-hidden="true"
                  style={{
                    top: spark.top,
                    bottom: spark.bottom,
                    left: spark.left,
                    right: spark.right,
                  }}
                  animate={{ y: [-4, 4, -4], opacity: [0.45, 1, 0.45], scale: [0.9, 1.15, 0.9] }}
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    delay: spark.delay,
                    ease: 'easeInOut',
                  }}
                  className={`pointer-events-none absolute ${spark.color}`}
                >
                  <Sparkles className={spark.size} />
                </motion.span>
              ))}

              {/* Close button (44x44 touch target) */}
              <div className="relative z-20 flex items-center justify-between mb-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300">
                  <Star className="w-3.5 h-3.5 fill-sky-300 text-sky-300" />
                  <span>ترقية مستوى الحساب</span>
                </span>
                <button
                  type="button"
                  onClick={dismissLevelUpModal}
                  aria-label="إغلاق نافذة المستوى الجديد"
                  className="min-w-[44px] min-h-[44px] -ml-2 -mt-2 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Central Avatar + Glowing Purple-Blue Level Emblem */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="relative mb-4 mt-1">
                  {/* Outer glowing aura behind avatar */}
                  <div
                    aria-hidden="true"
                    className="absolute -inset-3 rounded-full bg-gradient-to-tr from-violet-500/50 via-blue-500/45 to-sky-400/50 blur-xl"
                  />

                  {/* Crown crest */}
                  <motion.div
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative z-20 mx-auto -mb-2.5 w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-400 border-2 border-white/80 shadow-[0_0_20px_rgba(96,165,250,0.85)] flex items-center justify-center"
                  >
                    <Crown className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  </motion.div>

                  {/* Avatar ring */}
                  <div className="relative w-24 h-24 rounded-full p-[3px] overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.75)]">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-1/2 animate-purple-blue-ring"
                    />
                    <div className="relative z-10 w-full h-full rounded-full overflow-hidden bg-[#140A35] border-2 border-[#0D0826] flex items-center justify-center">
                      {currentUser.avatar ? (
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-display font-black text-white">
                          {currentUser.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Highlighted Current Level Badge overlapping bottom */}
                  <div className="relative z-20 -mt-3.5 mx-auto inline-flex items-center justify-center rounded-full p-[2px] overflow-hidden shadow-[0_6px_22px_rgba(59,130,246,0.68)]">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-1/2 animate-purple-blue-ring"
                    />
                    <span className="relative z-10 px-4 py-1 rounded-full bg-gradient-to-l from-violet-700 via-indigo-700 to-blue-600 text-white font-mono-num font-black text-sm tracking-wide">
                      Lv.{displayedLevel}
                    </span>
                  </div>
                </div>

                <h2
                  id="level-up-heading"
                  className="text-xl sm:text-2xl font-display font-black text-white text-balance"
                >
                  تهانينا {currentUser.name}!
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-indigo-200/90">
                  حققت مستوى جديد بتفاعلك المميز في رياض شات
                </p>

                {/* Prominent Current Level Display Card */}
                <div className="mt-4 w-full rounded-2xl bg-gradient-to-br from-violet-950/75 via-[#13103E]/90 to-blue-950/75 border border-indigo-400/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                  <div className="text-[11px] font-bold text-sky-300/90">
                    مستواك الحالي
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-3">
                    <span className="text-3xl sm:text-4xl font-display font-black tabular-nums animate-purple-blue-shimmer">
                      المستوى {displayedLevel}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-center gap-2 text-xs text-violet-200/90 font-mono-num">
                    <span className="opacity-75">Lv.{previousLevel}</span>
                    <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-bold text-sky-300">Lv.{displayedLevel}</span>
                  </div>

                  {/* Next level XP progress bar */}
                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-indigo-200/85 tabular-nums">
                      <span>التقدم نحو Lv.{displayedLevel + 1}</span>
                      <span className="font-mono-num text-sky-300 font-bold">
                        {formatFullGold(progress.xp)} / {formatFullGold(progress.requiredXp)} XP
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-black/50 border border-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-violet-500 via-indigo-400 to-sky-400 transition-all duration-300"
                        style={{ width: `${Math.max(8, progress.percent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 w-full space-y-2.5">
                  <button
                    type="button"
                    onClick={() => shareLevelAchievementInRoom(displayedLevel)}
                    className="group relative w-full min-h-[48px] px-5 py-3 rounded-2xl p-[1.5px] overflow-hidden shadow-[0_10px_30px_rgba(99,102,241,0.58)] active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-1/2 animate-purple-blue-ring"
                    />
                    <span className="relative z-10 w-full h-full min-h-[45px] px-4 rounded-[14px] bg-gradient-to-l from-violet-600 via-indigo-600 to-blue-600 group-hover:from-violet-500 group-hover:via-indigo-500 group-hover:to-blue-500 text-white font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 whitespace-nowrap transition-colors">
                      <Share2 className="w-4 h-4 shrink-0" />
                      <span>مشاركة الإنجاز</span>
                    </span>
                  </button>

                  <p className="text-[11px] text-indigo-200/75">
                    {activeRoomId
                      ? 'سيتم نشر إعلان ترقيتك فوراً داخل دردشة الغرفة الحالية'
                      : 'سيتم نشر إعلان ترقيتك والانتقال مباشرة إلى الغرفة الصوتية'}
                  </p>

                  <button
                    type="button"
                    onClick={dismissLevelUpModal}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    متابعة لاحقاً
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
