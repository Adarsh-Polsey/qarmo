import React from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button, Input } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { WizardData } from '../hooks/useWizard';
import { WizardProgress } from '../components/WizardProgress';

interface Props {
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
  /** Label for the primary action — defaults to "Continue" */
  actionLabel?: string;
}

export const WizardNameScreen: React.FC<Props> = ({
  formData,
  onUpdate,
  onNext,
  onBack,
  currentStep,
  totalSteps,
  actionLabel,
}) => {
  const { t } = useTranslation();

  const name = formData.fullName;
  const isValid = name.trim().length >= 2 && name.trim().length <= 60;
  const hasText = name.trim().length > 0;

  const handleChange = (val: string) => {
    onUpdate({ fullName: val });
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
            {t('wizard.fullName', { defaultValue: 'Full Name' })}
          </Text>

          <Input
            placeholder="e.g. Amal Kumar"
            value={name}
            onChangeText={handleChange}
            autoCapitalize="words"
            autoFocus
          />

          {/* Hint shown when Continue is disabled */}
          {!isValid && hasText && (
            <Text variant="caption" color={theme.colors.danger} style={styles.hint}>
              {t('wizard.errors.nameLength', { defaultValue: 'Name must be between 2 and 60 characters' })}
            </Text>
          )}
          {!hasText && (
            <Text variant="caption" color={theme.colors.mutedText} style={styles.hint}>
              {t('wizard.enterNameToContinue', { defaultValue: 'Enter your name to continue' })}
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            label={actionLabel || t('wizard.continue', { defaultValue: 'Continue' })}
            variant="primary"
            disabled={!isValid}
            onPress={onNext}
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
  label: { marginBottom: theme.spacing.md },
  hint: { marginTop: theme.spacing.sm },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  btn: { width: '100%' },
});
