import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { theme, Text, Button, Input } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { useAuth } from '../hooks/useAuth';
import { WizardProgress } from '../components/WizardProgress';

interface Props {
  phone: string; // formatted phone sent in previous step
  currentStep: number;
  totalSteps: number;
  onVerified: () => void;
  onBack: () => void;
}

export const WizardOTPScreen: React.FC<Props> = ({
  phone,
  currentStep,
  totalSteps,
  onVerified,
  onBack,
}) => {
  const { t } = useTranslation();
  const { signInWithPhone, verifyOTP } = useAuth();

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);
  const [resendCount, setResendCount] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [cooldown]);

  const maskedPhone = (() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 4) {
      return '*'.repeat(digits.length - 4) + digits.slice(-4);
    }
    return phone;
  })();

  const handleOtpChange = (val: string) => {
    setErrorMsg(null);
    setOtpCode(val.replace(/\D/g, '').slice(0, 6));
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendCount >= 3) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithPhone(phone);
      setResendCount((prev) => prev + 1);
      setCooldown(30);
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length < 6) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await verifyOTP(phone, otpCode);
      onVerified();
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress */}
        <WizardProgress current={currentStep} total={totalSteps} />

        {/* Content */}
        <View style={styles.content}>
          <Text variant="title" style={styles.label}>
            {t('auth.otp', { defaultValue: 'Enter OTP' })}
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.hint}>
            {`Sent to ${maskedPhone}`}
          </Text>

          <TouchableOpacity onPress={onBack} style={styles.changeLink}>
            <Text variant="caption" color={theme.colors.primary}>
              {t('auth.changePhone', {
                phone: maskedPhone,
                defaultValue: `Change (${maskedPhone})`,
              })}
            </Text>
          </TouchableOpacity>

          <Input
            placeholder="123456"
            keyboardType="number-pad"
            value={otpCode}
            onChangeText={handleOtpChange}
            maxLength={6}
            autoFocus
          />

          {errorMsg && (
            <Text variant="caption" color={theme.colors.danger} style={styles.error}>
              {errorMsg}
            </Text>
          )}

          <View style={styles.resendContainer}>
            {resendCount >= 3 ? (
              <Text variant="caption" color={theme.colors.danger}>
                {t('auth.resendLimitReached', { defaultValue: 'Maximum resend attempts reached.' })}
              </Text>
            ) : cooldown > 0 ? (
              <Text variant="caption" color={theme.colors.mutedText}>
                {t('auth.resendOtp', { defaultValue: 'Resend OTP' })} in {cooldown}s
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                <Text variant="caption" color={theme.colors.primary} style={styles.resendText}>
                  {t('auth.resendOtp', { defaultValue: 'Resend OTP' })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            label={t('auth.verifyOtp', { defaultValue: 'Verify' })}
            variant="primary"
            disabled={otpCode.length !== 6 || loading}
            loading={loading}
            onPress={handleVerify}
            style={styles.btn}
          />
          <Button
            label={t('common.cancel', { defaultValue: 'Cancel' })}
            variant="ghost"
            onPress={onBack}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  kav: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    justifyContent: 'space-between',
  },
  content: { flex: 1, justifyContent: 'center' },
  label: { marginBottom: theme.spacing.sm },
  hint: { marginBottom: theme.spacing.xs },
  changeLink: { marginBottom: theme.spacing.lg },
  error: { marginTop: theme.spacing.sm },
  resendContainer: { marginTop: theme.spacing.md, alignItems: 'center' },
  resendText: { fontWeight: '600' },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  btn: { width: '100%' },
});
