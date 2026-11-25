import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Agency2FAChannel } from '../types';

export const Agency2FAGate: React.FC = () => {
  const {
    currentUser,
    isPrimaryAdmin,
    agency2faStatus,
    requestAgency2FA,
    verifyAgency2FA,
    setActiveTab,
  } = useApp();

  const defaultChannel: Agency2FAChannel =
    agency2faStatus?.hasEmail || !agency2faStatus?.hasPhone ? 'email' : 'sms';

  const [channel, setChannel] = useState<Agency2FAChannel>(defaultChannel);
  const [customDestination, setCustomDestination] = useState('');
  const [step, setStep] = useState<'channel' | 'verify'>('channel');
  const [maskedDest, setMaskedDest] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('');
  const [previewOtp, setPreviewOtp] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendSec, setResendSec] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (resendSec <= 0) return;
    const timer = window.setInterval(() => {
      setResendSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSec]);

  const hasRegisteredForChannel =
    channel === 'email' ? Boolean(agency2faStatus?.hasEmail) : Boolean(agency2faStatus?.hasPhone);

  const registeredMask =
    channel === 'email' ? agency2faStatus?.maskedEmail || '' : agency2faStatus?.maskedPhone || '';

  const handleRequestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setErrorMsg('');

    if (!hasRegisteredForChannel && !customDestination.trim()) {
      setErrorMsg(
        channel === 'email'
          ? 'يرجى إدخال بريد إلكتروني صحيح لاستلام رمز التحقق'
          : 'يرجى إدخال رقم هاتف مع رمز الدولة لاستلام رسالة SMS'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await requestAgency2FA(
        channel,
        hasRegisteredForChannel ? undefined : customDestination.trim()
      );
      if (!res.ok) {
        setErrorMsg(res.error || 'تعذر إرسال رمز التحقق');
        return;
      }
      setMaskedDest(res.maskedDestination || registeredMask || customDestination.trim());
      setDeliveryMode(res.deliveryMode || '');
      setPreviewOtp(res.previewOtp || '');
      setResendSec(res.resendAfterSec || 60);
      setDigits(['', '', '', '', '', '']);
      setStep('verify');
      window.setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerify = async (codeStr: string) => {
    if (submitting) return;
    if (codeStr.length !== 6) {
      setErrorMsg('يرجى إدخال الرمز المكون من 6 أرقام كاملاً');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await verifyAgency2FA(codeStr);
      if (!res.ok) {
        setErrorMsg(res.error || 'رمز التحقق غير صحيح');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDigitChange = (idx: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[idx] = '';
      setDigits(next);
      return;
    }
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      pasted.forEach((ch, i) => {
        next[i] = ch;
      });
      setDigits(next);
      const focusIdx = Math.min(5, pasted.length);
      inputRefs.current[focusIdx]?.focus();
      if (pasted.length === 6) {
        void submitVerify(next.join(''));
      }
      return;
    }
    const next = [...digits];
    next[idx] = cleaned[0];
    setDigits(next);
    if (idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    } else if (next.every((d) => d.length === 1)) {
      void submitVerify(next.join(''));
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="max-w-xl mx-auto px-3 py-6">
      <div className="rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
        {/* Clean single-row top header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            aria-label="رجوع"
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-800 flex items-center justify-center text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-display font-bold text-white">
              المصادقة الثنائية لصلاحيات الوكيل
            </h1>
            <p className="text-xs text-slate-400">
              {isPrimaryAdmin ? 'المالك الرئيسي · ID 900' : `وكيل معتمد · ${currentUser.name}`} · جلسة{' '}
              <span className="font-mono-num">{agency2faStatus?.sessionDurationMin || 30}</span> دقيقة
            </p>
          </div>
          <div className="min-h-[44px] min-w-[44px] rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {step === 'channel' ? (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-sm font-bold text-slate-100">
                  اختر قناة استلام رمز التحقق المؤقت (OTP)
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  لحماية عمليات الشحن والتحويل الحساسة، يُطلب تأكيد هويتك برمز مكون من 6 أرقام مرة كل 30 دقيقة.
                </p>
              </div>

              {/* Segmented channel selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setChannel('email');
                    setErrorMsg('');
                  }}
                  className={`min-h-[48px] px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    channel === 'email'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>البريد الإلكتروني</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChannel('sms');
                    setErrorMsg('');
                  }}
                  className={`min-h-[48px] px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    channel === 'sms'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>رسالة SMS</span>
                </button>
              </div>

              {hasRegisteredForChannel ? (
                <div className="rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs text-slate-400">
                      {channel === 'email' ? 'البريد المسجل على حسابك' : 'رقم الجوال المسجل على حسابك'}
                    </div>
                    <div dir="ltr" className="text-sm font-mono-num font-semibold text-white truncate">
                      {registeredMask}
                    </div>
                  </div>
                  <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    {channel === 'email'
                      ? 'أدخل بريدك الإلكتروني لربطه واستلام الرمز:'
                      : 'أدخل رقم الجوال مع رمز الدولة (مثال: +9665XXXXXXXX):'}
                  </label>
                  <input
                    type={channel === 'email' ? 'email' : 'tel'}
                    dir="ltr"
                    value={customDestination}
                    onChange={(e) => setCustomDestination(e.target.value)}
                    placeholder={channel === 'email' ? 'agent@example.com' : '+966501234567'}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 flex items-start gap-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-display font-extrabold text-sm transition-colors cursor-pointer"
              >
                {submitting ? 'جارٍ إرسال رمز التحقق...' : 'إرسال رمز التحقق الآن'}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-white">أدخل رمز التحقق المكون من 6 أرقام</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('channel');
                      setErrorMsg('');
                    }}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer whitespace-nowrap"
                  >
                    تغيير القناة
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  تم إرسال الرمز إلى{' '}
                  <span dir="ltr" className="font-mono-num text-slate-200 font-semibold">
                    {maskedDest}
                  </span>{' '}
                  · صالح لمدة 5 دقائق
                </p>
              </div>

              {previewOtp && deliveryMode === 'dev_preview' && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>وضع التطوير (قبل ربط Twilio/SMTP) — رمز التحقق:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const arr = previewOtp.slice(0, 6).split('');
                      setDigits(arr);
                      void submitVerify(previewOtp);
                    }}
                    className="font-mono-num text-base font-extrabold tracking-widest text-emerald-300 hover:text-emerald-200 underline underline-offset-4 cursor-pointer"
                  >
                    {previewOtp}
                  </button>
                </div>
              )}

              {/* 6-digit touch-friendly OTP inputs */}
              <div dir="ltr" className="grid grid-cols-6 gap-2 sm:gap-3">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    aria-label={`الرقم ${idx + 1} من رمز التحقق`}
                    className="min-h-[52px] w-full text-center font-mono-num text-xl font-bold rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                ))}
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 flex items-start gap-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                disabled={submitting || digits.join('').length !== 6}
                onClick={() => void submitVerify(digits.join(''))}
                className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-display font-extrabold text-sm transition-colors cursor-pointer"
              >
                {submitting ? 'جارٍ التحقق...' : 'تأكيد الرمز وفتح لوحة الوكيل'}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {resendSec > 0 ? (
                    <span>
                      إعادة الإرسال متاحة بعد <span className="font-mono-num font-bold text-slate-200">{resendSec}</span> ث
                    </span>
                  ) : (
                    <span>لم يصلك الرمز؟</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={resendSec > 0 || submitting}
                  onClick={() => void handleRequestCode()}
                  className="inline-flex items-center gap-1.5 font-bold text-amber-400 hover:text-amber-300 disabled:opacity-40 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة إرسال الرمز</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
