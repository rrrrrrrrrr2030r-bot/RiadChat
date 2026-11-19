import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Crown, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ROYAL_DRAGON_PATH } from '../data/seedData';

export const RoyalDragonOverlay: React.FC = () => {
  const { dragonOverlayActive, dragonBannerText, toasts } = useApp();

  return (
    <>
      <AnimatePresence>
        {dragonOverlayActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.78, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              className="max-w-md w-full rounded-3xl bg-gradient-to-b from-[#251754] to-[#0E0B26] border border-blue-400/60 p-6 text-center shadow-2xl"
            >
              <div className="relative w-44 h-44 mx-auto mb-4 rounded-2xl overflow-hidden border border-violet-400/50 bg-black">
                <img
                  src={ROYAL_DRAGON_PATH}
                  alt="التنين الملكي"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="inline-flex items-center gap-1.5 text-sky-300 font-display font-bold text-sm mb-1">
                <Crown className="w-4 h-4 text-violet-300" />
                <span>الهدية الملكية الكبرى</span>
                <Sparkles className="w-4 h-4 text-sky-300" />
              </div>
              <h3 className="text-xl font-display font-extrabold text-white mb-2 text-balance">
                {dragonBannerText}
              </h3>
              <p className="text-xs text-slate-300">
                تم تعميم أنيميشن التنين الملكي على كافة الغرف الصوتية في رياض شات
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast stack */}
      <div className="fixed top-16 left-4 right-4 sm:left-6 sm:right-auto sm:w-88 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const toneStyles =
              toast.tone === 'error'
                ? 'bg-rose-950/95 border-rose-500/60 text-rose-100'
                : toast.tone === 'warning'
                ? 'bg-violet-950/95 border-violet-400/60 text-violet-100'
                : toast.tone === 'info'
                ? 'bg-blue-950/95 border-blue-400/60 text-blue-100'
                : 'bg-indigo-950/95 border-sky-400/60 text-sky-100';
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium shadow-xl backdrop-blur-md ${toneStyles}`}
              >
                {toast.text}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
};
