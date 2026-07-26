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
}

/** Validates a standard Indian vehicle registration plate (e.g. KL07BZ1234) */
const isValidPlate = (val: string) => {
  const clean = val.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(clean);
};

export const WizardPlateScreen: React.FC<Props> = ({
  formData,
  onUpdate,
  onNext,
  onBack,
  currentStep,
  totalSteps,
}) => {
  const { t } = useTranslation();

  const plate = formData.plateNumber;
  const isValid = isValidPlate(plate);
  const hasText = plate.trim().length > 0;

  const handleChange = (val: string) => {
    onUpdate({ plateNumber: val.toUpperCase() });
  };

  const handleNext = () => {
    if (!isValid) return;
    onUpdate({ plateNumber: plate.replace(/\s+/g, '').toUpperCase() });
    onNext();
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
            {t('wizard.plateNumber', { defaultValue: 'Vehicle number' })}
          </Text>

          <Input
            placeholder={t('wizard.plateHint', { defaultValue: 'e.g. KL 07 BZ 1234' })}
            value={plate}
            onChangeText={handleChange}
            autoCapitalize="characters"
            autoFocus
          />

          {!isValid && hasText && (
            <Text variant="caption" color={theme.colors.danger} style={styles.hint}>
              {t('wizard.errors.registrationInvalid', {
                defaultValue: 'Invalid registration number (format: AA00AA0000)',
              })}
            </Text>
          )}
          {!hasText && (
            <Text variant="caption" color={theme.colors.mutedText} style={styles.hint}>
              {t('wizard.enterPlateToContinue', { defaultValue: 'Enter vehicle number to continue' })}
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            label={t('wizard.continue', { defaultValue: 'Continue' })}
            variant="primary"
            disabled={!isValid}
            onPress={handleNext}
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
