import React, { useMemo, useState } from 'react';
import { ArrowDownAZ, ChevronDown, ChevronUp, Crown, Flame, Gift, Lock, Plus, Search, Sparkles, Trophy, Wrench, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole, VoiceRoom } from '../types';
import { formatCompactNumber } from '../utils/format';

type TopFeedFilter = 'recommended' | 'activity' | 'new' | 'country';
type SubFeedFilter = 'recent' | 'following' | 'join';

const COUNTRIES = [
  { name: 'الكل', flag: '🌍' },
  { name: 'اليمن', flag: '🇾🇪' },
  { name: 'السعودية', flag: '🇸🇦' },
  { name: 'قطر', flag: '🇶🇦' },
  { name: 'عُمان', flag: '🇴🇲' },
  { name: 'الإمارات', flag: '🇦🇪' },
];

const CATEGORIES: Array<VoiceRoom['category']> = ['وكالات', 'طرب', 'مسابقات', 'دردشة'];

const EqualizerBars: React.FC = () => (
  <span className="inline-flex items-end gap-[2px] h-3" aria-hidden="true">
    <span className="w-[2.5px] h-2 rounded-full bg-emerald-500 animate-pulse" />
    <span className="w-[2.5px] h-3 rounded-full bg-emerald-500" />
    <span className="w-[2.5px] h-1.5 rounded-full bg-emerald-400 animate-pulse" />
  </span>
);

const WealthCrestBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-l from-amber-500 via-yellow-400 to-amber-500 border border-amber-200 text-[#4A2500] text-[10px] font-mono-num font-black shadow-xs shrink-0">
    <Crown className="w-2.5 h-2.5 fill-amber-700 text-amber-800" />
    <span>{label}</span>
  </span>
);

const RoomCupBadge: React.FC<{ heat: number }> = ({ heat }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/90 text-amber-800 text-[10px] font-mono-num font-extrabold shrink-0">
    <Trophy className="w-2.5 h-2.5 text-amber-500 fill-amber-400" />
    <span>{formatCompactNumber(heat)}</span>
  </span>
);

const GoldenEliteBadge: React.FC<{
  label?: string;
  compact?: boolean;
  glowing?: boolean;
}> = ({ label = 'نخبة ذهبية', compact = false, glowing = false }) => (
  <span
    className={`group/elite golden-elite-badge inline-flex items-center gap-1 rounded-full border border-[#FEF08A]/95 text-[#3B1D00] font-display font-black whitespace-nowrap shrink-0 ${
      compact ? 'px-2 py-[1.5px] text-[9.5px]' : 'px-2.5 py-0.5 text-[10.5px]'
    } ${glowing ? 'animate-golden-elite-badge' : ''}`}
  >
    <Crown
      className={`relative z-10 ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} fill-[#78350F] text-[#78350F] shrink-0 transition-transform duration-200 group-hover/elite:scale-110 group-hover/elite:drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]`}
    />
    <span className="relative z-10 drop-shadow-[0_1px_0_rgba(255,251,235,0.55)]">{label}</span>
  </span>
);

function getHostEliteLabel(role?: UserRole): string {
  if (role === 'OWNER') return 'تاج النخبة';
  if (role === 'AGENCY_AGENT') return 'نخبة الوكلاء';
  if (role === 'HOST') return 'نجم البث';
  if (role === 'SUPERVISOR') return 'وسام الإشراف';
  return 'نخبة ذهبية';
}

export const RoomsView: React.FC = () => {
  const { state, currentUser, setActiveRoomId, setActiveTab, createVoiceRoom, showToast } = useApp();
  const [topFilter, setTopFilter] = useState<TopFeedFilter>('recommended');
  const [subFilter, setSubFilter] = useState<SubFeedFilter>('recent');
  const [selectedCountry, setSelectedCountry] = useState('الكل');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordRoomTarget, setPasswordRoomTarget] = useState<VoiceRoom | null>(null);
  const [passwordAttempt, setPasswordAttempt] = useState('');

  // Live Global Leaderboard state
  const [lbCategory, setLbCategory] = useState<'hosts' | 'gifters'>('hosts');
  const [lbSort, setLbSort] = useState<'metric' | 'alpha-desc'>('metric');
  const [lbExpanded, setLbExpanded] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCountry, setNewCountry] = useState(COUNTRIES[1]);
  const [newCat, setNewCat] = useState<VoiceRoom['category']>('وكالات');
  const [newDesc, setNewDesc] = useState('');

  const leaderboardItems = useMemo(() => {
    if (lbCategory === 'hosts') {
      const items = state.hosts.map((h) => {
        const user = state.users.find((u) => u.id === h.userId);
        return {
          id: h.userId,
          name: h.name,
          avatar: h.avatar,
          flag: user?.flag || '🇸🇦',
          level: user?.level || 1,
          role: user?.role || 'HOST',
          metric: h.giftsReceivedGold + Math.round(h.hoursLive * 2_000_000),
          subLabel: `${h.hoursLive} س بث · ${formatCompactNumber(h.giftsReceivedGold)}`,
          roomId: h.roomId,
        };
      });
      return items.sort((a, b) =>
        lbSort === 'alpha-desc'
          ? b.name.localeCompare(a.name, 'ar')
          : b.metric - a.metric
      );
    }

    const gifterItems = state.users.map((u) => {
      const gifted = u.giftedGold ?? 0;
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        flag: u.flag,
        level: u.level,
        role: u.role,
        metric: gifted,
        subLabel: `ID:${u.id} · Lv.${u.level}`,
        roomId: state.rooms.find((r) => r.ownerId === u.id)?.id || state.rooms[0]?.id,
      };
    });
    return gifterItems.sort((a, b) =>
      lbSort === 'alpha-desc'
        ? b.name.localeCompare(a.name, 'ar')
        : b.metric - a.metric
    );
  }, [lbCategory, lbSort, state.hosts, state.users, state.rooms]);

  const handleEnterRoom = (room: VoiceRoom) => {
    if (currentUser.isBanned && !currentUser.isAdmin) {
      showToast('عذراً، حسابك مقيد حالياً — يمكنك التبديل لحساب آخر أو فك الحظر من الإدارة', 'error');
      return;
    }
    if (room.bannedUserIds?.includes(currentUser.id) && currentUser.role !== 'OWNER') {
      showToast('عذراً، حسابك محظور من دخول هذه الغرفة', 'error');
      return;
    }
    if (state.maintenanceMode && !currentUser.isAdmin) {
      showToast('عذراً، الغرف الصوتية متوقفة مؤقتاً بسبب وضع الصيانة العامة', 'warning');
      return;
    }
    if (room.membersOnlyEntry && currentUser.role === 'USER' && room.ownerId !== currentUser.id) {
      showToast('هذه الغرفة مخصصة للأعضاء فقط حسب إعدادات الغرفة', 'warning');
      return;
    }
    if (room.password && currentUser.role !== 'OWNER' && room.ownerId !== currentUser.id) {
      setPasswordAttempt('');
      setPasswordRoomTarget(room);
      return;
    }
    if (room.isLocked && room.ownerId !== currentUser.id) {
      showToast('تم الدخول للغرفة بصلاحية المراقبة والاستماع', 'info');
    }
    setActiveRoomId(room.id);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordRoomTarget) return;
    if (passwordAttempt.trim() === (passwordRoomTarget.password || '').trim()) {
      const targetId = passwordRoomTarget.id;
      setPasswordRoomTarget(null);
      setPasswordAttempt('');
      setActiveRoomId(targetId);
      showToast('تم فتح قفل الغرفة بنجاح', 'success');
    } else {
      showToast('كلمة مرور الغرفة غير صحيحة', 'error');
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.isBanned) {
      showToast('عذراً، حسابك مقيد حالياً من إنشاء غرف جديدة', 'error');
      return;
    }
    if (!newTitle.trim()) {
      showToast('يرجى إدخال اسم الغرفة الصوتية', 'warning');
      return;
    }
    createVoiceRoom(newTitle, newCountry.name, newCountry.flag, newCat, newDesc);
    setNewTitle('');
    setNewDesc('');
    setCreateOpen(false);
  };

  const pinnedRoom = state.rooms.find((r) => r.isPinned) || state.rooms[0];

  const feedRooms = state.rooms
    .filter((room) => {
      if (pinnedRoom && room.id === pinnedRoom.id && topFilter === 'recommended' && !searchQuery.trim()) {
        return false;
      }
      if (dismissedIds.includes(room.id)) return false;
      if (topFilter === 'country' && selectedCountry !== 'الكل' && room.country !== selectedCountry) {
        return false;
      }
      if (subFilter === 'following' && room.category !== 'وكالات' && room.ownerId !== currentUser.id) {
        return false;
      }
      if (subFilter === 'join') {
        const occupied = room.seats.filter((s) => s.userId !== null).length;
        if (occupied >= room.totalMics) return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        return (
          room.title.toLowerCase().includes(q) ||
          room.ownerName.toLowerCase().includes(q) ||
          room.ownerId.includes(q) ||
          room.description.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (topFilter === 'activity') return b.heat - a.heat;
      if (topFilter === 'new') return a.listeners - b.listeners;
      return 0;
    });

  const usersById = useMemo(
    () => new Map(state.users.map((u) => [u.id, u])),
    [state.users]
  );

  return (
    <div className="space-y-4 pb-6">
      {/* Mint-pastel top discovery header bar with balanced spacing */}
      <div className="-mx-3 sm:-mx-6 -mt-5 px-4 sm:px-6 pt-4 pb-5 bg-gradient-to-b from-[#E5F9EC] via-[#EEFBF3] to-[#F5F7FA]">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Top Navigation Tabs Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'recommended', label: 'متعلق ب' },
                  { id: 'activity', label: 'النشاط' },
                  { id: 'new', label: 'جديد' },
                  { id: 'country', label: 'البلد' },
                ] as Array<{ id: TopFeedFilter; label: string }>
              ).map((tab) => {
                const active = topFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTopFilter(tab.id)}
                    className={`py-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      active
                        ? 'text-lg sm:text-xl font-display font-extrabold text-slate-900'
                        : 'text-sm sm:text-base font-display font-semibold text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label="إنشاء غرفة جديدة"
                className="w-10 h-10 rounded-full p-[1.5px] bg-gradient-to-tr from-violet-600 via-white to-purple-500 shadow-[0_3px_12px_rgba(124,58,237,0.25)] cursor-pointer transition-transform hover:scale-105"
              >
                <span className="w-full h-full rounded-full bg-white hover:bg-violet-50 text-violet-700 flex items-center justify-center transition-colors">
                  <Plus className="w-4.5 h-4.5" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="بحث في الغرف"
                className="w-10 h-10 rounded-full p-[1.5px] bg-gradient-to-tr from-violet-600 via-white to-purple-500 shadow-[0_3px_12px_rgba(124,58,237,0.25)] cursor-pointer transition-transform hover:scale-105"
              >
                <span className="w-full h-full rounded-full bg-white hover:bg-violet-50 text-violet-700 flex items-center justify-center transition-colors">
                  <Search className="w-4.5 h-4.5" />
                </span>
              </button>
            </div>
          </div>

          {/* Expandable Search Input */}
          {searchOpen && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الغرفة، الوكالة، أو رقم ID..."
                className="w-full h-11 pr-10 pl-9 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Country Filter Chips when البلد is selected */}
          {topFilter === 'country' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {COUNTRIES.map((c) => {
                const active = selectedCountry === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedCountry(c.name)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {c.flag} {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Pinned Hero Room Card with balanced spacing and Golden Elite Host Badge */}
          {pinnedRoom && topFilter === 'recommended' && !searchQuery.trim() && (() => {
            const pinnedOwner = usersById.get(pinnedRoom.ownerId);
            return (
              <article
                onClick={() => handleEnterRoom(pinnedRoom)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleEnterRoom(pinnedRoom);
                  }
                }}
                className="rounded-2xl bg-white hover:bg-emerald-50/30 border border-white/90 p-3.5 sm:p-4 flex items-stretch justify-between gap-3.5 shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition-all cursor-pointer"
              >
                {/* Right side (RTL): Square cover image */}
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-slate-900 shadow-xs">
                  <img
                    src={pinnedRoom.coverImage || pinnedRoom.ownerAvatar}
                    alt={pinnedRoom.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Center info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 gap-1.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm sm:text-base font-display font-extrabold text-slate-900 truncate">
                        {pinnedRoom.title}
                      </h2>
                      {(pinnedRoom.jetCount || 0) > 0 && (
                        <span className="text-base shrink-0" title="طائرة ملكية">
                          ✈️
                        </span>
                      )}
                    </div>

                    {/* Host Name + Golden Elite Badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[130px]">
                        {pinnedRoom.ownerName}
                      </span>
                      <GoldenEliteBadge label={getHostEliteLabel(pinnedOwner?.role)} compact />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm leading-none shrink-0">{pinnedRoom.flag}</span>
                      {pinnedRoom.wealthBadge ? (
                        <WealthCrestBadge label={pinnedRoom.wealthBadge} />
                      ) : (
                        <RoomCupBadge heat={pinnedRoom.heat} />
                      )}
                      <span className="text-xs text-slate-500 truncate max-w-[160px] sm:max-w-[230px]">
                        {pinnedRoom.description}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-mono-num font-bold text-slate-700">
                      <EqualizerBars />
                      <span>{pinnedRoom.listeners}</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-full">
                      غرفة مثبّتة
                    </span>
                  </div>
                </div>
              </article>
            );
          })()}

          {/* Live Global Leaderboard Card with Glowing Golden Shimmer for Icons & Names */}
          <section className="rounded-3xl bg-gradient-to-br from-[#1C0F45] via-[#13123D] to-[#0D2159] border border-amber-300/45 p-4 text-white shadow-[0_10px_32px_rgba(67,56,202,0.32)] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 text-amber-950 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.85)] animate-golden-icon-glow shrink-0">
                  <Crown className="w-4.5 h-4.5 fill-amber-800" />
                </span>
                <div>
                  <h2 className="text-xs sm:text-sm font-display font-extrabold flex items-center gap-1.5">
                    <span className="animate-golden-text-shimmer">لوحة المتصدرين الحية</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[9.5px] font-bold">
                      مباشر
                    </span>
                  </h2>
                  <p className="text-[10.5px] text-sky-200/90">
                    أوسمة النخبة الذهبية للمضيفين المتنافسين وأكرم المهدين
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setLbSort((s) => (s === 'metric' ? 'alpha-desc' : 'metric'))
                  }
                  className={`px-3 py-1.5 rounded-full border text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    lbSort === 'alpha-desc'
                      ? 'bg-amber-400 text-amber-950 border-yellow-200 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                      : 'bg-white/10 hover:bg-white/15 text-sky-100 border-white/20'
                  }`}
                  title="تبديل الترتيب التنازلي للأسماء (ي - أ / Z-A)"
                >
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                  <span>{lbSort === 'alpha-desc' ? 'تنازلي (ي-أ)' : 'الأعلى نقاطاً'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLbExpanded((v) => !v)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>{lbExpanded ? 'تصغير' : 'عرض الكل'}</span>
                  {lbExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/30 p-1.5 border border-white/10">
              <button
                type="button"
                onClick={() => setLbCategory('hosts')}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  lbCategory === 'hosts'
                    ? 'bg-gradient-to-l from-violet-600 to-blue-500 text-white shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-300 animate-golden-icon-glow" />
                <span>أكثر المضيفين نشاطاً</span>
              </button>
              <button
                type="button"
                onClick={() => setLbCategory('gifters')}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  lbCategory === 'gifters'
                    ? 'bg-gradient-to-l from-amber-500 to-orange-500 text-amber-950 font-extrabold shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>أكثر المستخدمين كرماً في الهدايا</span>
              </button>
            </div>

            {/* Compact Horizontal Top 3 Strip with Glowing Golden Shimmer */}
            <div className="grid grid-cols-3 gap-2.5">
              {leaderboardItems.slice(0, 3).map((item, idx) => {
                const crownGlow =
                  idx === 0
                    ? 'text-amber-300 animate-golden-icon-glow'
                    : idx === 1
                    ? 'text-yellow-200 animate-golden-icon-glow'
                    : 'text-amber-200 animate-golden-icon-glow';
                const cardRing =
                  idx === 0
                    ? 'border-amber-300/80 bg-gradient-to-b from-amber-400/25 via-amber-500/10 to-violet-950/65 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                    : idx === 1
                    ? 'border-amber-200/50 bg-gradient-to-b from-amber-300/12 to-white/5'
                    : 'border-amber-200/40 bg-gradient-to-b from-amber-200/10 to-white/5';

                const targetRoom = item.roomId
                  ? state.rooms.find((r) => r.id === item.roomId)
                  : undefined;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => targetRoom && handleEnterRoom(targetRoom)}
                    className={`rounded-2xl border p-2.5 flex flex-col items-center text-center gap-1.5 transition-all hover:brightness-110 cursor-pointer ${cardRing}`}
                  >
                    <div className="relative mt-0.5">
                      <Crown
                        className={`w-4.5 h-4.5 mx-auto -mb-1 relative z-10 fill-current ${crownGlow}`}
                      />
                      <img
                        src={item.avatar}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border-2 ${
                          idx === 0
                            ? 'border-amber-300 animate-gold-aura'
                            : idx === 1
                            ? 'border-amber-200/90 shadow-[0_0_12px_rgba(253,224,71,0.45)]'
                            : 'border-amber-200/75 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
                        }`}
                      />
                      <span className="absolute -bottom-1 -left-1 w-4.5 h-4.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border border-white text-[#3B1D00] text-[9.5px] font-mono-num font-black flex items-center justify-center shadow">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="text-[11px] font-display font-black truncate w-full animate-golden-text-shimmer">
                      {item.name}
                    </div>
                    <GoldenEliteBadge
                      label={idx === 0 ? 'تاج المتصدر' : getHostEliteLabel(item.role)}
                      compact
                      glowing
                    />
                    <div className="text-[10px] font-mono-num font-black text-amber-200">
                      {formatCompactNumber(item.metric)} 🪙
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Expanded Full Ranking List with Glowing Golden Names, Icons & Badges */}
            {lbExpanded && leaderboardItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-amber-300/20 max-h-64 overflow-y-auto">
                {leaderboardItems.map((item, idx) => {
                  const targetRoom = item.roomId
                    ? state.rooms.find((r) => r.id === item.roomId)
                    : undefined;
                  return (
                    <div
                      key={item.id}
                      onClick={() => targetRoom && handleEnterRoom(targetRoom)}
                      role={targetRoom ? 'button' : undefined}
                      tabIndex={targetRoom ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (targetRoom && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleEnterRoom(targetRoom);
                        }
                      }}
                      className="rounded-xl bg-white/10 hover:bg-amber-400/15 border border-amber-300/20 px-3 py-2.5 flex items-center justify-between gap-2.5 text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6.5 h-6.5 rounded-full bg-amber-400/25 border border-amber-300/50 font-mono-num font-black text-[11px] flex items-center justify-center shrink-0">
                          {idx < 3 ? (
                            <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-golden-icon-glow" />
                          ) : (
                            <span className="text-amber-200">{idx + 1}</span>
                          )}
                        </span>
                        <img
                          src={item.avatar}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-8.5 h-8.5 rounded-full object-cover border-2 border-amber-300/80 shadow-[0_0_10px_rgba(251,191,36,0.4)] shrink-0"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-display font-black truncate animate-golden-text-shimmer">
                              {item.name}
                            </span>
                            <span className="text-xs shrink-0">{item.flag}</span>
                            <GoldenEliteBadge
                              label={getHostEliteLabel(item.role)}
                              compact
                              glowing
                            />
                          </div>
                          <div className="text-[10px] text-sky-200/85 font-mono-num truncate">
                            {item.subLabel}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono-num font-black text-amber-300 shrink-0">
                        <Sparkles className="w-3 h-3 text-yellow-200 animate-golden-icon-glow" />
                        <Trophy className="w-3.5 h-3.5 text-amber-300 animate-golden-icon-glow" />
                        <span>{formatCompactNumber(item.metric)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Bright Quick-Access Bar: Currency Recharge Agencies & Exclusive Fruits/Veggies Games */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('agencies')}
              className="rounded-2xl bg-gradient-to-l from-[#15D16B] to-[#0EA954] hover:brightness-105 text-white px-4 py-3 flex items-center justify-between gap-2.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
            >
              <div className="text-right min-w-0">
                <div className="text-xs sm:text-sm font-display font-extrabold truncate">
                  وكالات شحن العملات
                </div>
                <div className="text-[10.5px] text-emerald-50 font-bold truncate">
                  تحويل فوري + 25% بونص
                </div>
              </div>
              <span className="text-2xl shrink-0">🪙</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('games')}
              className="rounded-2xl bg-gradient-to-l from-[#7C3AED] to-[#2563EB] hover:brightness-105 text-white px-4 py-3 flex items-center justify-between gap-2.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
            >
              <div className="text-right min-w-0">
                <div className="text-xs sm:text-sm font-display font-extrabold truncate">
                  الفواكه والخضروات
                </div>
                <div className="text-[10.5px] text-sky-100 font-bold truncate">
                  جوائز حتى ×45 · سحب فوري
                </div>
              </div>
              <span className="text-2xl shrink-0">🍊</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-filter row: مؤخرًا · المتابعة · انضم */}
      <div className="max-w-3xl mx-auto space-y-3.5 px-0.5">
        <div className="flex items-center justify-between gap-2 px-1.5 pt-0.5">
          <div className="flex items-center gap-6">
            {(
              [
                { id: 'recent', label: 'مؤخرًا' },
                { id: 'following', label: 'المتابعة' },
                { id: 'join', label: 'انضم' },
              ] as Array<{ id: SubFeedFilter; label: string }>
            ).map((sub) => {
              const active = subFilter === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSubFilter(sub.id)}
                  className={`relative pb-1.5 text-xs sm:text-sm font-display transition-colors cursor-pointer ${
                    active
                      ? 'font-extrabold text-emerald-600'
                      : 'font-semibold text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {sub.label}
                  {active && (
                    <span className="absolute bottom-0 inset-x-1.5 h-0.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {dismissedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setDismissedIds([])}
              className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
            >
              إظهار الكل
            </button>
          )}
        </div>

        {state.maintenanceMode && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex items-center gap-2.5 text-amber-900 text-xs font-medium">
            <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
            <span>وضع الصيانة العامة نشط حالياً. يمكنك إيقافه من مركز النظام.</span>
          </div>
        )}

        {/* Room Cards Feed with Generous Margins & Golden Elite Badges */}
        {feedRooms.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center shadow-xs">
            <p className="text-slate-500 text-sm font-medium">لا توجد غرف مطابقة لبحثك حالياً</p>
            <button
              type="button"
              onClick={() => {
                setTopFilter('recommended');
                setSubFilter('recent');
                setSelectedCountry('الكل');
                setSearchQuery('');
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              عرض جميع الغرف
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {feedRooms.map((room) => {
              const occupiedSeats = room.seats.filter((s) => s.userId !== null);
              const jetCount = room.jetCount || 0;
              const ownerAccount = usersById.get(room.ownerId);

              return (
                <article
                  key={room.id}
                  onClick={() => handleEnterRoom(room)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEnterRoom(room);
                    }
                  }}
                  className="group rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-100 p-3.5 sm:p-4 flex items-stretch justify-between gap-3.5 shadow-[0_3px_14px_rgba(15,23,42,0.05)] transition-all cursor-pointer"
                >
                  {/* Square Cover Image + optional lock badge */}
                  <div className="relative w-24 h-24 sm:w-[104px] sm:h-[104px] rounded-2xl overflow-hidden shrink-0 bg-slate-200">
                    <img
                      src={room.coverImage || room.ownerAvatar}
                      alt={room.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {room.isLocked && (
                      <span
                        title="غرفة مقفلة"
                        className="absolute bottom-1.5 left-1.5 w-6.5 h-6.5 rounded-full bg-amber-400/95 text-white flex items-center justify-center shadow"
                      >
                        <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    )}
                  </div>

                  {/* Center Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 gap-1.5">
                    <div className="space-y-1.5">
                      {/* Title & Jet Badges + Dismiss X */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <h2 className="text-sm sm:text-base font-display font-extrabold text-slate-900 truncate">
                            {room.title}
                          </h2>
                          {jetCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs shrink-0">
                              {Array.from({ length: Math.min(3, jetCount) }).map((_, i) => (
                                <span key={i}>🚀</span>
                              ))}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDismissedIds((prev) => [...prev, room.id]);
                          }}
                          aria-label="إخفاء الغرفة"
                          className="w-7 h-7 rounded-full text-slate-300 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Host Name + Golden Elite Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">
                          {room.ownerName}
                        </span>
                        <GoldenEliteBadge label={getHostEliteLabel(ownerAccount?.role)} compact />
                      </div>

                      {/* Flag + Dynamic Cup/Wealth Medal + Snippet */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm leading-none shrink-0">{room.flag}</span>
                        {room.wealthBadge ? (
                          <WealthCrestBadge label={room.wealthBadge} />
                        ) : (
                          <RoomCupBadge heat={room.heat} />
                        )}
                        <p className="text-xs text-slate-500 truncate max-w-[170px] sm:max-w-[260px]">
                          {room.description}
                        </p>
                      </div>
                    </div>

                    {/* Footer: Speaker Avatar Stack + Listener Equalizer */}
                    <div className="flex items-center justify-between gap-2.5 pt-1">
                      {/* Occupied avatars stack + seat counter */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
                          {occupiedSeats.slice(0, 5).map((seat) => (
                            <img
                              key={seat.seatNumber}
                              src={seat.avatar || room.ownerAvatar}
                              alt={seat.userName || ''}
                              referrerPolicy="no-referrer"
                              className="w-6.5 h-6.5 rounded-full object-cover ring-2 ring-white bg-slate-200"
                            />
                          ))}
                        </div>
                        <span className="w-6.5 h-6.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-mono-num font-bold flex items-center justify-center shrink-0">
                          {room.totalMics + occupiedSeats.length}
                        </span>
                      </div>

                      {/* Listener Equalizer Count */}
                      <div className="flex items-center gap-1.5 text-xs font-mono-num font-bold text-slate-700 shrink-0">
                        <EqualizerBars />
                        <span>{room.listeners}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-extrabold text-slate-900">
                إنشاء غرفة صوتية جديدة
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  اسم الغرفة الصوتية
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: ديوانية رياض — جلسة سمر"
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">الدولة</label>
                  <select
                    value={newCountry.name}
                    onChange={(e) => {
                      const found = COUNTRIES.find((c) => c.name === e.target.value);
                      if (found) setNewCountry(found);
                    }}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {COUNTRIES.filter((c) => c.name !== 'الكل').map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">التصنيف</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value as VoiceRoom['category'])}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  وصف الغرفة والترحيب
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="اكتب نبذة ترحيبية للزوار..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-full bg-gradient-to-l from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm transition-colors cursor-pointer shadow-md"
              >
                افتتاح الغرفة الآن
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Room Password Verification Modal */}
      {passwordRoomTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-3xl bg-white border border-slate-200 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-extrabold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>غرفة مقفلة بكلمة مرور</span>
              </h3>
              <button
                type="button"
                onClick={() => setPasswordRoomTarget(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              أدخل كلمة المرور للدخول إلى غرفة «{passwordRoomTarget.title}»
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                value={passwordAttempt}
                onChange={(e) => setPasswordAttempt(e.target.value)}
                placeholder="كلمة المرور..."
                autoFocus
                className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 font-mono-num text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="w-full h-11 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm cursor-pointer"
              >
                دخول الغرفة
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
