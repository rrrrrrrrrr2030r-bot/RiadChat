import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Gift,
  Link2,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  AGENCY_BANNER_PATH,
  AGENCY_QUICK_PACKS,
  AGENT_STOCK_PACKS,
} from '../data/seedData';
import { formatCompactNumber, formatFullGold } from '../utils/format';

export const AgenciesView: React.FC = () => {
  const {
    state,
    currentUser,
    transferAgencyGold,
    purchaseAgentWholesalePack,
    sendRechargeInvite,
    registerAsAgent,
    setActiveTab,
    setActiveRoomId,
    openWallet,
    showToast,
  } = useApp();

  const [recipientId, setRecipientId] = useState('882001');
  const [selectedPackId, setSelectedPackId] = useState('aq-10');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [agencyTitleInput, setAgencyTitleInput] = useState(`وكالة ${currentUser.name}`);
  const [customInputId, setCustomInputId] = useState('882001');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const packParam = params.get('pack');
      const agentParam = params.get('agent');
      if (packParam && AGENCY_QUICK_PACKS.some((p) => p.id === packParam)) {
        setSelectedPackId(packParam);
      }
      if (agentParam && state.users.some((u) => u.id === agentParam)) {
        setRecipientId(agentParam);
      }
    } catch {
      // Ignore invalid query string
    }
  }, [state.users]);

  const foundRecipient = state.users.find((u) => u.id === recipientId.trim());
  const selectedPack =
    AGENCY_QUICK_PACKS.find((p) => p.id === selectedPackId) || AGENCY_QUICK_PACKS[0];

  // Dynamic 24h sales calculated live from actual agency transfers
  const recent24hGold = state.transfers
    .filter((t) => t.timestamp === 'الآن' || t.timestamp.startsWith('اليوم'))
    .reduce((sum, t) => sum + t.baseGold, 0);
  const display24hGold = recent24hGold > 0 ? recent24hGold : 40_650_000;
  const display24hUsd = Math.max(1, Math.round(display24hGold / 1_042_000));

  const verifiedAgents = state.users.filter((u) => u.isVerifiedAgent);

  const shareLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?agent=${currentUser.id}&pack=${selectedPack.id}`
      : `https://riadchat.app/?agent=${currentUser.id}&pack=${selectedPack.id}`;

  const handleConfirmTransfer = () => {
    if (!foundRecipient) {
      showToast('اختر معرف اللاعب المستفيد أولاً', 'warning');
      setPickerOpen(true);
      return;
    }
    transferAgencyGold(foundRecipient.id, selectedPack.gold, currentUser.name);
  };

  const handleSendRechargeLink = () => {
    navigator.clipboard?.writeText(shareLink).catch(() => {});
    setLinkModalOpen(true);
    showToast('تم نسخ رابط إعادة الشحن الشخصي للوكالة!', 'success');
  };

  const handleInviteToRecharge = () => {
    sendRechargeInvite();
    const inviteText = `انضم الآن إلى رياض شات واشحن عبر وكالتي (ID:${currentUser.id}) واحصل على +25% بونص ذهب فوري: ${shareLink}`;
    navigator.clipboard?.writeText(inviteText).catch(() => {});
  };

  const handleApplyAgent = (e: React.FormEvent) => {
    e.preventDefault();
    registerAsAgent(agencyTitleInput);
    setApplyModalOpen(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      <div className="rounded-3xl overflow-hidden bg-[#F7F9FC] border border-emerald-200/80 shadow-md text-slate-900">
        {/* Top Bright White Header matching Screenshot 0bce51e5 */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('me')}
            aria-label="رجوع"
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-800 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <h1 className="text-base sm:text-lg font-display font-extrabold text-slate-900">
            تحويل الاموال
          </h1>

          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            aria-label="سجل الإحصائيات والوكلاء"
            className="w-9 h-9 rounded-full hover:bg-emerald-50 flex items-center justify-center text-slate-700 cursor-pointer"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Treasure Chest Reward Banner */}
          <div className="relative rounded-2xl overflow-hidden h-28 sm:h-34 shadow-sm border border-amber-300/70">
            <img
              src={AGENCY_BANNER_PATH}
              alt="مكافآت وكيل لدعوة المستخدم الجديد"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-red-950/75 via-red-900/35 to-transparent flex items-center justify-between px-5">
              <div className="space-y-1">
                <div className="text-lg sm:text-2xl font-display font-extrabold text-amber-200 drop-shadow-[0_2px_6px_rgba(127,29,29,0.95)] leading-snug">
                  مكافآت وكيل لدعوة المستخدم الجديد
                </div>
                <div className="text-xs font-bold text-white/95">
                  دعواتك الناجحة: <span className="font-mono-num text-yellow-300">{state.agentInviteCount}</span> · بونص الشحن +25%
                </div>
              </div>
            </div>
          </div>

          {/* Glowing Purple-Blue Shortcut to Agency Control Dashboard (OWNER only) */}
          {currentUser.role === 'OWNER' && (
            <button
              type="button"
              onClick={() => setActiveTab('agency-dashboard')}
              className="w-full rounded-2xl bg-gradient-to-l from-[#1E0F4B] via-[#151247] to-[#0D2159] border border-violet-400/60 px-4 py-3 flex items-center justify-between gap-3 text-white shadow-[0_0_22px_rgba(99,102,241,0.3)] hover:brightness-110 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0 text-right">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(124,58,237,0.65)]">
                  <Sparkles className="w-4 h-4 text-white" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-display font-extrabold truncate">
                    لوحة تحكم الوكالة (إدارة المضيفين والأرباح)
                  </div>
                  <div className="text-[11px] text-sky-200/90 truncate">
                    مراقبة المضيفين، الغرف المباشرة، وتوزيع العمولات آلياً
                  </div>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 text-white text-xs font-extrabold whitespace-nowrap shrink-0 flex items-center gap-1">
                <span>فتح اللوحة</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </button>
          )}

          {/* Agent Account Info Card matching Screenshot 0bce51e5 */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-right font-display font-bold text-sm text-slate-900">
                معلومات حساب وكيل الشحن
              </div>
              {currentUser.isVerifiedAgent ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <ShieldCheck className="w-4 h-4" />
                  <span>وكيل معتمد</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(true)}
                  className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  توثيق حسابك كوكيل ←
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-center pt-1">
              {/* Available Balance */}
              <div className="space-y-2 border-l border-slate-100 pl-2">
                <div className="text-xs text-slate-400">المبلغ المتاح</div>
                <div className="flex items-center justify-center gap-1 font-mono-num font-extrabold text-sm sm:text-base text-slate-900">
                  <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate">{formatFullGold(currentUser.gold)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStockModalOpen(true)}
                  className="w-full h-9 rounded-full border border-[#15D16B] text-[#11B85D] hover:bg-emerald-50 text-[11px] sm:text-xs font-bold cursor-pointer transition-colors"
                >
                  شراء ذهبية وكيل الشحن
                </button>
              </div>

              {/* 24h Sales (Dynamic) */}
              <div className="space-y-2 pr-1">
                <div className="text-xs text-slate-400">المبيعات في 24 ساعة</div>
                <div className="font-mono-num font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
                  {formatFullGold(display24hGold)}
                  <div className="text-[11px] text-slate-600">Gold($ {display24hUsd})</div>
                </div>
                <button
                  type="button"
                  onClick={() => setStatsOpen(true)}
                  className="w-full h-9 rounded-full border border-[#15D16B] text-[#11B85D] hover:bg-emerald-50 text-[11px] sm:text-xs font-bold cursor-pointer transition-colors"
                >
                  إحصائيات المبيعات
                </button>
              </div>
            </div>
          </section>

          {/* Recipient ID Selector Row matching Screenshot 0bce51e5 */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/80 px-4 py-3 flex items-center justify-between gap-3 cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              {foundRecipient ? (
                <img
                  src={foundRecipient.avatar}
                  alt={foundRecipient.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border border-emerald-400 shrink-0"
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </span>
              )}
              <div className="text-right min-w-0">
                <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                  {foundRecipient ? `${foundRecipient.name} (ID:${foundRecipient.id})` : 'مستفيد ID'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono-num">
                  {foundRecipient ? `الرصيد الحالي: ${formatFullGold(foundRecipient.gold)}` : 'اضغط لتحديد المستفيد'}
                </div>
              </div>
            </div>

            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 shrink-0">
              <span>اختار</span>
              <ChevronLeft className="w-4 h-4" />
            </span>
          </button>

          {/* 3x3 White Package Cards Grid matching Screenshot 0bce51e5 */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {AGENCY_QUICK_PACKS.map((pack) => {
              const active = pack.id === selectedPackId;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPackId(pack.id)}
                  className={`rounded-2xl bg-white p-3 flex flex-col items-center justify-between gap-2.5 transition-all cursor-pointer border ${
                    active
                      ? 'border-[#15D16B] ring-2 ring-emerald-400/45 shadow-md scale-[1.02]'
                      : 'border-violet-200/70 hover:border-emerald-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-1 font-mono-num font-bold text-xs sm:text-sm text-amber-500 pt-1">
                    <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{pack.label}</span>
                  </div>
                  <span className="w-full py-1 rounded-full bg-[#15D16B] text-white font-mono-num font-extrabold text-xs text-center shadow-xs">
                    $ {pack.usd}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3 Emerald Action Buttons matching Screenshot 0bce51e5 */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleConfirmTransfer}
              className="w-full h-12 rounded-full bg-[#15D16B] hover:bg-[#11BC5F] text-white font-display font-extrabold text-sm sm:text-base shadow-md shadow-emerald-500/25 cursor-pointer transition-transform active:scale-[0.99]"
            >
              تحويل الاموال ({formatCompactNumber(selectedPack.gold)} + 25% بونص)
            </button>

            <button
              type="button"
              onClick={handleSendRechargeLink}
              className="w-full h-11 rounded-full bg-[#6FE3A4] hover:bg-[#52D990] text-emerald-950 font-display font-extrabold text-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              <span>ارسل رابط اعادة الشحن</span>
            </button>

            <button
              type="button"
              onClick={handleInviteToRecharge}
              className="w-full h-12 rounded-full bg-[#09C75B] hover:bg-[#07B251] text-white font-display font-extrabold text-sm sm:text-base shadow-md shadow-emerald-500/25 cursor-pointer transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" />
              <span>دعوة لإعادة الشحن (+1M مكافأة فورية)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Verified Agencies Directory & Become an Agent Section */}
      <section className="rounded-3xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3 text-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-display font-extrabold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>وكالات الشحن المعتمدة في رياض شات</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              اختر أي وكيل للشحن السريع أو ادخل لغرفته الصوتية مباشرة
            </p>
          </div>
          {!currentUser.isVerifiedAgent && (
            <button
              type="button"
              onClick={() => setApplyModalOpen(true)}
              className="px-3.5 py-2 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>فتح وكالة</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {verifiedAgents.map((agent) => {
            const agentRoom = state.rooms.find((r) => r.ownerId === agent.id);
            return (
              <div
                key={agent.id}
                className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 truncate flex items-center gap-1">
                      <span>{agent.name}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-num">
                      ID:{agent.id} · مخزون: {formatCompactNumber(agent.gold)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientId(agent.id);
                      showToast(`تم اختيار ${agent.name} كمستفيد للتحويل`, 'info');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                  >
                    تحويل
                  </button>
                  {agentRoom && (
                    <button
                      type="button"
                      onClick={() => setActiveRoomId(agentRoom.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-800 text-[11px] font-bold cursor-pointer"
                    >
                      الغرفة
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recipient Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-display font-bold">تحديد حساب المستفيد (ID)</h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customInputId}
                onChange={(e) => {
                  setCustomInputId(e.target.value);
                  setRecipientId(e.target.value);
                }}
                placeholder="أدخل رقم ID (مثال: 900، 882001، 774100)"
                className="w-full h-11 pr-9 pl-3 rounded-xl bg-slate-50 border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {state.users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setRecipientId(u.id);
                    setCustomInputId(u.id);
                    setPickerOpen(false);
                  }}
                  className={`w-full rounded-xl p-2.5 flex items-center justify-between gap-2 text-right cursor-pointer ${
                    recipientId === u.id ? 'bg-emerald-50 border border-emerald-300' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-900">
                        {u.name} {u.flag}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-num">ID: {u.id}</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono-num font-bold text-amber-600">
                    {formatFullGold(u.gold)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Agent Wholesale Stock Top-Up Modal ("شراء ذهبية وكيل الشحن") */}
      {stockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-display font-bold flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span>شراء ذهبية وكيل الشحن (أسعار الجملة)</span>
              </h3>
              <button
                type="button"
                onClick={() => setStockModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {AGENT_STOCK_PACKS.map((pk) => (
                <button
                  key={pk.id}
                  type="button"
                  onClick={() => {
                    purchaseAgentWholesalePack(pk.gold, pk.usd);
                    setStockModalOpen(false);
                  }}
                  className="rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 p-3.5 text-center space-y-1.5 cursor-pointer transition-colors"
                >
                  <div className="text-[11px] font-extrabold text-emerald-700">{pk.bonusText}</div>
                  <div className="font-mono-num font-black text-base text-amber-600">
                    +{formatCompactNumber(pk.gold)} 🪙
                  </div>
                  <div className="py-1 rounded-full bg-[#15D16B] text-white font-mono-num font-bold text-xs">
                    تعبئة (${pk.usd})
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setStockModalOpen(false);
                openWallet('gold');
              }}
              className="w-full h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
            >
              الانتقال إلى المحفظة العامة للشحن
            </button>
          </div>
        </div>
      )}

      {/* Sales Stats & Ledger Modal ("إحصائيات المبيعات") */}
      {statsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 space-y-3 shadow-2xl text-slate-900 max-h-[82vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-display font-bold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>إحصائيات مبيعات الوكالة</span>
              </h3>
              <button
                type="button"
                onClick={() => setStatsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-center">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-[11px] text-emerald-700 font-bold">إجمالي تحويلات اليوم</div>
                <div className="font-mono-num font-black text-sm text-emerald-900 mt-0.5">
                  {formatCompactNumber(display24hGold)} 🪙
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3">
                <div className="text-[11px] text-amber-700 font-bold">عدد العمليات المسجلة</div>
                <div className="font-mono-num font-black text-sm text-amber-900 mt-0.5">
                  {state.transfers.length} عملية
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {state.transfers.map((tr) => (
                <div key={tr.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{tr.recipientName} (ID:{tr.recipientId})</div>
                    <div className="text-slate-400">{tr.agentName} · {tr.timestamp}</div>
                  </div>
                  <div className="text-left font-mono-num">
                    <div className="font-bold text-emerald-600">+{formatFullGold(tr.totalGold)}</div>
                    <div className="text-[10px] text-amber-600">بونص +{formatFullGold(tr.bonusGold)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share Recharge Link Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-display font-bold">رابط إعادة الشحن الشخصي</h3>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              شارك هذا الرابط مع اللاعبين لفتح صفحة الشحن محددة تلقائياً على وكالتك والباقة المختارة ($ {selectedPack.usd}):
            </p>
            <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-xs font-mono-num break-all text-slate-700">
              {shareLink}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareLink).catch(() => {});
                  showToast('تم نسخ الرابط إلى الحافظة!', 'success');
                }}
                className="h-11 rounded-full bg-[#15D16B] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>نسخ الرابط</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkModalOpen(false);
                  setActiveTab('messages');
                }}
                className="h-11 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>إرسال بالرسائل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register New Agency Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleApplyAgent}
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xl text-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-display font-bold">فتح وتوثيق وكالة شحن جديدة</h3>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">اسم الوكالة التجاري:</label>
              <input
                type="text"
                value={agencyTitleInput}
                onChange={(e) => setAgencyTitleInput(e.target.value)}
                placeholder="مثال: وكالة الصقر للشحن الفوري"
                className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="w-full h-11 rounded-full bg-[#15D16B] hover:bg-[#11BC5F] text-white font-extrabold text-sm cursor-pointer"
            >
              توثيق الوكالة الآن (+5M مخزون هدية)
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
