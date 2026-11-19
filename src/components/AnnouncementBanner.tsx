import React from 'react';
import { Megaphone, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AnnouncementBanner: React.FC = () => {
  const { state } = useApp();

  if (state.maintenanceMode) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">
            وضع الصيانة العامة مُفعل حالياً — الغرف الصوتية متوقفة مؤقتاً لإجراء التحديثات
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#EEFBF3] border-b border-emerald-200/70 text-slate-700 px-4 py-1.5 text-xs">
      <div className="max-w-7xl mx-auto flex items-center gap-2.5 overflow-hidden">
        <span className="flex items-center gap-1 text-emerald-700 font-bold whitespace-nowrap shrink-0">
          <Megaphone className="w-3.5 h-3.5" />
          إعلان مباشر
        </span>
        <span className="text-emerald-400" aria-hidden="true">|</span>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <p className="truncate text-slate-700" title={state.globalAnnouncement}>
            {state.globalAnnouncement}
          </p>
        </div>
      </div>
    </div>
  );
};
