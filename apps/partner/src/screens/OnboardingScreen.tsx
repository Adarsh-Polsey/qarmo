import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button, Input } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { CITIES } from '@qarmo/core';
import { supabase } from '@qarmo/supabase';
import { WizardData } from '../hooks/useWizard';
import { useAuth } from '../hooks/useAuth';
import { ImagePickerField } from '../components/ImagePickerField';

interface Props {
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  /** Finish for a customer account (name only) */
  onSubmitCustomer: () => Promise<void>;
  /** Finish for a partner account — referral is validated here, then passed through */
  onSubmitPartner: (validReferralCode: string | null) => Promise<void>;
  /** Discard onboarding and sign out (the only way "back" out of this screen) */
  onExit: () => void;
}

/** Validates a standard Indian vehicle registration plate (e.g. KL07BZ1234) */
const isValidPlate = (val: string) => {
  const clean = val.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(clean);
};

/** A single selectable card/pill used for account-type and partner-type choices */
const SelectOption: React.FC<{
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}> = ({ icon, label, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.option, selected && styles.optionSelected]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Text style={styles.optionIcon}>{icon}</Text>
    <Text
      variant="caption"
      color={selected ? theme.colors.ink : theme.colors.mutedText}
      style={styles.optionLabel}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

/**
 * Single dynamic onboarding screen shown to new users after OTP. The visible
 * fields adapt to the account type: a customer only enters a name, a partner
 * gets the ride/delivery choice plus two grouped cards (About you / Vehicle &
 * documents). Returning users never see this — they go straight to the app.
 */
export const OnboardingScreen: React.FC<Props> = ({
  formData,
  onUpdate,
  onSubmitCustomer,
  onSubmitPartner,
  onExit,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    accountType,
    partnerType,
    fullName,
    city,
    plateNumber,
    photoUri,
    aadhaarUri,
    drivingLicenceUri,
    referralCode,
  } = formData;

  const isCustomer = accountType === 'customer';
  const isPartner = accountType === 'partner';

  const nameValid = fullName.trim().length >= 2 && fullName.trim().length <= 60;
  const plateValid = isValidPlate(plateNumber);

  const customerReady = isCustomer && nameValid;
  const partnerReady =
    isPartner &&
    (partnerType === 'delivery' || partnerType === 'auto') &&
    nameValid &&
    !!city &&
    plateValid &&
    !!photoUri &&
    !!aadhaarUri &&
    !!drivingLicenceUri;

  const canFinish = customerReady || partnerReady;

  const handleFinish = async () => {
    if (submitting || !canFinish) return;
    setFormError(null);

    // Customer: nothing to validate beyond the name — finish directly.
    if (isCustomer) {
      setSubmitting(true);
      try {
        await onSubmitCustomer();
      } catch (err: any) {
        setSubmitting(false);
        setFormError(err?.message || t('wizard.errors.completionFailed', { defaultValue: 'Failed to complete profile.' }));
      }
      return;
    }

    // Partner: validate the referral code if one was entered. A wrong code blocks
    // (so the user can fix or clear it); an empty code just finishes without one.
    setSubmitting(true);
    const trimmed = (referralCode || '').trim().toUpperCase();
    if (trimmed) {
      try {
        const { data: isValid, error } = await supabase.rpc('validate_referral_code', { code: trimmed });
        if (error || !isValid) {
          setReferralError(t('wizard.invalidCode', { defaultValue: 'Code not found' }));
          setSubmitting(false);
          return;
        }
        if (profile && trimmed === profile.referral_code) {
          setReferralError(t('wizard.errors.selfReferral', { defaultValue: 'You cannot use your own referral code' }));
          setSubmitting(false);
          return;
        }
      } catch (err) {
        console.error('Error during referral validation:', err);
        setReferralError(t('wizard.errors.validationFailed', { defaultValue: 'Referral validation failed. Please try again.' }));
        setSubmitting(false);
        return;
      }
    }

    try {
      await onSubmitPartner(trimmed || null);
    } catch (err: any) {
      setSubmitting(false);
      setFormError(err?.message || t('wizard.errors.completionFailed', { defaultValue: 'Failed to complete profile.' }));
    }
  };

  const finishLabel = t('wizard.finish', { defaultValue: 'Finish' });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="title" color={theme.colors.ink} style={styles.title}>
            {t('onboarding.title', { defaultValue: 'Complete your profile' })}
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
            {t('onboarding.subtitle', { defaultValue: 'Tell us how you’ll use Qarmo' })}
          </Text>

          {/* Account type — inline, replaces the old standalone selection page */}
          <View style={styles.optionRow}>
            <SelectOption
              icon={t('accountType.customerIcon', { defaultValue: '🧍' })}
              label={t('accountType.customer', { defaultValue: 'Customer' })}
              selected={isCustomer}
              onPress={() => onUpdate({ accountType: 'customer', partnerType: '' })}
            />
            <SelectOption
              icon={t('accountType.partnerIcon', { defaultValue: '🛺' })}
              label={t('accountType.partner', { defaultValue: 'Partner' })}
              selected={isPartner}
              onPress={() => onUpdate({ accountType: 'partner' })}
            />
          </View>

          {/* Customer — just a name */}
          {isCustomer && (
            <View style={styles.card}>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.cardTitle}>
                {t('onboarding.aboutYou', { defaultValue: 'About you' })}
              </Text>
              <Input
                placeholder={t('wizard.namePlaceholder', { defaultValue: 'e.g. Amal Kumar' })}
                value={fullName}
                onChangeText={(val) => onUpdate({ fullName: val })}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* Partner — ride/delivery choice + two grouped cards */}
          {isPartner && (
            <>
              <View style={styles.optionRow}>
                <SelectOption
                  icon={t('partnerType.deliveryIcon', { defaultValue: '🛵' })}
                  label={t('partnerType.delivery', { defaultValue: 'Delivery' })}
                  selected={partnerType === 'delivery'}
                  onPress={() => onUpdate({ partnerType: 'delivery' })}
                />
                <SelectOption
                  icon={t('partnerType.rideIcon', { defaultValue: '🛺' })}
                  label={t('partnerType.ride', { defaultValue: 'Ride' })}
                  selected={partnerType === 'auto'}
                  onPress={() => onUpdate({ partnerType: 'auto' })}
                />
              </View>

              {/* Card 1 — About you */}
              <View style={styles.card}>
                <Text variant="caption" color={theme.colors.mutedText} style={styles.cardTitle}>
                  {t('onboarding.aboutYou', { defaultValue: 'About you' })}
                </Text>

                <Input
                  placeholder={t('wizard.namePlaceholder', { defaultValue: 'e.g. Amal Kumar' })}
                  value={fullName}
                  onChangeText={(val) => onUpdate({ fullName: val })}
                  autoCapitalize="words"
                />

                <Text variant="caption" color={theme.colors.ink} style={styles.fieldLabel}>
                  {t('wizard.city', { defaultValue: 'City' })}
                </Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setCityModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text variant="body" color={city ? theme.colors.ink : theme.colors.mutedText}>
                    {city || t('wizard.selectCity', { defaultValue: 'Select your city' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Card 2 — Vehicle & documents */}
              <View style={styles.card}>
                <Text variant="caption" color={theme.colors.mutedText} style={styles.cardTitle}>
                  {t('onboarding.vehicleDocs', { defaultValue: 'Vehicle & documents' })}
                </Text>

                <Text variant="caption" color={theme.colors.ink} style={styles.fieldLabel}>
                  {t('wizard.plateNumber', { defaultValue: 'Vehicle number' })}
                </Text>
                <Input
                  placeholder={t('wizard.plateHint', { defaultValue: 'e.g. KL 07 BZ 1234' })}
                  value={plateNumber}
                  onChangeText={(val) => onUpdate({ plateNumber: val.toUpperCase() })}
                  autoCapitalize="characters"
                />
                {plateNumber.trim().length > 0 && !plateValid && (
                  <Text variant="caption" color={theme.colors.danger} style={styles.inlineHint}>
                    {t('wizard.errors.registrationInvalid', {
                      defaultValue: 'Invalid registration number (format: AA00AA0000)',
                    })}
                  </Text>
                )}

                <View style={styles.spacer} />
                <ImagePickerField
                  label={t('wizard.photo', { defaultValue: 'Profile photo' })}
                  value={photoUri}
                  onChange={(uri) => onUpdate({ photoUri: uri })}
                  shape="circle"
                  aspect={[1, 1]}
                  placeholderIcon="📷"
                />

                <ImagePickerField
                  label={t('wizard.aadhaar', { defaultValue: 'Aadhaar card' })}
                  hint={t('wizard.aadhaarHint', { defaultValue: 'Upload your Aadhaar card' })}
                  value={aadhaarUri}
                  onChange={(uri) => onUpdate({ aadhaarUri: uri })}
                  placeholderIcon="🪪"
                />

                <ImagePickerField
                  label={t('wizard.drivingLicence', { defaultValue: 'Driving licence' })}
                  hint={t('wizard.drivingLicenceHint', { defaultValue: 'Upload your driving licence' })}
                  value={drivingLicenceUri}
                  onChange={(uri) => onUpdate({ drivingLicenceUri: uri })}
                  placeholderIcon="🪪"
                />

                <Text variant="caption" color={theme.colors.ink} style={styles.fieldLabel}>
                  {t('wizard.referral', { defaultValue: 'Referral code' })}
                  {'  '}
                  <Text variant="caption" color={theme.colors.mutedText}>
                    {t('common.optional', { defaultValue: '(optional)' })}
                  </Text>
                </Text>
                <Input
                  placeholder="e.g. ABC123"
                  value={referralCode}
                  onChangeText={(text) => {
                    setReferralError(null);
                    onUpdate({ referralCode: text.toUpperCase() });
                  }}
                  autoCapitalize="characters"
                  maxLength={6}
                  error={referralError || undefined}
                  editable={!submitting}
                />
              </View>
            </>
          )}

          {formError && (
            <Text variant="caption" color={theme.colors.danger} style={styles.formError}>
              {formError}
            </Text>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            label={finishLabel}
            variant="primary"
            disabled={!canFinish || submitting}
            loading={submitting}
            onPress={handleFinish}
            style={styles.btn}
          />
          <Button
            label={t('common.cancel', { defaultValue: 'Cancel' })}
            variant="ghost"
            disabled={submitting}
            onPress={onExit}
          />
        </View>
      </KeyboardAvoidingView>

      {/* City picker modal */}
      <Modal
        visible={cityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="title">{t('wizard.selectCity', { defaultValue: 'Select your city' })}</Text>
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
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => {
                    onUpdate({ city: item });
                    setCityModalVisible(false);
                  }}
                >
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
  safe: { flex: 1, backgroundColor: theme.colors.background },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  title: { marginBottom: theme.spacing.xs },
  subtitle: { marginBottom: theme.spacing.lg },
  optionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  option: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 96,
    justifyContent: 'center',
  },
  optionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  optionIcon: { fontSize: 32 },
  optionLabel: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  picker: {
    height: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  inlineHint: { marginTop: theme.spacing.xs },
  spacer: { height: theme.spacing.sm },
  formError: { marginTop: theme.spacing.sm, textAlign: 'center' },
  footer: {
    gap: theme.spacing.sm,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
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
