import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { isEmailDeliveryConfigured, maskEmail } from './agency2fa.ts';

export const OWNER_RECOVERY_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OWNER_RECOVERY_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const OWNER_RECOVERY_MAX_ATTEMPTS = 5;
export const OWNER_RECOVERY_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes after max failed attempts
const MAX_AUDIT_ENTRIES = 50;

export type OwnerRecoveryDeliveryMode = 'resend' | 'smtp' | 'dev_preview';

export type OwnerRecoveryAuditEvent =
  | 'code_requested'
  | 'code_rejected'
  | 'locked_out'
  | 'recovery_completed';

export interface OwnerRecoveryAuditEntry {
  id: string;
  timestamp: string;
  event: OwnerRecoveryAuditEvent;
  maskedEmail: string;
  deliveryMode?: OwnerRecoveryDeliveryMode;
  phoneUpdated?: boolean;
  revokedSessions?: number;
  ipHint: string;
  note: string;
}

interface OwnerRecoveryChallenge {
  otpHash: string;
  otpSalt: string;
  targetEmail: string;
  maskedEmail: string;
  deliveryMode: OwnerRecoveryDeliveryMode;
  createdAt: number;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
}

function normalizeEmailValue(raw?: string): string {
  return String(raw || '').trim().toLowerCase();
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Compare against dummy buffer to keep execution uniform
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function hashRecoveryOtp(code: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(code, salt, 32).toString('hex');
  return { hash, salt };
}

function verifyRecoveryOtpHash(code: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(code, salt, 32);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function maskIpAddress(rawIp?: string): string {
  const clean = String(rawIp || '').split(',')[0].trim();
  if (!clean) return 'unknown';
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}::*` : 'ipv6';
  }
  return 'masked';
}

export async function dispatchOwnerRecoveryEmail(params: {
  destination: string;
  code: string;
  ownerName: string;
  isProd: boolean;
}): Promise<{
  ok: boolean;
  deliveryMode: OwnerRecoveryDeliveryMode;
  previewOtp?: string;
  error?: string;
}> {
  const { destination, code, ownerName, isProd } = params;

  const subject = 'رمز استعادة حساب المالك الرئيسي — رياض شات (ID: 900)';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; padding: 24px; background: #09071A; color: #f8fafc; border-radius: 16px;">
      <h2 style="color: #a78bfa; margin-top: 0;">استعادة حساب المالك الرئيسي — رياض شات</h2>
      <p>مرحباً ${ownerName}،</p>
      <p>تم طلب استعادة الوصول إلى حساب المالك الرئيسي (<strong>ID: 900</strong>). استخدم رمز الاستعادة التالي خلال <strong>10 دقائق</strong>:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; background: #1c1347; border: 1px solid #7c3aed; border-radius: 12px; display: inline-block; color: #38bdf8; margin: 12px 0;">
        ${code}
      </div>
      <p style="color: #cbd5e1; font-size: 13px;">بعد إتمام الاستعادة سيتم إنهاء جميع الجلسات السابقة تلقائياً وتوثيق العملية في سجل الأمان.</p>
      <p style="color: #94a3b8; font-size: 12px;">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة فوراً وراجع سجل الأمان في لوحة النظام.</p>
    </div>
  `;

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'Riad Chat Security <security@riadchat.app>';

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [destination],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          ok: false,
          deliveryMode: 'resend',
          error: `تعذر إرسال بريد الاستعادة عبر Resend (${res.status}): ${errText.slice(0, 120)}`,
        };
      }
      return { ok: true, deliveryMode: 'resend' };
    } catch {
      return {
        ok: false,
        deliveryMode: 'resend',
        error: 'فشل الاتصال بخدمة البريد Resend لإرسال رمز الاستعادة',
      };
    }
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: emailFrom,
        to: destination,
        subject,
        html,
      });
      return { ok: true, deliveryMode: 'smtp' };
    } catch {
      return {
        ok: false,
        deliveryMode: 'smtp',
        error: 'فشل إرسال رمز الاستعادة عبر خادم SMTP — يرجى مراجعة إعدادات SMTP',
      };
    }
  }

  if (isProd) {
    return {
      ok: false,
      deliveryMode: 'smtp',
      error:
        'خدمة البريد غير مضبوطة في بيئة الإنتاج — يرجى ضبط إعدادات SMTP أو RESEND_API_KEY لإرسال رمز الاستعادة بأمان',
    };
  }

  // Development preview mode only (strictly gated on !isProd)
  return {
    ok: true,
    deliveryMode: 'dev_preview',
    previewOtp: code,
  };
}

export class OwnerRecoveryManager {
  private challenge: OwnerRecoveryChallenge | null = null;
  private lockoutUntil = 0;
  private auditLog: OwnerRecoveryAuditEntry[] = [];

  loadAuditLog(entries?: OwnerRecoveryAuditEntry[] | null): void {
    if (!Array.isArray(entries)) {
      this.auditLog = [];
      return;
    }
    this.auditLog = entries
      .filter((e) => e && typeof e === 'object' && typeof e.timestamp === 'string')
      .slice(0, MAX_AUDIT_ENTRIES);
  }

  exportAuditLog(): OwnerRecoveryAuditEntry[] {
    return this.auditLog.slice(0, MAX_AUDIT_ENTRIES);
  }

  private pushAudit(entry: Omit<OwnerRecoveryAuditEntry, 'id' | 'timestamp'>): OwnerRecoveryAuditEntry {
    const full: OwnerRecoveryAuditEntry = {
      id: `orec-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLog = [full, ...this.auditLog].slice(0, MAX_AUDIT_ENTRIES);
    return full;
  }

  getStatus(params: { primaryAdminEmail: string; isProd: boolean }) {
    const now = Date.now();
    const cooldownRemainingSec =
      this.challenge && this.challenge.resendAvailableAt > now
        ? Math.max(1, Math.ceil((this.challenge.resendAvailableAt - now) / 1000))
        : 0;
    const lockoutRemainingSec =
      this.lockoutUntil > now ? Math.max(1, Math.ceil((this.lockoutUntil - now) / 1000)) : 0;
    const hasPendingChallenge = Boolean(this.challenge && this.challenge.expiresAt > now);
    return {
      emailDeliveryConfigured: isEmailDeliveryConfigured(),
      devPreviewEnabled: !params.isProd,
      maskedAdminEmailHint: maskEmail(params.primaryAdminEmail),
      cooldownRemainingSec,
      lockoutRemainingSec,
      hasPendingChallenge,
    };
  }

  async requestRecoveryCode(params: {
    inputEmail: string;
    primaryAdminEmail: string;
    ownerName: string;
    isProd: boolean;
    ipHint: string;
  }): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    retryAfterSec?: number;
    maskedEmail?: string;
    deliveryMode?: OwnerRecoveryDeliveryMode;
    expiresInSec?: number;
    resendCooldownSec?: number;
    previewOtp?: string;
  }> {
    const now = Date.now();
    const normalizedInput = normalizeEmailValue(params.inputEmail);
    const normalizedAdmin = normalizeEmailValue(params.primaryAdminEmail);
    const maskedAdmin = maskEmail(normalizedAdmin);

    if (this.lockoutUntil > now) {
      const retryAfterSec = Math.max(1, Math.ceil((this.lockoutUntil - now) / 1000));
      return {
        ok: false,
        status: 429,
        retryAfterSec,
        error: `تم تقييد محاولات استعادة حساب المالك مؤقتاً — يرجى المحاولة بعد ${retryAfterSec} ثانية`,
      };
    }

    if (!normalizedInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInput)) {
      return {
        ok: false,
        status: 400,
        error: 'يرجى إدخال بريد إلكتروني صحيح',
      };
    }

    if (!timingSafeStringEqual(normalizedInput, normalizedAdmin)) {
      this.pushAudit({
        event: 'code_rejected',
        maskedEmail: maskEmail(normalizedInput) || '***',
        ipHint: params.ipHint,
        note: 'محاولة طلب استعادة ببريد غير مطابق للبريد المسجل في PRIMARY_ADMIN_EMAIL',
      });
      return {
        ok: false,
        status: 403,
        error: 'البريد الإلكتروني المدخل لا يطابق بريد المالك المسجّل في إعدادات النظام',
      };
    }

    if (this.challenge && this.challenge.resendAvailableAt > now) {
      const retryAfterSec = Math.max(1, Math.ceil((this.challenge.resendAvailableAt - now) / 1000));
      return {
        ok: false,
        status: 429,
        retryAfterSec,
        error: `يرجى الانتظار ${retryAfterSec} ثانية قبل طلب رمز استعادة جديد`,
      };
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const delivery = await dispatchOwnerRecoveryEmail({
      destination: normalizedAdmin,
      code,
      ownerName: params.ownerName,
      isProd: params.isProd,
    });

    if (!delivery.ok) {
      return {
        ok: false,
        status: 503,
        error: delivery.error || 'تعذر إرسال رمز الاستعادة عبر البريد حالياً',
      };
    }

    const hashed = hashRecoveryOtp(code);
    this.challenge = {
      otpHash: hashed.hash,
      otpSalt: hashed.salt,
      targetEmail: normalizedAdmin,
      maskedEmail: maskedAdmin,
      deliveryMode: delivery.deliveryMode,
      createdAt: now,
      expiresAt: now + OWNER_RECOVERY_OTP_TTL_MS,
      resendAvailableAt: now + OWNER_RECOVERY_RESEND_COOLDOWN_MS,
      attempts: 0,
    };

    this.pushAudit({
      event: 'code_requested',
      maskedEmail: maskedAdmin,
      deliveryMode: delivery.deliveryMode,
      ipHint: params.ipHint,
      note:
        delivery.deliveryMode === 'dev_preview'
          ? 'تم توليد رمز استعادة المالك في وضع المعاينة (التطوير)'
          : `تم إرسال رمز استعادة المالك عبر ${delivery.deliveryMode.toUpperCase()}`,
    });

    return {
      ok: true,
      status: 200,
      maskedEmail: maskedAdmin,
      deliveryMode: delivery.deliveryMode,
      expiresInSec: Math.round(OWNER_RECOVERY_OTP_TTL_MS / 1000),
      resendCooldownSec: Math.round(OWNER_RECOVERY_RESEND_COOLDOWN_MS / 1000),
      ...(delivery.previewOtp ? { previewOtp: delivery.previewOtp } : {}),
    };
  }

  verifyRecoveryCode(params: {
    code: string;
    ipHint: string;
  }): {
    ok: boolean;
    status: number;
    error?: string;
    deliveryMode?: OwnerRecoveryDeliveryMode;
    maskedEmail?: string;
  } {
    const now = Date.now();
    if (this.lockoutUntil > now) {
      const retryAfterSec = Math.max(1, Math.ceil((this.lockoutUntil - now) / 1000));
      return {
        ok: false,
        status: 429,
        error: `تم قفل التحقق مؤقتاً بسبب محاولات خاطئة متكررة — حاول مجدداً بعد ${retryAfterSec} ثانية`,
      };
    }

    if (!this.challenge) {
      return {
        ok: false,
        status: 400,
        error: 'لم يتم طلب رمز استعادة بعد أو انتهت صلاحيته — اطلب رمزاً جديداً أولاً',
      };
    }

    if (this.challenge.expiresAt <= now) {
      this.challenge = null;
      return {
        ok: false,
        status: 400,
        error: 'انتهت صلاحية رمز الاستعادة (10 دقائق) — يرجى طلب رمز جديد',
      };
    }

    const cleanCode = String(params.code || '').replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      return {
        ok: false,
        status: 400,
        error: 'يرجى إدخال رمز الاستعادة المكون من 6 أرقام',
      };
    }

    if (!verifyRecoveryOtpHash(cleanCode, this.challenge.otpHash, this.challenge.otpSalt)) {
      this.challenge.attempts += 1;
      const remaining = Math.max(0, OWNER_RECOVERY_MAX_ATTEMPTS - this.challenge.attempts);
      if (remaining === 0) {
        const masked = this.challenge.maskedEmail;
        this.challenge = null;
        this.lockoutUntil = now + OWNER_RECOVERY_LOCKOUT_MS;
        this.pushAudit({
          event: 'locked_out',
          maskedEmail: masked,
          ipHint: params.ipHint,
          note: 'تم تجاوز 5 محاولات خاطئة وتفعيل قفل أمني لمدة 15 دقيقة',
        });
        return {
          ok: false,
          status: 429,
          error: 'تم تجاوز الحد الأقصى للمحاولات الخاطئة — تم تفعيل القفل الأمني لمدة 15 دقيقة',
        };
      }
      this.pushAudit({
        event: 'code_rejected',
        maskedEmail: this.challenge.maskedEmail,
        ipHint: params.ipHint,
        note: `إدخال رمز استعادة غير صحيح (المتبقي ${remaining} محاولات)`,
      });
      return {
        ok: false,
        status: 401,
        error: `رمز الاستعادة غير صحيح — تبقى لديك ${remaining} محاولات`,
      };
    }

    const deliveryMode = this.challenge.deliveryMode;
    const maskedEmail = this.challenge.maskedEmail;
    // Consume single-use challenge immediately
    this.challenge = null;
    return {
      ok: true,
      status: 200,
      deliveryMode,
      maskedEmail,
    };
  }

  recordRecoveryCompleted(params: {
    maskedEmail: string;
    deliveryMode?: OwnerRecoveryDeliveryMode;
    phoneUpdated: boolean;
    revokedSessions: number;
    ipHint: string;
  }): OwnerRecoveryAuditEntry {
    return this.pushAudit({
      event: 'recovery_completed',
      maskedEmail: params.maskedEmail,
      deliveryMode: params.deliveryMode,
      phoneUpdated: params.phoneUpdated,
      revokedSessions: params.revokedSessions,
      ipHint: params.ipHint,
      note: params.phoneUpdated
        ? `تمت استعادة حساب المالك وتحديث كلمة المرور ورقم الهاتف وإنهاء ${params.revokedSessions} جلسة نشطة`
        : `تمت استعادة حساب المالك وتحديث كلمة المرور وإنهاء ${params.revokedSessions} جلسة نشطة`,
    });
  }
}
