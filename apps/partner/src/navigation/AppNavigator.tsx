import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { useAuth } from '../hooks/useAuth';
import { useWizard } from '../hooks/useWizard';
import { OTPScreen } from '../screens/OTPScreen';
import { WizardNamePhotoScreen } from '../screens/WizardNamePhotoScreen';
import { WizardRoleScreen } from '../screens/WizardRoleScreen';
import { WizardVehicleScreen } from '../screens/WizardVehicleScreen';
import { WizardReferralScreen } from '../screens/WizardReferralScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ReferralScreen } from '../screens/ReferralScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { supabase } from '@qarmo/supabase';
import { Ionicons } from '@expo/vector-icons';

export const AppNavigator: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, loading, isCheckingProfile, signOut, refreshProfile } = useAuth();

  const {
    step,
    setStep,
    formData,
    updateFormData,
    resetWizard,
    isLoaded: isWizardLoaded,
  } = useWizard(user?.id);

  const [activeTab, setActiveTab] = useState<'home' | 'referrals' | 'profile'>('home');

  // If auth is loading, or wizard is loading when user is authenticated, show loading screen
  if (loading || (user && !isWizardLoaded) || isCheckingProfile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="caption" color={theme.colors.mutedText} style={styles.loadingText}>
          {t('common.loading')}
        </Text>
      </SafeAreaView>
    );
  }

  // State 1: Not authenticated -> Show OTP Screen
  if (!user) {
    return <OTPScreen />;
  }

  // If authenticated but profile failed to load (e.g. database/network error)
  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text variant="body" color={theme.colors.danger} style={{ marginBottom: theme.spacing.md }}>
          {t('common.error')}
        </Text>
        <Button
          label={t('common.retry')}
          variant="primary"
          onPress={refreshProfile}
          style={{ width: 200, marginBottom: theme.spacing.sm }}
        />
        <Button label={t('auth.logout')} variant="ghost" onPress={signOut} style={{ width: 200 }} />
      </SafeAreaView>
    );
  }

  // State 2: Authenticated but profile is incomplete -> Show Wizard
  if (!profile.profile_completed_at) {
    const handleWizardSubmit = async (validReferralCode: string | null) => {
      const userId = user.id;

      // 1. Upload photo if selected
      let photoUrl = profile.photo_url;
      if (formData.photoUri) {
        try {
          const response = await fetch(formData.photoUri);
          const blob = await response.blob();

          const fileExt = formData.photoUri.split('.').pop() || 'jpg';
          const fileName = `${userId}/profile.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, {
              contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
              upsert: true,
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error('Failed to upload profile photo: ' + uploadError.message);
          }

          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

          photoUrl = publicUrlData.publicUrl;
        } catch (photoErr: any) {
          console.error('Photo upload failed:', photoErr);
          throw photoErr;
        }
      }

      // 2. Call complete-profile edge function first with all form data
      const { data: funcData, error: funcError } = await supabase.functions.invoke('complete-profile', {
        body: {
          fullName: formData.fullName,
          photoUrl,
          roles: formData.roles,
          city: formData.city,
          vehicles: formData.vehicles,
          referralCode: validReferralCode,
        },
      });

      if (funcError || (funcData && (funcData as any).error)) {
        const errMsg = funcError?.message || (funcData as any)?.error || 'Profile completion API error';
        throw new Error(errMsg);
      }

      // 3. Reset local wizard state
      await resetWizard();

      // 4. Refresh profile context in useAuth
      await refreshProfile();
    };

    switch (step) {
      case 1:
        return (
          <SafeAreaView style={styles.safe}>
            <WizardNamePhotoScreen
              formData={formData}
              onUpdate={updateFormData}
              onNext={() => setStep(2)}
              onSignOut={signOut}
            />
          </SafeAreaView>
        );
      case 2:
        return (
          <SafeAreaView style={styles.safe}>
            <WizardRoleScreen
              formData={formData}
              onUpdate={updateFormData}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          </SafeAreaView>
        );
      case 3:
        return (
          <SafeAreaView style={styles.safe}>
            <WizardVehicleScreen
              formData={formData}
              onUpdate={updateFormData}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          </SafeAreaView>
        );
      case 4:
        return (
          <SafeAreaView style={styles.safe}>
            <WizardReferralScreen
              userId={user.id}
              formData={formData}
              onUpdate={updateFormData}
              onSubmit={handleWizardSubmit}
              onBack={() => setStep(3)}
            />
          </SafeAreaView>
        );
      default:
        return (
          <SafeAreaView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </SafeAreaView>
        );
    }
  }

  // State 3: Authenticated and profile is completed -> Show Dashboard / Tabs
  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <DashboardScreen
            onNavigateToReferrals={() => setActiveTab('referrals')}
            onNavigateToProfile={() => setActiveTab('profile')}
          />
        );
      case 'referrals':
        return <ReferralScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return (
          <DashboardScreen
            onNavigateToReferrals={() => setActiveTab('referrals')}
            onNavigateToProfile={() => setActiveTab('profile')}
          />
        );
    }
  };

  return (
    <View style={styles.appContainer}>
      <View style={styles.tabContent}>{renderTabContent()}</View>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={24}
            color={activeTab === 'home' ? theme.colors.primary : theme.colors.mutedText}
          />
          <Text
            variant="caption"
            color={activeTab === 'home' ? theme.colors.primary : theme.colors.mutedText}
            style={styles.tabLabel}
          >
            {t('partner.dashboard')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('referrals')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'referrals' ? 'people' : 'people-outline'}
            size={24}
            color={activeTab === 'referrals' ? theme.colors.primary : theme.colors.mutedText}
          />
          <Text
            variant="caption"
            color={activeTab === 'referrals' ? theme.colors.primary : theme.colors.mutedText}
            style={styles.tabLabel}
          >
            {t('partner.referrals')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.8}
        >
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
            {t('partner.profile')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
