import React from 'react';
import { CheckCircle2, Crown, Diamond, Sparkles, Zap, ShoppingBag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { STORE_PACKAGES } from '../data/seedData';
import { StorePackage } from '../types';
import { formatFullGold } from '../utils/format';

const THEME_CLASSES: Record<StorePackage['accentTheme'], string> = {
  amber: 'from-[#3B1D8E] via-[#261663] to-[#131038] border-violet-400/50',
  purple: 'from-[#4C1D95] via-[#31176B] to-[#161038] border-purple-400/55',
  crimson: 'from-[#1E3A8A] via-[#1E1B4B] to-[#131038] border-blue-400/50',
  emerald: 'from-[#581C87] via-[#1D4ED8]/60 to-[#0F0B28] border-sky-400/50',
};

export const StoreView: React.FC = () => {
  const { currentUser, purchaseStorePackage, setActiveEntry } = useApp();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-violet-600" />
            <span>المتجر الملكي وباقات الشحن الفاخرة</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            اشحن الذهب والماسات الملكية مع سيارات ويخوت الدخول 3D الفورية
          </p>
        </div>

        <div className="text-xs text-slate-700 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 font-mono-num">
          الدخولية النشطة: <span className="text-violet-700 font-bold">{currentUser.activeEntry || 'القياسية'}</span>
        </div>
      </div>

      {/* Store Packages Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {STORE_PACKAGES.map((pkg) => (
          <article
            key={pkg.id}
            className={`rounded-3xl bg-gradient-to-br ${THEME_CLASSES[pkg.accentTheme]} border p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-xl`}
          >
            <div className="space-y-4">
              {/* Top Title & Tag */}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-display font-extrabold text-white leading-snug">
                  {pkg.name}
                </h2>
                {pkg.badgeText && (
                  <span className="px-3 py-1 rounded-full bg-gradient-to-l from-violet-500 to-blue-500 text-white text-[11px] font-extrabold whitespace-nowrap shrink-0 shadow-md shadow-violet-600/30">
                    {pkg.badgeText}
                  </span>
                )}
              </div>

              {/* Gold & Bonus Highlight */}
              <div className="space-y-1.5">
                <div className="text-2xl sm:text-3xl font-mono-num font-extrabold text-sky-200">
                  {formatFullGold(pkg.gold)} <span className="text-base font-display">ذهب</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-300 font-mono-num">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>+ {formatFullGold(pkg.bonusGold)} ذهب بونص مجاني فوري!</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-sky-300 font-mono-num">
                  <Diamond className="w-4 h-4 shrink-0" />
                  <span>+ {formatFullGold(pkg.diamonds)} ماسة ملكية</span>
                </div>
              </div>

              {/* Perks list */}
              <ul className="space-y-2 pt-2 border-t border-white/10">
                {pkg.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-xs sm:text-sm text-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price & Instant Recharge CTA */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={() => purchaseStorePackage(pkg)}
                className="flex-1 h-12 rounded-2xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>شحن فوري لحسابي</span>
              </button>

              <div className="text-left shrink-0">
                <div className="text-[11px] text-slate-300">السعر:</div>
                <div className="text-xl sm:text-2xl font-mono-num font-extrabold text-white">
                  ${pkg.priceUsd}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Owned Luxury Entries Showcase */}
      <section className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-display font-bold text-white mb-3">
          <Crown className="w-4 h-4 text-sky-400" />
          <span>مقتنيات الدخول 3D في محفظتك ({currentUser.ownedEntries.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentUser.ownedEntries.length === 0 ? (
            <span className="text-xs text-slate-400">
              اشحن أي باقة فاخرة أعلاه لفتح سيارات ويخوت الدخول 3D تلقائياً.
            </span>
          ) : (
            currentUser.ownedEntries.map((entry) => {
              const isEquipped = currentUser.activeEntry === entry;
              return (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setActiveEntry(entry)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    isEquipped
                      ? 'bg-gradient-to-l from-violet-600 to-blue-500 border-sky-300/60 text-white shadow'
                      : 'bg-[#201652] hover:bg-[#2A1E6B] border-blue-400/35 text-sky-200'
                  }`}
                >
                  {entry} {isEquipped ? '✓' : ''}
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
