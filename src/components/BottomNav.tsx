import React from 'react';
import { Home, Gamepad2, Compass, MessageCircle, Smile } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MainTab } from '../types';

const MOBILE_TABS: Array<{
  id: MainTab;
  label: string;
  icon: React.FC<{ className?: string }>;
  hasDot?: boolean;
}> = [
  { id: 'rooms', label: 'الغرفة', icon: Home },
  { id: 'games', label: 'لعبة', icon: Gamepad2 },
  { id: 'square', label: 'ساحة', icon: Compass },
  { id: 'messages', label: 'الرسائل', icon: MessageCircle, hasDot: true },
  { id: 'me', label: 'أنا', icon: Smile },
];

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, setActiveRoomId } = useApp();

  const handleSelect = (tab: MainTab) => {
    if (tab !== 'games') {
      setActiveRoomId(null);
    }
    setActiveTab(tab);
  };

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.05)]"
    >
      <div className="grid grid-cols-5 h-full max-w-lg mx-auto">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelect(tab.id)}
              className={`group relative min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                active ? 'text-violet-700' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <span className="relative flex items-center justify-center">
                {active ? (
                  <span className="relative w-8 h-8 rounded-full p-[2px] overflow-hidden shadow-[0_2px_14px_rgba(139,92,246,0.55)] flex items-center justify-center">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
                    <span className="relative z-10 w-full h-full rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white border border-white/80 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </span>
                  </span>
                ) : (
                  <span className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-violet-500/80 via-white to-purple-500/80 shadow-[0_1px_6px_rgba(124,58,237,0.16)] flex items-center justify-center transition-transform group-hover:scale-105">
                    <span className="w-full h-full rounded-full bg-white text-violet-600 flex items-center justify-center">
                      <Icon className="w-4 h-4 shrink-0" />
                    </span>
                  </span>
                )}

                {tab.hasDot && (
                  <span className="z-20 absolute -top-0.5 -left-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </span>

              <span
                className={`text-[11px] whitespace-nowrap leading-none ${
                  active ? 'font-extrabold text-violet-700' : 'font-semibold text-slate-600'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
