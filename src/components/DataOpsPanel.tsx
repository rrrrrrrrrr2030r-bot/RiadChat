import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Database,
  Download,
  Gauge,
  GitBranch,
  HardDriveDownload,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { OpsOverviewResponse } from '../types';
import { resolveApiUrl } from '../utils/apiBase';

type OpsSubTab = 'monitor' | 'backups' | 'migrations' | 'stress';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar-SA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const DataOpsPanel: React.FC = () => {
  const { isPrimaryAdmin, fetchOpsOverview, opsRequest, showToast } = useApp();

  const [subTab, setSubTab] = useState<OpsSubTab>('monitor');
  const [overview, setOverview] = useState<OpsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Governance / Webhook form
  const [alertWebhookInput, setAlertWebhookInput] = useState('');
  const [backupWebhookInput, setBackupWebhookInput] = useState('');

  // Explicit Owner confirmation modal before destructive/rollback/migration actions
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOpsOverview();
      if (data) setOverview(data);
    } finally {
      setLoading(false);
    }
  }, [fetchOpsOverview]);

  useEffect(() => {
    if (!isPrimaryAdmin) return;
    void reload();
  }, [isPrimaryAdmin, reload]);

  if (!isPrimaryAdmin) {
    return null;
  }

  const runAction = async (key: string, fn: () => Promise<void>) => {
    if (busyAction) return;
    setBusyAction(key);
    try {
      await fn();
      await reload();
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportOffsiteFile = async (backupId?: string) => {
    setBusyAction('export');
    try {
      const query = backupId ? `?backupId=${encodeURIComponent(backupId)}` : '';
      const res = await fetch(resolveApiUrl(`/api/ops/backups/export${query}`), {
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) {
        showToast('تعذر تنزيل النسخة الاحتياطية المشفرة', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backupId || 'riyadh-chat-backup'}.riadbackup.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('تم تصدير النسخة الاحتياطية المشفرة خارج السيرفر بنجاح', 'success');
    } catch {
      showToast('حدث خطأ أثناء تصدير النسخة الاحتياطية', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const latestProbe = overview?.monitor.latest;
  const statusLabel =
    latestProbe?.status === 'down'
      ? 'متوقف'
      : latestProbe?.status === 'degraded'
      ? 'بطء ملحوظ'
      : 'يعمل بكفاءة';

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-display font-bold text-white">
            مركز حماية البيانات وتحمّل الضغط (ID: 900)
          </h2>
          <p className="text-xs text-slate-400">
            نسخ يومي 30 يوم · استرجاع لأي نقطة زمنية · ترحيلات داخل Transaction · فحص كل دقيقة · حماية 429
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading || Boolean(busyAction)}
            onClick={() => void reload()}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث الحالة</span>
          </button>
          <button
            type="button"
            disabled={Boolean(busyAction) || !overview?.backups.length}
            onClick={() => {
              const prev = overview?.backups[0];
              if (!prev) return;
              setConfirmModal({
                title: 'الرجوع للنسخة السابقة بضغطة واحدة',
                description: `سيتم إنشاء لقطة أمان حالية أولاً، ثم استرجاع النسخة (${prev.id}) بتاريخ ${formatShortDate(prev.createdAt)}. هل تؤكد الاسترجاع؟`,
                confirmLabel: 'تأكيد الاسترجاع الآن',
                onConfirm: async () => {
                  const res = await opsRequest('/api/ops/backups/rollback', {
                    body: { backupId: prev.id, ownerConfirmed: true },
                  });
                  if (res.ok) {
                    showToast('تمت استعادة النسخة السابقة بنجاح!', 'success');
                  } else {
                    showToast(res.error || 'تعذر تنفيذ الاسترجاع', 'error');
                  }
                },
              });
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-xs font-extrabold text-slate-950 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>رجوع للنسخة السابقة</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation segmented control */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800">
        {[
          { id: 'monitor' as const, label: 'المراقبة والتنبيهات', icon: Activity },
          { id: 'backups' as const, label: 'النسخ والأرشيف', icon: Database },
          { id: 'migrations' as const, label: 'الترحيلات والحوكمة', icon: GitBranch },
          { id: 'stress' as const, label: 'اختبار الضغط والأداء', icon: Gauge },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading && !overview ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center text-sm text-slate-400">
          جارٍ تحميل بيانات المراقبة وحماية القاعدة...
        </div>
      ) : null}

      {/* 1. 1-MINUTE MONITOR & ALERTS */}
      {overview && subTab === 'monitor' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
              <div className="text-xs text-slate-400">حالة الخادم (فحص كل 60ث)</div>
              <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusLabel}</span>
              </div>
              <div className="text-xs text-slate-400 font-mono-num">
                الجاهزية {overview.monitor.uptimePct}%
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
              <div className="text-xs text-slate-400">زمن الاستجابة / تأخر الحلقة</div>
              <div className="text-lg font-bold text-white font-mono-num">
                {latestProbe?.responseMs ?? 0}ms / {latestProbe?.eventLoopLagMs ?? 0}ms
              </div>
              <div className="text-xs text-slate-400">
                آخر فحص {formatShortDate(latestProbe?.checkedAt)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
              <div className="text-xs text-slate-400">الذاكرة والاتصالات الحية</div>
              <div className="text-lg font-bold text-white font-mono-num">
                {latestProbe?.heapUsedMb ?? 0} MB
              </div>
              <div className="text-xs text-slate-400 font-mono-num">
                WS: {latestProbe?.wsClients ?? 0} · طلبات نشطة: {overview.traffic.activeRequests}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
              <div className="text-xs text-slate-400">حماية الزحمة (HTTP 429)</div>
              <div className="text-lg font-bold text-amber-400 font-mono-num">
                Retry-After: {overview.traffic.retryAfterSec}s
              </div>
              <div className="text-xs text-slate-400 font-mono-num">
                تمت خدمتها: {overview.traffic.totalServed} · صُدّت: {overview.traffic.totalRejected429}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">سجل الفحص الدوري كل دقيقة</h3>
                <p className="text-xs text-slate-400">
                  التنبيه الخارجي عبر Webhook:{' '}
                  <span className={overview.alertWebhookConfigured ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                    {overview.alertWebhookConfigured ? 'مربوط ومفعّل' : 'غير مضبوط (تنبيهات داخلية فقط)'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() =>
                  void runAction('probe', async () => {
                    const res = await opsRequest('/api/ops/monitor/check-now');
                    if (res.ok) showToast('تم تنفيذ فحص صحة فوري للخادم', 'success');
                  })
                }
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>فحص الآن</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-2 font-semibold">الوقت</th>
                    <th className="py-2 px-2 font-semibold">الحالة</th>
                    <th className="py-2 px-2 font-semibold">الاستجابة</th>
                    <th className="py-2 px-2 font-semibold">الذاكرة</th>
                    <th className="py-2 px-2 font-semibold">المتصلون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {overview.monitor.history.slice(0, 8).map((item) => (
                    <tr key={item.checkedAt}>
                      <td className="py-2 px-2 text-slate-300 font-mono-num">
                        {formatShortDate(item.checkedAt)}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={
                            item.status === 'healthy'
                              ? 'text-emerald-400 font-bold'
                              : item.status === 'degraded'
                              ? 'text-amber-400 font-bold'
                              : 'text-rose-400 font-bold'
                          }
                        >
                          {item.status === 'healthy' ? 'سليم' : item.status === 'degraded' ? 'تحذير' : 'عطل'}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono-num text-slate-200">{item.responseMs} ms</td>
                      <td className="py-2 px-2 font-mono-num text-slate-200">{item.heapUsedMb} MB</td>
                      <td className="py-2 px-2 font-mono-num text-slate-200">{item.wsClients}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optional HTTPS Webhook Alert & Offsite Backup URL configuration */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">ربط تنبيهات التعطل والنسخ الخارجي (HTTPS Webhook)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">رابط Webhook لتنبيه الأعطال الفوري (اختياري)</label>
                <input
                  type="url"
                  dir="ltr"
                  value={alertWebhookInput}
                  onChange={(e) => setAlertWebhookInput(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">رابط Webhook لرفع النسخ المشفرة خارج السيرفر (اختياري)</label>
                <input
                  type="url"
                  dir="ltr"
                  value={backupWebhookInput}
                  onChange={(e) => setBackupWebhookInput(e.target.value)}
                  placeholder="https://backup.example.com/ingest"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() =>
                void runAction('save-webhooks', async () => {
                  const res = await opsRequest('/api/ops/governance', {
                    body: {
                      ...(alertWebhookInput.trim() ? { alertWebhookUrl: alertWebhookInput.trim() } : {}),
                      ...(backupWebhookInput.trim() ? { backupWebhookUrl: backupWebhookInput.trim() } : {}),
                    },
                  });
                  if (res.ok) {
                    setAlertWebhookInput('');
                    setBackupWebhookInput('');
                    showToast('تم حفظ إعدادات الـ Webhook الآمنة بنجاح', 'success');
                  } else {
                    showToast(res.error || 'رابط Webhook غير صالح (يجب أن يكون HTTPS عام)', 'error');
                  }
                })
              }
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
            >
              حفظ روابط الـ Webhook
            </button>
          </div>
        </div>
      )}

      {/* 2. DAILY BACKUPS (30 DAYS), PITR, RESTORE DRILL & SOFT-DELETE ARCHIVE */}
      {overview && subTab === 'backups' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  النسخ الاحتياطي اليومي ({overview.retentionDays} يوماً) ولقطات النقطة الزمنية (PITR)
                </h3>
                <p className="text-xs text-slate-400">
                  التشفير على القرص: {overview.dbEncryptedAtRest ? 'AES-256-GCM مفعّل' : 'مفعل بصلاحيات 0600 وبصمة SHA-256'} ·
                  إجمالي اللقطات: <span className="font-mono-num">{overview.backups.length}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() =>
                    void runAction('backup-now', async () => {
                      const res = await opsRequest('/api/ops/backups/create', {
                        body: { kind: 'manual', reason: 'owner-manual' },
                      });
                      if (res.ok) showToast('تم إنشاء لقطة احتياطية فورية محمية', 'success');
                    })
                  }
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-extrabold text-slate-950 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <HardDriveDownload className="w-3.5 h-3.5" />
                  <span>نسخة احتياطية الآن</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => void handleExportOffsiteFile()}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير نسخة خارج السيرفر</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() =>
                    void runAction('drill', async () => {
                      const res = await opsRequest<{ drill?: { passed?: boolean } }>(
                        '/api/ops/backups/restore-drill'
                      );
                      if (res.ok && res.data?.drill?.passed) {
                        showToast('نجحت تجربة الاسترجاع على النسخة المعزولة 100%', 'success');
                      } else {
                        showToast(res.error || 'تعذر إتمام تجربة الاسترجاع', 'error');
                      }
                    })
                  }
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>تجربة استرجاع الآن</span>
                </button>
                {overview.backupWebhookConfigured && (
                  <button
                    type="button"
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      void runAction('offsite-push', async () => {
                        const res = await opsRequest('/api/ops/backups/offsite-push');
                        if (res.ok) showToast('تم رفع النسخة المشفرة للوجهة الخارجية بنجاح', 'success');
                        else showToast(res.error || 'تعذر الرفع للوجهة الخارجية', 'error');
                      })
                    }
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>رفع خارجي الآن</span>
                  </button>
                )}
              </div>
            </div>

            {overview.lastRestoreDrill && (
              <div className="rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 ${
                      overview.lastRestoreDrill.passed ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  />
                  <span>
                    آخر تجربة استرجاع شهرية/يدوية:{' '}
                    <strong className={overview.lastRestoreDrill.passed ? 'text-emerald-400' : 'text-rose-400'}>
                      {overview.lastRestoreDrill.passed ? 'ناجحة وسليمة' : 'تحتاج مراجعة'}
                    </strong>
                  </span>
                </div>
                <div className="text-slate-400 font-mono-num">
                  {formatShortDate(overview.lastRestoreDrill.ranAt)} · مستخدمون: {overview.lastRestoreDrill.usersVerified} ·
                  غرف: {overview.lastRestoreDrill.roomsVerified} · {overview.lastRestoreDrill.durationMs}ms
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-2">المعرّف والنوع</th>
                    <th className="py-2 px-2">التاريخ</th>
                    <th className="py-2 px-2">الحجم</th>
                    <th className="py-2 px-2">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {overview.backups.slice(0, 10).map((b) => (
                    <tr key={b.id}>
                      <td className="py-2.5 px-2">
                        <div className="font-mono-num text-slate-100 font-semibold">{b.id}</div>
                        <div className="text-[11px] text-slate-400">
                          {b.kind === 'daily' ? 'نسخة يومية (30 يوم)' : b.kind === 'pitr' ? 'لقطة زمنية PITR' : 'لقطة يدوية'} · {b.reason}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono-num text-slate-300">
                        {formatShortDate(b.createdAt)}
                      </td>
                      <td className="py-2.5 px-2 font-mono-num text-slate-300">
                        {formatBytes(b.sizeBytes)}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleExportOffsiteFile(b.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                          >
                            تنزيل
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmModal({
                                title: 'استرجاع نقطة زمنية (PITR)',
                                description: `سيتم استرجاع حالة قاعدة البيانات إلى اللقطة (${b.id}) بتاريخ ${formatShortDate(b.createdAt)} بعد أخذ لقطة أمان حالية.`,
                                confirmLabel: 'تأكيد الاسترجاع لهذه النقطة',
                                onConfirm: async () => {
                                  const res = await opsRequest('/api/ops/backups/rollback', {
                                    body: { backupId: b.id, ownerConfirmed: true },
                                  });
                                  if (res.ok) showToast('تم استرجاع النقطة الزمنية بنجاح', 'success');
                                  else showToast(res.error || 'تعذر الاسترجاع', 'error');
                                },
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold cursor-pointer"
                          >
                            استرجاع
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Soft-Delete Archive (Restore instead of permanent loss) */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">الأرشيف الآمن (Soft Delete — الاستعادة بدل الفقدان)</h3>
                <p className="text-xs text-slate-400">
                  أي غرفة أو مشرف يتم حذفه يُحفظ تلقائياً هنا مع منع الحذف العشوائي بدون معرف محدد.
                </p>
              </div>
              <ArchiveRestore className="w-5 h-5 text-amber-400" />
            </div>

            {overview.archivedRooms.length === 0 && overview.archivedModerators.length === 0 ? (
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-center text-xs text-slate-400">
                لا توجد عناصر مؤرشفة حالياً — جميع الغرف والمشرفين نشطون.
              </div>
            ) : (
              <div className="space-y-2">
                {overview.archivedRooms.map((item) => (
                  <div
                    key={item.roomId}
                    className="rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">غرفة: {item.roomTitle}</div>
                      <div className="text-slate-400 font-mono-num">
                        {item.roomId} · أُرشفت {formatShortDate(item.archivedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() =>
                        void runAction(`restore-room-${item.roomId}`, async () => {
                          const res = await opsRequest(
                            `/api/ops/archive/restore-room/${encodeURIComponent(item.roomId)}`
                          );
                          if (res.ok) showToast(`تمت استعادة الغرفة "${item.roomTitle}" بنجاح`, 'success');
                        })
                      }
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold cursor-pointer"
                    >
                      استعادة الغرفة
                    </button>
                  </div>
                ))}

                {overview.archivedModerators.map((item) => (
                  <div
                    key={item.moderatorId}
                    className="rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">مشرف: {item.name} ({item.role})</div>
                      <div className="text-slate-400 font-mono-num">
                        أُرشف {formatShortDate(item.archivedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() =>
                        void runAction(`restore-mod-${item.moderatorId}`, async () => {
                          const res = await opsRequest(
                            `/api/ops/archive/restore-moderator/${encodeURIComponent(item.moderatorId)}`
                          );
                          if (res.ok) showToast(`تمت استعادة المشرف "${item.name}" بنجاح`, 'success');
                        })
                      }
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold cursor-pointer"
                    >
                      استعادة المشرف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TRANSACTIONAL MIGRATIONS & READ-ONLY GOVERNANCE */}
      {overview && subTab === 'migrations' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>صلاحية القراءة فقط الافتراضية للأدوات الآلية (Read-Only Default)</span>
              </div>
              <p className="text-xs text-slate-400">
                عند التفعيل لا يُنفَّذ أي ترحيل أو استرجاع أو حذف بدون موافقة صريحة وتأكيد من المالك (ID: 900).
              </p>
            </div>
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() =>
                void runAction('toggle-ro', async () => {
                  const next = !overview.readOnlyAutomationMode;
                  const res = await opsRequest('/api/ops/governance', {
                    body: { readOnlyAutomationMode: next },
                  });
                  if (res.ok) {
                    showToast(
                      next
                        ? 'تم تفعيل وضع القراءة فقط مع موافقة المالك الإلزامية'
                        : 'تم تعديل وضع الحوكمة',
                      'info'
                    );
                  }
                })
              }
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                overview.readOnlyAutomationMode
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border border-slate-700 text-slate-300'
              }`}
            >
              {overview.readOnlyAutomationMode ? 'مفعّل: قراءة فقط + موافقة المالك' : 'تفعيل وضع القراءة فقط'}
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white">سجل الترحيلات (migrations/) — تجربة على نسخة ثم Transaction</h3>
              <p className="text-xs text-slate-400">
                كل تعديل يُجرب أولاً على نسخة معزولة (Dry-Run) ثم يُنفذ داخل معاملة ذرية مع لقطة أمان تلقائية.
              </p>
            </div>

            <div className="space-y-2.5">
              {overview.migrations.map((mig) => (
                <div
                  key={mig.id}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-xs font-mono-num text-amber-300">{mig.filename}</div>
                      <div className="text-sm font-bold text-white">{mig.titleAr}</div>
                      <p className="text-xs text-slate-400">{mig.descriptionAr}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {mig.applied ? (
                        <span className="text-xs font-bold text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>مطبّق · {formatShortDate(mig.applied.appliedAt)}</span>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() =>
                              void runAction(`dry-${mig.id}`, async () => {
                                const res = await opsRequest<{ result?: { passed?: boolean; summary?: string } }>(
                                  '/api/ops/migrations/dry-run',
                                  { body: { migrationId: mig.id } }
                                );
                                if (res.ok && res.data?.result?.passed) {
                                  showToast(`نجحت التجربة على النسخة المعزولة: ${res.data.result.summary}`, 'success');
                                } else {
                                  showToast(res.error || 'فشلت تجربة الترحيل', 'error');
                                }
                              })
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                          >
                            تجربة على نسخة
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() =>
                              setConfirmModal({
                                title: 'تطبيق الترحيل داخل معاملة ذرية (Transaction)',
                                description: `سيتم التحقق على نسخة معزولة ثم أخذ لقطة PITR وتنفيذ (${mig.filename}) داخل Transaction مع تراجع تلقائي عند أي خطأ.`,
                                confirmLabel: 'موافقة وتطبيق الترحيل',
                                onConfirm: async () => {
                                  const res = await opsRequest('/api/ops/migrations/apply', {
                                    body: { migrationId: mig.id, ownerConfirmed: true },
                                  });
                                  if (res.ok) showToast('تم تطبيق الترحيل بنجاح داخل Transaction', 'success');
                                  else showToast(res.error || 'تعذر تطبيق الترحيل', 'error');
                                },
                              })
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-extrabold text-slate-950 cursor-pointer"
                          >
                            تطبيق داخل Transaction
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {mig.lastDryRun && !mig.applied && (
                    <div className="text-xs text-slate-300 border-t border-slate-800 pt-2">
                      نتيجة آخر تجربة معزولة:{' '}
                      <strong className={mig.lastDryRun.passed ? 'text-emerald-400' : 'text-rose-400'}>
                        {mig.lastDryRun.passed ? 'ناجحة' : 'فاشلة'}
                      </strong>{' '}
                      — {mig.lastDryRun.summary} ({mig.lastDryRun.durationMs}ms)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. HIGH-TRAFFIC INDEXING, POOLING & PROGRESSIVE STRESS TEST */}
      {overview && subTab === 'stress' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
              <div className="text-xs text-slate-400">فهارس O(1) للاستعلامات السريعة</div>
              <div className="text-base font-bold text-white font-mono-num">
                {overview.indexes.indexedUsers} مستخدم · {overview.indexes.indexedRooms} غرفة ·{' '}
                {overview.indexes.indexedInvites} دعوة
              </div>
              <div className="text-xs text-slate-400">تحديث تلقائي مع كل عملية · Pagination مفعّل</div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
              <div className="text-xs text-slate-400">حوض تجميع الكتابة (Write Pool)</div>
              <div className="text-base font-bold text-white font-mono-num">
                {overview.writePool.flushedBatches} دفعة · {overview.writePool.lastFlushMs} ms
              </div>
              <div className="text-xs text-slate-400 font-mono-num">
                تجميع كل {overview.writePool.coalesceMs}ms · قيد الانتظار: {overview.writePool.pendingWrites}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
              <div className="text-xs text-slate-400">كاش الملفات الثابتة والصور</div>
              <div className="text-base font-bold text-emerald-400">Immutable + Lazy Load</div>
              <div className="text-xs text-slate-400">
                دعم CDN اختياري + Cache-Control + تأجيل الصور البعيدة
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">اختبار الضغط المتدرج (Stress Test)</h3>
                <p className="text-xs text-slate-400">
                  يرفع الزوار الافتراضيين تدريجياً (15 ← 35 ← 70 متزامن) لقياس أقصى سرعة (RPS) وزمن P95 ونقطة تفعيل حماية 429.
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() =>
                  void runAction('stress', async () => {
                    const res = await opsRequest('/api/ops/stress-test');
                    if (res.ok) showToast('اكتمل اختبار الضغط المتدرج وتم تحديث التقرير', 'success');
                    else showToast(res.error || 'تعذر تشغيل اختبار الضغط', 'error');
                  })
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-xs font-extrabold text-slate-950 inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                <span>{busyAction === 'stress' ? 'جارٍ تنفيذ اختبار الضغط...' : 'تشغيل اختبار الضغط الآن'}</span>
              </button>
            </div>

            {overview.lastStressTest ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 border-b border-slate-800 pb-2.5">
                  <span>
                    أعلى معدل طلبات:{' '}
                    <strong className="font-mono-num text-emerald-400">
                      {overview.lastStressTest.peakRps} req/s
                    </strong>
                  </span>
                  <span>
                    نقطة تفعيل الحماية (429):{' '}
                    <strong className="text-amber-400">
                      {overview.lastStressTest.saturationStage || 'لم يصل للحد الأقصى بعد'}
                    </strong>
                  </span>
                  <span className="text-slate-400 font-mono-num">
                    المدة الكلية: {overview.lastStressTest.durationMs}ms · {formatShortDate(overview.lastStressTest.ranAt)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 px-2">المرحلة</th>
                        <th className="py-2 px-2">ناجح (200)</th>
                        <th className="py-2 px-2">حماية زحمة (429)</th>
                        <th className="py-2 px-2">السرعة (RPS)</th>
                        <th className="py-2 px-2">متوسط / P95</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {overview.lastStressTest.stages.map((st) => (
                        <tr key={st.stageName}>
                          <td className="py-2 px-2 font-semibold text-slate-100">{st.stageName}</td>
                          <td className="py-2 px-2 font-mono-num text-emerald-400">{st.okCount}</td>
                          <td className="py-2 px-2 font-mono-num text-amber-400">{st.rateLimited429Count}</td>
                          <td className="py-2 px-2 font-mono-num text-white font-bold">{st.rps}</td>
                          <td className="py-2 px-2 font-mono-num text-slate-300">
                            {st.avgMs}ms / {st.p95Ms}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-center text-xs text-slate-400">
                اضغط على «تشغيل اختبار الضغط الآن» لقياس الحد الفعلي لتحمل الخادم قبل وصول الزوار.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owner Double-Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4 text-right shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {confirmModal.description}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => {
                  const fn = confirmModal.onConfirm;
                  setConfirmModal(null);
                  void runAction('confirm', fn);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-extrabold text-slate-950 cursor-pointer"
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
