import React from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { theme, Text, Button, Card } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { WizardData } from '../hooks/useWizard';

interface Props {
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const WizardRoleScreen: React.FC<Props> = ({ formData, onUpdate, onNext, onBack }) => {
  const { t } = useTranslation();
  const selectedRoles = formData.roles;

  const toggleRole = (role: 'auto_driver' | 'delivery_executive') => {
    let nextRoles = [...selectedRoles];
    if (nextRoles.includes(role)) {
      nextRoles = nextRoles.filter((r) => r !== role);
    } else {
      nextRoles.push(role);
    }
    onUpdate({ roles: nextRoles });
  };

  const isAutoSelected = selectedRoles.includes('auto_driver');
  const isDeliverySelected = selectedRoles.includes('delivery_executive');
  const isValid = selectedRoles.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="title" style={styles.title}>
            {t('wizard.role')}
          </Text>
          <Text variant="caption" color={theme.colors.mutedText}>
            {t('wizard.stepTracker', { step: 2, total: 4, defaultValue: 'Step 2 of 4' })}
          </Text>
        </View>

        {/* Roles container */}
        <View style={styles.rolesContainer}>
          {/* Auto Driver Card */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => toggleRole('auto_driver')}
            style={styles.roleCardWrapper}
          >
            <Card style={[styles.roleCard, isAutoSelected && styles.selectedCard]}>
              <View style={styles.cardHeader}>
                <Text
                  variant="body"
                  color={isAutoSelected ? theme.colors.primaryPressed : theme.colors.ink}
                  style={styles.roleTitle}
                >
                  {t('wizard.autoDriver')}
                </Text>
                <View style={[styles.checkbox, isAutoSelected && styles.checkboxChecked]}>
                  {isAutoSelected && <View style={styles.checkboxDot} />}
                </View>
              </View>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.roleDescription}>
                {t('wizard.autoDriverDesc', { defaultValue: 'Drive passengers across town in your auto rickshaw. Earn per ride.' })}
              </Text>
            </Card>
          </TouchableOpacity>

          {/* Delivery Executive Card */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => toggleRole('delivery_executive')}
            style={styles.roleCardWrapper}
          >
            <Card style={[styles.roleCard, isDeliverySelected && styles.selectedCard]}>
              <View style={styles.cardHeader}>
                <Text
                  variant="body"
                  color={isDeliverySelected ? theme.colors.primaryPressed : theme.colors.ink}
                  style={styles.roleTitle}
                >
                  {t('wizard.deliveryExecutive')}
                </Text>
                <View style={[styles.checkbox, isDeliverySelected && styles.checkboxChecked]}>
                  {isDeliverySelected && <View style={styles.checkboxDot} />}
                </View>
              </View>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.roleDescription}>
                {t('wizard.deliveryExecutiveDesc', { defaultValue: 'Deliver food, groceries, and packages using your bike, scooter, or cycle.' })}
              </Text>
            </Card>
          </TouchableOpacity>
        </View>

        {!isValid && (
          <Text variant="caption" color={theme.colors.danger} style={styles.errorText}>
            {t('wizard.selectAtLeastOne')}
          </Text>
        )}
      </ScrollView>

      {/* Footer buttons */}
      <View style={styles.footer}>
        <Button
          label={t('common.cancel')}
          variant="ghost"
          onPress={onBack}
          style={styles.footerBtn}
        />
        <Button
          label={t('wizard.next')}
          variant="primary"
          disabled={!isValid}
          onPress={onNext}
          style={styles.footerBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.xs,
  },
  rolesContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  roleCardWrapper: {
    width: '100%',
  },
  roleCard: {
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  roleTitle: {
    fontWeight: '700',
    fontSize: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkboxDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.background,
  },
  roleDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  footerBtn: {
    flex: 1,
  },
});
