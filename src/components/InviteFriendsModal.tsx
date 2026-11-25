import React, { useState } from 'react';
import {
  Check,
  Copy,
  Gift,
  Link2,
  Share2,
  Smartphone,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PUBLIC_INVITE_BASE_URL } from '../lib/supabase';
import { InviteLinkRecord } from '../types';

interface InviteFriendsModalProps {
  open: boolean;
  roomId?: string;
  roomTitle?: string;
  onClose: () => void;
}

export const InviteFriendsModal: React.FC<InviteFriendsModalProps> = ({
  open,
  roomId,
  roomTitle,
  onClose,
}) => {
  const { state, currentUser, createInviteLink, redeemInviteCode, showToast } = useApp();
  const [creating, setCreating] = useState(false);
  const [latestInvite, setLatestInvite] = useState<InviteLinkRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState('');

  if (!open) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : PUBLIC_INVITE_BASE_URL;

  const buildPublicWebUrl = (inv: InviteLinkRecord) => {
    const params = new URLSearchParams({ invite: inv.code });
    if (inv.roomId) params.set('room', inv.roomId);
    return `${PUBLIC_INVITE_BASE_URL}/?${params.toString()}`;
  };

  const buildPreviewWebUrl = (inv: InviteLinkRecord) => {
    const params = new URLSearchParams({ invite: inv.code });
    if (inv.roomId) params.set('room', inv.roomId);
    return `${currentOrigin}/?${params.toString()}`;
  };

  const buildNativeUrl = (inv: InviteLinkRecord) =>
    inv.roomId
      ? `riyadhchat://invite/${inv.code}?room=${inv.roomId}`
      : `riyadhchat://invite/${inv.code}`;

  const handleGenerate = async (bindRoom: boolean) => {
    setCreating(true);
    try {
      const inv = await createInviteLink(bindRoom ? roomId : undefined);
      if (inv) {
        setLatestInvite(inv);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    showToast('تم نسخ رابط الدعوة بنجاح!', 'success');
    window.setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleNativeShare = async (inv: InviteLinkRecord) => {
    const webUrl = buildPublicWebUrl(inv);
    const title = inv.roomTitle
      ? `انضم معي إلى غرفة «${inv.roomTitle}» في رياض شات`
      : 'انضم إليّ في تطبيق رياض شات للدردشة الصوتية والألعاب!';
    const text = inv.roomTitle
      ? `🎙️ أدعوك للانضمام لغرفة «${inv.roomTitle}» في رياض شات واحصل على +500,000 ذهبية ترحيبية فوراً:`
      : '👑 أدعوك لتجربة رياض شات للدردشة الصوتية والألعاب المباشرة واحصل على +500,000 ذهبية ترحيبية:';

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: webUrl });
        showToast('تمت مشاركة رابط الدعوة بنجاح!', 'success');
        return;
      } catch {
        // User cancelled or share unsupported in iframe -> fallback to copy
      }
    }
    handleCopy(webUrl, `share-${inv.code}`);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = redeemInput.trim();
    if (!clean) return;
    const ok = await redeemInviteCode(clean);
    if (ok) {
      setRedeemInput('');
      onClose();
    }
  };

  const myInvites = state.invites.filter((i) => i.inviterId === currentUser.id);
  const personalFallbackInvite: InviteLinkRecord = {
    code: currentUser.referralCode || `RIAD-${currentUser.id}`,
    inviterId: currentUser.id,
    inviterName: currentUser.name,
    uses: currentUser.referralCount || 0,
    rewardGold: 1_000_000,
    createdAt: 'دائم',
  };
  const activeInvites = myInvites.length > 0 ? myInvites.slice(0, 6) : state.invites.slice(0, 6);
  const featuredInvite =
    latestInvite ||
    (roomId ? myInvites.find((i) => i.roomId === roomId) : null) ||
    myInvites[0] ||
    personalFallbackInvite;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        dir="rtl"
        className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-[#120D2B] border border-violet-400/35 p-5 text-white shadow-2xl space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center text-white shadow-lg shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-display font-extrabold text-white truncate">
                دعوة الأصدقاء وروابط الانضمام
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                {roomTitle
                  ? `ربط مباشر بغرفة: ${roomTitle}`
                  : 'أنشئ رابطاً فعالاً واربح +1,000,000 ذهبية لكل صديق'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reward Strip */}
        <div className="rounded-2xl bg-gradient-to-l from-amber-500/20 via-violet-500/20 to-sky-500/20 border border-amber-300/30 p-3 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-amber-100 font-bold">
              مكافأة فورية: +1M لك و +500K لصديقك عند الانضمام
            </span>
          </div>
          <Sparkles className="w-4 h-4 text-sky-300 shrink-0" />
        </div>

        {/* Action Buttons */}
        <div className={`grid gap-2 ${roomId ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {roomId && (
            <button
              type="button"
              disabled={creating}
              onClick={() => handleGenerate(true)}
              className="min-h-[44px] rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:brightness-110 disabled:opacity-60 text-white font-display font-extrabold text-xs px-3 flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Link2 className="w-4 h-4 shrink-0" />
              <span>{creating ? 'جاري الإنشاء...' : 'رابط دخول هذه الغرفة'}</span>
            </button>
          )}
          <button
            type="button"
            disabled={creating}
            onClick={() => handleGenerate(false)}
            className={`min-h-[44px] rounded-xl font-display font-extrabold text-xs px-3 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
              roomId
                ? 'bg-white/10 hover:bg-white/15 border border-white/15 text-white'
                : 'bg-gradient-to-l from-violet-600 to-blue-500 hover:brightness-110 text-white shadow-lg'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>{creating ? 'جاري الإنشاء...' : 'إنشاء رابط دعوة جديد'}</span>
          </button>
        </div>

        {/* Active Featured Invite Link */}
        {featuredInvite && (
          <div className="rounded-2xl bg-white/[0.06] border border-violet-400/25 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-violet-200">
                كود الدعوة:{' '}
                <span className="font-mono-num text-amber-300">{featuredInvite.code}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-mono-num font-bold">
                {featuredInvite.uses} انضمام
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>رابط الدعوة الرسمي (riadchat.vercel.app):</span>
                <span className="font-mono-num text-amber-300">
                  دعواتك: {currentUser.referralCount || 0} · +
                  {((currentUser.referralRewardsGold || 0) / 1_000_000).toFixed(1)}M
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-2.5 py-2">
                <span
                  dir="ltr"
                  className="text-[11px] font-mono-num text-sky-200 truncate flex-1 text-left"
                >
                  {buildPublicWebUrl(featuredInvite)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(buildPublicWebUrl(featuredInvite), 'web')}
                  className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedKey === 'web' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedKey === 'web' ? 'نُسخ' : 'نسخ'}</span>
                </button>
              </div>
              {currentOrigin !== PUBLIC_INVITE_BASE_URL && (
                <button
                  type="button"
                  onClick={() => handleCopy(buildPreviewWebUrl(featuredInvite), 'preview')}
                  className="text-[10.5px] font-bold text-indigo-300 hover:text-white underline underline-offset-2 cursor-pointer"
                >
                  {copiedKey === 'preview'
                    ? '✓ تم نسخ رابط المعاينة الحالي للاختبار'
                    : 'نسخ رابط المعاينة الحالي للاختبار المباشر'}
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Smartphone className="w-3 h-3 text-violet-300" />
                <span>الرابط العميق للتطبيق الأصلي (Deep Link):</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5">
                <span
                  dir="ltr"
                  className="text-[10.5px] font-mono-num text-violet-200 truncate flex-1 text-left"
                >
                  {buildNativeUrl(featuredInvite)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(buildNativeUrl(featuredInvite), 'native')}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  {copiedKey === 'native' ? '✓' : 'نسخ'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleNativeShare(featuredInvite)}
              className="w-full min-h-[42px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة الرابط عبر تطبيقات الهاتف</span>
            </button>
          </div>
        )}

        {/* Redeem Invite Code Form */}
        <form onSubmit={handleRedeem} className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-300">
            لديك كود دعوة من صديق؟ فعّله هنا (+500,000 ذهبية):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value)}
              placeholder="مثال: RIYADH900 أو RC-..."
              dir="ltr"
              className="flex-1 h-10 rounded-xl bg-black/35 border border-white/15 px-3 text-xs font-mono-num text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs cursor-pointer shrink-0"
            >
              تفعيل
            </button>
          </div>
        </form>

        {/* Recent Invites List */}
        {activeInvites.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400">
              روابط الدعوة النشطة ({state.invites.length})
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
              {activeInvites.map((inv) => (
                <div
                  key={inv.code}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono-num font-bold text-white flex items-center gap-1.5">
                      <span>{inv.code}</span>
                      {inv.roomTitle && (
                        <span className="text-[10px] font-sans text-sky-300 truncate">
                          · {inv.roomTitle}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      بواسطة {inv.inviterName} · {inv.uses} استخدام
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNativeShare(inv)}
                    className="px-2.5 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                  >
                    مشاركة
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
