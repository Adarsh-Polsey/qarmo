import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { theme, Text, Button, Input } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { supabase } from '@qarmo/supabase';
import { WizardData } from '../hooks/useWizard';
import { useAuth } from '../hooks/useAuth';

interface Props {
  userId: string;
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onSubmit: (referralCode: string | null) => Promise<void>;
  onBack: () => void;
}

export const WizardReferralScreen: React.FC<Props> = ({
  userId,
  formData,
  onUpdate,
  onSubmit,
  onBack,
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
      // Validate code via RPC instead of querying profiles directly
      const { data: isValid, error: rpcError } = await supabase.rpc('validate_referral_code', {
        code: trimmedCode,
      });

      if (rpcError || !isValid) {
        setValidationError(t('wizard.invalidCode'));
        setSubmitting(false);
        return;
      }

      // Check self-referral client-side ONLY as a lightweight UX hint (not authoritative)
      if (profile && trimmedCode === profile.referral_code) {
        setValidationError(t('wizard.errors.selfReferral', { defaultValue: 'You cannot use your own referral code' }));
        setSubmitting(false);
        return;
      }

      await handleComplete(trimmedCode);
    } catch (err) {
      console.error('Error during referral validation:', err);
      setValidationError(t('wizard.errors.validationFailed', { defaultValue: 'Referral validation failed. Please try again.' }));
      setSubmitting(false);
    }
  };

  const handleComplete = async (validReferralCode: string | null) => {
    setSubmitting(true);
    try {
      await onSubmit(validReferralCode);
    } catch (err: any) {
      console.error('Error completing profile:', err);
      setValidationError(err.message || t('wizard.errors.completionFailed', { defaultValue: 'Failed to complete profile. Please try again.' }));
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    await handleComplete(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="title" style={styles.title}>
            {t('wizard.referral')}
          </Text>
          <Text variant="caption" color={theme.colors.mutedText}>
            {t('wizard.stepTracker', { step: 4, total: 4, defaultValue: 'Step 4 of 4' })}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text variant="body" style={styles.instruction}>
            {t('wizard.referralHint')}
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
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.buttonsRow}>
          <Button
            label={t('wizard.skip')}
            variant="ghost"
            disabled={submitting}
            onPress={handleSkip}
            style={styles.footerBtn}
          />
          <Button
            label={t('wizard.finish')}
            variant="primary"
            disabled={submitting}
            loading={submitting}
            onPress={validateAndFinish}
            style={styles.footerBtn}
          />
        </View>
        <Button label={t('common.cancel')} variant="ghost" disabled={submitting} onPress={onBack} />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.xs,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: theme.spacing.xxl,
  },
  instruction: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.sm,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  footerBtn: {
    flex: 1,
  },
});
