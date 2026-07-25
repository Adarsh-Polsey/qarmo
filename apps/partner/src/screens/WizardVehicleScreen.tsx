import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { theme, Text, Button, Input, Card } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { CITIES } from '@qarmo/core';
import { WizardData } from '../hooks/useWizard';

interface Props {
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const WizardVehicleScreen: React.FC<Props> = ({ formData, onUpdate, onNext, onBack }) => {
  const { t } = useTranslation();
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const selectedRoles = formData.roles;
  const vehicles = formData.vehicles || {};

  // Form states locally so we don't spam async-storage on every keystroke, but initialize from formData
  const [selectedCity, setSelectedCity] = useState<string>(formData.city);

  const [autoReg, setAutoReg] = useState<string>(vehicles.auto_driver?.registrationNumber || '');

  const [deliveryType, setDeliveryType] = useState<'bike' | 'scooter' | 'bicycle' | ''>(
    (vehicles.delivery_executive?.vehicleType as 'bike' | 'scooter' | 'bicycle') || '',
  );
  const [deliveryReg, setDeliveryReg] = useState<string>(
    vehicles.delivery_executive?.registrationNumber || '',
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateRegNumber = (num: string) => {
    const clean = num.replace(/\s+/g, '').toUpperCase();
    // Regular Indian plate: e.g. KL07BZ1234 or KL7B1234
    // standard is 2 letters, 2 digits, 1 or 2 letters, 4 digits
    const regex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;
    return regex.test(clean);
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    onUpdate({ city });
    setCityModalVisible(false);
  };

  const handleNext = () => {
    const newErrors: Record<string, string> = {};
    const updatedVehicles = { ...vehicles };

    if (!selectedCity) {
      newErrors.city = t('wizard.errors.cityRequired', { defaultValue: 'Please select a city' });
    }

    if (selectedRoles.includes('auto_driver')) {
      const cleanAutoReg = autoReg.replace(/\s+/g, '').toUpperCase();
      if (!cleanAutoReg) {
        newErrors.autoReg = t('wizard.errors.registrationRequired', { defaultValue: 'Registration number is required' });
      } else if (!validateRegNumber(cleanAutoReg)) {
        newErrors.autoReg = t('wizard.errors.registrationInvalid', { defaultValue: 'Invalid registration number (format: AA00AA0000)' });
      } else {
        updatedVehicles.auto_driver = {
          vehicleType: 'auto',
          registrationNumber: cleanAutoReg,
        };
      }
    }

    if (selectedRoles.includes('delivery_executive')) {
      if (!deliveryType) {
        newErrors.deliveryType = t('wizard.errors.vehicleTypeRequired', { defaultValue: 'Please select a vehicle type' });
      } else {
        if (deliveryType === 'bicycle') {
          updatedVehicles.delivery_executive = {
            vehicleType: 'bicycle',
            registrationNumber: 'N/A',
          };
        } else {
          const cleanDeliveryReg = deliveryReg.replace(/\s+/g, '').toUpperCase();
          if (!cleanDeliveryReg) {
            newErrors.deliveryReg = t('wizard.errors.registrationRequired', { defaultValue: 'Registration number is required' });
          } else if (!validateRegNumber(cleanDeliveryReg)) {
            newErrors.deliveryReg = t('wizard.errors.registrationInvalid', { defaultValue: 'Invalid registration number (format: AA00AA0000)' });
          } else {
            updatedVehicles.delivery_executive = {
              vehicleType: deliveryType,
              registrationNumber: cleanDeliveryReg,
            };
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // No errors, update context and move next
    onUpdate({
      city: selectedCity,
      vehicles: updatedVehicles,
    });
    onNext();
  };

  // Determine if next button is disabled
  const isCityValid = !!selectedCity;

  const isAutoValid = selectedRoles.includes('auto_driver') ? validateRegNumber(autoReg) : true;

  const isDeliveryValid = selectedRoles.includes('delivery_executive')
    ? !!deliveryType && (deliveryType === 'bicycle' || validateRegNumber(deliveryReg))
    : true;

  const isFormValid = isCityValid && isAutoValid && isDeliveryValid;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="title" style={styles.title}>
            {t('wizard.vehicle')}
          </Text>
          <Text variant="caption" color={theme.colors.mutedText}>
            {t('wizard.stepTracker', { step: 3, total: 4, defaultValue: 'Step 3 of 4' })}
          </Text>
        </View>

        {/* City Selector */}
        <View style={styles.section}>
          <Text variant="body" style={styles.sectionTitle}>
            {t('wizard.city')}
          </Text>
          <TouchableOpacity style={styles.pickerTrigger} onPress={() => setCityModalVisible(true)}>
            <Text variant="body" color={selectedCity ? theme.colors.ink : theme.colors.mutedText}>
              {selectedCity || t('wizard.selectCity')}
            </Text>
          </TouchableOpacity>
          {errors.city && (
            <Text variant="caption" color={theme.colors.danger}>
              {errors.city}
            </Text>
          )}
        </View>

        {/* Auto Driver Section */}
        {selectedRoles.includes('auto_driver') && (
          <Card style={styles.vehicleCard}>
            <Text variant="body" style={styles.cardHeading}>
              {t('wizard.autoDriver')} {t('wizard.vehicle')}
            </Text>

            <View style={styles.formRow}>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.label}>
                {t('wizard.vehicleType')}
              </Text>
              <View style={styles.fixedTypeBadge}>
                <Text variant="body" style={styles.fixedTypeText}>
                  {t('wizard.auto', { defaultValue: 'Auto' })}
                </Text>
              </View>
            </View>

            <Input
              label={t('wizard.registrationNumber')}
              placeholder="e.g. KL07BZ1234"
              value={autoReg}
              onChangeText={(text) => {
                setAutoReg(text);
                setErrors((prev) => ({ ...prev, autoReg: '' }));
              }}
              autoCapitalize="characters"
              error={errors.autoReg}
            />
          </Card>
        )}

        {/* Delivery Executive Section */}
        {selectedRoles.includes('delivery_executive') && (
          <Card style={styles.vehicleCard}>
            <Text variant="body" style={styles.cardHeading}>
              {t('wizard.deliveryExecutive')} {t('wizard.vehicle')}
            </Text>

            {/* Vehicle Type Selection */}
            <View style={styles.formRow}>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.label}>
                {t('wizard.vehicleType')}
              </Text>

              <View style={styles.typeButtons}>
                {(['bike', 'scooter', 'bicycle'] as const).map((type) => {
                  const isSelected = deliveryType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
                      onPress={() => {
                        setDeliveryType(type);
                        setErrors((prev) => ({ ...prev, deliveryType: '' }));
                      }}
                    >
                      <Text
                        variant="caption"
                        color={isSelected ? theme.colors.textOnColored : theme.colors.ink}
                      >
                        {t('wizard.vehicleTypes.' + type, { defaultValue: type }).toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.deliveryType && (
                <Text variant="caption" color={theme.colors.danger}>
                  {errors.deliveryType}
                </Text>
              )}
            </View>

            {/* Registration Number (Only for Motorized Vehicles) */}
            {deliveryType !== 'bicycle' && deliveryType !== '' && (
              <Input
                label={t('wizard.registrationNumber')}
                placeholder="e.g. KL08CA5678"
                value={deliveryReg}
                onChangeText={(text) => {
                  setDeliveryReg(text);
                  setErrors((prev) => ({ ...prev, deliveryReg: '' }));
                }}
                autoCapitalize="characters"
                error={errors.deliveryReg}
              />
            )}

            {deliveryType === 'bicycle' && (
              <View style={styles.bicycleInfo}>
                <Text variant="caption" color={theme.colors.success}>
                  {t('wizard.noRegNeeded', { defaultValue: 'No registration plate needed for bicycle.' })}
                </Text>
              </View>
            )}
          </Card>
        )}
      </ScrollView>

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
              <Text variant="title">{t('wizard.selectCity')}</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Text variant="body" color={theme.colors.primary}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.cityItem} onPress={() => handleCitySelect(item)}>
                  <Text variant="body" style={styles.cityItemText}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>

      {/* Footer */}
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
          disabled={!isFormValid}
          onPress={handleNext}
          style={styles.footerBtn}
        />
      </View>
    </KeyboardAvoidingView>
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
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  pickerTrigger: {
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  vehicleCard: {
    marginBottom: theme.spacing.lg,
    borderColor: theme.colors.border,
    borderWidth: 1.5,
  },
  cardHeading: {
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  formRow: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  fixedTypeBadge: {
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fixedTypeText: {
    fontWeight: '600',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  typeButton: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  typeButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  bicycleInfo: {
    padding: theme.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
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
  cityItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  cityItemText: {
    fontSize: 18,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
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
