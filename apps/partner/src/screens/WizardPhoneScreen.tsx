import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { useAuth } from '../hooks/useAuth';
import { WizardProgress } from '../components/WizardProgress';

const countryData = [
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳' },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: 'SA', dialCode: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: 'MY', dialCode: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'SG', dialCode: '+65', name: 'Singapore', flag: '🇸🇬' },
];

interface Props {
  /** Which wizard step this phone screen is (e.g. 1 for customer, 1 for partner) */
  currentStep: number;
  totalSteps: number;
  onOtpSent: (formattedPhone: string) => void;
  onBack: () => void;
}

export const WizardPhoneScreen: React.FC<Props> = ({
  currentStep,
  totalSteps,
  onOtpSent,
  onBack,
}) => {
  const { t } = useTranslation();
  const { signInWithPhone } = useAuth();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(countryData[0]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const getPhoneLengthForCountry = (dialCode: string) => {
    const lengths: Record<string, number> = {
      '+91': 10, '+1': 10, '+44': 10, '+49': 11,
      '+971': 9, '+61': 9, '+966': 9, '+60': 10, '+65': 8,
    };
    return lengths[dialCode] || 10;
  };

  const isPhoneValid = () => {
    return phone.replace(/\D/g, '').length >= getPhoneLengthForCountry(selectedCountry.dialCode);
  };

  const handlePhoneChange = (val: string) => {
    setErrorMsg(null);
    setPhone(val.replace(/\D/g, ''));
  };

  /** Group the digits for a friendlier read, e.g. "98765 43210" */
  const prettyPhone = phone.replace(/(\d{5})(?=\d)/g, '$1 ').trim();
  const fullPhone = `${selectedCountry.dialCode} ${prettyPhone}`;

  const handleContinue = () => {
    if (!isPhoneValid()) return;
    setConfirmVisible(true);
  };

  const handleConfirmSend = async () => {
    setLoading(true);
    setErrorMsg(null);
    const formattedPhone = `${selectedCountry.dialCode}${phone}`;
    try {
      await signInWithPhone(formattedPhone);
      setConfirmVisible(false);
      onOtpSent(formattedPhone);
    } catch (err: any) {
      setConfirmVisible(false);
      setErrorMsg(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const selectCountry = (country: typeof countryData[0]) => {
    setSelectedCountry(country);
    setCountryModalVisible(false);
    setSearchQuery('');
    setPhone('');
  };

  const filteredCountries = countryData.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery),
  );

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
          <Text variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
            {t('auth.phoneSubtitle', {
              defaultValue: 'We’ll send you a verification code to confirm it’s you.',
            })}
          </Text>

          <Text variant="caption" color={theme.colors.mutedText} style={styles.fieldLabel}>
            {t('auth.phone', { defaultValue: 'Phone number' })}
          </Text>

          <View style={[styles.phoneField, inputFocused && styles.phoneFieldFocused]}>
            <TouchableOpacity
              style={styles.prefix}
              onPress={() => setCountryModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.flagText}>{selectedCountry.flag}</Text>
              <Text style={styles.prefixText}>{selectedCountry.dialCode}</Text>
              <Text style={styles.chevron}>▾</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TextInput
              style={styles.phoneInput}
              placeholder={
                getPhoneLengthForCountry(selectedCountry.dialCode) === 10
                  ? '98765 43210'
                  : t('auth.phonePlaceholder', { defaultValue: 'Enter phone number' })
              }
              placeholderTextColor={theme.colors.mutedText}
              keyboardType="phone-pad"
              value={prettyPhone}
              onChangeText={handlePhoneChange}
              autoComplete="tel"
              maxLength={16}
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
          <Button
            label={t('common.cancel', { defaultValue: 'Cancel' })}
            variant="ghost"
            onPress={onBack}
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
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text variant="title" style={styles.sheetTitle}>
              {t('auth.confirmTitle', { defaultValue: 'Confirm your number' })}
            </Text>
            <Text variant="body" color={theme.colors.mutedText} style={styles.sheetBody}>
              {t('auth.confirmBody', {
                defaultValue: 'We’ll send a verification code to',
              })}
            </Text>
            <Text variant="title" style={styles.sheetPhone}>
              {fullPhone}
            </Text>
            <View style={styles.sheetActions}>
              <Button
                label={t('common.cancel', { defaultValue: 'Cancel' })}
                variant="secondary"
                onPress={() => setConfirmVisible(false)}
                disabled={loading}
                style={styles.sheetBtn}
              />
              <Button
                label={t('auth.sendCode', { defaultValue: 'Send code' })}
                variant="primary"
                onPress={handleConfirmSend}
                loading={loading}
                disabled={loading}
                style={styles.sheetBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Country Picker Modal */}
      <Modal
        visible={countryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setCountryModalVisible(false); setSearchQuery(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="title" style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => { setCountryModalVisible(false); setSearchQuery(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search country or code..."
                placeholderTextColor={theme.colors.mutedText}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
              {filteredCountries.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={[styles.countryItem, selectedCountry.code === country.code && styles.selectedCountryItem]}
                  onPress={() => selectCountry(country)}
                >
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <View style={styles.countryInfo}>
                    <Text style={styles.countryName}>{country.name}</Text>
                    <Text style={styles.countryCode}>{country.dialCode}</Text>
                  </View>
                  {selectedCountry.code === country.code && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
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
  prefix: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingRight: theme.spacing.sm },
  flagText: { fontSize: 22 },
  prefixText: { ...theme.typography.body, fontFamily: theme.fonts.medium, fontWeight: '500', color: theme.colors.ink },
  chevron: { fontSize: 14, color: theme.colors.mutedText },
  divider: { width: 1, height: 24, backgroundColor: theme.colors.border, marginRight: theme.spacing.md },
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
  sheetActions: { flexDirection: 'row', gap: theme.spacing.md, width: '100%' },
  sheetBtn: { flex: 1 },

  // Country picker
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontFamily: theme.fonts.medium, fontSize: 18, fontWeight: '500' },
  modalClose: { fontSize: 24, color: theme.colors.mutedText },
  searchContainer: { padding: theme.spacing.lg },
  searchInput: { height: 48, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.md, fontFamily: theme.fonts.regular, fontSize: 16, color: theme.colors.ink, borderWidth: 1, borderColor: theme.colors.border },
  countryList: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  selectedCountryItem: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.sm },
  countryFlag: { fontSize: 24, marginRight: theme.spacing.md },
  countryInfo: { flex: 1 },
  countryName: { ...theme.typography.body, fontFamily: theme.fonts.medium, fontWeight: '500', color: theme.colors.ink },
  countryCode: { ...theme.typography.caption, color: theme.colors.mutedText },
  checkMark: { fontFamily: theme.fonts.medium, fontSize: 24, color: theme.colors.primary, fontWeight: '500' },
});
