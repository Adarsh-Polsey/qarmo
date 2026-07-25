import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { theme, Text, Button, Card, getInitials } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { supabase } from '@qarmo/supabase';
import { useAuth } from '../hooks/useAuth';

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const [plateNumber, setPlateNumber] = useState('');

  useEffect(() => {
    if (!profile) return;
    const fetchVehicle = async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('registration_number')
        .eq('owner_id', profile.id)
        .limit(1)
        .single();
      
      if (data?.registration_number) {
        setPlateNumber(data.registration_number);
      }
    };
    fetchVehicle();
  }, [profile]);

  const handleLogout = () => {
    Alert.alert(
      t('auth.logoutConfirmTitle', { defaultValue: 'Log out?' }),
      '',
      [
        {
          text: t('common.no', { defaultValue: 'No' }),
          style: 'cancel',
        },
        {
          text: t('common.yes', { defaultValue: 'Yes' }),
          onPress: () => signOut(),
          style: 'destructive',
        },
      ]
    );
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const partnerTypeLabel = profile.partner_type === 'ride' 
    ? t('partner.ridePartner', { defaultValue: '🛺 Ride Partner' }) 
    : profile.partner_type === 'delivery' 
    ? t('partner.deliveryPartner', { defaultValue: '🛵 Delivery Partner' }) 
    : '';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="title" style={styles.pageTitle}>
          {t('profile.account', { defaultValue: 'Account' })}
        </Text>
        
        <View style={styles.avatarWrapper}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.placeholderText}>{getInitials(profile.full_name)}</Text>
            </View>
          )}
        </View>

        <View style={styles.detailsContainer}>
          <Text variant="title" style={styles.nameText}>
            {profile.full_name || 'Partner'}
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.phoneText}>
            {profile.phone}
          </Text>
          
          <Text variant="body" color={theme.colors.mutedText} style={styles.roleText}>
            {profile.account_type === 'customer'
              ? t('profile.customer', { defaultValue: 'Customer' })
              : `${partnerTypeLabel}${profile.city ? ` · ${profile.city}` : ''}${plateNumber ? ` · ${plateNumber}` : ''}`}
          </Text>
        </View>

        <View style={styles.actionsContainer}>
          <Button 
            label={t('auth.logout', { defaultValue: '🚪 Log out' })} 
            variant="secondary" 
            onPress={handleLogout} 
            style={styles.logoutBtn} 
          />
        </View>
      </ScrollView>
    </SafeAreaView>
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
  },
  container: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  pageTitle: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  placeholderText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.mutedText,
  },
  detailsContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  nameText: {
    marginBottom: theme.spacing.xs,
  },
  phoneText: {
    marginBottom: theme.spacing.xs,
  },
  roleText: {
    textAlign: 'center',
  },
  actionsContainer: {
    width: '100%',
    marginTop: theme.spacing.xl,
  },
  logoutBtn: {
    width: '100%',
  },
});
