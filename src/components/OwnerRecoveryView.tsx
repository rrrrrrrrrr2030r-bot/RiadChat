import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { APP_ICON_PATH } from '../data/seedData';
import type { OwnerRecoveryStatus } from '../types';
import { resolveApiUrl } from '../utils/apiBase';

interface OwnerRecoveryViewProps {
  onBack: () => void;
}

export const OwnerRecoveryView: React.FC<OwnerRecoveryViewProps> = ({ onBack }) => {
  const { requestOwnerRecoveryCode, completeOwnerRecovery } = useApp();

  const [step, setStep] = useState<1 | 2>(1);
  const [status, setStatus] = useState<OwnerRecoveryStatus | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [maskedEmail, setMaskedEmail] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'resend' | 'smtp' | 'dev_preview' | null>(null);
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(resolveApiUrl('/api/auth/owner-recovery/status'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: (OwnerRecoveryStatus & { ok?: boolean }) | null) => {
        if (!active || !data?.ok) return;
        setStatus(data);
        if (data.cooldownRemainingSec > 0) {
          setCooldownSec(data.cooldownRemainingSec);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setInterval(() => {
      setCooldownSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownSec]);

  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitting || cooldownSec > 0) return;
    setErrorText(null);
    setInfoText(null);
    setSubmitting(true);
    try {
      const res = await requestOwnerRecoveryCode(email);
      if (!res.ok) {
        setErrorText(res.error || 'تعذر إرسال رمز الاستعادة');
        if (res.retryAfterSec && res.retryAfterSec > 0) {
          setCooldownSec(res.retryAfterSec);
        }
        return;
      }
      setMaskedEmail(res.maskedEmail || status?.maskedAdminEmailHint || '');
      setDeliveryMode(res.deliveryMode || null);
      setPreviewOtp(res.previewOtp || null);
      setCooldownSec(res.resendCooldownSec || 60);
      setStep(2);
      setInfoText(
        res.deliveryMode === 'dev_preview'
          ? 'تم إنشاء رمز الاستعادة في وضع المعاينة للتطوير — أدخله أدناه لتعيين بيانات الدخول الجديدة.'
          : 'تم إرسال رمز الاستعادة المكون من 6 أرقام إلى بريد المالك المسجّل (صالح لمدة 10 دقائق).'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorText(null);

    const cleanCode = code.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setErrorText('يرجى إدخال رمز الاستعادة المكون من 6 أرقام');
      return;
    }
    if (newPassword.length < 8) {
      setErrorText('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorText('كلمتا المرور غير متطابقتين');
      return;
    }

    setSubmitting(true);
    try {
      const res = await completeOwnerRecovery({
        code: cleanCode,
        newPassword,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      if (!res.ok) {
        setErrorText(res.error || 'تعذر إتمام استعادة حساب المالك');
        return;
      }
      // Clear recovery hash on successful sign-in
      if (window.location.hash === '#owner-recovery') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const passwordsMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-gradient-to-b from-[#09071A] via-[#130C32] to-[#080616] text-white flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-md space-y-5">
        {/* Back navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3 -mr-2 rounded-xl text-sm font-bold text-indigo-200 hover:text-white hover:bg-white/[0.06] inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowRight className="w-4 h-4 shrink-0" />
            <span>العودة لتسجيل الدخول</span>
          </button>
          <span className="text-xs text-slate-400 font-mono-num">ID: 900</span>
        </div>

        {/* Header Identity */}
        <div className="flex items-center gap-3.5 px-1">
          <img
            src={APP_ICON_PATH}
            alt="رياض شات"
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-2xl object-cover border border-violet-400/40 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-white leading-tight">
              استعادة حساب المالك
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              الخطوة {step} من 2 ·{' '}
              {step === 1
                ? 'التحقق عبر البريد الرسمي المسجّل'
                : 'تأكيد الرمز وتعيين كلمة المرور الجديدة'}
            </p>
          </div>
        </div>

        {/* Main Single-Elevation Recovery Card */}
        <div className="rounded-3xl bg-[#130D33]/92 border border-violet-400/30 p-5 sm:p-6 shadow-[0_20px_60px_rgba(15,10,48,0.7)] space-y-4">
          {/* Delivery status metadata line (clean unboxed typography) */}
          {status && (
            <div className="text-xs text-slate-300 leading-relaxed pb-3 border-b border-white/10">
              <span>البريد المرجعي: </span>
              <span dir="ltr" className="font-mono-num font-bold text-sky-300">
                {status.maskedAdminEmailHint}
              </span>
              <span aria-hidden="true" className="mx-1.5 text-slate-500">
                ·
              </span>
              <span>
                {status.emailDeliveryConfigured
                  ? 'إرسال البريد مفعّل (SMTP / Resend)'
                  : status.devPreviewEnabled
                  ? 'وضع معاينة التطوير مفعّل'
                  : 'يتطلب ضبط SMTP في إعدادات الإنتاج'}
              </span>
            </div>
          )}

          {errorText && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/15 border border-rose-400/45 px-3.5 py-2.5 text-xs font-bold text-rose-200 leading-relaxed"
            >
              {errorText}
            </div>
          )}

          {infoText && !errorText && (
            <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-3.5 py-2.5 text-xs font-semibold text-emerald-200 leading-relaxed">
              {infoText}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="owner-recovery-email"
                  className="text-xs font-bold text-indigo-200 block"
                >
                  البريد الإلكتروني للمالك (المسجّل في PRIMARY_ADMIN_EMAIL)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-violet-300 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="owner-recovery-email"
                    type="email"
                    required
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@example.com"
                    className="w-full min-h-[48px] pr-10 pl-3.5 rounded-xl bg-black/35 border border-white/15 focus:border-violet-400 text-sm text-white placeholder:text-slate-500 focus:outline-none text-left"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  يُرسل رمز الاستعادة حصرياً إلى البريد الرسمي المعتمد في متغير البيئة ولا يُرسل لأي بريد آخر.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || cooldownSec > 0}
                className="w-full min-h-[48px] rounded-xl bg-gradient-to-l from-violet-600 via-purple-600 to-blue-600 hover:brightness-110 text-white font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(124,58,237,0.45)] cursor-pointer disabled:opacity-60 transition-all"
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>
                  {submitting
                    ? 'جارٍ إرسال رمز الاستعادة...'
                    : cooldownSec > 0
                    ? `انتظر ${cooldownSec} ثانية قبل إعادة الطلب`
                    : 'إرسال رمز الاستعادة إلى البريد'}
                </span>
              </button>

              {status?.hasPendingChallenge && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorText(null);
                    setMaskedEmail(status.maskedAdminEmailHint);
                    setStep(2);
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-white/15 hover:bg-white/[0.06] text-xs font-bold text-indigo-200 cursor-pointer transition-colors"
                >
                  لدي رمز استعادة صالح بالفعل — المتابعة للخطوة الثانية
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={handleCompleteRecovery} className="space-y-4">
              {/* Dev-preview OTP box (only populated by server when !isProd & SMTP unconfigured) */}
              {previewOtp && deliveryMode === 'dev_preview' && (
                <div className="rounded-2xl bg-sky-500/15 border border-sky-400/45 p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-sky-200">
                    رمز الاستعادة (وضع معاينة التطوير فقط)
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      dir="ltr"
                      className="font-mono-num text-xl font-black tracking-[0.3em] text-white"
                    >
                      {previewOtp}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCode(previewOtp)}
                      className="min-h-[38px] px-3 rounded-lg bg-sky-500/25 hover:bg-sky-500/40 text-xs font-bold text-sky-100 cursor-pointer whitespace-nowrap"
                    >
                      تعبئة تلقائية
                    </button>
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-300">
                أدخل الرمز المرسل إلى{' '}
                <span dir="ltr" className="font-mono-num font-bold text-sky-300">
                  {maskedEmail || status?.maskedAdminEmailHint}
                </span>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="owner-recovery-code"
                  className="text-xs font-bold text-indigo-200 block"
                >
                  رمز الاستعادة (6 أرقام)
                </label>
                <input
                  id="owner-recovery-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full min-h-[48px] px-4 rounded-xl bg-black/40 border border-white/15 focus:border-sky-400 font-mono-num text-lg font-extrabold tracking-[0.35em] text-center text-white placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="owner-recovery-password"
                  className="text-xs font-bold text-indigo-200 block"
                >
                  كلمة المرور الجديدة (8 أحرف على الأقل)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-violet-300 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="owner-recovery-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={128}
                    dir="ltr"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[46px] pr-10 pl-11 rounded-xl bg-black/35 border border-white/15 focus:border-violet-400 text-sm text-white placeholder:text-slate-500 focus:outline-none text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="w-10 h-10 absolute left-1 top-1/2 -translate-y-1/2 rounded-lg text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="owner-recovery-confirm"
                  className="text-xs font-bold text-indigo-200 block"
                >
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-violet-300 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="owner-recovery-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={128}
                    dir="ltr"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[46px] pr-10 pl-3.5 rounded-xl bg-black/35 border border-white/15 focus:border-violet-400 text-sm text-white placeholder:text-slate-500 focus:outline-none text-left"
                  />
                </div>
                {confirmPassword && (
                  <p
                    className={`text-[11px] font-semibold flex items-center gap-1 ${
                      passwordsMatch ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {passwordsMatch && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    <span>
                      {passwordsMatch ? 'كلمتا المرور متطابقتان' : 'كلمتا المرور غير متطابقتين'}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="owner-recovery-phone"
                  className="text-xs font-bold text-slate-300 block"
                >
                  تحديث رقم الهاتف مع رمز الدولة (اختياري)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-sky-300 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="owner-recovery-phone"
                    type="tel"
                    dir="ltr"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+9677xxxxxxxx"
                    className="w-full min-h-[46px] pr-10 pl-3.5 rounded-xl bg-black/35 border border-white/15 focus:border-sky-400 font-mono-num text-sm text-white placeholder:text-slate-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] rounded-xl bg-gradient-to-l from-violet-600 via-purple-600 to-blue-600 hover:brightness-110 text-white font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(124,58,237,0.45)] cursor-pointer disabled:opacity-60 transition-all"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{submitting ? 'جارٍ التأكيد والدخول...' : 'تأكيد الاستعادة والدخول الآن'}</span>
              </button>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setErrorText(null);
                  }}
                  className="min-h-[40px] px-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  تغيير البريد
                </button>
                <button
                  type="button"
                  disabled={submitting || cooldownSec > 0 || !email.trim()}
                  onClick={() => void handleRequestCode()}
                  className="min-h-[40px] px-2 text-xs font-bold text-sky-300 hover:text-sky-200 disabled:text-slate-500 inline-flex items-center gap-1.5 cursor-pointer font-mono-num"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {cooldownSec > 0 ? `إعادة الإرسال بعد ${cooldownSec}ث` : 'إعادة إرسال الرمز'}
                  </span>
                </button>
              </div>
            </form>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed pt-3 border-t border-white/10">
            لأمان حساب المالك: إتمام الاستعادة يُنهي جميع الجلسات النشطة السابقة (الويب، WebSocket، وجلسات 2FA) ويوثّق العملية في سجل الأمان.
          </p>
        </div>
      </div>
    </div>
  );
};
