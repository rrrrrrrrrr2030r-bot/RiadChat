import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'none';

export interface BiometricCapabilities {
  supported: boolean;
  enrolled: boolean;
  available: boolean;
  kind: BiometricKind;
  label: string;
  icon: string;
}

export interface BiometricPromptResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

/**
 * Inspects device biometric hardware & enrolled credentials via expo-local-authentication.
 * Fails safely to unavailable when running on unsupported devices or simulators without enrollment.
 */
export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    const available = Boolean(hasHardware && isEnrolled);
    if (!available) {
      return {
        supported: Boolean(hasHardware),
        enrolled: Boolean(isEnrolled),
        available: false,
        kind: 'none',
        label: 'البصمة أو التعرف على الوجه',
        icon: '🔐',
      };
    }

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return {
        supported: true,
        enrolled: true,
        available: true,
        kind: 'face',
        label: 'التعرف على الوجه',
        icon: '🪪',
      };
    }

    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return {
        supported: true,
        enrolled: true,
        available: true,
        kind: 'fingerprint',
        label: 'بصمة الإصبع',
        icon: '👆',
      };
    }

    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return {
        supported: true,
        enrolled: true,
        available: true,
        kind: 'iris',
        label: 'بصمة العين',
        icon: '👁️',
      };
    }

    return {
      supported: true,
      enrolled: true,
      available: true,
      kind: 'fingerprint',
      label: 'المصادقة الحيوية',
      icon: '🔐',
    };
  } catch {
    return {
      supported: false,
      enrolled: false,
      available: false,
      kind: 'none',
      label: 'البصمة أو التعرف على الوجه',
      icon: '🔐',
    };
  }
}

/**
 * Prompts native Face ID / Touch ID / Android BiometricPrompt with device-passcode fallback.
 */
export async function authenticateWithBiometrics(
  promptMessage = 'تأكيد الهوية للدخول السريع إلى رياض شات'
): Promise<BiometricPromptResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'إلغاء',
      fallbackLabel: 'استخدام رمز الجهاز',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    const rawError = 'error' in result ? String(result.error || '') : '';
    const cancelled =
      rawError === 'user_cancel' ||
      rawError === 'system_cancel' ||
      rawError === 'app_cancel';

    if (cancelled) {
      return {
        success: false,
        cancelled: true,
        error: 'تم إلغاء التحقق الحيوي، يمكنك إعادة المحاولة أو الدخول يدوياً',
      };
    }

    if (rawError === 'lockout') {
      return {
        success: false,
        error: 'تم قفل المصادقة الحيوية مؤقتاً بعد عدة محاولات، استخدم الدخول العادي',
      };
    }

    return {
      success: false,
      error: 'تعذر التحقق بالبصمة أو الوجه، حاول مرة أخرى',
    };
  } catch {
    return {
      success: false,
      error: 'المصادقة الحيوية غير متاحة حالياً على هذا الجهاز',
    };
  }
}
