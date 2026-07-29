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
import { theme, Text, Button, IconHouse, IconMapTrifold, IconList, IconCpu, IconUser } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { useAuth } from '../hooks/useAuth';
import { useWizard } from '../hooks/useWizard';
import { supabase } from '@qarmo/supabase';

// Screens — Auth entry
import { WelcomeScreen } from '../screens/WelcomeScreen';

// Screens — Phone/OTP verification
import { WizardPhoneScreen } from '../screens/WizardPhoneScreen';
import { WizardOTPScreen } from '../screens/WizardOTPScreen';

// Screens — Onboarding (new users, single dynamic screen)
import { OnboardingScreen } from '../screens/OnboardingScreen';

// Screens — App
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CustomerMapScreen } from '../screens/CustomerMapScreen';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { AiAgentScreen } from '../screens/AiAgentScreen';

import { usePartnerLocation } from '../hooks/usePartnerLocation';
import { compressImage, uriToUploadBody } from '../utils/image';
import { logger } from '../utils/logger';

const TAG = 'Wizard';

// ─────────────────────────────────────────────────────────────────────────────
// Flow types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-auth screens (unauthenticated):
 *  welcome → single entry page (image + Get started)
 *  phone   → phone number entry
 *  otp     → OTP verification
 *
 * There is no Register/Login split — everyone follows welcome → phone → otp.
 * After OTP the user is authenticated and routing is decided purely by
 * profile.profile_completed_at: incomplete → OnboardingScreen, complete → app.
 */
type PreAuthScreen = 'welcome' | 'phone' | 'otp';

// Phone + OTP render a 2-step progress; new users then get the onboarding screen.
const AUTH_TOTAL_STEPS = 2;

// ─────────────────────────────────────────────────────────────────────────────
// AppNavigator
// ─────────────────────────────────────────────────────────────────────────────

export const AppNavigator: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, loading, isCheckingProfile, profileFetchError, signOut, refreshProfile } = useAuth();

  const {
    formData,
    updateFormData,
    resetWizard,
    isLoaded: isWizardLoaded,
  } = useWizard(user?.id);

  const [activeTab, setActiveTab] = useState<'home' | 'tab2' | 'profile'>('home');

  // Pre-auth navigation state
  const [preAuthScreen, setPreAuthScreen] = useState<PreAuthScreen>('welcome');
  // Phone formatted for OTP (e.g. "+919876543210")
  const [otpPhone, setOtpPhone] = useState('');
  // Raw digits typed on the phone screen, kept here (not just in WizardPhoneScreen's own
  // state) so backing out of the OTP screen restores them instead of remounting to blank.
  const [phoneDigits, setPhoneDigits] = useState('');

  // These are local UI state, not auth state — signOut() (in useAuth) has no way to
  // reset them itself. Without this, signing out leaves preAuthScreen wherever it was
  // last (e.g. 'otp'), so the very next unauthenticated render reuses that stale value
  // instead of starting over from Welcome. resetWizard() is included too: signOut()
  // already clears the *persisted* wizard progress, but the in-memory formData here
  // would otherwise still hold the previous account's name/photo/etc. if someone
  // registers a different account right after logging out.
  useEffect(() => {
    if (user) return;
    setPreAuthScreen('welcome');
    setOtpPhone('');
    setPhoneDigits('');
    setActiveTab('home');
    resetWizard();
  }, [user, resetWizard]);

  const { locationError } = usePartnerLocation();

  // Going back from onboarding would otherwise silently sign the user out
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
  // Mirrors each screen's own onBack wiring so the hardware back button behaves
  // the same as tapping the on-screen back/cancel action.
  const handleHardwareBack = useCallback((): boolean => {
    // Main app (tabs) — profile complete
    if (user && profile?.profile_completed_at) {
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false; // on Home tab — let the OS handle it (minimize/exit)
    }

    // Post-OTP — single onboarding screen. Back here discards the (already
    // authenticated) session, so confirm before signing out.
    if (user && !profile?.profile_completed_at) {
      confirmDiscardAndSignOut();
      return true;
    }

    // Pre-auth flow
    if (!user) {
      switch (preAuthScreen) {
        case 'welcome':
          return false; // let the OS handle it (exit app)
        case 'phone':
          setPreAuthScreen('welcome');
          return true;
        case 'otp':
          setPreAuthScreen('phone');
          return true;
        default:
          return false;
      }
    }

    return false;
  }, [user, profile, activeTab, preAuthScreen, confirmDiscardAndSignOut]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => subscription.remove();
  }, [handleHardwareBack]);

  // ───── Web browser back/forward ────────────────────────────────────────────
  // The URL doesn't reflect the current screen (refresh still lands on Welcome) —
  // this only makes the browser's back/forward buttons step through screens the
  // same way the Android hardware back button does above, by pushing a history
  // entry whenever the visible screen changes and replaying handleHardwareBack on
  // popstate.
  const currentScreenKey = !user
    ? `preauth:${preAuthScreen}`
    : !profile?.profile_completed_at
    ? 'onboarding'
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
  // to the onboarding screen below rather than showing a hard error.

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
    // Welcome — single entry point (no Register/Login split)
    if (preAuthScreen === 'welcome') {
      return <WelcomeScreen onContinue={() => setPreAuthScreen('phone')} />;
    }

    // Phone entry
    if (preAuthScreen === 'phone') {
      return (
        <WizardPhoneScreen
          currentStep={1}
          totalSteps={AUTH_TOTAL_STEPS}
          initialPhone={phoneDigits}
          onOtpSent={(formattedPhone, rawPhone) => {
            setOtpPhone(formattedPhone);
            setPhoneDigits(rawPhone);
            setPreAuthScreen('otp');
          }}
          onBack={() => setPreAuthScreen('welcome')}
        />
      );
    }

    // OTP verification
    if (preAuthScreen === 'otp') {
      return (
        <WizardOTPScreen
          phone={otpPhone}
          currentStep={2}
          totalSteps={AUTH_TOTAL_STEPS}
          onVerified={() => {
            // No explicit transition here: verifyOTP() (awaited inside WizardOTPScreen
            // before this fires) already updated `user`/`profile`, which re-renders this
            // component into the onboarding or app branch below depending on
            // profile_completed_at. A brand-new signup lands on onboarding; a returning
            // user with a completed profile lands straight on the app.
          }}
          onBack={() => setPreAuthScreen('phone')}
        />
      );
    }

    return null;
  }

  // ───── Logged in, profile incomplete — onboarding (new users only) ─────────

  if (!profile?.profile_completed_at) {
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
        // Rethrow so OnboardingScreen clears its submitting state and surfaces the
        // error inline (the partner path already resolves on its own internal warnings).
        throw err;
      }
    };

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
          const body = await uriToUploadBody(compressedPhotoUri);
          const fileName = `${user.id}/profile.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, body, { contentType: 'image/jpeg', upsert: true });
          if (uploadErr) throw new Error('Failed to upload photo: ' + uploadErr.message);
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarPath = publicUrlData.publicUrl;
          donePhoto('ok', { bodySize: body instanceof ArrayBuffer ? body.byteLength : body.size });
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
          const body = await uriToUploadBody(compressedDocUri);
          const bodySize = body instanceof ArrayBuffer ? body.byteLength : body.size;
          const ext = 'jpg';
          const storagePath = `${user.id}/${docType}.${ext}`;

          let { error: uploadErr } = await supabase.storage
            .from('partner-documents')
            .upload(storagePath, body, { contentType: 'image/jpeg', upsert: true });

          // Fallback to 'avatars' bucket if 'partner-documents' bucket does not exist on Supabase yet
          if (uploadErr && (uploadErr.message?.includes('not found') || uploadErr.message?.includes('Bucket'))) {
            logger.warn(TAG, `partner-documents bucket unavailable for ${docType} — falling back to avatars bucket`, {
              message: uploadErr.message,
            });
            const fallbackPath = `${user.id}/docs/${docType}.${ext}`;
            const { error: fallbackErr } = await supabase.storage
              .from('avatars')
              .upload(fallbackPath, body, { contentType: 'image/jpeg', upsert: true });

            if (!fallbackErr) {
              doneDoc('ok', { path: fallbackPath, viaFallbackBucket: true, bodySize });
              return fallbackPath;
            }
          }

          if (uploadErr) throw new Error(`Failed to upload ${docType}: ` + uploadErr.message);
          doneDoc('ok', { path: storagePath, bodySize });
          return storagePath;
        } catch (err: any) {
          // Aadhaar/licence are the required compliance documents (B-22/B-23) — unlike the
          // best-effort avatar upload above, a failure here must stop Finish (B-25) rather
          // than silently completing registration with a missing partner_documents row.
          // console.warn (unlike logger, which is __DEV__-only) is the one trace of this
          // that survives in a production build, so it stays even though it duplicates doneDoc.
          console.warn(`Doc upload failed for ${docType}:`, err?.message);
          doneDoc('fail', { message: err?.message });
          throw new Error(t('wizard.errors.uploadFailed', { defaultValue: 'Upload failed. Try again.' }));
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

      // 4. Build role/vehicle object for the complete-profile edge function.
      // `partnerType` here and `profile?.partner_type` (DB) both use 'ride'/'delivery' —
      // previously this compared against a stray 'auto' left over from the wizard's old
      // internal naming, so a partner whose type came from `profile?.partner_type` (the
      // fallback) was silently misclassified as delivery even when they were a ride partner.
      const partnerType = formData.partnerType || profile?.partner_type || 'delivery';
      const roles = partnerType === 'ride' ? ['auto_driver'] : ['delivery_executive'];
      const vehicleRole = roles[0];
      const vehiclesPayload = {
        [vehicleRole]: {
          vehicleType: partnerType === 'ride' ? 'auto' : 'bike',
          registrationNumber: formData.plateNumber || '',
        },
      };

      // 5. Invoke complete-profile edge function FIRST (for referral-code generation,
      // referral awarding & vehicle insertion). This must run before the direct
      // update below: the complete_profile RPC only generates a referral_code while
      // profile_completed_at is still null, so if the direct baseline update stamped
      // profile_completed_at first, the RPC would short-circuit on its idempotency
      // guard and the partner would never get a code (dashboard "Your code:" blank).
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
          let message = funcError?.message || (funcData as any)?.error;
          // FunctionsHttpError.context is the raw Response — the generic .message
          // ("Edge Function returned a non-2xx status code") hides the function's
          // actual reason, which is in the response body.
          if ((funcError as any)?.context?.json) {
            try {
              const body = await (funcError as any).context.json();
              message = body?.error || message;
            } catch {
              // context body wasn't JSON — keep the generic message
            }
          }
          console.warn('complete-profile function warning:', message);
          doneEdgeFn('fail', { message });
        } else {
          doneEdgeFn('ok', {
            success: (funcData as any)?.success ?? null,
            referralCode: (funcData as any)?.referral_code ?? null,
            response: funcData,
          });
        }
      } catch (funcErr: any) {
        console.warn('Edge function invoke exception:', funcErr.message);
        doneEdgeFn('fail', { message: funcErr?.message });
      }

      // 6. Direct database update on profiles table as a baseline guarantee and to
      // persist partner-only columns the RPC doesn't set (plate_number, referred_by).
      // Runs AFTER the edge function so it never pre-empts referral-code generation;
      // it deliberately does not touch referral_code, so the RPC-generated code stays.
      const doneDirectUpdate = logger.time(TAG, 'Direct profile update (baseline)');
      let { error: directUpdateErr } = await supabase.from('profiles').update({
        full_name: formData.fullName,
        city: formData.city,
        account_type: 'partner',
        partner_type: partnerType,
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

      logger.info(TAG, 'handlePartnerSubmit — finished, resetting wizard');
      await resetWizard();

      // Read the profile back from the DB to confirm completeProfile actually
      // landed — profile_completed_at present is what flips onboarding → dashboard,
      // and referral_code present proves the edge-function RPC generated a code.
      const finalProfile = await refreshProfile();
      logger.info(TAG, 'handlePartnerSubmit — verification', {
        profileCompleted: !!finalProfile?.profile_completed_at,
        completedAt: finalProfile?.profile_completed_at ?? null,
        hasReferralCode: !!finalProfile?.referral_code,
        referralCode: finalProfile?.referral_code ?? null,
        accountType: finalProfile?.account_type ?? null,
      });
      if (!finalProfile?.profile_completed_at) {
        logger.warn(TAG, 'handlePartnerSubmit — completeProfile did NOT persist profile_completed_at', {
          userId: user.id,
        });
      }
    };

    return (
      <OnboardingScreen
        formData={formData}
        onUpdate={updateFormData}
        onSubmitCustomer={handleCustomerFinish}
        onSubmitPartner={handlePartnerSubmit}
        onExit={confirmDiscardAndSignOut}
      />
    );
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
          ? <AiAgentScreen />
          : <ComingSoonScreen icon={IconList} />;
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
          {isCustomer ? (
            <IconMapTrifold size={24} color={activeTab === 'home' ? theme.colors.primary : theme.colors.mutedText} />
          ) : (
            <IconHouse size={24} color={activeTab === 'home' ? theme.colors.primary : theme.colors.mutedText} />
          )}
          <Text
            variant="caption"
            color={activeTab === 'home' ? theme.colors.primary : theme.colors.mutedText}
            style={styles.tabLabel}
          >
            {t('tabs.home', { defaultValue: 'Home' })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('tab2')} activeOpacity={0.8}>
          {isCustomer ? (
            <IconCpu size={24} color={activeTab === 'tab2' ? theme.colors.primary : theme.colors.mutedText} />
          ) : (
            <IconList size={24} color={activeTab === 'tab2' ? theme.colors.primary : theme.colors.mutedText} />
          )}
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
          <IconUser size={24} color={activeTab === 'profile' ? theme.colors.primary : theme.colors.mutedText} />
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
