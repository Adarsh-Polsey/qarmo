import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  theme,
  Text,
  Button,
  Input,
  IconComponent,
  IconTaxi,
  IconScooter,
  IconCaretLeft,
  IconX,
  IconCamera,
  IconIdentificationCard,
} from '@qarmo/ui';
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

/** Springy slide config shared by the tab underline and the pill thumb. */
const SLIDE = { duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true };

/** Inner padding of the segmented-pill track — the thumb inset on every side. */
const SEG_PAD = 4;

/**
 * Top-level account choice, styled as a full-width tab bar: plain labels over a
 * hairline track with an ink underline that slides to the active tab (no icons,
 * no boxes).
 */
function AccountTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: string;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const rawIndex = options.findIndex((o) => o.value === value);
  // No option chosen yet (fresh signup) — neither label is active and the sliding
  // underline stays hidden, so the choice reads as neutral rather than pre-picked.
  const hasSelection = rawIndex !== -1;
  const index = Math.max(0, rawIndex);
  const segW = width / options.length;
  // Tracks whether we've ever had a selection — the first tap should have the
  // underline simply appear at that tab, not slide in from the (never-shown) first tab.
  const hadSelectionRef = useRef(false);

  useEffect(() => {
    if (!hasSelection) return;
    if (!hadSelectionRef.current) {
      anim.setValue(index);
      hadSelectionRef.current = true;
      return;
    }
    Animated.timing(anim, { toValue: index, ...SLIDE }).start();
  }, [index, hasSelection, anim]);

  const translateX = anim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * segW),
  });

  return (
    <View
      style={styles.tabRow}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={styles.tab}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            <Text
              variant="body"
              color={active ? theme.colors.ink : theme.colors.mutedText}
              style={styles.tabLabel}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
      {width > 0 && hasSelection && (
        <Animated.View
          style={[styles.tabIndicator, { width: segW, transform: [{ translateX }] }]}
        />
      )}
    </View>
  );
}

/**
 * Two-way choice, styled as a segmented pill: a grey track with a white thumb
 * (soft 1px border) that slides to the active option.
 */
function SegmentedPill<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; icon: IconComponent; label: string }[];
  value: string;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width > 0 ? (width - SEG_PAD * 2) / options.length : 0;

  useEffect(() => {
    Animated.timing(anim, { toValue: index, ...SLIDE }).start();
  }, [index, anim]);

  const translateX = anim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * segW),
  });

  return (
    <View
      style={styles.segTrack}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View
          style={[styles.segThumb, { width: segW, transform: [{ translateX }] }]}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        const OptIcon = opt.icon;
        return (
          <TouchableOpacity
            key={opt.value}
            style={styles.segItem}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <OptIcon size={16} color={active ? theme.colors.primary : theme.colors.mutedText} />
            <Text
              variant="caption"
              color={active ? theme.colors.primary : theme.colors.mutedText}
              style={styles.segLabel}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

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
    (partnerType === 'delivery' || partnerType === 'ride') &&
    nameValid &&
    !!city &&
    plateValid &&
    !!photoUri &&
    !!aadhaarUri &&
    !!drivingLicenceUri;

  const canFinish = customerReady || partnerReady;

  // One-line reason shown above the disabled Finish button (Design Philosophy: never a
  // silent no-op). Walks the same fields canFinish checks, in the order they appear on
  // the form, so it always names the very next thing missing.
  const finishReason = (() => {
    if (canFinish) return null;
    if (!accountType) {
      return t('wizard.chooseAccountType', { defaultValue: 'Choose Customer or Partner to continue' });
    }
    if (isCustomer) {
      return t('wizard.enterNameToContinue', { defaultValue: 'Enter your name to continue' });
    }
    if (!nameValid) return t('wizard.enterNameToContinue', { defaultValue: 'Enter your name to continue' });
    if (!city) return t('wizard.selectCityToContinue', { defaultValue: 'Select a city to continue' });
    if (!plateValid) return t('wizard.enterPlateToContinue', { defaultValue: 'Enter vehicle number to continue' });
    if (!photoUri) return t('wizard.addPhotoToContinue', { defaultValue: 'Add a photo to continue' });
    if (!aadhaarUri || !drivingLicenceUri) {
      return t('wizard.addDocumentToContinue', { defaultValue: 'Add a document to continue' });
    }
    return null;
  })();

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
      {/* iOS-style back — the only way out of onboarding (signs out) */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onExit}
          disabled={submitting}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <IconCaretLeft size={20} color={theme.colors.ink} style={styles.backChevron} />
          <Text variant="body" color={theme.colors.ink} style={styles.backLabel}>
            {t('common.back', { defaultValue: 'Back' })}
          </Text>
        </TouchableOpacity>
      </View>

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

          {/* Account type — full-width tab bar, replaces the old selection page */}
          <AccountTabs
            value={accountType}
            onChange={(next) =>
              next === 'customer'
                ? onUpdate({ accountType: 'customer', partnerType: '' })
                : onUpdate({ accountType: 'partner', partnerType: partnerType || 'ride' })
            }
            options={[
              { value: 'customer', label: t('accountType.customer', { defaultValue: 'Customer' }) },
              { value: 'partner', label: t('accountType.partner', { defaultValue: 'Partner' }) },
            ]}
          />

          {/* Customer — just a name */}
          {isCustomer && (
            <View style={styles.card}>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.cardTitle}>
                {t('onboarding.fullName', { defaultValue: 'Full name' })}
              </Text>
              <Input
                dense
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
              <SegmentedPill
                value={partnerType}
                onChange={(value) => onUpdate({ partnerType: value })}
                options={[
                  {
                    value: 'ride',
                    icon: IconTaxi,
                    label: t('partnerType.ride', { defaultValue: 'Ride' }),
                  },
                  {
                    value: 'delivery',
                    icon: IconScooter,
                    label: t('partnerType.delivery', { defaultValue: 'Delivery' }),
                  },
                ]}
              />

              {/* Section — About you */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionAccent} />
                  <Text variant="caption" color={theme.colors.mutedText} style={styles.sectionTitle}>
                    {t('onboarding.aboutYou', { defaultValue: 'About you' })}
                  </Text>
                </View>

                <Input
                  dense
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
                  <Text
                    variant="body"
                    color={city ? theme.colors.ink : theme.colors.mutedText}
                    style={styles.pickerText}
                  >
                    {city || t('wizard.selectCity', { defaultValue: 'Select your city' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Section — Vehicle & documents */}
              <View style={[styles.section, styles.sectionDivider]}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionAccent} />
                  <Text variant="caption" color={theme.colors.mutedText} style={styles.sectionTitle}>
                    {t('onboarding.vehicleDocs', { defaultValue: 'Vehicle & documents' })}
                  </Text>
                </View>

                <Text variant="caption" color={theme.colors.ink} style={styles.fieldLabel}>
                  {t('wizard.plateNumber', { defaultValue: 'Vehicle number' })}
                </Text>
                <Input
                  dense
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
                  placeholderIcon={IconCamera}
                />

                <ImagePickerField
                  label={t('wizard.aadhaar', { defaultValue: 'Aadhaar card' })}
                  hint={t('wizard.aadhaarHint', { defaultValue: 'Upload your Aadhaar card' })}
                  value={aadhaarUri}
                  onChange={(uri) => onUpdate({ aadhaarUri: uri })}
                  placeholderIcon={IconIdentificationCard}
                />

                <ImagePickerField
                  label={t('wizard.drivingLicence', { defaultValue: 'Driving licence' })}
                  hint={t('wizard.drivingLicenceHint', { defaultValue: 'Upload your driving licence' })}
                  value={drivingLicenceUri}
                  onChange={(uri) => onUpdate({ drivingLicenceUri: uri })}
                  placeholderIcon={IconIdentificationCard}
                />

                <Text variant="caption" color={theme.colors.ink} style={styles.fieldLabel}>
                  {t('wizard.referral', { defaultValue: 'Referral code' })}
                  {'  '}
                  <Text variant="caption" color={theme.colors.mutedText}>
                    {t('common.optional', { defaultValue: '(optional)' })}
                  </Text>
                </Text>
                <Input
                  dense
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
          {finishReason && (
            <Text variant="caption" color={theme.colors.mutedText} style={styles.finishReason}>
              {finishReason}
            </Text>
          )}
          <Button
            label={finishLabel}
            variant="primary"
            disabled={!canFinish || submitting}
            loading={submitting}
            onPress={handleFinish}
            style={styles.btn}
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
              <TouchableOpacity onPress={() => setCityModalVisible(false)} hitSlop={8}>
                <IconX size={24} color={theme.colors.mutedText} />
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
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.xs,
  },
  backChevron: {
    marginRight: 2,
  },
  backLabel: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 17,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  title: { fontSize: 20, lineHeight: 26, marginBottom: 2 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: theme.spacing.md },
  // Account tabs — full-width labels over a hairline track, sliding ink underline
  tabRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  tabLabel: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.primary,
  },
  // Segmented pill (grey track, sliding white thumb with soft border)
  segTrack: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    padding: SEG_PAD,
    marginBottom: theme.spacing.md,
  },
  segThumb: {
    position: 'absolute',
    top: SEG_PAD,
    bottom: SEG_PAD,
    left: SEG_PAD,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segLabel: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 14,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: theme.spacing.sm,
  },
  // Partner form sections — no outer box; the fields carry their own border, and
  // sections are separated by a very light grey rule instead of a bordered card.
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionDivider: {
    borderTopWidth: 6,
    borderTopColor: theme.colors.surface,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.xs,
    marginHorizontal: -theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionAccent: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginRight: theme.spacing.xs,
  },
  sectionTitle: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldLabel: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 16,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  picker: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    justifyContent: 'center',
  },
  pickerText: { fontSize: 15, lineHeight: 20 },
  inlineHint: { fontSize: 12, lineHeight: 15, marginTop: theme.spacing.xs },
  spacer: { height: theme.spacing.sm },
  formError: { marginTop: theme.spacing.sm, textAlign: 'center' },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  btn: { width: '100%' },
  finishReason: { marginBottom: theme.spacing.xs, textAlign: 'center' },
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
