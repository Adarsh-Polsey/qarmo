import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { useAuth } from '../hooks/useAuth';
import { useWizard } from '../hooks/useWizard';
import { supabase } from '@qarmo/supabase';

// Screens — Auth
import { LandingScreen } from '../screens/LandingScreen';

// Screens — Pre-auth selection
import { AccountTypeScreen } from '../screens/AccountTypeScreen';
import { PartnerTypeScreen } from '../screens/PartnerTypeScreen';

// Screens — Wizard (phone/OTP inside wizard)
import { WizardPhoneScreen } from '../screens/WizardPhoneScreen';
import { WizardOTPScreen } from '../screens/WizardOTPScreen';
import { WizardNameScreen } from '../screens/WizardNameScreen';
import { WizardPlateScreen } from '../screens/WizardPlateScreen';
import { WizardCityScreen } from '../screens/WizardCityScreen';
import { WizardPhotoScreen } from '../screens/WizardPhotoScreen';
import { WizardDocumentScreen } from '../screens/WizardDocumentScreen';
import { WizardReferralScreen } from '../screens/WizardReferralScreen';

// Screens — App
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CustomerMapScreen } from '../screens/CustomerMapScreen';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';

import { Ionicons } from '@expo/vector-icons';
import { usePartnerLocation } from '../hooks/usePartnerLocation';
import { compressImage } from '../utils/image';
import { logger } from '../utils/logger';

const TAG = 'Wizard';


// ─────────────────────────────────────────────────────────────────────────────
// Flow types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-auth screens (unauthenticated)
 *  landing       → Landing page
 *  accountType   → Customer / Partner pick
 *  partnerType   → Delivery / Ride pick (partner only)
 *  phone         → Phone number entry (inside wizard)
 *  otp           → OTP verification (inside wizard)
 */
type PreAuthScreen = 'landing' | 'accountType' | 'partnerType' | 'phone' | 'otp';

// ─────────────────────────────────────────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Customer wizard steps (after OTP):
 *   1 → name (finish)
 * Total rendered steps in dots: phone=1, otp=2, name=3
 */
const CUSTOMER_TOTAL_STEPS = 3;

/**
 * Partner wizard steps (after OTP):
 *   1 → name, 2 → plate, 3 → city, 4 → photo, 5 → aadhaar, 6 → licence, 7 → referral
 * Total rendered steps in dots: phone=1, otp=2, then partner steps 3–9
 */
const PARTNER_POST_OTP_STEPS = 7;
const PARTNER_TOTAL_STEPS = 2 + PARTNER_POST_OTP_STEPS; // = 9

// partner post-OTP step numbers (1-indexed within post-OTP range)
enum PartnerStep {
  Name = 1,
  Plate = 2,
  City = 3,
  Photo = 4,
  Aadhaar = 5,
  DrivingLicence = 6,
  Referral = 7,
}

// ─────────────────────────────────────────────────────────────────────────────
// AppNavigator
// ─────────────────────────────────────────────────────────────────────────────

export const AppNavigator: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, loading, isCheckingProfile, profileFetchError, signOut, refreshProfile } = useAuth();

  const {
    step,
    setStep,
    formData,
    updateFormData,
    resetWizard,
    isLoaded: isWizardLoaded,
  } = useWizard(user?.id);

  const [activeTab, setActiveTab] = useState<'home' | 'tab2' | 'profile'>('home');

  // Pre-auth navigation state
  const [preAuthScreen, setPreAuthScreen] = useState<PreAuthScreen>('landing');
  // Phone formatted for OTP (e.g. "+919876543210")
  const [otpPhone, setOtpPhone] = useState('');
  // Whether user came through "Log in" (vs "Register")
  const [isLoginMode, setIsLoginMode] = useState(false);

  // These are local UI state, not auth state — signOut() (in useAuth) has no way to
  // reset them itself. Without this, signing out leaves preAuthScreen wherever it was
  // last (e.g. 'otp'), so the very next unauthenticated render reuses that stale value
  // instead of starting over from Landing. resetWizard() is included too: signOut()
  // already clears the *persisted* wizard progress, but the in-memory formData/step
  // here would otherwise still hold the previous account's name/photo/etc. if someone
  // registers a different account right after logging out.
  useEffect(() => {
    if (user) return;
    setPreAuthScreen('landing');
    setOtpPhone('');
    setIsLoginMode(false);
    setActiveTab('home');
    resetWizard();
  }, [user, resetWizard]);

  const { locationError } = usePartnerLocation();

  // Going back from the first wizard step would otherwise silently sign the user out
  // (they're already OTP-authenticated) — confirm first instead of discarding the session.
  const confirmDiscardAndSignOut = useCallback(() => {
    const title = t('wizard.discardConfirmTitle', { defaultValue: 'Sign out?' });
    const message = t('wizard.discardConfirmMessage', {
      defaultValue: 'Going back will sign you out — you will need to verify your phone again to continue.',
    });

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
        signOut();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
      { text: t('auth.logout', { defaultValue: 'Log out' }), style: 'destructive', onPress: () => signOut() },
    ]);
  }, [t, signOut]);

  // ───── Android hardware back button ────────────────────────────────────────
  // Mirrors each screen's own onBack/onOtpSent wiring so the hardware back button
  // behaves the same as tapping the on-screen back/cancel action.
  const handleHardwareBack = useCallback((): boolean => {
    // Main app (tabs) — profile complete
    if (user && profile?.profile_completed_at) {
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false; // on Home tab — let the OS handle it (minimize/exit)
    }

    // Post-OTP wizard steps
    if (user && !profile?.profile_completed_at) {
      const isCustomer = formData.accountType === 'customer' ||
        (profile?.account_type === 'customer' && formData.accountType === '');

      if (isCustomer) {
        confirmDiscardAndSignOut();
        return true;
      }

      switch (step) {
        case PartnerStep.Name:
          confirmDiscardAndSignOut();
          return true;
        case PartnerStep.Plate:
          setStep(PartnerStep.Name);
          return true;
        case PartnerStep.City:
          setStep(PartnerStep.Plate);
          return true;
        case PartnerStep.Photo:
          setStep(PartnerStep.City);
          return true;
        case PartnerStep.Aadhaar:
          setStep(PartnerStep.Photo);
          return true;
        case PartnerStep.DrivingLicence:
          setStep(PartnerStep.Aadhaar);
          return true;
        case PartnerStep.Referral:
          setStep(PartnerStep.DrivingLicence);
          return true;
        default:
          return false;
      }
    }

    // Pre-auth flow
    if (!user) {
      switch (preAuthScreen) {
        case 'landing':
          return false; // let the OS handle it (exit app)
        case 'accountType':
          setPreAuthScreen('landing');
          return true;
        case 'partnerType':
          setPreAuthScreen('accountType');
          return true;
        case 'phone':
          if (isLoginMode) {
            setPreAuthScreen('landing');
          } else if (formData.accountType === 'partner') {
            setPreAuthScreen('partnerType');
          } else {
            setPreAuthScreen('accountType');
          }
          return true;
        case 'otp':
          setPreAuthScreen('phone');
          return true;
        default:
          return false;
      }
    }

    return false;
  }, [user, profile, activeTab, step, preAuthScreen, formData, isLoginMode, confirmDiscardAndSignOut, setStep]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => subscription.remove();
  }, [handleHardwareBack]);

  // ───── Web browser back/forward ────────────────────────────────────────────
  // The URL doesn't reflect the current screen (refresh still lands on Landing) —
  // this only makes the browser's back/forward buttons step through screens the
  // same way the Android hardware back button does above, by pushing a history
  // entry whenever the visible screen changes and replaying handleHardwareBack on
  // popstate.
  const currentScreenKey = !user
    ? `preauth:${preAuthScreen}`
    : !profile?.profile_completed_at
    ? `wizard:${step}`
    : `tab:${activeTab}`;

  const isHandlingPopRef = useRef(false);
  const lastPushedScreenKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    if (isHandlingPopRef.current) {
      isHandlingPopRef.current = false;
    } else if (lastPushedScreenKeyRef.current !== null) {
      window.history.pushState({ screenKey: currentScreenKey }, '');
    }
    lastPushedScreenKeyRef.current = currentScreenKey;
  }, [currentScreenKey]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onPopState = () => {
      isHandlingPopRef.current = true;
      handleHardwareBack();
      // Safety net: if handleHardwareBack didn't change any state (e.g. it only opened
      // a confirm dialog), the effect above never runs to clear this flag — clear it
      // here so the next real navigation still pushes its own history entry.
      setTimeout(() => {
        isHandlingPopRef.current = false;
      }, 0);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleHardwareBack]);

  // ───── Loading states ─────────────────────────────────────────────────────

  if (loading || (user && !isWizardLoaded) || isCheckingProfile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="caption" color={theme.colors.mutedText} style={styles.loadingText}>
          {t('common.loading', { defaultValue: 'Loading...' })}
        </Text>
      </SafeAreaView>
    );
  }

  // ───── Error loading profile ───────────────────────────────────────────────
  // Note: a null profile with no fetch error means the row simply doesn't exist yet
  // (e.g. right after signup, before the DB trigger creates it) — that falls through
  // to the wizard below rather than showing a hard error.

  if (user && !profile && profileFetchError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text variant="body" color={theme.colors.danger} style={{ marginBottom: theme.spacing.md }}>
          {t('common.error', { defaultValue: 'Error loading profile' })}
        </Text>
        <Button
          label={t('common.retry', { defaultValue: 'Retry' })}
          variant="primary"
          onPress={refreshProfile}
          style={{ width: 200, marginBottom: theme.spacing.sm }}
        />
        <Button
          label={t('auth.logout', { defaultValue: 'Log out' })}
          variant="ghost"
          onPress={signOut}
          style={{ width: 200 }}
        />
      </SafeAreaView>
    );
  }

  // ───── Not logged in — pre-auth flow ──────────────────────────────────────

  if (!user) {
    // Landing
    if (preAuthScreen === 'landing') {
      return (
        <LandingScreen
          onRegister={() => {
            setIsLoginMode(false);
            setPreAuthScreen('accountType');
          }}
          onLogin={() => {
            setIsLoginMode(true);
            // Login goes straight to phone entry
            updateFormData({ accountType: '' }); // clear, will be set after OTP from profile
            setPreAuthScreen('phone');
          }}
        />
      );
    }

    // Account type selection (Register path only)
    if (preAuthScreen === 'accountType') {
      return (
        <AccountTypeScreen
          onSelectCustomer={() => {
            updateFormData({ accountType: 'customer', partnerType: '' });
            setPreAuthScreen('phone');
          }}
          onSelectPartner={() => {
            updateFormData({ accountType: 'partner' });
            setPreAuthScreen('partnerType');
          }}
        />
      );
    }

    // Partner type selection
    if (preAuthScreen === 'partnerType') {
      return (
        <PartnerTypeScreen
          onSelectDelivery={() => {
            updateFormData({ partnerType: 'delivery' });
            setPreAuthScreen('phone');
          }}
          onSelectRide={() => {
            updateFormData({ partnerType: 'auto' });
            setPreAuthScreen('phone');
          }}
          onBack={() => setPreAuthScreen('accountType')}
        />
      );
    }

    // Phone entry (inside wizard)
    if (preAuthScreen === 'phone') {
      const isCustomer = formData.accountType === 'customer';
      const currentStep = 1;
      const totalSteps = isLoginMode ? 2 : (isCustomer ? CUSTOMER_TOTAL_STEPS : PARTNER_TOTAL_STEPS);

      return (
        <WizardPhoneScreen
          currentStep={currentStep}
          totalSteps={totalSteps}
          onOtpSent={(formattedPhone) => {
            setOtpPhone(formattedPhone);
            setPreAuthScreen('otp');
          }}
          onBack={() => {
            if (isLoginMode) {
              setPreAuthScreen('landing');
            } else if (formData.accountType === 'partner') {
              setPreAuthScreen('partnerType');
            } else {
              setPreAuthScreen('accountType');
            }
          }}
        />
      );
    }

    // OTP entry (inside wizard)
    if (preAuthScreen === 'otp') {
      const isCustomer = formData.accountType === 'customer';
      const currentStep = 2;
      const totalSteps = isLoginMode ? 2 : (isCustomer ? CUSTOMER_TOTAL_STEPS : PARTNER_TOTAL_STEPS);

      return (
        <WizardOTPScreen
          phone={otpPhone}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onVerified={() => {
            // No explicit step transition here: verifyOTP() (awaited inside WizardOTPScreen
            // before this fires) already updated `user`/`profile`, which re-renders this
            // component into the post-OTP branch below. useWizard's own load effect then
            // either keeps the default step 1 (brand-new signup) or restores whatever step
            // was persisted for this user (e.g. a login resuming an incomplete registration).
            // Forcing setStep(1) here raced that restore and could clobber resumed progress.
          }}
          onBack={() => setPreAuthScreen('phone')}
        />
      );
    }

    return null;
  }

  // ───── Logged in, profile incomplete — wizard steps (post-OTP) ───────────

  if (!profile?.profile_completed_at) {
    const isCustomer = formData.accountType === 'customer' ||
      (profile?.account_type === 'customer' && formData.accountType === '');

    // ── Customer wizard: step 1 → Name ──────────────────────────────────────
    if (isCustomer) {
      // step 1 = name (= step 3 in total dots: 1=phone, 2=otp, 3=name)
      const dotStep = 3;
      const totalDots = CUSTOMER_TOTAL_STEPS;

      const handleCustomerFinish = async () => {
        if (!user) return;
        const done = logger.time(TAG, 'handleCustomerFinish');
        try {
          let { error } = await supabase.from('profiles').update({
            full_name: formData.fullName,
            account_type: 'customer',
            profile_completed_at: new Date().toISOString(),
          }).eq('id', user.id);

          // Fallback if account_type column does not exist on Supabase DB schema yet
          if (error && (error.code === 'PGRST204' || error.message?.includes('account_type'))) {
            logger.warn(TAG, 'Direct update missing account_type column — retrying without it', { code: error.code });
            const fallbackRes = await supabase.from('profiles').update({
              full_name: formData.fullName,
              profile_completed_at: new Date().toISOString(),
            }).eq('id', user.id);
            error = fallbackRes.error;
          }

          if (error) throw error;
          done('ok');
          await resetWizard();
          await refreshProfile();
        } catch (err: any) {
          console.error('Customer finish error:', err);
          done('fail', { message: err?.message });
          Alert.alert(
            t('common.error', { defaultValue: 'Error' }),
            err.message || t('wizard.errors.completionFailed', { defaultValue: 'Failed to complete profile.' }),
          );
        }
      };

      return (
        <WizardNameScreen
          formData={formData}
          onUpdate={updateFormData}
          onNext={handleCustomerFinish}
          onBack={confirmDiscardAndSignOut}
          currentStep={dotStep}
          totalSteps={totalDots}
          actionLabel={t('wizard.finish', { defaultValue: 'Finish' })}
        />
      );
    }

    // ── Partner wizard: steps 1–7 (post-OTP) ────────────────────────────────
    const dotOffset = 2; // phone=1, otp=2 already counted

    const handlePartnerSubmit = async (validReferralCode: string | null) => {
      if (!user) return;
      logger.info(TAG, 'handlePartnerSubmit — started', {
        hasPhoto: !!formData.photoUri,
        hasAadhaar: !!formData.aadhaarUri,
        hasLicence: !!formData.drivingLicenceUri,
        hasReferralCode: !!validReferralCode,
      });

      let avatarPath: string | null = null;

      // 1. Upload profile photo to avatars bucket (best-effort — same as document
      // uploads below: a flaky upload here shouldn't block the rest of registration,
      // since the profile update step already tolerates a null avatarPath).
      if (formData.photoUri) {
        const donePhoto = logger.time(TAG, 'Upload avatar photo');
        try {
          const compressedPhotoUri = await compressImage(formData.photoUri, 800, 0.7);
          const response = await fetch(compressedPhotoUri);
          const blob = await response.blob();
          const fileName = `${user.id}/profile.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
          if (uploadErr) throw new Error('Failed to upload photo: ' + uploadErr.message);
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarPath = publicUrlData.publicUrl;
          donePhoto('ok', { blobSize: blob.size });
        } catch (photoErr: any) {
          console.warn('Photo upload warning:', photoErr.message);
          donePhoto('fail', { message: photoErr?.message });
        }
      }

      // 2. Upload documents to partner-documents bucket (fallback to avatars if bucket migration not run)
      const uploadDoc = async (uri: string, docType: 'aadhaar' | 'driving_licence') => {
        const doneDoc = logger.time(TAG, `Upload document (${docType})`);
        try {
          const compressedDocUri = await compressImage(uri, 1200, 0.75);
          const response = await fetch(compressedDocUri);
          const blob = await response.blob();
          const ext = 'jpg';
          const storagePath = `${user.id}/${docType}.${ext}`;

          let { error: uploadErr } = await supabase.storage
            .from('partner-documents')
            .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

          // Fallback to 'avatars' bucket if 'partner-documents' bucket does not exist on Supabase yet
          if (uploadErr && (uploadErr.message?.includes('not found') || uploadErr.message?.includes('Bucket'))) {
            logger.warn(TAG, `partner-documents bucket unavailable for ${docType} — falling back to avatars bucket`, {
              message: uploadErr.message,
            });
            const fallbackPath = `${user.id}/docs/${docType}.${ext}`;
            const { error: fallbackErr } = await supabase.storage
              .from('avatars')
              .upload(fallbackPath, blob, { contentType: 'image/jpeg', upsert: true });

            if (!fallbackErr) {
              doneDoc('ok', { path: fallbackPath, viaFallbackBucket: true, blobSize: blob.size });
              return fallbackPath;
            }
          }

          if (uploadErr) throw new Error(`Failed to upload ${docType}: ` + uploadErr.message);
          doneDoc('ok', { path: storagePath, blobSize: blob.size });
          return storagePath;
        } catch (err: any) {
          console.warn(`Doc upload warning for ${docType}:`, err.message);
          doneDoc('fail', { message: err?.message });
          return null;
        }
      };

      let aadhaarPath: string | null = null;
      let licencePath: string | null = null;

      if (formData.aadhaarUri) {
        aadhaarPath = await uploadDoc(formData.aadhaarUri, 'aadhaar');
      }
      if (formData.drivingLicenceUri) {
        licencePath = await uploadDoc(formData.drivingLicenceUri, 'driving_licence');
      }

      // 3. Upsert partner_documents rows
      if (aadhaarPath) {
        const { error } = await supabase.from('partner_documents').upsert(
          {
            partner_id: user.id,
            doc_type: 'aadhaar',
            storage_path: aadhaarPath,
            review_status: 'pending',
            uploaded_at: new Date().toISOString(),
          },
          { onConflict: 'partner_id,doc_type' },
        );
        if (error) console.warn('Failed to save aadhaar DB record:', error.message);
      }
      if (licencePath) {
        const { error } = await supabase.from('partner_documents').upsert(
          {
            partner_id: user.id,
            doc_type: 'driving_licence',
            storage_path: licencePath,
            review_status: 'pending',
            uploaded_at: new Date().toISOString(),
          },
          { onConflict: 'partner_id,doc_type' },
        );
        if (error) console.warn('Failed to save licence DB record:', error.message);
      }

      // 4. Build role/vehicle object for the complete-profile edge function
      const partnerType = formData.partnerType || profile?.partner_type || 'delivery';
      const roles = partnerType === 'auto' ? ['auto_driver'] : ['delivery_executive'];
      const vehicleRole = roles[0];
      const vehiclesPayload = {
        [vehicleRole]: {
          vehicleType: partnerType === 'auto' ? 'auto' : 'bike',
          registrationNumber: formData.plateNumber || '',
        },
      };

      // 5. Direct database update on profiles table as a baseline guarantee
      const doneDirectUpdate = logger.time(TAG, 'Direct profile update (baseline)');
      let { error: directUpdateErr } = await supabase.from('profiles').update({
        full_name: formData.fullName,
        city: formData.city,
        account_type: 'partner',
        partner_type: partnerType === 'auto' ? 'ride' : 'delivery',
        plate_number: formData.plateNumber || null,
        referred_by: validReferralCode || null,
        photo_url: avatarPath || profile?.photo_url || null,
        profile_completed_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (directUpdateErr && (directUpdateErr.code === 'PGRST204' || directUpdateErr.message?.includes('column'))) {
        logger.warn(TAG, 'Direct update hit a missing column — retrying with the base column set', {
          code: directUpdateErr.code,
        });
        // Fallback update for standard profiles columns if new schema columns are missing
        const fallbackRes = await supabase.from('profiles').update({
          full_name: formData.fullName,
          city: formData.city,
          photo_url: avatarPath || profile?.photo_url || null,
          profile_completed_at: new Date().toISOString(),
        }).eq('id', user.id);
        directUpdateErr = fallbackRes.error;
      }

      if (directUpdateErr) {
        console.warn('Direct profile update warning:', directUpdateErr.message);
        doneDirectUpdate('fail', { message: directUpdateErr.message });
      } else {
        doneDirectUpdate('ok');
      }

      // 6. Invoke complete-profile edge function (for referrals & vehicle insertion)
      const doneEdgeFn = logger.time(TAG, 'Invoke complete-profile edge function');
      try {
        const { data: funcData, error: funcError } = await supabase.functions.invoke('complete-profile', {
          body: {
            fullName: formData.fullName,
            photoUrl: avatarPath || profile?.photo_url || null,
            roles,
            city: formData.city,
            vehicles: vehiclesPayload,
            referralCode: validReferralCode,
          },
        });

        if (funcError || (funcData as any)?.error) {
          const message = funcError?.message || (funcData as any)?.error;
          console.warn('complete-profile function warning:', message);
          doneEdgeFn('fail', { message });
        } else {
          doneEdgeFn('ok', { referralCode: (funcData as any)?.referral_code ?? null });
        }
      } catch (funcErr: any) {
        console.warn('Edge function invoke exception:', funcErr.message);
        doneEdgeFn('fail', { message: funcErr?.message });
      }

      logger.info(TAG, 'handlePartnerSubmit — finished, resetting wizard');
      await resetWizard();
      await refreshProfile();
    };

    switch (step) {
      case PartnerStep.Name:
        return (
          <WizardNameScreen
            formData={formData}
            onUpdate={updateFormData}
            onNext={() => setStep(PartnerStep.Plate)}
            onBack={confirmDiscardAndSignOut}
            currentStep={dotOffset + PartnerStep.Name}
            totalSteps={PARTNER_TOTAL_STEPS}
          />
        );

      case PartnerStep.Plate:
        return (
          <WizardPlateScreen
            formData={formData}
            onUpdate={updateFormData}
            onNext={() => setStep(PartnerStep.City)}
            onBack={() => setStep(PartnerStep.Name)}
            currentStep={dotOffset + PartnerStep.Plate}
            totalSteps={PARTNER_TOTAL_STEPS}
          />
        );

      case PartnerStep.City:
        return (
          <WizardCityScreen
            formData={formData}
            onUpdate={updateFormData}
            onNext={() => setStep(PartnerStep.Photo)}
            onBack={() => setStep(PartnerStep.Plate)}
            currentStep={dotOffset + PartnerStep.City}
            totalSteps={PARTNER_TOTAL_STEPS}
          />
        );

      case PartnerStep.Photo:
        return (
          <WizardPhotoScreen
            formData={formData}
            onUpdate={updateFormData}
            onNext={() => setStep(PartnerStep.Aadhaar)}
            onBack={() => setStep(PartnerStep.City)}
            currentStep={dotOffset + PartnerStep.Photo}
            totalSteps={PARTNER_TOTAL_STEPS}
          />
        );

      case PartnerStep.Aadhaar:
        return (
          <WizardDocumentScreen
            key="aadhaar"
            docType="aadhaar"
            fieldKey="aadhaarUri"
            formData={formData}
            onUpdate={updateFormData}
            onNext={() => setStep(PartnerStep.DrivingLicence)}
            onBack={() => setStep(PartnerStep.Photo)}
            currentStep={dotOffset + PartnerStep.Aadhaar}
            totalSteps={PARTNER_TOTAL_STEPS}
          />
        );

      case PartnerStep.DrivingLicence:
        return (
          <WizardDocumentScreen
            key="driving_licence"
            docType="driving_licence"
            fieldKey="drivingLicenceUri"
            formData={formData}
            onUpdate={updateFormData}
            onNext={() => setStep(PartnerStep.Referral)}
            onBack={() => setStep(PartnerStep.Aadhaar)}
            currentStep={dotOffset + PartnerStep.DrivingLicence}
            totalSteps={PARTNER_TOTAL_STEPS}
          />
        );

      case PartnerStep.Referral:
        return (
          <WizardReferralScreen
            userId={user.id}
            formData={formData}
            onUpdate={updateFormData}
            onSubmit={handlePartnerSubmit}
            onBack={() => setStep(PartnerStep.DrivingLicence)}
            currentStep={dotOffset + PartnerStep.Referral}
            totalSteps={PARTNER_TOTAL_STEPS}
          />
        );

      default:
        return (
          <SafeAreaView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </SafeAreaView>
        );
    }
  }

  // ───── Logged in + profile complete — main app ────────────────────────────

  const isCustomer = profile?.account_type === 'customer';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return isCustomer
          ? <CustomerMapScreen />
          : <DashboardScreen locationError={locationError} />;
      case 'tab2':
        return isCustomer
          ? <ComingSoonScreen iconName="hardware-chip-outline" />
          : <ComingSoonScreen iconName="list-outline" />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return isCustomer
          ? <CustomerMapScreen />
          : <DashboardScreen locationError={locationError} />;
    }
  };

  return (
    <View style={styles.appContainer}>
      <View style={styles.tabContent}>{renderTabContent()}</View>
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')} activeOpacity={0.8}>
          <Ionicons
            name={isCustomer
              ? (activeTab === 'home' ? 'map' : 'map-outline')
              : (activeTab === 'home' ? 'home' : 'home-outline')}
            size={24}
            color={activeTab === 'home' ? theme.colors.primary : theme.colors.mutedText}
          />
          <Text
            variant="caption"
            color={activeTab === 'home' ? theme.colors.primary : theme.colors.mutedText}
            style={styles.tabLabel}
          >
            {t('tabs.home', { defaultValue: 'Home' })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('tab2')} activeOpacity={0.8}>
          <Ionicons
            name={isCustomer
              ? (activeTab === 'tab2' ? 'hardware-chip' : 'hardware-chip-outline')
              : (activeTab === 'tab2' ? 'list' : 'list-outline')}
            size={24}
            color={activeTab === 'tab2' ? theme.colors.primary : theme.colors.mutedText}
          />
          <Text
            variant="caption"
            color={activeTab === 'tab2' ? theme.colors.primary : theme.colors.mutedText}
            style={styles.tabLabel}
          >
            {isCustomer
              ? t('tabs.aiAgent', { defaultValue: 'AI Agent' })
              : t('tabs.jobBoard', { defaultValue: 'Job Board' })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('profile')} activeOpacity={0.8}>
          <Ionicons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={24}
            color={activeTab === 'profile' ? theme.colors.primary : theme.colors.mutedText}
          />
          <Text
            variant="caption"
            color={activeTab === 'profile' ? theme.colors.primary : theme.colors.mutedText}
            style={styles.tabLabel}
          >
            {t('tabs.account', { defaultValue: 'Account' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
  },
  appContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 72,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});
