import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Pressable,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { useAuth } from '../hooks/useAuth';
import { WizardProgress } from '../components/WizardProgress';

const CELL_COUNT = 6;

/** A single amber caret that blinks in the active OTP cell */
const Caret: React.FC = () => {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.caret, { opacity }]} />;
};

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
  const [focused, setFocused] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [cooldown]);

  const handleOtpChange = (val: string) => {
    setErrorMsg(null);
    setOtpCode(val.replace(/\D/g, '').slice(0, CELL_COUNT));
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
    if (otpCode.length < CELL_COUNT) return;
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
          <Text style={styles.heading}>
            {t('auth.otpTitle', { defaultValue: 'Enter verification code' })}
          </Text>
          <Text variant="body" color={theme.colors.hint} style={styles.subtitle}>
            {t('auth.otpSubtitle', { defaultValue: 'Enter the 6-digit code sent to' })}
          </Text>
          <View style={styles.phoneRow}>
            <Text variant="body" style={styles.phoneText}>{phone}</Text>
            <TouchableOpacity onPress={onBack} hitSlop={8}>
              <Text variant="caption" color={theme.colors.primary} style={styles.changeText}>
                {t('auth.change', { defaultValue: 'Change' })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Segmented OTP boxes */}
          <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: CELL_COUNT }).map((_, i) => {
              const digit = otpCode[i];
              const filled = digit !== undefined;
              const isCurrent = focused && i === otpCode.length;
              const hasError = !!errorMsg;
              return (
                <View
                  key={i}
                  style={[
                    styles.otpCell,
                    filled && styles.otpCellFilled,
                    isCurrent && styles.otpCellActive,
                    hasError && styles.otpCellError,
                  ]}
                >
                  {filled ? (
                    <Text style={styles.otpDigit}>{digit}</Text>
                  ) : isCurrent ? (
                    <Caret />
                  ) : null}
                </View>
              );
            })}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={otpCode}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={CELL_COUNT}
              autoFocus
              caretHidden
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </Pressable>

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
                {t('auth.didntReceive', { defaultValue: 'Didn’t receive the code?' })}{' '}
                {t('auth.resendOtp', { defaultValue: 'Resend' })} ({cooldown}s)
              </Text>
            ) : (
              <View style={styles.resendInline}>
                <Text variant="caption" color={theme.colors.mutedText}>
                  {t('auth.didntReceive', { defaultValue: 'Didn’t receive the code?' })}{' '}
                </Text>
                <TouchableOpacity onPress={handleResend} disabled={loading} hitSlop={8}>
                  <Text variant="caption" color={theme.colors.primary} style={styles.resendText}>
                    {t('auth.resendOtp', { defaultValue: 'Resend' })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            label={t('auth.verifyOtp', { defaultValue: 'Verify' })}
            variant="primary"
            disabled={otpCode.length !== CELL_COUNT || loading}
            loading={loading}
            onPress={handleVerify}
            style={styles.btn}
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
  content: { flex: 1, paddingTop: theme.spacing.xl },
  heading: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 28,
    lineHeight: 36,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
  },
  subtitle: { marginBottom: theme.spacing.xs },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  phoneText: { fontFamily: theme.fonts.medium, fontWeight: '500', color: theme.colors.ink },
  changeText: { fontFamily: theme.fonts.medium, fontWeight: '500' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  otpCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCellFilled: {
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.background,
  },
  otpCellActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  otpCellError: { borderColor: theme.colors.danger },
  otpDigit: {
    fontFamily: theme.fonts.regular,
    fontWeight: '400',
    fontSize: 20,
    color: theme.colors.ink,
  },
  caret: {
    width: 2,
    height: 20,
    borderRadius: 1,
    backgroundColor: theme.colors.primary,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  error: { marginTop: theme.spacing.md },
  resendContainer: { marginTop: theme.spacing.lg, alignItems: 'center' },
  resendInline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  resendText: { fontFamily: theme.fonts.medium, fontWeight: '500' },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  btn: { width: '100%' },
});
