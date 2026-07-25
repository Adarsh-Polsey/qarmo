import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { theme, Text, Button, Input } from '@qarmo/ui';
import { useTranslation, i18n } from '@qarmo/i18n';
import { APP_VERSION, DEFAULT_COUNTRY_CODE } from '@qarmo/core';
import { useAuth } from '../hooks/useAuth';

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

export const OTPScreen: React.FC = () => {
  const { t } = useTranslation();
  const { signInWithPhone, verifyOTP } = useAuth();

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [lang, setLang] = useState<'en' | 'ml'>('en');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countryData[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleLanguage = () => {
    const next = lang === 'en' ? 'ml' : 'en';
    i18n.changeLanguage(next);
    setLang(next);
  };

  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setTimeout(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cooldown]);

  useEffect(() => {
    // Mask phone number for display: show only last 4 digits
    if (phone.length >= 4) {
      const visible = phone.slice(-4);
      const masked = '*'.repeat(Math.max(0, phone.length - 4)) + visible;
      setMaskedPhone(masked);
    } else {
      setMaskedPhone(phone);
    }
  }, [phone]);

  const cleanPhone = (val: string) => {
    return val.replace(/\D/g, '');
  };

  const handlePhoneChange = (val: string) => {
    setErrorMsg(null);
    setPhone(cleanPhone(val));
  };

  const handleOtpChange = (val: string) => {
    setErrorMsg(null);
    setOtpCode(val.replace(/\D/g, '').slice(0, 6));
  };

  const getPhoneLengthForCountry = (dialCode: string) => {
    const lengths: Record<string, number> = {
      '+91': 10,
      '+1': 10,
      '+44': 10,
      '+49': 11,
      '+971': 9,
      '+61': 9,
      '+966': 9,
      '+60': 10,
      '+65': 8,
    };
    return lengths[dialCode] || 10;
  };

  const isPhoneValid = () => {
    const expectedLength = getPhoneLengthForCountry(selectedCountry.dialCode);
    return phone.length >= expectedLength;
  };

  const sendCode = async () => {
    if (!isPhoneValid()) return;
    if (step === 'otp' && resendCount >= 3) return;
    setLoading(true);
    setErrorMsg(null);

    const formattedPhone = `${selectedCountry.dialCode}${phone}`;
    try {
      await signInWithPhone(formattedPhone);
      if (step === 'otp') {
        setResendCount((prev) => prev + 1);
      }
      setStep('otp');
      setCooldown(30);
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (otpCode.length < 6) return;
    setLoading(true);
    setErrorMsg(null);

    const formattedPhone = `${selectedCountry.dialCode}${phone}`;
    try {
      await verifyOTP(formattedPhone, otpCode);
    } catch (err: any) {
      setErrorMsg(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtpCode('');
    setErrorMsg(null);
    setResendCount(0);
  };

  const selectCountry = (country: typeof countryData[0]) => {
    setSelectedCountry(country);
    setCountryModalVisible(false);
    setSearchQuery('');
    setPhone('');
  };

  const filteredCountries = countryData.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.dialCode.includes(searchQuery)
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text variant="title" color={theme.colors.primary} style={styles.appTitle}>
            Qarmo Partner
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
            {t('auth.tagline', { defaultValue: 'Drive & Earn' })}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {step === 'phone' ? (
            <View style={styles.inputGroup}>
              <Text variant="body" style={styles.instruction}>
                {t('auth.phone')}
              </Text>

              <View style={styles.phoneInputWrapper}>
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
                  />
                </View>
              </View>
              {errorMsg && (
                <Text variant="caption" color={theme.colors.danger} style={styles.errorText}>
                  {errorMsg}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <View style={styles.otpHeaderRow}>
                <Text variant="body" style={styles.instruction}>
                  {t('auth.otp')}
                </Text>
                <TouchableOpacity onPress={handleBackToPhone}>
                  <Text variant="caption" color={theme.colors.primary}>
                    {t('auth.changePhone', {
                      phone: `${selectedCountry.flag} ${selectedCountry.dialCode} ${maskedPhone}`,
                      defaultValue: `Change (${selectedCountry.flag} ${selectedCountry.dialCode} ${maskedPhone})`,
                    })}
                  </Text>
                </TouchableOpacity>
              </View>

              <Input
                placeholder="123456"
                keyboardType="number-pad"
                value={otpCode}
                onChangeText={handleOtpChange}
                maxLength={6}
                autoFocus
              />

              {errorMsg && (
                <Text variant="caption" color={theme.colors.danger} style={styles.errorText}>
                  {errorMsg}
                </Text>
              )}

              <View style={styles.cooldownContainer}>
                {resendCount >= 3 ? (
                  <Text variant="caption" color={theme.colors.danger}>
                    {t('auth.resendLimitReached', { defaultValue: 'Maximum resend attempts reached.' })}
                  </Text>
                ) : cooldown > 0 ? (
                  <Text variant="caption" color={theme.colors.mutedText}>
                    {t('auth.resendOtp')} in {cooldown}s
                  </Text>
                ) : (
                  <TouchableOpacity onPress={sendCode} disabled={loading}>
                    <Text variant="caption" color={theme.colors.primary} style={styles.resendText}>
                      {t('auth.resendOtp')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {step === 'phone' ? (
            <Button
              label={t('wizard.continue')}
              variant="primary"
              disabled={!isPhoneValid() || loading}
              loading={loading}
              onPress={sendCode}
              style={styles.actionBtn}
            />
          ) : (
            <Button
              label={t('auth.verifyOtp')}
              variant="primary"
              disabled={otpCode.length !== 6 || loading}
              loading={loading}
              onPress={verifyCode}
              style={styles.actionBtn}
            />
          )}

          <Button
            label={lang === 'en' ? 'മലയാളം' : 'English'}
            variant="ghost"
            onPress={toggleLanguage}
          />

          <Text variant="caption" color={theme.colors.mutedText} style={styles.version}>
            v{APP_VERSION}
          </Text>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={countryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCountryModalVisible(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="title" style={styles.modalTitle}>
                Select Country
              </Text>
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
                  style={[
                    styles.countryItem,
                    selectedCountry.code === country.code && styles.selectedCountryItem,
                  ]}
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
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  kav: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'space-between',
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  appTitle: {
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  inputGroup: {
    width: '100%',
  },
  instruction: {
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
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
  flagText: {
    fontSize: 20,
  },
  prefixText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  chevron: {
    fontSize: 12,
    color: theme.colors.mutedText,
  },
  flexInput: {
    flex: 1,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    marginTop: theme.spacing.sm,
  },
  cooldownContainer: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  resendText: {
    fontWeight: '600',
  },
  footer: {
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  actionBtn: {
    width: '100%',
  },
  version: {
    marginTop: theme.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalClose: {
    fontSize: 24,
    color: theme.colors.mutedText,
  },
  searchContainer: {
    padding: theme.spacing.lg,
  },
  searchInput: {
    height: 48,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.ink,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countryList: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectedCountryItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: theme.spacing.md,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    ...theme.typography.body,
    fontWeight: '500',
    color: theme.colors.ink,
  },
  countryCode: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  checkMark: {
    fontSize: 24,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
});
