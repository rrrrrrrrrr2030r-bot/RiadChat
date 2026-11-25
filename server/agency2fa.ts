import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import nodemailer from 'nodemailer';

export type Agency2FAChannel = 'sms' | 'email';

export interface Agency2FAChallenge {
  userId: string;
  channel: Agency2FAChannel;
  destination: string;
  maskedDestination: string;
  otpHash: string;
  otpSalt: string;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
}

export interface Agency2FATokenPayload {
  uid: string;
  jti: string;
  channel: Agency2FAChannel;
  iat?: number;
  exp: number;
}

export const AGENCY_2FA_COOKIE_NAME = 'riad_agency_2fa';
export const AGENCY_2FA_SESSION_MS = 30 * 60 * 1000; // 30 minutes
export const AGENCY_2FA_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const AGENCY_2FA_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const AGENCY_2FA_MAX_ATTEMPTS = 5;

export function maskEmail(email?: string): string {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) return '';
  const [local, domain] = clean.split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(5, Math.max(2, local.length - 2)))}${local[local.length - 1]}@${domain}`;
}

export function maskPhone(phone?: string): string {
  const clean = String(phone || '').trim();
  if (!clean) return '';
  const digits = clean.replace(/[^\d+]/g, '');
  if (digits.length < 6) return '***';
  const prefix = digits.slice(0, Math.min(4, digits.length - 2));
  const suffix = digits.slice(-2);
  return `${prefix}${'•'.repeat(Math.max(4, digits.length - prefix.length - suffix.length))}${suffix}`;
}

function hashOtp(code: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(code, salt, 32).toString('hex');
  return { hash, salt };
}

function verifyOtpHash(code: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(code, salt, 32);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function isSmsDeliveryConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim()
  );
}

export function isEmailDeliveryConfigured(): boolean {
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  return hasResend || hasSmtp;
}

export async function dispatchAgencyOtp(params: {
  channel: Agency2FAChannel;
  destination: string;
  code: string;
  userName: string;
  isProd: boolean;
}): Promise<{
  ok: boolean;
  deliveryMode: 'twilio' | 'resend' | 'smtp' | 'dev_preview';
  previewOtp?: string;
  error?: string;
}> {
  const { channel, destination, code, userName, isProd } = params;

  if (channel === 'sms') {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    if (sid && authToken && fromNumber) {
      try {
        const body = new URLSearchParams({
          To: destination,
          From: fromNumber,
          Body: `رياض شات: رمز المصادقة الثنائية للوكيل هو ${code} (صالح لمدة 5 دقائق). لا تشاركه مع أي شخص.`,
        });
        const auth = Buffer.from(`${sid}:${authToken}`).toString('base64');
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          }
        );
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error('[Agency2FA] Twilio SMS failed:', res.status, errText.slice(0, 200));
          return {
            ok: false,
            deliveryMode: 'twilio',
            error: 'تعذر إرسال رسالة SMS عبر مزود الخدمة حالياً — جرب قناة البريد الإلكتروني',
          };
        }
        return { ok: true, deliveryMode: 'twilio' };
      } catch (err) {
        console.error('[Agency2FA] Twilio SMS error:', err);
        return {
          ok: false,
          deliveryMode: 'twilio',
          error: 'حدث خطأ شبكي أثناء إرسال رسالة SMS',
        };
      }
    }
    if (isProd) {
      return {
        ok: false,
        deliveryMode: 'twilio',
        error: 'خدمة رسائل SMS غير مفعّلة في إعدادات السيرفر بعد — يرجى استخدام البريد الإلكتروني أو إعداد Twilio',
      };
    }
    return { ok: true, deliveryMode: 'dev_preview', previewOtp: code };
  }

  // Email delivery: prefer Resend HTTP API, then SMTP via nodemailer
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom =
    process.env.OTP_EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'security@riadchat.app';

  const subject = 'رمز المصادقة الثنائية (2FA) لصلاحيات الوكيل — رياض شات';
  const textBody = `مرحباً ${userName}،\n\nرمز التحقق الثنائي لدخول بوابة الوكيل في رياض شات هو: ${code}\nصالح لمدة 5 دقائق فقط.\nإذا لم تطلب هذا الرمز، يرجى تغيير كلمة المرور فوراً.`;

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
          text: textBody,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[Agency2FA] Resend email failed:', res.status, errText.slice(0, 200));
        return {
          ok: false,
          deliveryMode: 'resend',
          error: 'تعذر إرسال رمز التحقق عبر البريد الإلكتروني حالياً',
        };
      }
      return { ok: true, deliveryMode: 'resend' };
    } catch (err) {
      console.error('[Agency2FA] Resend email error:', err);
      return {
        ok: false,
        deliveryMode: 'resend',
        error: 'حدث خطأ شبكي أثناء إرسال البريد الإلكتروني',
      };
    }
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const smtpPort = Number(process.env.SMTP_PORT || 587);
      const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: emailFrom,
        to: destination,
        subject,
        text: textBody,
      });
      return { ok: true, deliveryMode: 'smtp' };
    } catch (err) {
      console.error('[Agency2FA] SMTP email error:', err);
      return {
        ok: false,
        deliveryMode: 'smtp',
        error: 'تعذر الإرسال عبر خادم البريد SMTP — تحقق من الإعدادات',
      };
    }
  }

  if (isProd) {
    return {
      ok: false,
      deliveryMode: 'smtp',
      error: 'خدمة البريد الإلكتروني غير مفعّلة في إعدادات السيرفر بعد — أضف إعدادات SMTP أو Resend',
    };
  }
  return { ok: true, deliveryMode: 'dev_preview', previewOtp: code };
}

export class Agency2FAManager {
  private readonly secret: string;
  private readonly challenges = new Map<string, Agency2FAChallenge>();
  private readonly revokedJtis = new Map<string, number>();
  private readonly revokedBeforeByUser = new Map<string, number>();

  constructor(sessionSecret: string) {
    this.secret = crypto
      .createHmac('sha256', sessionSecret)
      .update('riad-chat-agency-2fa-v1')
      .digest('hex');
  }

  private pruneRevoked() {
    const now = Date.now();
    for (const [jti, exp] of this.revokedJtis.entries()) {
      if (exp <= now) this.revokedJtis.delete(jti);
    }
  }

  signToken(userId: string, channel: Agency2FAChannel): { token: string; expiresAt: number; jti: string } {
    const now = Date.now();
    const expiresAt = now + AGENCY_2FA_SESSION_MS;
    const jti = crypto.randomBytes(12).toString('hex');
    const payload = Buffer.from(
      JSON.stringify({ uid: userId, jti, channel, iat: now, exp: expiresAt } satisfies Agency2FATokenPayload)
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    return { token: `${payload}.${sig}`, expiresAt, jti };
  }

  verifyToken(token: string | undefined, expectedUserId?: string): Agency2FATokenPayload | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Agency2FATokenPayload;
      if (!parsed.uid || !parsed.jti || !parsed.exp) return null;
      if (parsed.exp <= Date.now()) return null;
      if (expectedUserId && parsed.uid !== expectedUserId) return null;
      this.pruneRevoked();
      if (this.revokedJtis.has(parsed.jti)) return null;
      const revokedBefore = this.revokedBeforeByUser.get(parsed.uid) || 0;
      const issuedAt = typeof parsed.iat === 'number' ? parsed.iat : parsed.exp - AGENCY_2FA_SESSION_MS;
      if (revokedBefore > 0 && issuedAt <= revokedBefore) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  extractTokenFromRequest(req: Request): string {
    const headerToken = String(req.header('X-Agency-2FA-Token') || '').trim();
    if (headerToken) return headerToken;
    const rawCookie = req.headers.cookie;
    if (!rawCookie) return '';
    for (const part of rawCookie.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const k = part.slice(0, idx).trim();
      if (k === AGENCY_2FA_COOKIE_NAME) {
        try {
          return decodeURIComponent(part.slice(idx + 1).trim());
        } catch {
          return part.slice(idx + 1).trim();
        }
      }
    }
    return '';
  }

  private isSecureRequest(req: Request): boolean {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    return req.secure || forwardedProto === 'https' || process.env.NODE_ENV === 'production';
  }

  setCookie(req: Request, res: Response, token: string): void {
    const secure = this.isSecureRequest(req);
    const maxAgeSec = Math.floor(AGENCY_2FA_SESSION_MS / 1000);
    const parts = [
      `${AGENCY_2FA_COOKIE_NAME}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      `Max-Age=${maxAgeSec}`,
      secure ? 'SameSite=None' : 'SameSite=Lax',
    ];
    if (secure) {
      parts.push('Secure', 'Partitioned');
    }
    res.append('Set-Cookie', parts.join('; '));
  }

  clearCookie(req: Request, res: Response): void {
    const secure = this.isSecureRequest(req);
    const parts = [
      `${AGENCY_2FA_COOKIE_NAME}=`,
      'Path=/',
      'HttpOnly',
      'Max-Age=0',
      secure ? 'SameSite=None' : 'SameSite=Lax',
    ];
    if (secure) {
      parts.push('Secure', 'Partitioned');
    }
    res.append('Set-Cookie', parts.join('; '));
  }

  revokeFromRequest(req: Request, res: Response): void {
    const token = this.extractTokenFromRequest(req);
    const parsed = this.verifyToken(token);
    if (parsed) {
      this.revokedJtis.set(parsed.jti, parsed.exp);
    }
    this.clearCookie(req, res);
  }

  revokeAllForUser(userId: string): void {
    this.challenges.delete(userId);
    this.revokedBeforeByUser.set(userId, Date.now());
  }

  createChallenge(userId: string, channel: Agency2FAChannel, destination: string): {
    ok: boolean;
    code?: string;
    challenge?: Agency2FAChallenge;
    retryAfterSec?: number;
  } {
    const existing = this.challenges.get(userId);
    const now = Date.now();
    if (existing && existing.resendAvailableAt > now) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resendAvailableAt - now) / 1000));
      return { ok: false, retryAfterSec };
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const hashed = hashOtp(code);
    const challenge: Agency2FAChallenge = {
      userId,
      channel,
      destination,
      maskedDestination: channel === 'email' ? maskEmail(destination) : maskPhone(destination),
      otpHash: hashed.hash,
      otpSalt: hashed.salt,
      expiresAt: now + AGENCY_2FA_OTP_TTL_MS,
      resendAvailableAt: now + AGENCY_2FA_RESEND_COOLDOWN_MS,
      attempts: 0,
    };
    this.challenges.set(userId, challenge);
    return { ok: true, code, challenge };
  }

  verifyChallenge(userId: string, submittedCode: string): {
    ok: boolean;
    error?: string;
    channel?: Agency2FAChannel;
    destination?: string;
  } {
    const challenge = this.challenges.get(userId);
    if (!challenge) {
      return { ok: false, error: 'لم يتم طلب رمز تحقق أو انتهت صلاحيته — اطلب رمزاً جديداً' };
    }
    if (challenge.expiresAt <= Date.now()) {
      this.challenges.delete(userId);
      return { ok: false, error: 'انتهت صلاحية رمز التحقق (5 دقائق) — يرجى طلب رمز جديد' };
    }
    if (challenge.attempts >= AGENCY_2FA_MAX_ATTEMPTS) {
      this.challenges.delete(userId);
      return { ok: false, error: 'تم تجاوز الحد الأقصى للمحاولات الخاطئة — اطلب رمزاً جديداً' };
    }

    const cleanCode = String(submittedCode || '').replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      return { ok: false, error: 'يرجى إدخال رمز التحقق المكون من 6 أرقام' };
    }

    if (!verifyOtpHash(cleanCode, challenge.otpHash, challenge.otpSalt)) {
      challenge.attempts += 1;
      const remaining = Math.max(0, AGENCY_2FA_MAX_ATTEMPTS - challenge.attempts);
      if (remaining === 0) {
        this.challenges.delete(userId);
        return { ok: false, error: 'رمز التحقق غير صحيح وتم إلغاء المحاولة — اطلب رمزاً جديداً' };
      }
      return {
        ok: false,
        error: `رمز التحقق غير صحيح — تبقى لديك ${remaining} محاولات`,
      };
    }

    // Single-use OTP: consume immediately upon verification
    this.challenges.delete(userId);
    return {
      ok: true,
      channel: challenge.channel,
      destination: challenge.destination,
    };
  }

  getActiveSession(req: Request, userId: string): Agency2FATokenPayload | null {
    const token = this.extractTokenFromRequest(req);
    return this.verifyToken(token, userId);
  }

  createMiddleware<TReq extends Request & { authUser?: { id: string } }>() {
    return (req: TReq, res: Response, next: NextFunction) => {
      const user = req.authUser;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
        return;
      }
      const active = this.getActiveSession(req, user.id);
      if (!active) {
        res.status(403).json({
          error: 'مطلوب تأكيد المصادقة الثنائية (2FA) لصلاحيات الوكيل قبل تنفيذ هذه العملية',
          code: 'AGENCY_2FA_REQUIRED',
        });
        return;
      }
      next();
    };
  }
}
