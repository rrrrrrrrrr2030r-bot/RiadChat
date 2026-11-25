import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMobileApp } from '../context/MobileAppContext';
import { mobileApi } from '../services/api';
import type { MobileResolvedInvite } from '../types';

type AuthMode = 'login' | 'register';
type AuthMethod = 'email' | 'phone';

export const AuthScreen: React.FC = () => {
  const {
    pendingReferralCode,
    isSupabaseEnabled,
    lastGoogleHint,
    clearGoogleHint,
    loginWithEmail,
    registerWithEmail,
    sendPhoneOtp,
    verifyPhoneOtp,
    loginWithGoogle,
    loginWithFacebook,
    canUseBiometricQuickLogin,
    biometricLabel,
    biometricIcon,
    loginWithBiometrics,
  } = useMobileApp();

  const [mode, setMode] = useState<AuthMode>(pendingReferralCode ? 'register' : 'login');
  const [method, setMethod] = useState<AuthMethod>('email');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralInput, setReferralInput] = useState(pendingReferralCode || '');

  const [phone, setPhone] = useState('+9665');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [previewOtpHint, setPreviewOtpHint] = useState<string | null>(null);

  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleName, setGoogleName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');

  const [fbModalOpen, setFbModalOpen] = useState(false);
  const [fbName, setFbName] = useState('');
  const [fbEmail, setFbEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<MobileResolvedInvite | null>(null);

  useEffect(() => {
    const code = (pendingReferralCode || '').trim();
    if (!code) return;
    setReferralInput(code);
    setMode('register');
    let active = true;
    void mobileApi.resolveInviteCode(code).then((resolved) => {
      if (active && resolved) {
        setInvitePreview(resolved);
      }
    });
    return () => {
      active = false;
    };
  }, [pendingReferralCode]);

  const handleBiometricQuickLogin = async () => {
    setErrorText(null);
    setSubmitting(true);
    try {
      const res = await loginWithBiometrics();
      if (!res.ok) {
        setErrorText(res.error || 'تعذر التحقق الحيوي، يمكنك تسجيل الدخول يدوياً');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async () => {
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

  const handleSendOtp = async () => {
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

  const handleVerifyOtp = async () => {
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

  const handleGooglePress = async (switchAccount = false) => {
    setErrorText(null);
    if (isSupabaseEnabled) {
      setSubmitting(true);
      try {
        const res = await loginWithGoogle({
          referralCode: referralInput,
          switchAccount,
        });
        if (!res.ok) {
          setErrorText(res.error || 'تعذر فتح تسجيل الدخول عبر جوجل');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Direct 1-tap sign-in without modal/account picker when Google hint is saved
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
      await clearGoogleHint();
      setGoogleEmail('');
      setGoogleName('');
    }
    setGoogleModalOpen(true);
  };

  const handleGoogleModalSubmit = async () => {
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

  const handleFacebookPress = async () => {
    setErrorText(null);
    if (isSupabaseEnabled) {
      setSubmitting(true);
      try {
        const res = await loginWithFacebook({ referralCode: referralInput });
        if (!res.ok) {
          setErrorText(res.error || 'تعذر فتح تسجيل الدخول عبر فيسبوك');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setFbModalOpen(true);
  };

  const handleFacebookModalSubmit = async () => {
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View style={styles.brandBlock}>
            <View style={styles.logoRing}>
              <Image
                source={require('../../assets/app-icon.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.brandTitle}>رياض شات</Text>
            <Text style={styles.brandSubtitle}>
              غرف الصوت المباشرة · الألعاب الملكية · مزامنة فورية بين الويب والجوال
            </Text>
          </View>

          {/* Incoming Referral Welcome Card */}
          {invitePreview && (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteBannerTitle}>
                🎁 دعوة خاصة من {invitePreview.inviterName}
              </Text>
              <Text style={styles.inviteBannerDesc}>
                سجّل الآن واحصل على +{invitePreview.welcomeGold.toLocaleString('en-US')} ذهبية
                ترحيبية فورياً
                {invitePreview.roomTitle ? ` · غرفة «${invitePreview.roomTitle}»` : ''}
              </Text>
            </View>
          )}

          {/* Biometric Quick Login Card — Strictly visible ONLY for pre-existing AsyncStorage sessions */}
          {canUseBiometricQuickLogin && (
            <TouchableOpacity
              style={[styles.biometricCard, submitting && styles.disabledBtn]}
              disabled={submitting}
              onPress={() => void handleBiometricQuickLogin()}
              activeOpacity={0.86}
            >
              <View style={styles.biometricIconWrap}>
                <Text style={styles.biometricIconText}>{biometricIcon}</Text>
              </View>
              <View style={styles.biometricTextCol}>
                <Text style={styles.biometricTitle}>
                  دخول سريع عبر {biometricLabel}
                </Text>
                <Text style={styles.biometricSub}>
                  استعادة جلستك المحفوظة فوراً بدون إدخال كلمة المرور
                </Text>
              </View>
              {submitting ? (
                <ActivityIndicator color="#A7F3D0" size="small" />
              ) : (
                <Text style={styles.biometricAction}>فتح</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Main Auth Card */}
          <View style={styles.card}>
            {/* Mode Switcher */}
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
                onPress={() => {
                  setMode('login');
                  setErrorText(null);
                }}
              >
                <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>
                  تسجيل الدخول
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]}
                onPress={() => {
                  setMode('register');
                  setErrorText(null);
                }}
              >
                <Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>
                  إنشاء حساب جديد
                </Text>
              </TouchableOpacity>
            </View>

            {/* Method Switcher */}
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[styles.methodBtn, method === 'email' && styles.methodBtnEmailActive]}
                onPress={() => {
                  setMethod('email');
                  setErrorText(null);
                }}
              >
                <Text style={styles.methodText}>✉️ البريد الإلكتروني</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodBtn, method === 'phone' && styles.methodBtnPhoneActive]}
                onPress={() => {
                  setMethod('phone');
                  setErrorText(null);
                }}
              >
                <Text style={styles.methodText}>📱 رقم الهاتف (OTP)</Text>
              </TouchableOpacity>
            </View>

            {errorText && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            )}

            {/* EMAIL FORM */}
            {method === 'email' ? (
              <View style={styles.formBlock}>
                {mode === 'register' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>الاسم الظاهر</Text>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="مثال: سلطان الرياض"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>
                    {mode === 'login' ? 'البريد الإلكتروني أو رقم ID' : 'البريد الإلكتروني'}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.ltrInput]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@example.com"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType={mode === 'register' ? 'email-address' : 'default'}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>كلمة المرور</Text>
                  <TextInput
                    style={[styles.input, styles.ltrInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                  />
                </View>

                {mode === 'register' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>كود الدعوة (اختياري · +500,000 ذهبية)</Text>
                    <TextInput
                      style={[styles.input, styles.ltrInput, styles.referralInput]}
                      value={referralInput}
                      onChangeText={(t) => setReferralInput(t.toUpperCase())}
                      placeholder="RIYADH900"
                      placeholderTextColor="#64748B"
                      autoCapitalize="characters"
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && styles.disabledBtn]}
                  disabled={submitting}
                  onPress={() => void handleEmailSubmit()}
                  activeOpacity={0.88}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {mode === 'register' ? 'إنشاء الحساب وتوليد ID فريد' : 'دخول إلى رياض شات'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* PHONE OTP FORM */
              <View style={styles.formBlock}>
                {!otpSent ? (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>رقم الهاتف (مع رمز الدولة)</Text>
                      <TextInput
                        style={[styles.input, styles.ltrInput]}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="+966501234567"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>

                    {mode === 'register' && (
                      <View style={styles.fieldGroup}>
                        <Text style={styles.label}>الاسم الظاهر (للحساب الجديد)</Text>
                        <TextInput
                          style={styles.input}
                          value={name}
                          onChangeText={setName}
                          placeholder="مثال: فهد العتيبي"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.phoneBtn, submitting && styles.disabledBtn]}
                      disabled={submitting}
                      onPress={() => void handleSendOtp()}
                      activeOpacity={0.88}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryBtnText}>إرسال رمز التحقق (OTP)</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.otpInfoBox}>
                      <Text style={styles.otpInfoTitle}>✅ تم إرسال رمز التحقق إلى {phone}</Text>
                      {previewOtpHint && (
                        <Text style={styles.otpHintText}>
                          رمز التحقق للتجربة الفورية: {previewOtpHint}
                        </Text>
                      )}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>أدخل رمز التحقق (6 أرقام)</Text>
                      <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={otpCode}
                        onChangeText={(t) => setOtpCode(t.replace(/\D/g, ''))}
                        placeholder="123456"
                        placeholderTextColor="#64748B"
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>

                    <View style={styles.otpActionsRow}>
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => {
                          setOtpSent(false);
                          setOtpCode('');
                          setPreviewOtpHint(null);
                        }}
                      >
                        <Text style={styles.secondaryBtnText}>تغيير الرقم</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.primaryBtn,
                          { flex: 1 },
                          (submitting || otpCode.length < 6) && styles.disabledBtn,
                        ]}
                        disabled={submitting || otpCode.length < 6}
                        onPress={() => void handleVerifyOtp()}
                      >
                        <Text style={styles.primaryBtnText}>
                          {submitting ? 'جارٍ التحقق...' : 'تأكيد والدخول'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>أو المتابعة السريعة عبر</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Direct Google Login Button (No Forced Account Picker) */}
            <View style={styles.googleBlock}>
              <TouchableOpacity
                style={[styles.googleBtn, submitting && styles.disabledBtn]}
                disabled={submitting}
                onPress={() => void handleGooglePress(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.googleBadge}>G</Text>
                <Text style={styles.googleBtnText} numberOfLines={1}>
                  {lastGoogleHint?.email
                    ? `دخول مباشر عبر جوجل (${lastGoogleHint.email})`
                    : 'المتابعة المباشرة بحساب جوجل (Google)'}
                </Text>
              </TouchableOpacity>

              {lastGoogleHint?.email && (
                <TouchableOpacity
                  disabled={submitting}
                  onPress={() => void handleGooglePress(true)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.switchAccountText}>تبديل حساب جوجل</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Facebook Login Button */}
            <TouchableOpacity
              style={[styles.fbBtn, submitting && styles.disabledBtn]}
              disabled={submitting}
              onPress={() => void handleFacebookPress()}
              activeOpacity={0.88}
            >
              <Text style={styles.fbBtnText}>f  المتابعة بحساب فيسبوك (Facebook)</Text>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              🛡️ تُحفظ جلستك تلقائياً وتتم مزامنة رصيدك ومعرفك مع نسخة الويب
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Google First-Time Direct Confirmation Sheet (fallback when Supabase keys aren't set yet) */}
      <Modal
        visible={googleModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGoogleModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>الدخول المباشر عبر جوجل</Text>
            <Text style={styles.modalSub}>
              يُحفظ بريد حساب جوجل للدخول المباشر تلقائياً في المرات القادمة دون نافذة اختيار الحساب
            </Text>
            <TextInput
              style={[styles.input, styles.ltrInput]}
              value={googleEmail}
              onChangeText={setGoogleEmail}
              placeholder="yourname@gmail.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              value={googleName}
              onChangeText={setGoogleName}
              placeholder="الاسم الظاهر (اختياري)"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.otpActionsRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setGoogleModalOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.googleBtn, { flex: 1 }, submitting && styles.disabledBtn]}
                disabled={submitting}
                onPress={() => void handleGoogleModalSubmit()}
              >
                <Text style={styles.googleBtnText}>
                  {submitting ? 'جارٍ الدخول...' : 'دخول مباشر'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Facebook Profile Confirmation Sheet (fallback when Supabase keys aren't set yet) */}
      <Modal
        visible={fbModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFbModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>المتابعة عبر فيسبوك</Text>
            <Text style={styles.modalSub}>
              أدخل اسمك وبريدك المرتبط بحساب فيسبوك لتوليد معرفك الفريد ومزامنته مع الويب
            </Text>
            <TextInput
              style={styles.input}
              value={fbName}
              onChangeText={setFbName}
              placeholder="الاسم في فيسبوك"
              placeholderTextColor="#94A3B8"
            />
            <TextInput
              style={[styles.input, styles.ltrInput]}
              value={fbEmail}
              onChangeText={setFbEmail}
              placeholder="facebook-email@example.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.otpActionsRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setFbModalOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fbBtn, { flex: 1 }, submitting && styles.disabledBtn]}
                disabled={submitting}
                onPress={() => void handleFacebookModalSubmit()}
              >
                <Text style={styles.fbBtnText}>
                  {submitting ? 'جارٍ الدخول...' : 'تأكيد والمتابعة'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0620' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 18,
    gap: 16,
  },
  brandBlock: { alignItems: 'center', gap: 6 },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#1B3B60',
    borderWidth: 2,
    borderColor: '#C084FC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  brandTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  brandSubtitle: {
    color: '#C7D2FE',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  inviteBanner: {
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.55)',
    padding: 12,
    gap: 4,
  },
  inviteBannerTitle: { color: '#FDE047', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  inviteBannerDesc: { color: '#E0E7FF', fontSize: 12, textAlign: 'right', lineHeight: 18 },
  biometricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.52)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  biometricIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(16,185,129,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricIconText: { fontSize: 20 },
  biometricTextCol: { flex: 1, gap: 2 },
  biometricTitle: { color: '#ECFDF5', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  biometricSub: { color: '#A7F3D0', fontSize: 11, textAlign: 'right' },
  biometricAction: {
    color: '#064E3B',
    backgroundColor: '#34D399',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
  },
  card: {
    borderRadius: 24,
    backgroundColor: '#150E36',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.32)',
    padding: 18,
    gap: 14,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  modeBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: { backgroundColor: '#7C3AED' },
  modeText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  modeTextActive: { color: '#FFFFFF', fontWeight: '800' },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBtnEmailActive: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderColor: '#A78BFA',
  },
  methodBtnPhoneActive: {
    backgroundColor: 'rgba(56,189,248,0.22)',
    borderColor: '#38BDF8',
  },
  methodText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  errorBox: {
    borderRadius: 12,
    backgroundColor: 'rgba(244,63,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.45)',
    padding: 10,
  },
  errorText: { color: '#FECDD3', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  formBlock: { gap: 12 },
  fieldGroup: { gap: 6 },
  label: { color: '#C7D2FE', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  input: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    textAlign: 'right',
  },
  ltrInput: { textAlign: 'left' },
  referralInput: { borderColor: 'rgba(250,204,21,0.4)', color: '#FDE68A' },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  phoneBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabledBtn: { opacity: 0.6 },
  otpInfoBox: {
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.4)',
    padding: 10,
    gap: 4,
  },
  otpInfoTitle: { color: '#E0F2FE', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  otpHintText: { color: '#FDE047', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  otpInput: { textAlign: 'center', fontSize: 20, letterSpacing: 6, fontWeight: '800' },
  otpActionsRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { color: '#94A3B8', fontSize: 11 },
  googleBlock: { gap: 6 },
  googleBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  googleBadge: {
    color: '#4285F4',
    fontSize: 17,
    fontWeight: '900',
  },
  googleBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  switchAccountText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  fbBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  fbBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  footerNote: {
    color: '#A5B4FC',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderRadius: 22,
    backgroundColor: '#161038',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    padding: 18,
    gap: 12,
  },
  modalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'right' },
  modalSub: { color: '#CBD5E1', fontSize: 12, textAlign: 'right', lineHeight: 18 },
});
