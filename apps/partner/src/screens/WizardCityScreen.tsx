import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { CITIES } from '@qarmo/core';
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

export const WizardCityScreen: React.FC<Props> = ({
  formData,
  onUpdate,
  onNext,
  onBack,
  currentStep,
  totalSteps,
}) => {
  const { t } = useTranslation();
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const city = formData.city;
  const isValid = !!city;

  const handleSelect = (selected: string) => {
    onUpdate({ city: selected });
    setCityModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress */}
      <View style={styles.topContent}>
        <WizardProgress current={currentStep} total={totalSteps} />

        {/* Content */}
        <View style={styles.content}>
          <Text variant="title" style={styles.label}>
            {t('wizard.city', { defaultValue: 'City' })}
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.sublabel}>
            {t('wizard.cityHint', { defaultValue: 'Town or area you work in' })}
          </Text>

          <TouchableOpacity
            style={styles.picker}
            onPress={() => setCityModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text
              variant="body"
              color={city ? theme.colors.ink : theme.colors.mutedText}
            >
              {city || t('wizard.selectCity', { defaultValue: 'Select your city' })}
            </Text>
          </TouchableOpacity>

          {!isValid && (
            <Text variant="caption" color={theme.colors.mutedText} style={styles.hint}>
              {t('wizard.selectCityToContinue', { defaultValue: 'Select a city to continue' })}
            </Text>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          label={t('wizard.continue', { defaultValue: 'Continue' })}
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

      {/* City Picker Modal */}
      <Modal
        visible={cityModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="title">
                {t('wizard.selectCity', { defaultValue: 'Select your city' })}
              </Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Text variant="body" color={theme.colors.primary}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.cityItem} onPress={() => handleSelect(item)}>
                  <Text variant="body" style={styles.cityText}>{item}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  topContent: { flex: 1 },
  content: { flex: 1, justifyContent: 'center' },
  label: { marginBottom: theme.spacing.sm },
  sublabel: { marginBottom: theme.spacing.md },
  picker: {
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  hint: { marginTop: theme.spacing.sm },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  btn: { width: '100%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: '70%',
    paddingBottom: theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  cityItem: { paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  cityText: { fontSize: 18 },
  separator: { height: 1, backgroundColor: theme.colors.border },
});
