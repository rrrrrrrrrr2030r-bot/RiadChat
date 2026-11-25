import React, { useEffect, useState } from 'react';
import {
  Activity,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Lock,
  Mic,
  Minimize2,
  Moon,
  Palette,
  Power,
  RefreshCw,
  Settings,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { forceRefreshApp } from '../utils/cacheBuster';
import {
  APP_ICON_PATH,
  AVATAR_AHMED_PATH,
  AVATAR_NAWAF_PATH,
  AVATAR_RIAD_PATH,
  COVER_GENTLEMAN_PATH,
  COVER_OCEAN_PATH,
  COVER_SUV_PATH,
  ROOM_THEMES,
} from '../data/seedData';
import { RoomThemeId, VisitorChatRequirement, VoiceRoom } from '../types';

export type RoomControlSheet = 'none' | 'quick-menu' | 'settings' | 'mics' | 'themes';

interface RoomSettingsModalProps {
  room: VoiceRoom;
  sheet: RoomControlSheet;
  onChangeSheet: (sheet: RoomControlSheet) => void;
  onOpenInsight?: (drawer: 'engagement' | 'hosts') => void;
  onPreviewSleep?: () => void;
  onClose: () => void;
}

const MIC_COUNT_ROWS: number[][] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 15, 16],
  [17, 18, 20],
];

const COVER_PRESETS = [
  { label: 'غلاف كلاسيكي', src: COVER_GENTLEMAN_PATH },
  { label: 'سيارة صحراوية', src: COVER_SUV_PATH },
  { label: 'محيط ليلي', src: COVER_OCEAN_PATH },
  { label: 'صورة رياض', src: AVATAR_RIAD_PATH },
  { label: 'شعار المنصة', src: APP_ICON_PATH },
];

const CHAT_REQ_LABELS: Record<VisitorChatRequirement, string> = {
  disallowed: 'غير مسموح',
  all: 'مسموح للجميع',
  lv5: 'المستوى 5+',
  lv10: 'المستوى 10+',
};

const GreenToggle: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0 ${
      checked ? 'bg-[#1AD068]' : 'bg-[#2C2C30]'
    }`}
  >
    <span
      className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
        checked ? 'right-0.5' : 'left-0.5'
      }`}
    />
  </button>
);

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  room,
  sheet,
  onChangeSheet,
  onOpenInsight,
  onPreviewSleep,
  onClose,
}) => {
  const {
    state,
    currentUser,
    isPrimaryAdmin,
    minimizeRoom,
    setActiveRoomId,
    updateRoomSettings,
    toggleRoomBanUser,
    deleteVoiceRoom,
    boostRoomHeat,
    showToast,
  } = useApp();

  const canManage =
    isPrimaryAdmin ||
    currentUser.role === 'SUPERVISOR' ||
    room.ownerId === currentUser.id;

  // Mic count & decoration preview drafts
  const [draftMics, setDraftMics] = useState<number>(room.totalMics || 20);
  const [draftThemeFilter, setDraftThemeFilter] = useState<boolean>(
    room.useThemeFilter ?? true
  );

  // Sub-editor states inside Settings
  type SettingsEditor =
    | null
    | 'cover'
    | 'title'
    | 'description'
    | 'welcome'
    | 'password'
    | 'dice'
    | 'membership'
    | 'visitorChat'
    | 'boost'
    | 'banList'
    | 'deleteConfirm';

  const [editor, setEditor] = useState<SettingsEditor>(null);
  const [textDraft, setTextDraft] = useState('');
  const [numDraft, setNumDraft] = useState<number>(1);
  const [customCoverUrl, setCustomCoverUrl] = useState('');

  useEffect(() => {
    setDraftMics(room.totalMics || 20);
    setDraftThemeFilter(room.useThemeFilter ?? true);
  }, [room.id, room.totalMics, room.useThemeFilter, sheet]);

  if (sheet === 'none') return null;

  const sampleAvatars = [
    room.ownerAvatar,
    AVATAR_RIAD_PATH,
    AVATAR_AHMED_PATH,
    AVATAR_NAWAF_PATH,
    COVER_OCEAN_PATH,
    COVER_SUV_PATH,
    COVER_GENTLEMAN_PATH,
  ];

  const handleOpenManaged = (target: 'settings' | 'mics' | 'themes') => {
    if (!canManage) {
      showToast('هذه الصلاحية مخصصة لمالك الغرفة أو المشرفين فقط', 'warning');
      return;
    }
    onChangeSheet(target);
  };

  // 1) QUICK MENU (6 Circular Green Buttons — Screenshot Farah_96b07a56)
  if (sheet === 'quick-menu') {
    const items = [
      {
        id: 'themes',
        label: 'الموضوعات',
        icon: Palette,
        onClick: () => handleOpenManaged('themes'),
      },
      {
        id: 'mics',
        label: 'زخرفة',
        icon: Mic,
        onClick: () => handleOpenManaged('mics'),
      },
      {
        id: 'settings',
        label: 'إعدادات الغرفة',
        icon: Settings,
        onClick: () => handleOpenManaged('settings'),
      },
      {
        id: 'share',
        label: 'المشاركة',
        icon: Share2,
        onClick: () => {
          const shareText = `انضم معي الآن إلى غرفة «${room.title}» (ID:${room.ownerId}) على رياض شات!`;
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(shareText).catch(() => {});
          }
          showToast('تم نسخ رابط ودعوة الغرفة للمشاركة!', 'success');
          onClose();
        },
      },
      {
        id: 'keep',
        label: 'احتفظ',
        icon: Minimize2,
        onClick: () => {
          onClose();
          minimizeRoom();
        },
      },
      {
        id: 'leave',
        label: 'مغادرة',
        icon: Power,
        onClick: () => {
          onClose();
          setActiveRoomId(null);
        },
      },
    ];

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090418]/78 backdrop-blur-md px-6">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm space-y-8">
          <div className="grid grid-cols-3 gap-y-8 gap-x-5 place-items-center">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="flex flex-col items-center gap-3 group cursor-pointer focus:outline-none"
                >
                  <span className="relative w-[74px] h-[74px] rounded-full p-[3px] overflow-hidden shadow-[0_0_24px_rgba(147,51,234,0.68)] group-hover:scale-105 group-active:scale-95 transition-transform">
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
                    <span className="relative z-10 w-full h-full rounded-full bg-gradient-to-b from-[#4C1D95] via-[#311068] to-[#1A083E] border border-white/25 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)]">
                      <Icon className="w-8 h-8 text-white stroke-[2.1] drop-shadow-[0_2px_8px_rgba(255,255,255,0.45)]" />
                    </span>
                  </span>
                  <span className="text-xs font-display font-extrabold text-white tracking-wide drop-shadow">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {isPrimaryAdmin && onOpenInsight && (
            <div className="pt-2 border-t border-white/15 space-y-2.5">
              <div className="text-center text-[11px] font-bold text-violet-200/85">
                تحليلات ومراقبة الإدارة الأساسية (ID: 900)
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInsight('engagement');
                  }}
                  className="min-h-[46px] px-3 py-2 rounded-2xl bg-gradient-to-l from-violet-700/80 via-[#221258]/90 to-blue-700/80 hover:brightness-115 border border-violet-300/35 text-xs font-display font-bold text-white flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(99,102,241,0.35)] cursor-pointer transition-all"
                >
                  <Activity className="w-4 h-4 text-sky-300 shrink-0" />
                  <span>نبض التفاعل</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInsight('hosts');
                  }}
                  className="min-h-[46px] px-3 py-2 rounded-2xl bg-[#18103E]/90 hover:bg-[#23175A] border border-indigo-400/35 text-xs font-display font-bold text-white flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(79,70,229,0.28)] cursor-pointer transition-all"
                >
                  <Users className="w-4 h-4 text-violet-300 shrink-0" />
                  <span>المضيفون النشطون</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2) MIC COUNT & DECORATION SCREEN (عدد الميكروفون و الزخرفة — Farah_7124294d)
  if (sheet === 'mics') {
    const previewList = Array.from({ length: draftMics }, (_, i) => {
      const seat = room.seats[i];
      return {
        num: i + 1,
        avatar: seat?.avatar || sampleAvatars[i % sampleAvatars.length],
      };
    });

    return (
      <div className="fixed inset-0 z-50 bg-[#141416] text-white flex flex-col">
        {/* Top bar */}
        <header className="h-14 px-4 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <button
            type="button"
            onClick={() => onChangeSheet('settings')}
            aria-label="رجوع"
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-base font-display font-extrabold">عدد الميكروفون</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Pill grid: 1..20 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-display font-bold">
              <span className="w-1 h-4 rounded-full bg-[#1AD068]" />
              <span>عدد الميكروفون</span>
            </div>

            <div className="space-y-2.5">
              {MIC_COUNT_ROWS.map((row, rIdx) => (
                <div
                  key={rIdx}
                  className={
                    row.length === 5
                      ? 'grid grid-cols-5 gap-2.5'
                      : 'flex items-center justify-center gap-2.5'
                  }
                >
                  {row.map((num) => {
                    const active = draftMics === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDraftMics(num)}
                        className={`h-8 rounded-full font-mono-num text-xs font-bold transition-all cursor-pointer ${
                          row.length < 5 ? 'w-[18.5%] min-w-[54px]' : 'w-full'
                        } ${
                          active
                            ? 'bg-[#1D2B22] border border-[#1AD068] text-white shadow-[0_0_12px_rgba(26,208,104,0.35)]'
                            : 'bg-[#252528] border border-transparent text-slate-300 hover:bg-[#2F2F34]'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Decoration Live Stage Preview */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 text-sm font-display font-bold">
              <span className="w-1 h-4 rounded-full bg-[#1AD068]" />
              <span>زخرفة</span>
            </div>

            <div className="relative mx-auto max-w-[270px] rounded-2xl bg-gradient-to-b from-[#139B3D] via-[#077629] to-[#02551C] p-4 border border-emerald-400/25 shadow-xl overflow-hidden">
              {/* Decorative subtle geometric grid overlay & corner crescents */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1 right-2 text-emerald-200/35 text-2xl select-none"
              >
                🌙✨
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1 left-2 text-emerald-200/35 text-2xl select-none"
              >
                ✨🌙
              </div>

              <div className="relative z-10 grid grid-cols-5 gap-2.5 place-items-center py-2">
                {previewList.map((item) => (
                  <div
                    key={item.num}
                    className="w-9 h-9 rounded-full overflow-hidden border border-white/60 shadow-sm bg-black/30"
                  >
                    <img
                      src={item.avatar}
                      alt={`مقعد ${item.num}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              <div className="relative z-10 mt-3 flex justify-center">
                <span className="px-4 py-1.5 rounded-xl bg-black/45 text-white font-mono-num text-xs font-extrabold">
                  2000
                </span>
              </div>
            </div>

            {/* Checkbox row */}
            <label className="flex items-center justify-center gap-2.5 pt-2 cursor-pointer select-none">
              <span className="text-xs font-bold text-slate-200">استخدم موضوع مرشح</span>
              <button
                type="button"
                role="checkbox"
                aria-checked={draftThemeFilter}
                onClick={() => setDraftThemeFilter((v) => !v)}
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                  draftThemeFilter
                    ? 'bg-[#1AD068] border-[#1AD068] text-white'
                    : 'bg-transparent border-slate-500'
                }`}
              >
                {draftThemeFilter && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
            </label>
          </div>
        </div>

        {/* Bottom emerald Confirm bar */}
        <div className="p-3 bg-[#141416] border-t border-white/[0.06] shrink-0">
          <button
            type="button"
            onClick={() => {
              updateRoomSettings(room.id, {
                totalMics: draftMics,
                useThemeFilter: draftThemeFilter,
              });
              showToast(`تم تحديث عدد المايكات إلى ${draftMics} مقعد بنجاح!`, 'success');
              onClose();
            }}
            className="w-full h-12 rounded-xl bg-[#00C853] hover:bg-[#00DF5D] text-white font-display font-extrabold text-sm cursor-pointer shadow-lg transition-colors"
          >
            تأكيد
          </button>
        </div>
      </div>
    );
  }

  // 3) THEMES PICKER (الموضوعات)
  if (sheet === 'themes') {
    const activeTheme = room.themeId || 'ocean-stars';
    return (
      <div className="fixed inset-0 z-50 bg-[#141416] text-white flex flex-col">
        <header className="h-14 px-4 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <button
            type="button"
            onClick={() => onChangeSheet('settings')}
            aria-label="رجوع"
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-base font-display font-extrabold">الموضوعات</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 content-start">
          {ROOM_THEMES.map((theme) => {
            const isSelected = activeTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  updateRoomSettings(room.id, { themeId: theme.id as RoomThemeId });
                  showToast(`تم تطبيق ثيم «${theme.name}» على الغرفة`, 'success');
                  onClose();
                }}
                className={`relative rounded-2xl overflow-hidden text-right border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#1AD068] shadow-[0_0_20px_rgba(26,208,104,0.35)]'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className={`h-28 bg-gradient-to-b ${theme.previewBg} relative p-3 flex flex-col justify-between`}>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-black/45 text-[10px] font-bold">
                      {isSelected ? 'نشط الآن ✓' : 'اختيار الثيم'}
                    </span>
                    <span className="text-xs opacity-80">20 مايك</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-6 h-6 rounded-full border border-amber-300/80 bg-black/30"
                      />
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-[#1E1E22] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-display font-bold">{theme.name}</div>
                    <div className="text-[11px] text-slate-400">{theme.subtitle}</div>
                  </div>
                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-[#1AD068] text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 4) COMPREHENSIVE DARK ROOM SETTINGS PANEL (16 CONTROLS — Farah_ea5ca8ef & Farah_e9488219)
  const currentThemeName =
    ROOM_THEMES.find((t) => t.id === (room.themeId || 'ocean-stars'))?.name || 'موجة البحر';

  return (
    <div className="fixed inset-0 z-50 bg-[#141416] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between border-b border-white/[0.06] shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="رجوع إلى الغرفة"
          className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <h2 className="text-base font-display font-extrabold">إعدادات الغرفة</h2>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06] pb-8">
        {/* 1. صورة الواجهة */}
        <button
          type="button"
          onClick={() => {
            setCustomCoverUrl('');
            setEditor('cover');
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white">صورة الواجهة</span>
          <img
            src={room.coverImage || room.ownerAvatar}
            alt={room.title}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-lg object-cover border border-white/15"
          />
        </button>

        {/* 2. اسم الغرفة */}
        <button
          type="button"
          onClick={() => {
            setTextDraft(room.title);
            setEditor('title');
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white shrink-0">اسم الغرفة</span>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs min-w-0">
            <span className="truncate max-w-[185px]">{room.title}</span>
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </div>
        </button>

        {/* 3. الإعلان */}
        <button
          type="button"
          onClick={() => {
            setTextDraft(room.description);
            setEditor('description');
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white shrink-0">الإعلان</span>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs min-w-0">
            <span className="truncate max-w-[195px]">{room.description}</span>
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </div>
        </button>

        {/* 4. الترحيب التلقائي */}
        <button
          type="button"
          onClick={() => {
            setTextDraft(room.welcomeMessage ?? 'ارحبووو');
            setEditor('welcome');
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white shrink-0">الترحيب التلقائي</span>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs min-w-0">
            <span className="truncate max-w-[180px]">{room.welcomeMessage || 'ارحبووو'}</span>
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </div>
        </button>

        {/* 5. الموضوعات */}
        <button
          type="button"
          onClick={() => onChangeSheet('themes')}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white shrink-0">الموضوعات</span>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <span>{currentThemeName}</span>
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </div>
        </button>

        {/* 6. كلمة مرور الغرفة */}
        <button
          type="button"
          onClick={() => {
            setTextDraft('');
            setEditor('password');
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white shrink-0">كلمة مرور الغرفة</span>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <span>{room.hasPassword || room.password ? '••••' : ''}</span>
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </div>
        </button>

        {/* 7. عدد الميكروفون */}
        <button
          type="button"
          onClick={() => onChangeSheet('mics')}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white shrink-0">عدد الميكروفون</span>
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-mono-num font-bold">
            <span>{room.totalMics}</span>
            <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
        </button>

        {/* 8. عدد النرد الرمي كل مرة */}
        <button
          type="button"
          onClick={() => {
            setNumDraft(room.diceCount ?? 1);
            setEditor('dice');
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white shrink-0">عدد النرد الرمي كل مرة</span>
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-mono-num font-bold">
            <span>{room.diceCount ?? 1}</span>
            <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
        </button>

        {/* 9. إشتراكات العضوية */}
        <button
          type="button"
          onClick={() => {
            setNumDraft(room.membershipCount ?? 0);
            setEditor('membership');
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white shrink-0">إشتراكات العضوية</span>
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-mono-num font-bold">
            <span>{room.membershipCount ?? 0}</span>
            <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
        </button>

        {/* 10. يسمح للأعضاء فقط بالدخول */}
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-white">يسمح للأعضاء فقط بالدخول</span>
          <GreenToggle
            checked={Boolean(room.membersOnlyEntry)}
            onChange={(val) => {
              updateRoomSettings(room.id, { membersOnlyEntry: val });
              showToast(
                val ? 'تم قصر الدخول على الأعضاء فقط' : 'تم السماح للجميع بدخول الغرفة',
                'info'
              );
            }}
            label="يسمح للأعضاء فقط بالدخول"
          />
        </div>

        {/* 11. الإذن زوار على خط المكالمة */}
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-white">الإذن زوار على خط المكالمة</span>
          <GreenToggle
            checked={room.allowVisitorsOnMic !== false}
            onChange={(val) => {
              updateRoomSettings(room.id, { allowVisitorsOnMic: val });
              showToast(
                val ? 'تم السماح للزوار بالصعود على المايك' : 'تم إغلاق الصعود على المايك للزوار',
                'info'
              );
            }}
            label="الإذن زوار على خط المكالمة"
          />
        </div>

        {/* 12. أرسل الايموجي إلى منطقة الدردشة */}
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-white">أرسل الايموجي إلى منطقة الدردشة</span>
          <GreenToggle
            checked={Boolean(room.sendEmojiToChat)}
            onChange={(val) => {
              updateRoomSettings(room.id, { sendEmojiToChat: val });
              showToast(
                val ? 'سيتم إظهار الإيموجي داخل منطقة الدردشة' : 'تم إيقاف عرض الإيموجي بالدردشة',
                'info'
              );
            }}
            label="أرسل الايموجي إلى منطقة الدردشة"
          />
        </div>

        {/* 13. وضع السكون التلقائي للبطارية (5 دقائق) */}
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-sky-300 shrink-0" />
              <span>وضع السكون التلقائي (5 دقائق)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              تعتيم الشاشة وتخفيف إضاءة الأيقونات تلقائياً عند انقطاع الصوت لتوفير البطارية
            </p>
          </div>
          <GreenToggle
            checked={room.autoSleepEnabled !== false}
            onChange={(val) => {
              updateRoomSettings(room.id, { autoSleepEnabled: val });
              showToast(
                val
                  ? 'تم تفعيل وضع السكون التلقائي بعد 5 دقائق من الصمت'
                  : 'تم إيقاف وضع السكون التلقائي في هذه الغرفة',
                'info'
              );
            }}
            label="وضع السكون التلقائي"
          />
        </div>

        {onPreviewSleep && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onPreviewSleep();
            }}
            className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <span className="text-sm font-medium text-sky-300 flex items-center gap-2">
              <Moon className="w-4 h-4" />
              <span>معاينة وضع السكون وتعتيم الشاشة الآن</span>
            </span>
            <ChevronLeft className="w-4 h-4 text-sky-300 shrink-0" />
          </button>
        )}

        {isPrimaryAdmin && onOpenInsight && (
          <>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInsight('engagement');
              }}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-300" />
                <span>نبض التفاعل اللحظي (الرسم البياني)</span>
              </span>
              <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInsight('hosts');
              }}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-300" />
                <span>المضيفون النشطون</span>
              </span>
              <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </>
        )}

        {/* 14. الزائر أرسل متطلبات مستوى الرسائل */}
        <button
          type="button"
          onClick={() => setEditor('visitorChat')}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white">
            الزائر أرسل متطلبات مستوى الرسائل
          </span>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <span>{CHAT_REQ_LABELS[room.visitorChatRequirement || 'all']}</span>
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </div>
        </button>

        {/* 14. دعم الغرفة (للإدارة الأساسية ID: 900 فقط) */}
        {isPrimaryAdmin && (
          <button
            type="button"
            onClick={() => setEditor('boost')}
            className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <span className="text-sm font-medium text-white">دعم الغرفة</span>
            <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        )}

        {/* 15. قائمة الحظر */}
        <button
          type="button"
          onClick={() => setEditor('banList')}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white">قائمة الحظر</span>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            {(room.bannedUserIds?.length || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono-num text-[11px]">
                {room.bannedUserIds?.length}
              </span>
            )}
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </div>
        </button>

        {/* تحديث التطبيق ومسح الكاش القديم */}
        <button
          type="button"
          onClick={() => {
            showToast('جارٍ مسح التخزين المؤقت وتحميل أحدث نسخة من رياض شات...', 'info');
            void forceRefreshApp();
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-sky-500/10 transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-sky-300 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            <span>تحديث التطبيق ومسح الكاش</span>
          </span>
          <ChevronLeft className="w-4 h-4 text-sky-300 shrink-0" />
        </button>

        {/* 16. حذف هذه الغرف */}
        <button
          type="button"
          onClick={() => setEditor('deleteConfirm')}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-rose-400">حذف هذه الغرف</span>
          <ChevronLeft className="w-4 h-4 text-rose-400 shrink-0" />
        </button>
      </div>

      {/* Inline Dialogs for each setting field */}
      {editor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#1E1E22] border border-white/10 p-5 space-y-4 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-extrabold">
                {editor === 'cover' && 'تغيير صورة الواجهة'}
                {editor === 'title' && 'تعديل اسم الغرفة'}
                {editor === 'description' && 'تعديل إعلان الغرفة'}
                {editor === 'welcome' && 'رسالة الترحيب التلقائي'}
                {editor === 'password' && 'كلمة مرور الغرفة'}
                {editor === 'dice' && 'عدد النرد الرمي كل مرة'}
                {editor === 'membership' && 'إشتراكات العضوية'}
                {editor === 'visitorChat' && 'متطلبات مستوى رسائل الزائر'}
                {editor === 'boost' && 'دعم وترويج الغرفة'}
                {editor === 'banList' && 'إدارة قائمة الحظر للغرفة'}
                {editor === 'deleteConfirm' && 'تأكيد حذف الغرفة'}
              </h3>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editor === 'cover' && (
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  {COVER_PRESETS.map((p) => (
                    <button
                      key={p.src}
                      type="button"
                      onClick={() => {
                        updateRoomSettings(room.id, { coverImage: p.src });
                        showToast(`تم تغيير واجهة الغرفة إلى «${p.label}»`, 'success');
                        setEditor(null);
                      }}
                      className="rounded-xl overflow-hidden border-2 border-white/15 hover:border-[#1AD068] aspect-square cursor-pointer"
                    >
                      <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  value={customCoverUrl}
                  onChange={(e) => setCustomCoverUrl(e.target.value)}
                  placeholder="أو ضع رابط صورة مخصصة..."
                  className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/15 text-xs focus:outline-none focus:border-[#1AD068]"
                />
                {customCoverUrl.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      updateRoomSettings(room.id, { coverImage: customCoverUrl.trim() });
                      showToast('تم تحديث صورة الواجهة', 'success');
                      setEditor(null);
                    }}
                    className="w-full h-10 rounded-xl bg-[#1AD068] text-white font-bold text-xs cursor-pointer"
                  >
                    حفظ الصورة
                  </button>
                )}
              </div>
            )}

            {(editor === 'title' || editor === 'description' || editor === 'welcome') && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-black/45 border border-white/15 text-sm focus:outline-none focus:border-[#1AD068]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editor === 'title' && textDraft.trim()) {
                      updateRoomSettings(room.id, { title: textDraft.trim() });
                    } else if (editor === 'description') {
                      updateRoomSettings(room.id, { description: textDraft.trim() });
                    } else if (editor === 'welcome') {
                      updateRoomSettings(room.id, { welcomeMessage: textDraft.trim() || 'ارحبووو' });
                    }
                    showToast('تم حفظ التعديل بنجاح', 'success');
                    setEditor(null);
                  }}
                  className="w-full h-11 rounded-xl bg-[#1AD068] text-white font-bold text-sm cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            )}

            {editor === 'password' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>اترك الحقل فارغاً لإلغاء القفل وفتح الغرفة للجميع</span>
                </div>
                <input
                  type="text"
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  placeholder="مثال: 9000"
                  className="w-full h-11 px-3 rounded-xl bg-black/45 border border-white/15 font-mono-num text-sm focus:outline-none focus:border-[#1AD068]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateRoomSettings(room.id, { password: '' });
                      showToast('تم إلغاء كلمة مرور الغرفة', 'info');
                      setEditor(null);
                    }}
                    className="h-10 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold cursor-pointer"
                  >
                    إلغاء القفل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateRoomSettings(room.id, { password: textDraft.trim() });
                      showToast(
                        textDraft.trim() ? 'تم تفعيل كلمة مرور الغرفة' : 'تم إلغاء كلمة مرور الغرفة',
                        'success'
                      );
                      setEditor(null);
                    }}
                    className="h-10 rounded-xl bg-[#1AD068] text-white text-xs font-bold cursor-pointer"
                  >
                    تأكيد
                  </button>
                </div>
              </div>
            )}

            {editor === 'dice' && (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      updateRoomSettings(room.id, { diceCount: n });
                      showToast(`تم ضبط رمي النرد إلى ${n} في كل مرة`, 'success');
                      setEditor(null);
                    }}
                    className={`h-12 rounded-xl font-mono-num font-extrabold text-sm cursor-pointer border ${
                      (room.diceCount ?? 1) === n
                        ? 'bg-[#1AD068]/20 border-[#1AD068] text-[#1AD068]'
                        : 'bg-black/35 border-white/10'
                    }`}
                  >
                    🎲 ×{n}
                  </button>
                ))}
              </div>
            )}

            {editor === 'membership' && (
              <div className="space-y-3">
                <input
                  type="number"
                  min={0}
                  value={numDraft}
                  onChange={(e) => setNumDraft(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full h-11 px-3 rounded-xl bg-black/45 border border-white/15 font-mono-num text-sm focus:outline-none focus:border-[#1AD068]"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateRoomSettings(room.id, { membershipCount: numDraft });
                    showToast('تم تحديث إشتراكات العضوية للغرفة', 'success');
                    setEditor(null);
                  }}
                  className="w-full h-11 rounded-xl bg-[#1AD068] text-white font-bold text-sm cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            )}

            {editor === 'visitorChat' && (
              <div className="space-y-2">
                {(['disallowed', 'all', 'lv5', 'lv10'] as VisitorChatRequirement[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      updateRoomSettings(room.id, { visitorChatRequirement: opt });
                      showToast(`تم ضبط الدردشة: ${CHAT_REQ_LABELS[opt]}`, 'success');
                      setEditor(null);
                    }}
                    className={`w-full h-11 px-4 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer border ${
                      (room.visitorChatRequirement || 'all') === opt
                        ? 'bg-[#1AD068]/15 border-[#1AD068] text-white'
                        : 'bg-black/35 border-white/10 text-slate-300'
                    }`}
                  >
                    <span>{CHAT_REQ_LABELS[opt]}</span>
                    {(room.visitorChatRequirement || 'all') === opt && (
                      <Check className="w-4 h-4 text-[#1AD068]" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {editor === 'boost' && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-300">
                  ادعم تصدّر الغرفة في الترتيب العام بزيادة الحرارة المباشرة:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '+500K', val: 500_000 },
                    { label: '+2.5M', val: 2_500_000 },
                    { label: '+10M', val: 10_000_000 },
                  ].map((b) => (
                    <button
                      key={b.val}
                      type="button"
                      onClick={() => {
                        boostRoomHeat(room.id, b.val);
                        setEditor(null);
                      }}
                      className="h-11 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 text-amber-950 font-mono-num font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editor === 'banList' && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {state.users
                  .filter((u) => u.id !== room.ownerId)
                  .map((u) => {
                    const isBanned = room.bannedUserIds?.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/35 border border-white/10"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{u.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono-num">
                              ID:{u.id}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleRoomBanUser(room.id, u.id)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                            isBanned
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                          }`}
                        >
                          <Ban className="w-3 h-3" />
                          <span>{isBanned ? 'فك الحظر' : 'حظر'}</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {editor === 'deleteConfirm' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  هل أنت متأكد من حذف غرفة «{room.title}» نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditor(null)}
                    className="h-10 rounded-xl bg-white/10 text-xs font-bold cursor-pointer"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditor(null);
                      onClose();
                      deleteVoiceRoom(room.id);
                    }}
                    className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تأكيد الحذف</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
