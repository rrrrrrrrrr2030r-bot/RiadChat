import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { OwnerRecoveryAuditEntry, OwnerRecoveryStatus } from '../types';

const EVENT_LABELS: Record<OwnerRecoveryAuditEntry['event'], string> = {
  code_requested: 'طلب رمز استعادة',
  code_rejected: 'محاولة مرفوضة',
  locked_out: 'قفل أمني مؤقت',
  recovery_completed: 'استعادة مكتملة',
};

export const OwnerRecoveryAuditCard: React.FC = () => {
  const { opsRequest } = useApp();
  const [status, setStatus] = useState<OwnerRecoveryStatus | null>(null);
  const [entries, setEntries] = useState<OwnerRecoveryAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opsRequest<{
        status?: OwnerRecoveryStatus;
        auditLog?: OwnerRecoveryAuditEntry[];
      }>('/api/system/owner-recovery-audit', { method: 'GET' });
      if (!res.ok || !res.data) return;
      if (res.data.status) setStatus(res.data.status);
      if (Array.isArray(res.data.auditLog)) setEntries(res.data.auditLog);
    } finally {
      setLoading(false);
    }
  }, [opsRequest]);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  return (
    <section className="rounded-3xl bg-[#161038] border border-violet-500/35 p-4 sm:p-5 space-y-4 text-white">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-400/40 text-violet-200 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-display font-extrabold text-white">
              سجل أمان استعادة حساب المالك (ID: 900)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {status ? (
                <>
                  البريد المرجعي:{' '}
                  <span dir="ltr" className="font-mono-num text-sky-300 font-bold">
                    {status.maskedAdminEmailHint}
                  </span>
                  {' · '}
                  {status.emailDeliveryConfigured
                    ? 'إرسال SMTP/Resend مفعّل'
                    : status.devPreviewEnabled
                    ? 'وضع معاينة التطوير'
                    : 'SMTP غير مضبوط'}
                </>
              ) : (
                'توثيق طلبات وإتمام استعادة حساب المالك الرئيسي'
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void fetchAudit()}
          className="min-h-[40px] px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl bg-[#0F0B28] border border-violet-500/20 p-4 text-xs text-slate-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>لا توجد عمليات استعادة مسجّلة حتى الآن — الحساب في حالة أمان طبيعية.</span>
        </div>
      ) : (
        <div className="divide-y divide-white/10 rounded-2xl bg-[#0F0B28] border border-violet-500/20 overflow-hidden">
          {entries.slice(0, 12).map((entry) => {
            const eventColor =
              entry.event === 'recovery_completed'
                ? 'text-emerald-300'
                : entry.event === 'locked_out' || entry.event === 'code_rejected'
                ? 'text-rose-300'
                : 'text-sky-300';
            return (
              <div key={entry.id} className="p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <span className={`font-display font-bold ${eventColor}`}>
                    {EVENT_LABELS[entry.event] || entry.event}
                  </span>
                  <span dir="ltr" className="font-mono-num text-[11px] text-slate-400">
                    {new Date(entry.timestamp).toLocaleString('ar-SA')}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{entry.note}</p>
                <div className="text-[11px] text-slate-400 font-mono-num">
                  <span dir="ltr">{entry.maskedEmail}</span>
                  {' · IP: '}
                  <span dir="ltr">{entry.ipHint}</span>
                  {typeof entry.revokedSessions === 'number' && (
                    <span> · جلسات منتهية: {entry.revokedSessions}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
