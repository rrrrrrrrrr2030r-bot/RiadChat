import React, { useState } from 'react';
import {
  Activity,
  BellRing,
  Check,
  Coins,
  Copy,
  Crown,
  Flame,
  Megaphone,
  Moon,
  RotateCcw,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DiceMultiplier, GameLuckMode, ModeratorRecord } from '../types';
import { formatCompactNumber, formatFullGold } from '../utils/format';
import { RoomEngagementCard } from './RoomEngagementCard';
import { ActiveHostsPanel } from './ActiveHostsPanel';

type SystemTopTab = 'quick' | 'moderators' | 'superadmin';
type ModSubTab = 'create' | 'workspace' | 'list';
type SuperSubTab = 'settings' | 'users' | 'agencies' | 'rooms' | 'reports' | 'broadcast';

const MOD_ROLES = [
  'أدمن عام (صلاحية كاملة)',
  'مشرف غرف صوتية',
  'مراقب البلاغات والمسابقات',
  'مدير الوكالات والشحن',
];

export const SystemView: React.FC = () => {
  const {
    state,
    setActiveTab,
    setActiveRoomId,
    updateAnnouncement,
    setGameLuckMode,
    setDiceMultiplier,
    toggleMaintenanceMode,
    toggleUltraNightMode,
    grantRoyalBlessingAll,
    feedAdminTreasury,
    boostAllRoomsHeat,
    boostRoomHeat,
    triggerRoyalDragon,
    addModerator,
    toggleModeratorStatus,
    deleteModerator,
    resolveReport,
    toggleUserBan,
    verifyUserAgent,
    adjustUserGold,
    resetDemoData,
    showToast,
  } = useApp();

  const [topTab, setTopTab] = useState<SystemTopTab>('quick');
  const [modSubTab, setModSubTab] = useState<ModSubTab>('create');
  const [superSubTab, setSuperSubTab] = useState<SuperSubTab>('settings');
  const [selectedAnalyticsRoomId, setSelectedAnalyticsRoomId] = useState<string>(
    state.rooms[0]?.id || 'room-900'
  );
  const [ownerInsightTab, setOwnerInsightTab] = useState<'none' | 'engagement' | 'hosts'>('none');

  // Quick announcement input
  const [announcementInput, setAnnouncementInput] = useState('');

  // Moderator creation form
  const [modName, setModName] = useState('');
  const [modId, setModId] = useState('8775');
  const [modRole, setModRole] = useState(MOD_ROLES[0]);
  const [modWhatsapp, setModWhatsapp] = useState('775367122');
  const [modCustody, setModCustody] = useState('50000000');
  const [lastCreatedMod, setLastCreatedMod] = useState<ModeratorRecord | null>(null);

  const handleUpdateBanner = (e: React.FormEvent) => {
    e.preventDefault();
    updateAnnouncement(announcementInput);
    setAnnouncementInput('');
  };

  const handleCreateModerator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modName.trim() || !modId.trim()) {
      showToast('يرجى إدخال اسم المشرف ورقم ID المميز', 'warning');
      return;
    }
    const created = addModerator({
      name: modName.trim(),
      specialId: modId.trim(),
      role: modRole,
      whatsapp: modWhatsapp.trim(),
      custodyGold: Number(modCustody.replace(/[^\d]/g, '')) || 0,
    });
    setLastCreatedMod(created);
    setModName('');
    const nextNum = (Number(modId.replace(/[^\d]/g, '')) || 8775) + 1;
    setModId(String(nextNum));
  };

  const copyAssignmentCard = (mod: ModeratorRecord) => {
    const cardText = `👑 بطاقة تكليف رسمية — رياض شات\nالاسم: ${mod.name}\nرقم ID المميز: ${mod.specialId}\nالرتبة: ${mod.role}\nعهدة الذهب: ${formatFullGold(mod.custodyGold)} ذهب\nالحالة: نشط ومعتمد`;
    navigator.clipboard?.writeText(cardText).catch(() => {});
    showToast('تم نسخ بطاقة التكليف الفورية بنجاح!', 'success');
  };

  const sendWhatsappCard = (mod: ModeratorRecord) => {
    const cardText = encodeURIComponent(
      `👑 مرحباً ${mod.name}، تم تعيينك في منصة رياض شات!\nرقم ID المميز: ${mod.specialId}\nالصلاحية: ${mod.role}\nعهدة الذهب: ${formatFullGold(mod.custodyGold)} ذهب`
    );
    const phone = mod.whatsapp.replace(/[^\d]/g, '');
    const waLink = `https://wa.me/${phone}?text=${cardText}`;
    navigator.clipboard?.writeText(waLink).catch(() => {});
    showToast('تم تجهيز ونسخ رابط إرسال التكليف عبر واتساب!', 'info');
  };

  const pendingReportsCount = state.reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Top System Header & Switcher */}
      <div className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-display font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-sky-400" />
              <span>مركز التحكم والنظام الإداري</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              تحكم شامل وفوري في الأعضاء، الأرصدة، الغرف الصوتية، الوكالات، والمشرفين
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('agency-dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C124B] hover:bg-[#261966] border border-blue-400/50 text-sky-200 text-xs font-extrabold cursor-pointer transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>لوحة تحكم الوكالة</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-l from-violet-600 to-blue-600 text-white text-xs font-extrabold shadow-md shadow-violet-600/30">
              <Crown className="w-3.5 h-3.5" />
              <span>إدارة رياض ID: 10</span>
            </span>
          </div>
        </div>

        {/* 3 Main System Sub-Views */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setTopTab('quick')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              topTab === 'quick'
                ? 'bg-gradient-to-l from-violet-600 to-blue-600 text-white shadow-md shadow-violet-600/25'
                : 'bg-[#0F0B28] text-slate-300 hover:text-white border border-violet-500/25'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0" />
            <span className="truncate">التحكم السريع</span>
          </button>

          <button
            type="button"
            onClick={() => setTopTab('moderators')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              topTab === 'moderators'
                ? 'bg-gradient-to-l from-violet-600 to-blue-600 text-white shadow-md shadow-violet-600/25'
                : 'bg-[#0F0B28] text-slate-300 hover:text-white border border-violet-500/25'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span className="truncate">نظام المشرفين والأدمن</span>
          </button>

          <button
            type="button"
            onClick={() => setTopTab('superadmin')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              topTab === 'superadmin'
                ? 'bg-gradient-to-l from-violet-600 to-blue-600 text-white shadow-md shadow-violet-600/25'
                : 'bg-[#0F0B28] text-slate-300 hover:text-white border border-violet-500/25'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="truncate">
              الإدارة والبلاغات {pendingReportsCount > 0 ? `(${pendingReportsCount})` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: Quick System Commands (Screenshot 2) */}
      {topTab === 'quick' && (
        <div className="space-y-5">
          {/* Instant System Commands */}
          <section className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-3">
            <h2 className="text-sm sm:text-base font-display font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-sky-400" />
              <span>أوامر النظام الفورية (تطبق على كامل التطبيق بضغطة واحدة)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={grantRoyalBlessingAll}
                className="rounded-2xl bg-[#281554] hover:bg-[#331B6B] border border-violet-400/45 p-4 text-right transition-colors cursor-pointer"
              >
                <div className="font-display font-bold text-sm sm:text-base text-violet-200 flex items-center gap-2">
                  <span>🎁</span>
                  <span>مكرمة ملكية شاملة</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  إهداء +1,000,000 ذهب لكل عضو في المنصة
                </div>
              </button>

              <button
                type="button"
                onClick={() => triggerRoyalDragon('إدارة رياض الملكية')}
                className="rounded-2xl bg-[#122659] hover:bg-[#173273] border border-blue-400/45 p-4 text-right transition-colors cursor-pointer"
              >
                <div className="font-display font-bold text-sm sm:text-base text-sky-300 flex items-center gap-2">
                  <span>🐉</span>
                  <span>إطلاق التنين الملكي</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  عرض أنيميشن الهدية الكبرى بالنظام بالكامل
                </div>
              </button>

              <button
                type="button"
                onClick={feedAdminTreasury}
                className="rounded-2xl bg-[#1E1B59] hover:bg-[#262370] border border-indigo-400/45 p-4 text-right transition-colors cursor-pointer"
              >
                <div className="font-display font-bold text-sm sm:text-base text-indigo-200 flex items-center gap-2">
                  <span>💰</span>
                  <span>تغذية خزينة المدير</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  إضافة +50M ذهب لحسابك الفوري
                </div>
              </button>

              <button
                type="button"
                onClick={boostAllRoomsHeat}
                className="rounded-2xl bg-[#2E164E] hover:bg-[#3B1D63] border border-purple-400/45 p-4 text-right transition-colors cursor-pointer"
              >
                <div className="font-display font-bold text-sm sm:text-base text-purple-200 flex items-center gap-2">
                  <span>🔥</span>
                  <span>مضاعفة دعم الغرف</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  رفع حرارة ونقاط دعم كل الغرف +10M
                </div>
              </button>
            </div>
          </section>

          {/* Live Global Announcement Editor */}
          <section className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-3">
            <h2 className="text-sm sm:text-base font-display font-bold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-violet-400" />
              <span>تغيير شريط الإعلان العام المباشر</span>
            </h2>

            <form onSubmit={handleUpdateBanner} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={announcementInput}
                onChange={(e) => setAnnouncementInput(e.target.value)}
                placeholder="اكتب نص الإعلان العاجل ليظهر أعلى التطبيق..."
                className="flex-1 h-12 px-4 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
              />
              <button
                type="submit"
                className="h-12 px-6 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-extrabold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md shadow-violet-600/25"
              >
                تحديث الإعلان
              </button>
            </form>
          </section>

          {/* Game Luck & Profit Ratio Control */}
          <section className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-3">
            <h2 className="text-sm sm:text-base font-display font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-sky-400" />
              <span>التحكم في حظوظ الألعاب ونسبة الربح</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'generous', label: 'سخي جداً (ربح عالي)' },
                  { id: 'balanced', label: 'متوازن (قياسي)' },
                  { id: 'strict', label: 'صارم (تحدي)' },
                ] as Array<{ id: GameLuckMode; label: string }>
              ).map((opt) => {
                const active = state.gameLuckMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGameLuckMode(opt.id)}
                    className={`h-12 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                      active
                        ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-600/30'
                        : 'bg-[#0F0B28] text-slate-300 border border-violet-500/30 hover:border-blue-400/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Ultra Night Mode Quick Display Toggle */}
          <section className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5">
            <div className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-display font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <Moon className="w-4 h-4 text-sky-400" />
                  <span>الوضع الليلي الفائق (تباين بنفسجي وأزرق)</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  يعزز تباين الألوان البنفسجية والزرقاء ويقلل سطوع العناصر البيضاء تماماً لراحة العين ليلاً
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.ultraNightMode}
                aria-label="تفعيل الوضع الليلي الفائق"
                onClick={toggleUltraNightMode}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                  state.ultraNightMode
                    ? 'bg-gradient-to-l from-violet-600 to-blue-500 border-sky-400/70 shadow-[0_0_14px_rgba(99,102,241,0.65)]'
                    : 'bg-[#1D1548] border-violet-500/35'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full transition-transform ${
                    state.ultraNightMode
                      ? '-translate-x-7 bg-sky-200 shadow'
                      : '-translate-x-1 bg-slate-400'
                  }`}
                />
              </button>
            </div>
          </section>
          {/* Owner Live Room Analytics: Engagement Chart & Active Hosts */}
          {(() => {
            const analyticsRoom =
              state.rooms.find((r) => r.id === selectedAnalyticsRoomId) || state.rooms[0];
            if (!analyticsRoom) return null;
            return (
              <section className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-display font-bold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-sky-400" />
                      <span>مراقبة الغرفة: نبض التفاعل والمضيفون النشطون</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      تحليل التفاعل اللحظي وترتيب المضيفين النشطين مباشرة من لوحة تحكم المالك
                    </p>
                  </div>

                  <select
                    value={analyticsRoom.id}
                    onChange={(e) => setSelectedAnalyticsRoomId(e.target.value)}
                    aria-label="اختيار الغرفة للمراقبة"
                    className="h-10 px-3 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-xs text-white focus:outline-none focus:border-blue-400"
                  >
                    {state.rooms.map((r) => (
                      <option key={r.id} value={r.id} className="bg-[#0F0B28]">
                        {r.title} (ID:{r.ownerId})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setOwnerInsightTab((prev) => (prev === 'engagement' ? 'none' : 'engagement'))
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-display font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      ownerInsightTab === 'engagement'
                        ? 'bg-gradient-to-l from-violet-600 to-blue-500 border-sky-300/60 text-white shadow-lg'
                        : 'bg-[#0F0B28] border-violet-500/30 text-slate-200 hover:border-sky-400/50'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-sky-300 shrink-0" />
                    <span>نبض التفاعل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setOwnerInsightTab((prev) => (prev === 'hosts' ? 'none' : 'hosts'))
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-display font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      ownerInsightTab === 'hosts'
                        ? 'bg-gradient-to-l from-violet-600 to-blue-500 border-sky-300/60 text-white shadow-lg'
                        : 'bg-[#0F0B28] border-violet-500/30 text-slate-200 hover:border-violet-400/50'
                    }`}
                  >
                    <Users className="w-4 h-4 text-violet-300 shrink-0" />
                    <span>المضيفون النشطون</span>
                  </button>
                </div>

                {ownerInsightTab === 'engagement' && (
                  <RoomEngagementCard
                    room={analyticsRoom}
                    onClose={() => setOwnerInsightTab('none')}
                  />
                )}

                {ownerInsightTab === 'hosts' && (
                  <ActiveHostsPanel
                    room={analyticsRoom}
                    onInspectHost={(hostUser) => {
                      showToast(`${hostUser.name} — Lv.${hostUser.level} (ID:${hostUser.id})`, 'info');
                    }}
                    onClose={() => setOwnerInsightTab('none')}
                  />
                )}
              </section>
            );
          })()}
        </div>
      )}

      {/* TAB 2: Moderators & Admins System (Screenshot 7) */}
      {topTab === 'moderators' && (
        <div className="rounded-2xl bg-[#161038] border border-blue-500/35 p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-violet-500/25 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-white">
                منظومة المشرفين والأدمن (إنشاء وإرسال للمشرفين)
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                أنشئ صلاحية مشرف أو أدمن وأرسل له النظام جاهزاً عبر واتساب أو انسخ بطاقة التكليف الفورية
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-blue-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-violet-600/30">
              <Shield className="w-5 h-5" />
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#0F0B28] p-1.5 border border-violet-500/30">
            <button
              type="button"
              onClick={() => setModSubTab('create')}
              className={`min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                modSubTab === 'create'
                  ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">تعيين وإرسال لمشرف</span>
            </button>
            <button
              type="button"
              onClick={() => setModSubTab('workspace')}
              className={`min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                modSubTab === 'workspace'
                  ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">شاشة عمل المشرف</span>
            </button>
            <button
              type="button"
              onClick={() => setModSubTab('list')}
              className={`min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                modSubTab === 'list'
                  ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">المشرفون ({state.moderators.length})</span>
            </button>
          </div>

          {modSubTab === 'create' && (
            <form onSubmit={handleCreateModerator} className="space-y-4">
              <h3 className="text-sm font-display font-bold text-sky-300 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span>1. إصدار صلاحية مشرف أو أدمن جديد</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    اسم المشرف / الأدمن:
                  </label>
                  <input
                    type="text"
                    value={modName}
                    onChange={(e) => setModName(e.target.value)}
                    placeholder="مثال: المشرف العام صقر"
                    className="w-full h-11 px-3 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-sm text-white focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    رقم ID المشرف المميز:
                  </label>
                  <input
                    type="text"
                    value={modId}
                    onChange={(e) => setModId(e.target.value)}
                    placeholder="8775"
                    className="w-full h-11 px-3 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-sm font-mono-num text-white focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    رتبة ونوع نظام المشرف:
                  </label>
                  <select
                    value={modRole}
                    onChange={(e) => setModRole(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-sm text-white focus:outline-none focus:border-blue-400"
                  >
                    {MOD_ROLES.map((r) => (
                      <option key={r} value={r} className="bg-[#0F0B28] text-white">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    رقم واتساب المشرف (للإرسال المباشر):
                  </label>
                  <input
                    type="text"
                    value={modWhatsapp}
                    onChange={(e) => setModWhatsapp(e.target.value)}
                    placeholder="775367122"
                    className="w-full h-11 px-3 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-sm font-mono-num text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  رصيد عهدة المشرف بالذهب:
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={modCustody}
                  onChange={(e) => setModCustody(e.target.value.replace(/[^\d]/g, ''))}
                  className="w-full h-11 px-3 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-sm font-mono-num text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-extrabold text-sm cursor-pointer transition-colors shadow-lg shadow-violet-600/25"
              >
                إصدار الصلاحية وإنشاء بطاقة التكليف
              </button>

              {lastCreatedMod && (
                <div className="rounded-2xl bg-blue-500/15 border border-blue-400/40 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-sky-300 font-bold">
                    <span>تم إصدار التكليف لـ {lastCreatedMod.name} (ID: {lastCreatedMod.specialId})</span>
                    <span>{lastCreatedMod.role}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => copyAssignmentCard(lastCreatedMod)}
                      className="h-10 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ بطاقة التكليف الفورية</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => sendWhatsappCard(lastCreatedMod)}
                      className="h-10 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      <span>إرسال جاهز عبر واتساب</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {modSubTab === 'workspace' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">لوحة مهام المشرف المباشرة</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    مراقبة {state.rooms.length} غرف نشطة · {pendingReportsCount} بلاغات بانتظار المراجعة
                  </div>
                </div>
                <button
                  type="button"
                  onClick={boostAllRoomsHeat}
                  className="px-4 py-2 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 text-white text-xs font-bold cursor-pointer"
                >
                  دعم فوري لجميع الغرف
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.rooms.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-3.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-xs sm:text-sm text-white truncate">
                        {r.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-num">
                        ID:{r.ownerId} · حرارة {formatCompactNumber(r.heat)}
                      </div>
                    </div>
                    <span className="text-xs text-sky-400 font-semibold shrink-0">مستقرة</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modSubTab === 'list' && (
            <div className="space-y-3">
              {state.moderators.length === 0 ? (
                <div className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-8 text-center text-xs text-slate-400">
                  لا يوجد مشرفون مضافون بعد. انتقل إلى «تعيين وإرسال لمشرف» لإصدار أول صلاحية.
                </div>
              ) : (
                state.moderators.map((mod) => (
                  <div
                    key={mod.id}
                    className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{mod.name}</span>
                        <span className="text-xs font-mono-num text-sky-300">
                          ID:{mod.specialId}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            mod.status === 'active' ? 'text-sky-400' : 'text-rose-400'
                          }`}
                        >
                          {mod.status === 'active' ? 'نشط' : 'موقوف'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {mod.role} · عهدة: {formatFullGold(mod.custodyGold)} ذهب
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyAssignmentCard(mod)}
                        className="px-3 py-1.5 rounded-lg bg-[#1F174A] hover:bg-[#2A2063] text-xs text-white cursor-pointer"
                      >
                        نسخ البطاقة
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleModeratorStatus(mod.id)}
                        className="px-3 py-1.5 rounded-lg bg-violet-500/25 text-violet-200 text-xs font-semibold cursor-pointer"
                      >
                        {mod.status === 'active' ? 'إيقاف' : 'تفعيل'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteModerator(mod.id)}
                        aria-label="حذف المشرف"
                        className="p-2 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Super Admin & Reports (Screenshot 10) */}
      {topTab === 'superadmin' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-display font-bold text-white">
                  لوحة التحكم والإدارة الشاملة (Super Admin)
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  إدارة المستخدمين، أرصدة الوكالات، مراقبة الغرف الصوتية، واقتصاد ألعاب الحظ
                </p>
              </div>
              <Shield className="w-6 h-6 text-violet-400 shrink-0" />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(
                [
                  { id: 'settings', label: 'الإعدادات' },
                  { id: 'users', label: 'المستخدمين' },
                  { id: 'agencies', label: 'الوكالات' },
                  { id: 'rooms', label: 'الغرف' },
                  { id: 'reports', label: `البلاغات (${pendingReportsCount})` },
                  { id: 'broadcast', label: 'البث العام' },
                ] as Array<{ id: SuperSubTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSuperSubTab(tab.id)}
                  className={`min-h-[40px] px-4 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    superSubTab === tab.id
                      ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-md shadow-violet-600/25'
                      : 'bg-[#0F0B28] text-slate-300 hover:text-white border border-violet-500/25'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {superSubTab === 'settings' && (
            <div className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-4">
              <h3 className="text-sm sm:text-base font-display font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                <span>إعدادات النظام العامة واقتصاد الألعاب</span>
              </h3>

              {/* Maintenance Mode */}
              <div className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-violet-400" />
                    <span>وضع الصيانة العامة</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    إيقاف مؤقت للغرف الصوتية لإجراء التحديثات
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleMaintenanceMode}
                  className={`min-h-[40px] px-4 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    state.maintenanceMode
                      ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white'
                      : 'bg-[#201652] text-slate-200 hover:bg-[#2B1D6E]'
                  }`}
                >
                  {state.maintenanceMode ? 'مُفعل' : 'معطل'}
                </button>
              </div>

              {/* Ultra Night Mode Toggle */}
              <div className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <Moon className="w-4 h-4 text-sky-400" />
                    <span>الوضع الليلي الفائق</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    تعزيز تباين الألوان البنفسجية والزرقاء وتقليل سطوع العناصر البيضاء تماماً
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={state.ultraNightMode}
                  aria-label="تبديل الوضع الليلي الفائق"
                  onClick={toggleUltraNightMode}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                    state.ultraNightMode
                      ? 'bg-gradient-to-l from-violet-600 to-blue-500 border-sky-400/70 shadow-[0_0_14px_rgba(99,102,241,0.65)]'
                      : 'bg-[#1D1548] border-violet-500/35'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 rounded-full transition-transform ${
                      state.ultraNightMode
                        ? '-translate-x-7 bg-sky-200 shadow'
                        : '-translate-x-1 bg-slate-400'
                    }`}
                  />
                </button>
              </div>

              {/* Games Multiplier */}
              <div className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-4 space-y-3">
                <div className="font-semibold text-sm text-white">نسبة مضاعف الحظ (الفواكه والخضروات)</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {([1.5, 1.25, 1] as DiceMultiplier[]).map((mult) => {
                    const active = state.diceMultiplier === mult;
                    return (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => setDiceMultiplier(mult)}
                        className={`h-11 rounded-xl font-mono-num font-bold text-sm cursor-pointer transition-colors ${
                          active
                            ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-md shadow-violet-600/25'
                            : 'bg-[#1D1548] text-slate-300 border border-violet-500/30 hover:text-white'
                        }`}
                      >
                        x{mult}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reset Data */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={resetDemoData}
                  className="min-h-[40px] px-4 rounded-xl bg-[#201652] hover:bg-[#2A1D69] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة البيانات الافتراضية</span>
                </button>
              </div>
            </div>
          )}

          {superSubTab === 'users' && (
            <div className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-3">
              <h3 className="text-sm font-display font-bold text-white">إدارة الأعضاء ({state.users.length})</h3>
              <div className="space-y-2.5">
                {state.users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={u.avatar}
                        alt={u.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-violet-400/50"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white truncate">
                          {u.name} {u.flag}
                        </div>
                        <div className="text-xs text-slate-400 font-mono-num">
                          ID:{u.id} · {formatCompactNumber(u.gold)} ذهب · Lv.{u.level}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          adjustUserGold(u.id, 10_000_000);
                          showToast(`تم منح +10M ذهب لـ ${u.name}`, 'success');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-violet-500/25 text-violet-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>+10M</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => verifyUserAgent(u.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                          u.isVerifiedAgent
                            ? 'bg-blue-500/25 text-sky-300'
                            : 'bg-[#1D1548] text-slate-300'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{u.isVerifiedAgent ? 'وكيل معتمد' : 'توثيق وكيل'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleUserBan(u.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          u.isBanned
                            ? 'bg-rose-500 text-white'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {u.isBanned ? 'فك الحظر' : 'حظر'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {superSubTab === 'agencies' && (
            <div className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-3">
              <h3 className="text-sm font-display font-bold text-white">الوكالات المعتمدة في السيرفر</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.users
                  .filter((u) => u.isVerifiedAgent)
                  .map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-xl bg-[#0F0B28] border border-blue-400/40 p-3.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={agent.avatar}
                          alt={agent.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                        <div>
                          <div className="font-bold text-sm text-white">{agent.name}</div>
                          <div className="text-xs text-slate-400 font-mono-num">
                            ID:{agent.id} · {formatCompactNumber(agent.gold)} ذهب
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-sky-300">معتمدة ✓</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {superSubTab === 'rooms' && (
            <div className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-3">
              <h3 className="text-sm font-display font-bold text-white">مراقبة الغرف الصوتية</h3>
              <div className="space-y-2.5">
                {state.rooms.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">{r.title}</div>
                      <div className="text-xs text-slate-400 font-mono-num">
                        ID:{r.ownerId} · {r.listeners.toLocaleString('en-US')} مستمع ·{' '}
                        {formatCompactNumber(r.heat)} حرارة
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => boostRoomHeat(r.id, 1_000_000)}
                        className="px-3 py-1.5 rounded-lg bg-violet-500/25 hover:bg-violet-500/40 text-violet-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5 text-pink-400" />
                        <span>+1M</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRoomId(r.id)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-l from-violet-600 to-blue-500 text-white text-xs font-bold cursor-pointer"
                      >
                        دخول
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {superSubTab === 'reports' && (
            <div className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-3">
              <h3 className="text-sm font-display font-bold text-white">البلاغات والرقابة الفورية</h3>
              <div className="space-y-2.5">
                {state.reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl bg-[#0F0B28] border border-violet-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">
                        بلاغ ضد {rep.targetName} (ID:{rep.targetId})
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">{rep.reason}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        المُبلّغ: {rep.reporterName} · الغرفة: {rep.roomTitle} · {rep.timestamp}
                      </div>
                    </div>

                    {rep.status === 'pending' ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => resolveReport(rep.id, 'resolved')}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-l from-violet-600 to-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>معالجة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveReport(rep.id, 'dismissed')}
                          className="px-3 py-1.5 rounded-lg bg-[#1D1548] text-slate-300 text-xs cursor-pointer"
                        >
                          تجاهل
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-sky-400 shrink-0">
                        {rep.status === 'resolved' ? 'تمت المعالجة ✓' : 'تم الحفظ'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {superSubTab === 'broadcast' && (
            <div className="rounded-2xl bg-[#161038] border border-violet-500/30 p-4 sm:p-5 space-y-4">
              <h3 className="text-sm font-display font-bold text-white">البث العام والإشعارات</h3>
              <form onSubmit={handleUpdateBanner} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={announcementInput}
                  onChange={(e) => setAnnouncementInput(e.target.value)}
                  placeholder="أرسل رسالة عاجلة لجميع المستخدمين..."
                  className="flex-1 h-11 px-3 rounded-xl bg-[#0F0B28] border border-violet-500/35 text-sm text-white focus:outline-none focus:border-blue-400"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 text-white font-bold text-xs cursor-pointer"
                >
                  بث فوري
                </button>
              </form>
              <button
                type="button"
                onClick={() => triggerRoyalDragon('بث الإدارة العام')}
                className="px-4 py-2.5 rounded-xl bg-blue-500/20 border border-blue-400/45 text-sky-300 text-xs font-bold cursor-pointer"
              >
                إطلاق إشعار التنين الملكي العام 🐉
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
