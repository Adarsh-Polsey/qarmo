import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { theme, Text, Button, Input } from '@qarmo/ui';
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

  const handleContinue = async () => {
    if (!isPhoneValid()) return;
    setLoading(true);
    setErrorMsg(null);
    const formattedPhone = `${selectedCountry.dialCode}${phone}`;
    try {
      await signInWithPhone(formattedPhone);
      onOtpSent(formattedPhone);
    } catch (err: any) {
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
          <Text variant="title" style={styles.label}>
            {t('auth.phone', { defaultValue: 'Phone Number' })}
          </Text>

          <View style={styles.phoneRow}>
            <TouchableOpacity
              style={styles.prefixContainer}
              onPress={() => setCountryModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.flagText}>{selectedCountry.flag}</Text>
              <Text style={styles.prefixText}>{selectedCountry.dialCode}</Text>
              <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>
            <View style={styles.flexInput}>
              <Input
                placeholder={
                  getPhoneLengthForCountry(selectedCountry.dialCode) === 10
                    ? '98765 43210'
                    : 'Enter phone number'
                }
                keyboardType="phone-pad"
                value={phone}
                onChangeText={handlePhoneChange}
                autoComplete="tel"
                maxLength={15}
                containerStyle={{ marginBottom: 0 }}
                autoFocus
              />
            </View>
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
  content: { flex: 1, justifyContent: 'center' },
  label: { marginBottom: theme.spacing.md },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  prefixContainer: {
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minWidth: 90,
  },
  flagText: { fontSize: 20 },
  prefixText: { ...theme.typography.body, fontWeight: '600', color: theme.colors.ink },
  chevron: { fontSize: 12, color: theme.colors.mutedText },
  flexInput: { flex: 1 },
  error: { marginTop: theme.spacing.sm },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  btn: { width: '100%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalClose: { fontSize: 24, color: theme.colors.mutedText },
  searchContainer: { padding: theme.spacing.lg },
  searchInput: { height: 48, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.md, fontSize: 16, color: theme.colors.ink, borderWidth: 1, borderColor: theme.colors.border },
  countryList: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  selectedCountryItem: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.sm },
  countryFlag: { fontSize: 24, marginRight: theme.spacing.md },
  countryInfo: { flex: 1 },
  countryName: { ...theme.typography.body, fontWeight: '500', color: theme.colors.ink },
  countryCode: { ...theme.typography.caption, color: theme.colors.mutedText },
  checkMark: { fontSize: 24, color: theme.colors.primary, fontWeight: 'bold' },
});
