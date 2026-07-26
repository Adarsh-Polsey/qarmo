import React, { useState } from 'react';
import { StyleSheet, View, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { theme, Text, Button, Input } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { supabase } from '@qarmo/supabase';
import { WizardData } from '../hooks/useWizard';
import { useAuth } from '../hooks/useAuth';
import { WizardProgress } from '../components/WizardProgress';

interface Props {
  userId: string;
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onSubmit: (referralCode: string | null) => Promise<void>;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
}

export const WizardReferralScreen: React.FC<Props> = ({
  userId,
  formData,
  onUpdate,
  onSubmit,
  onBack,
  currentStep,
  totalSteps,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [code, setCode] = useState(formData.referralCode || '');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleTextChange = (text: string) => {
    setCode(text.toUpperCase());
    setValidationError(null);
    onUpdate({ referralCode: text.toUpperCase() });
  };

  const validateAndFinish = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      await handleComplete(null);
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    try {
      const { data: isValid, error: rpcError } = await supabase.rpc('validate_referral_code', {
        code: trimmedCode,
      });

      if (rpcError || !isValid) {
        // B-20: show "Code not found" — never block Finish
        setValidationError(t('wizard.invalidCode', { defaultValue: 'Code not found' }));
        setSubmitting(false);
        return;
      }

      // Lightweight self-referral UX hint (not authoritative — server also checks)
      if (profile && trimmedCode === profile.referral_code) {
        setValidationError(t('wizard.errors.selfReferral', { defaultValue: 'You cannot use your own referral code' }));
        setSubmitting(false);
        return;
      }

      await handleComplete(trimmedCode);
    } catch (err) {
      console.error('Error during referral validation:', err);
      setValidationError(
        t('wizard.errors.validationFailed', { defaultValue: 'Referral validation failed. Please try again.' }),
      );
      setSubmitting(false);
    }
  };

  const handleComplete = async (validReferralCode: string | null) => {
    setSubmitting(true);
    try {
      await onSubmit(validReferralCode);
    } catch (err: any) {
      console.error('Error completing profile:', err);
      setValidationError(
        err.message ||
          t('wizard.errors.completionFailed', { defaultValue: 'Failed to complete profile. Please try again.' }),
      );
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    await handleComplete(null);
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
          <Text variant="title" style={styles.title}>
            {t('wizard.referral', { defaultValue: 'Referral Code' })}
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.hint}>
            {t('wizard.referralOptional', {
              defaultValue: 'Optional — enter a referral code or skip',
            })}
          </Text>

          <Input
            placeholder="e.g. ABC123"
            value={code}
            onChangeText={handleTextChange}
            autoCapitalize="characters"
            maxLength={6}
            error={validationError || undefined}
            editable={!submitting}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.buttonsRow}>
            <Button
              label={t('wizard.skip', { defaultValue: 'Skip' })}
              variant="ghost"
              disabled={submitting}
              onPress={handleSkip}
              style={styles.footerBtn}
            />
            <Button
              label={t('wizard.finish', { defaultValue: 'Finish' })}
              variant="primary"
              disabled={submitting}
              loading={submitting}
              onPress={validateAndFinish}
              style={styles.footerBtn}
            />
          </View>
          <Button
            label={t('common.cancel', { defaultValue: 'Cancel' })}
            variant="ghost"
            disabled={submitting}
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
  title: { marginBottom: theme.spacing.sm },
  hint: { marginBottom: theme.spacing.xl },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  buttonsRow: { flexDirection: 'row', gap: theme.spacing.md, width: '100%' },
  footerBtn: { flex: 1 },
});
