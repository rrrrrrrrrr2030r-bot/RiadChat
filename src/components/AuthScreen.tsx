import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { APP_ICON_PATH } from '../data/seedData';
import { isSupabaseConfigured } from '../lib/supabase';
import { useResolveInviteQuery } from '../hooks/useServerQueries';
import { resolveApiUrl } from '../utils/apiBase';
import { OwnerRecoveryView } from './OwnerRecoveryView';

type AuthMode = 'login' | 'register';
type AuthMethod = 'email' | 'phone';

export const AuthScreen: React.FC = () => {
  const {
    pendingReferralCode,
    lastGoogleHint,
    clearGoogleHint,
    loginWithEmail,
    registerWithEmail,
    sendPhoneOtp,
    verifyPhoneOtp,
    loginWithGoogle,
    loginWithFacebook,
    claimOwnerPassword,
  } = useApp();

  const [mode, setMode] = useState<AuthMode>(() =>
    pendingReferralCode ? 'register' : 'login'
  );
  const [method, setMethod] = useState<AuthMethod>('email');

  // Email & Password fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralInput, setReferralInput] = useState(pendingReferralCode || '');

  // Phone OTP fields
  const [phone, setPhone] = useState('+9665');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [previewOtpHint, setPreviewOtpHint] = useState<string | null>(null);

  // Google quick confirmation sheet (used only on first-time fallback when Supabase OAuth keys aren't set)
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleName, setGoogleName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');

  // Facebook quick modal when Supabase OAuth keys aren't set yet
  const [fbModalOpen, setFbModalOpen] = useState(false);
  const [fbName, setFbName] = useState('');
  const [fbEmail, setFbEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [ownerClaimRequired, setOwnerClaimRequired] = useState(false);
  const [ownerClaimOpen, setOwnerClaimOpen] = useState(false);
  const [ownerClaimIdentifier, setOwnerClaimIdentifier] = useState('');
  const [ownerClaimPassword, setOwnerClaimPassword] = useState('');
  const [ownerRecoveryOpen, setOwnerRecoveryOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.hash === '#owner-recovery' ||
      window.location.pathname.toLowerCase().endsWith('/owner-recovery')
    );
  });
  const { data: invitePreview = null } = useResolveInviteQuery(pendingReferralCode);

  useEffect(() => {
    const syncRecoveryHash = () => {
      const open =
        window.location.hash === '#owner-recovery' ||
        window.location.pathname.toLowerCase().endsWith('/owner-recovery');
      setOwnerRecoveryOpen(open);
    };
    window.addEventListener('hashchange', syncRecoveryHash);
    return () => window.removeEventListener('hashchange', syncRecoveryHash);
  }, []);

  const openOwnerRecovery = () => {
    setErrorText(null);
    setOwnerRecoveryOpen(true);
    try {
      window.history.replaceState(null, '', '#owner-recovery');
    } catch {
      // Ignore history restriction
    }
  };

  const closeOwnerRecovery = () => {
    setOwnerRecoveryOpen(false);
    try {
      if (window.location.hash === '#owner-recovery') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch {
      // Ignore history restriction
    }
  };

  useEffect(() => {
    let active = true;
    fetch(resolveApiUrl('/api/health'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ownerPasswordClaimRequired?: boolean } | null) => {
        if (active && data?.ownerPasswordClaimRequired) {
          setOwnerClaimRequired(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const code = (pendingReferralCode || '').trim();
    if (!code) return;
    setReferralInput(code);
    setMode('register');
  }, [pendingReferralCode]);

  const handleOwnerClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSubmitting(true);
    try {
      const res = await claimOwnerPassword(ownerClaimIdentifier, ownerClaimPassword);
      if (!res.ok) {
        setErrorText(res.error || 'تعذر تفعيل كلمة مرور المالك');
      } else {
        setOwnerClaimOpen(false);
        setOwnerClaimRequired(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSubmitting(true);
    try {
      const res =
        mode === 'register'
          ? await registerWithEmail(name, email, password, referralInput)
          : await loginWithEmail(email, password);
      if (!res.ok) {
        setErrorText(res.error || 'تعذر إكمال العملية، تحقق من البيانات');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSubmitting(true);
    try {
      const res = await sendPhoneOtp(phone);
      if (!res.ok) {
        setErrorText(res.error || 'تعذر إرسال رمز التحقق');
        return;
      }
      setOtpSent(true);
      setPreviewOtpHint(res.previewOtp || null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSubmitting(true);
    try {
      const res = await verifyPhoneOtp(phone, otpCode, name, referralInput);
      if (!res.ok) {
        setErrorText(res.error || 'رمز التحقق غير صحيح');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async (switchAccount = false) => {
    setErrorText(null);
    if (isSupabaseConfigured) {
      setSubmitting(true);
      try {
        const res = await loginWithGoogle({
          referralCode: referralInput,
          switchAccount,
        });
        if (!res.ok) {
          setErrorText(res.error || 'تعذر تسجيل الدخول عبر جوجل');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Direct 1-tap login without account chooser when a saved Google hint already exists
    if (!switchAccount && lastGoogleHint?.email) {
      setSubmitting(true);
      try {
        const res = await loginWithGoogle({
          email: lastGoogleHint.email,
          name: lastGoogleHint.name,
          referralCode: referralInput,
        });
        if (!res.ok) {
          setErrorText(res.error || 'تعذر الدخول المباشر عبر جوجل');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (switchAccount) {
      clearGoogleHint();
      setGoogleEmail('');
      setGoogleName('');
    }
    setGoogleModalOpen(true);
  };

  const handleGoogleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSubmitting(true);
    try {
      const res = await loginWithGoogle({
        name: googleName.trim() || undefined,
        email: googleEmail.trim(),
        referralCode: referralInput,
      });
      if (!res.ok) {
        setErrorText(res.error || 'تعذر تسجيل الدخول عبر جوجل');
      } else {
        setGoogleModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFacebookClick = async () => {
    setErrorText(null);
    if (isSupabaseConfigured) {
      setSubmitting(true);
      try {
        const res = await loginWithFacebook({ referralCode: referralInput });
        if (!res.ok) {
          setErrorText(res.error || 'تعذر الدخول عبر فيسبوك');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setFbModalOpen(true);
  };

  const handleFacebookFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSubmitting(true);
    try {
      const res = await loginWithFacebook({
        name: fbName.trim() || 'عضو فيسبوك',
        email: fbEmail.trim() || undefined,
        referralCode: referralInput,
      });
      if (!res.ok) {
        setErrorText(res.error || 'تعذر تسجيل الدخول عبر فيسبوك');
      } else {
        setFbModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (ownerRecoveryOpen) {
    return <OwnerRecoveryView onBack={closeOwnerRecovery} />;
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#09071A] bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.38),_rgba(37,99,235,0.18)_45%,_#09071A_82%)] text-white flex flex-col items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-md space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-22 h-22 rounded-3xl p-[2.5px] bg-gradient-to-tr from-violet-500 via-fuchsia-400 to-sky-400 shadow-[0_0_32px_rgba(168,85,247,0.55)]">
            <img
              src={APP_ICON_PATH}
              alt="رياض شات"
              className="w-full h-full rounded-[21px] object-cover object-center bg-[#1B3B60]"
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-white">
              رياض شات
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/85 mt-1">
              غرف الصوت المباشرة · الألعاب الملكية · الوكالات المعتمدة
            </p>
          </div>
        </div>

        {/* Incoming Referral Welcome Banner */}
        {invitePreview && (
          <div className="rounded-2xl bg-gradient-to-l from-violet-700/45 via-indigo-800/45 to-blue-700/45 border border-amber-300/45 px-4 py-3 flex items-center gap-3 shadow-[0_6px_24px_rgba(124,58,237,0.35)]">
            <span className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/50 text-amber-300 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5" />
            </span>
            <div className="min-w-0 text-xs leading-relaxed">
              <div className="font-display font-extrabold text-amber-200 truncate">
                دعوة خاصة من {invitePreview.inviterName}
              </div>
              <div className="text-indigo-100/90">
                سجّل الآن واحصل على{' '}
                <strong className="font-mono-num text-amber-300">
                  +{invitePreview.welcomeGold.toLocaleString('en-US')}
                </strong>{' '}
                ذهبية ترحيبية فورياً
                {invitePreview.roomTitle ? ` · غرفة «${invitePreview.roomTitle}»` : ''}
              </div>
            </div>
          </div>
        )}

        {/* Main Auth Card */}
        <div className="rounded-3xl bg-[#130D33]/92 border border-violet-400/30 p-5 sm:p-6 shadow-[0_20px_60px_rgba(15,10,48,0.75)] backdrop-blur-xl space-y-5">
          {/* Login / Register Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white/[0.06] border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorText(null);
              }}
              className={`min-h-[44px] rounded-xl text-sm font-display font-extrabold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-gradient-to-l from-violet-600 to-blue-600 text-white shadow-[0_4px_16px_rgba(124,58,237,0.5)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorText(null);
              }}
              className={`min-h-[44px] rounded-xl text-sm font-display font-extrabold transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-gradient-to-l from-violet-600 to-blue-600 text-white shadow-[0_4px_16px_rgba(124,58,237,0.5)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          {/* Auth Method Selector: Email vs Phone OTP */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMethod('email');
                setErrorText(null);
              }}
              className={`min-h-[44px] rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                method === 'email'
                  ? 'bg-violet-500/20 border-violet-400/70 text-white'
                  : 'bg-white/[0.03] border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Mail className="w-4 h-4 text-violet-300" />
              <span>البريد الإلكتروني</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMethod('phone');
                setErrorText(null);
              }}
              className={`min-h-[44px] rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                method === 'phone'
                  ? 'bg-sky-500/20 border-sky-400/70 text-white'
                  : 'bg-white/[0.03] border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Phone className="w-4 h-4 text-sky-300" />
              <span>رقم الهاتف (OTP)</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorText && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-400/45 px-3.5 py-2.5 text-xs font-bold text-rose-200">
              {errorText}
            </div>
          )}

          {/* EMAIL & PASSWORD FORM */}
          {method === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-indigo-200 block">الاسم الظاهر</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-indigo-300 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: سلطان الرياض"
                      className="w-full min-h-[46px] pr-10 pl-3.5 rounded-xl bg-black/35 border border-white/15 focus:border-violet-400 text-sm text-white placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-indigo-200 block">
                  {mode === 'login' ? 'البريد الإلكتروني أو رقم ID' : 'البريد الإلكتروني'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-indigo-300 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={mode === 'register' ? 'email' : 'text'}
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full min-h-[46px] pr-10 pl-3.5 rounded-xl bg-black/35 border border-white/15 focus:border-violet-400 text-sm text-white placeholder:text-slate-400 focus:outline-none text-left"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-indigo-200 block">كلمة المرور</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-indigo-300 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[46px] pr-10 pl-3.5 rounded-xl bg-black/35 border border-white/15 focus:border-violet-400 text-sm text-white placeholder:text-slate-400 focus:outline-none text-left"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-indigo-200 block">
                    كود الدعوة (اختياري — يمنحك +500,000 ذهبية)
                  </label>
                  <div className="relative">
                    <Gift className="w-4 h-4 text-amber-300 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      dir="ltr"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      placeholder="RIYADH900"
                      className="w-full min-h-[44px] pr-10 pl-3.5 rounded-xl bg-black/35 border border-amber-400/30 focus:border-amber-400 font-mono-num text-sm text-amber-200 placeholder:text-slate-500 focus:outline-none text-left"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] rounded-xl bg-gradient-to-l from-violet-600 via-purple-600 to-blue-600 hover:brightness-110 text-white font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(124,58,237,0.5)] cursor-pointer disabled:opacity-60 transition-all"
              >
                <span>
                  {submitting
                    ? 'جارٍ المعالجة...'
                    : mode === 'register'
                    ? 'إنشاء الحساب وتوليد ID فريد'
                    : 'دخول إلى رياض شات'}
                </span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              {mode === 'login' && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={openOwnerRecovery}
                    className="min-h-[40px] px-3 text-xs font-bold text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer transition-colors"
                  >
                    نسيت بيانات المالك؟ استعادة حساب المالك عبر البريد الرسمي
                  </button>
                </div>
              )}
            </form>
          )}

          {/* PHONE OTP FORM */}
          {method === 'phone' && (
            <form
              onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
              className="space-y-3.5"
            >
              {!otpSent ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-indigo-200 block">
                      رقم الهاتف (مع رمز الدولة)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-sky-300 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+966501234567"
                        className="w-full min-h-[46px] pr-10 pl-3.5 rounded-xl bg-black/35 border border-white/15 focus:border-sky-400 font-mono-num text-sm text-white placeholder:text-slate-400 focus:outline-none text-left"
                      />
                    </div>
                  </div>

                  {mode === 'register' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-indigo-200 block">
                        الاسم الظاهر (للحساب الجديد)
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="مثال: فهد العتيبي"
                        className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/15 focus:border-sky-400 text-sm text-white placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[48px] rounded-xl bg-gradient-to-l from-sky-500 to-blue-600 hover:brightness-110 text-white font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(56,189,248,0.4)] cursor-pointer disabled:opacity-60"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{submitting ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق (OTP)'}</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-xl bg-sky-500/15 border border-sky-400/40 px-3.5 py-2.5 text-xs text-sky-100 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>تم إرسال رمز التحقق إلى {phone}</span>
                    </div>
                    {previewOtpHint && (
                      <div className="text-[11px] text-amber-200 font-mono-num">
                        رمز التحقق للتجربة الفورية:{' '}
                        <strong className="text-white tracking-widest">{previewOtpHint}</strong>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-indigo-200 block">
                      أدخل رمز التحقق (6 أرقام)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      dir="ltr"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full min-h-[48px] px-4 rounded-xl bg-black/40 border border-sky-400/50 text-center font-mono-num text-lg tracking-[0.4em] text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setPreviewOtpHint(null);
                      }}
                      className="min-h-[46px] rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
                    >
                      تغيير الرقم
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || otpCode.length < 6}
                      className="min-h-[46px] rounded-xl bg-gradient-to-l from-violet-600 to-blue-600 hover:brightness-110 text-xs font-extrabold text-white cursor-pointer disabled:opacity-60"
                    >
                      {submitting ? 'جارٍ التحقق...' : 'تأكيد والدخول'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex-1 h-px bg-white/10" />
            <span>أو المتابعة السريعة عبر</span>
            <span className="flex-1 h-px bg-white/10" />
          </div>

          {/* Direct Google Login Button (No Forced Account Picker) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleGoogleClick(false)}
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-display font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(255,255,255,0.16)] cursor-pointer disabled:opacity-60 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span className="truncate">
                {lastGoogleHint?.email
                  ? `دخول مباشر عبر جوجل (${lastGoogleHint.email})`
                  : 'المتابعة المباشرة بحساب جوجل (Google)'}
              </span>
            </button>

            {lastGoogleHint?.email && (
              <button
                type="button"
                onClick={() => void handleGoogleClick(true)}
                disabled={submitting}
                className="w-full text-center text-[11px] font-bold text-indigo-300 hover:text-white transition-colors cursor-pointer"
              >
                تبديل حساب جوجل
              </button>
            )}
          </div>

          {/* Facebook Login Button */}
          <button
            type="button"
            onClick={handleFacebookClick}
            disabled={submitting}
            className="w-full min-h-[48px] rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-display font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(24,119,242,0.4)] cursor-pointer disabled:opacity-60 transition-colors"
          >
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.77l-.44 2.91h-2.33V22c4.78-.76 8.43-4.92 8.43-9.94z" />
            </svg>
            <span>المتابعة بحساب فيسبوك (Facebook)</span>
          </button>

          {/* Session Persistence & Security Footer */}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2 text-[11px] text-indigo-200/80">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>جلسة محمية بكوكي مشفّر وتشفير كلمات المرور على السيرفر</span>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={openOwnerRecovery}
                className="min-h-[36px] text-[11px] font-bold text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer"
              >
                صفحة استعادة حساب المالك (ID: 900)
              </button>
              {ownerClaimRequired && (
                <button
                  type="button"
                  onClick={() => setOwnerClaimOpen(true)}
                  className="min-h-[36px] text-[11px] font-bold text-amber-300 hover:text-amber-200 underline underline-offset-4 cursor-pointer"
                >
                  تفعيل كلمة مرور المالك الأساسي (أول تشغيل)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* One-Time First-Run Owner Password Claim Modal */}
      {ownerClaimOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleOwnerClaimSubmit}
            className="w-full max-w-sm rounded-3xl bg-[#161038] border border-amber-400/45 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 text-amber-300 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm font-display font-extrabold">تعيين كلمة مرور المالك (مرة واحدة)</h2>
                <p className="text-[11px] text-slate-300">
                  أدخل بريد المالك أو رقم المعرف (900) وكلمة مرور قوية (8 أحرف فأكثر)
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <input
                type="text"
                required
                dir="ltr"
                value={ownerClaimIdentifier}
                onChange={(e) => setOwnerClaimIdentifier(e.target.value)}
                placeholder="900 أو بريد المالك"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/15 text-sm text-white text-left focus:outline-none focus:border-amber-400"
              />
              <input
                type="password"
                required
                minLength={8}
                dir="ltr"
                value={ownerClaimPassword}
                onChange={(e) => setOwnerClaimPassword(e.target.value)}
                placeholder="كلمة المرور الجديدة (8+ أحرف)"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/15 text-sm text-white text-left focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOwnerClaimOpen(false)}
                className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 text-xs font-extrabold cursor-pointer"
              >
                {submitting ? 'جارٍ الحفظ...' : 'تفعيل ودخول'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Google First-Time Direct Confirmation Sheet (fallback when Supabase Google OAuth keys aren't set yet) */}
      {googleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleGoogleFallbackSubmit}
            className="w-full max-w-sm rounded-3xl bg-[#161038] border border-violet-400/40 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-display font-extrabold">الدخول المباشر عبر جوجل</h2>
                <p className="text-[11px] text-slate-300">
                  يُحفظ حسابك لتسجيل الدخول المباشر تلقائياً في المرات القادمة دون نافذة اختيار الحساب
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <input
                type="email"
                required
                dir="ltr"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/15 text-sm text-white text-left focus:outline-none focus:border-violet-400"
              />
              <input
                type="text"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                placeholder="الاسم الظاهر (اختياري)"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/15 text-sm text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGoogleModalOpen(false)}
                className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-extrabold cursor-pointer"
              >
                {submitting ? 'جارٍ الدخول...' : 'دخول مباشر'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Facebook Profile Confirmation Sheet (when Supabase Facebook OAuth keys are not yet added) */}
      {fbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleFacebookFallbackSubmit}
            className="w-full max-w-sm rounded-3xl bg-[#161038] border border-blue-400/40 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </span>
              <div>
                <h2 className="text-sm font-display font-extrabold">المتابعة عبر فيسبوك</h2>
                <p className="text-[11px] text-slate-300">
                  أدخل اسمك وبريدك المرتبط بحساب فيسبوك لإنشاء معرفك الفريد فوراً
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <input
                type="text"
                required
                value={fbName}
                onChange={(e) => setFbName(e.target.value)}
                placeholder="الاسم في فيسبوك"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/15 text-sm text-white focus:outline-none focus:border-blue-400"
              />
              <input
                type="email"
                dir="ltr"
                value={fbEmail}
                onChange={(e) => setFbEmail(e.target.value)}
                placeholder="facebook-email@example.com"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-black/35 border border-white/15 text-sm text-white text-left focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFbModalOpen(false)}
                className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-xs font-extrabold cursor-pointer"
              >
                {submitting ? 'جارٍ الدخول...' : 'تأكيد والمتابعة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
