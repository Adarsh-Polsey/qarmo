import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { useAuth } from '../hooks/useAuth';
import { WizardProgress } from '../components/WizardProgress';

const DIAL_CODE = '+91';
const PHONE_LENGTH = 10;

interface Props {
  /** Which wizard step this phone screen is (e.g. 1 for customer, 1 for partner) */
  currentStep: number;
  totalSteps: number;
  /** Restores previously-typed digits when navigating back from the OTP screen */
  initialPhone?: string;
  onOtpSent: (formattedPhone: string, rawPhone: string) => void;
  onBack: () => void;
}

export const WizardPhoneScreen: React.FC<Props> = ({
  currentStep,
  totalSteps,
  initialPhone = '',
  onOtpSent,
  onBack,
}) => {
  const { t } = useTranslation();
  const { signInWithPhone } = useAuth();

  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const isPhoneValid = () => phone.replace(/\D/g, '').length >= PHONE_LENGTH;

  const handlePhoneChange = (val: string) => {
    setErrorMsg(null);
    setPhone(val.replace(/\D/g, ''));
  };

  /** Group the digits for a friendlier read, e.g. "98765 43210" */
  const prettyPhone = phone.replace(/(\d{5})(?=\d)/g, '$1 ').trim();
  const fullPhone = `${DIAL_CODE} ${prettyPhone}`;

  const handleContinue = () => {
    if (!isPhoneValid()) return;
    setConfirmVisible(true);
  };

  const handleConfirmSend = async () => {
    setLoading(true);
    setErrorMsg(null);
    const formattedPhone = `${DIAL_CODE}${phone}`;
    try {
      await signInWithPhone(formattedPhone);
      setConfirmVisible(false);
      onOtpSent(formattedPhone, phone);
    } catch (err: any) {
      setConfirmVisible(false);
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
            {t('auth.phoneTitle', { defaultValue: 'Enter your phone number' })}
          </Text>
          <Text variant="body" color={theme.colors.hint} style={styles.subtitle}>
            {t('auth.phoneSubtitle', {
              defaultValue: 'We’ll send you a verification code to confirm it’s you.',
            })}
          </Text>

          <Text variant="caption" color={theme.colors.mutedText} style={styles.fieldLabel}>
            {t('auth.phone', { defaultValue: 'Phone number' })}
          </Text>

          <View style={[styles.phoneField, inputFocused && styles.phoneFieldFocused]}>
            <Text style={styles.prefixText}>{DIAL_CODE}</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.phoneInput}
              placeholder="98765 43210"
              placeholderTextColor={theme.colors.hint}
              keyboardType="phone-pad"
              value={prettyPhone}
              onChangeText={handlePhoneChange}
              autoComplete="tel"
              maxLength={PHONE_LENGTH + 2}
              autoFocus
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
          </View>

          {errorMsg && (
            <Text variant="caption" color={theme.colors.danger} style={styles.error}>
              {errorMsg}
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            label={t('wizard.continue', { defaultValue: 'Continue' })}
            variant="primary"
            disabled={!isPhoneValid() || loading}
            loading={loading}
            onPress={handleContinue}
            style={styles.btn}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Confirmation bottom sheet */}
      <Modal
        visible={confirmVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setConfirmVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => { if (!loading) setConfirmVisible(false); }}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text variant="title" style={styles.sheetTitle}>
              {t('auth.confirmTitle', { defaultValue: 'Confirm your number' })}
            </Text>
            <Text variant="body" color={theme.colors.hint} style={styles.sheetBody}>
              {t('auth.confirmBody', {
                defaultValue: 'We’ll send a verification code to',
              })}
            </Text>
            <Text variant="title" style={styles.sheetPhone}>
              {fullPhone}
            </Text>
            <Button
              label={t('auth.sendCode', { defaultValue: 'Send code' })}
              variant="primary"
              onPress={handleConfirmSend}
              loading={loading}
              disabled={loading}
              style={styles.btn}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
  subtitle: { marginBottom: theme.spacing.xl },
  fieldLabel: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
  },
  phoneFieldFocused: { borderColor: theme.colors.primary },
  prefixText: { ...theme.typography.body, fontFamily: theme.fonts.medium, fontWeight: '500', color: theme.colors.ink },
  divider: { width: 1, height: 24, backgroundColor: theme.colors.border, marginHorizontal: theme.spacing.md },
  phoneInput: {
    flex: 1,
    ...theme.typography.body,
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    color: theme.colors.ink,
    paddingVertical: 0,
    letterSpacing: 1,
  },
  error: { marginTop: theme.spacing.sm },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  btn: { width: '100%' },

  // Confirmation sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  sheetTitle: { textAlign: 'center', marginBottom: theme.spacing.sm },
  sheetBody: { textAlign: 'center', marginBottom: theme.spacing.xs },
  sheetPhone: { textAlign: 'center', marginBottom: theme.spacing.lg },
});
