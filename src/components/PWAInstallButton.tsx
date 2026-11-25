import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { APP_ICON_PATH } from '../data/seedData';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Suppress button when already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const standaloneUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  const handleCopyUrl = () => {
    if (!standaloneUrl) return;
    navigator.clipboard?.writeText(standaloneUrl).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="تثبيت تطبيق رياض شات على الهاتف"
        aria-label="تثبيت التطبيق"
        className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-l from-violet-600 to-blue-600 hover:brightness-110 text-white font-display font-bold shadow-[0_2px_12px_rgba(124,58,237,0.38)] transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
          compact ? 'h-8 px-2.5 text-[11px] sm:h-9 sm:px-3.5 sm:text-xs' : 'h-10 px-4 text-xs sm:text-sm'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden min-[420px]:inline' : 'inline'}>تثبيت التطبيق</span>
      </button>

      {guideOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="absolute inset-0"
            onClick={() => setGuideOpen(false)}
            aria-hidden="true"
          />
          <div
            dir="rtl"
            className="relative z-10 w-full max-w-sm rounded-3xl bg-[#120D2B] border border-violet-400/35 p-5 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={APP_ICON_PATH}
                  alt="رياض شات"
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-2xl object-cover border border-violet-300/40 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-display font-extrabold text-white truncate">
                    تثبيت تطبيق رياض شات
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    تطبيق مستقل يعمل بملء الشاشة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe ? (
              <div className="space-y-3 text-xs text-slate-200 leading-relaxed">
                <div className="rounded-2xl bg-amber-500/15 border border-amber-400/35 p-3 text-amber-100">
                  أنت تتصفح التطبيق حالياً من داخل نافذة المعاينة. إذا ثبّت الصفحة من هنا فسيتم تثبيت صفحة المحرر بدلاً من تطبيق <strong>رياض شات</strong>.
                </div>
                <ol className="space-y-2 list-decimal list-inside text-slate-200">
                  <li>افتح رابط التطبيق المباشر المستقل في متصفح Chrome أو Safari.</li>
                  <li>بعد الفتح، اضغط زر <strong>«تثبيت التطبيق»</strong> أو اختر من قائمة المتصفح <strong>«الإضافة إلى الشاشة الرئيسية»</strong>.</li>
                </ol>
                {standaloneUrl && (
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <a
                      href={standaloneUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] w-full rounded-xl bg-gradient-to-l from-violet-600 to-blue-500 hover:brightness-110 text-white font-display font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span>فتح التطبيق المستقل للتثبيت</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="min-h-[42px] w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>تم نسخ الرابط المباشر</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>نسخ رابط التطبيق المباشر</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : isIOS ? (
              <div className="space-y-3 text-xs text-slate-200 leading-relaxed">
                <div className="flex items-center gap-2 text-sky-300 font-bold">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>خطوات التثبيت على iPhone / iPad (Safari):</span>
                </div>
                <ol className="space-y-2 list-decimal list-inside">
                  <li>اضغط على زر <strong>المشاركة (Share)</strong> في شريط Safari السفلي.</li>
                  <li>مرّر للأسفل واختر <strong>«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</strong>.</li>
                  <li>اضغط <strong>«إضافة»</strong> ليظهر تطبيق رياض شات كأيقونة مستقلة.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-200 leading-relaxed">
                <div className="flex items-center gap-2 text-sky-300 font-bold">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>خطوات التثبيت على Android / Chrome:</span>
                </div>
                <ol className="space-y-2 list-decimal list-inside">
                  <li>اضغط على قائمة المتصفح (<strong>⋮</strong>) في الزاوية العلوية.</li>
                  <li>اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«الإضافة إلى الشاشة الرئيسية»</strong>.</li>
                  <li>أكد التثبيت ليفتح رياض شات مباشرةً كتطبيق مستقل بملء الشاشة.</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="min-h-[42px] w-full rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-200 cursor-pointer transition-colors"
            >
              حسناً
            </button>
          </div>
        </div>
      )}
    </>
  );
};
