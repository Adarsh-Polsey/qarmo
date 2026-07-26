import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Card, getInitials } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { supabase } from '@qarmo/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Location from 'expo-location';
import { GlobalCounter } from '../components/GlobalCounter';

interface Props {
  onNavigateToReferrals: () => void;
  onNavigateToProfile: () => void;
  locationError?: boolean;
}

export const DashboardScreen: React.FC<Props> = ({
  onNavigateToReferrals,
  onNavigateToProfile,
  locationError = false,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [points, setPoints] = useState<number>(0);
  const [referredCount, setReferredCount] = useState<number>(0);

  const referralCode = profile?.referral_code || '';
  const firstName = profile?.full_name?.split(' ')[0] || 'Partner';
  const partnerTypeLabel = profile?.partner_type === 'ride' 
    ? t('partner.ridePartner', { defaultValue: '🛺 Ride Partner' }) 
    : t('partner.deliveryPartner', { defaultValue: '🛵 Delivery Partner' });

  useEffect(() => {
    if (!profile) return;
    
    // Fetch referrals
    const fetchReferrals = async () => {
      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', profile.id)
        .eq('status', 'awarded');
      
      const rc = count || 0;
      setReferredCount(rc);
      setPoints(rc * 50);
    };

    fetchReferrals();
  }, [profile]);

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: t('dashboard.shareMessage', { code: referralCode, defaultValue: `Join Qarmo with my code ${referralCode}` }),
      });
    } catch (err) {
      console.error('Error sharing code:', err);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const [plateNumber, setPlateNumber] = useState<string>('');

  useEffect(() => {
    if (!profile) return;
    const fetchVehicle = async () => {
      if (profile.plate_number) {
        setPlateNumber(profile.plate_number);
        return;
      }
      const { data } = await supabase
        .from('vehicles')
        .select('registration_number')
        .eq('owner_id', profile.id)
        .limit(1)
        .maybeSingle();
      
      if (data?.registration_number) {
        setPlateNumber(data.registration_number);
      }
    };
    fetchVehicle();
  }, [profile]);

  return (
    <SafeAreaView style={styles.safe}>
      <GlobalCounter />
      
      {locationError && (
        <View style={styles.banner}>
          <Text variant="caption" style={styles.bannerText}>
            {t('dashboard.locationDenied', { defaultValue: 'Turn on location so customers can find you.' })}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.idCard}>
          <View style={styles.idHeader}>
            <View style={styles.avatarWrapper}>
              {profile.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.placeholderText}>{getInitials(profile.full_name)}</Text>
                </View>
              )}
            </View>
            <View style={styles.idDetails}>
              <Text variant="title" style={styles.idName}>{profile.full_name || firstName}</Text>
              <Text variant="body" color={theme.colors.mutedText}>{partnerTypeLabel}</Text>
              <Text variant="caption" color={theme.colors.mutedText}>
                {profile.city || t('dashboard.unknownCity', { defaultValue: 'Unknown City' })} {plateNumber ? `· ${plateNumber}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.idStats}>
            <Text variant="heroNumber" style={styles.pointsText}>
              ⭐ {points} points
            </Text>
            <Text variant="body" color={theme.colors.mutedText} style={styles.referredText}>
              {referredCount === 0
                ? t('dashboard.inviteNudge', { defaultValue: 'Invite a friend to earn points!' })
                : referredCount === 1
                ? t('dashboard.friendJoinedSingular', { defaultValue: '1 friend joined' })
                : t('dashboard.friendsJoinedPlural', { count: referredCount, defaultValue: `${referredCount} friends joined` })}
            </Text>
            <Text variant="body" style={styles.codeText}>
              {t('dashboard.yourCode', { defaultValue: 'Your code:' })} {referralCode}
            </Text>
          </View>
        </Card>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Text variant="body" style={styles.shareBtnText}>
            🔗 {t('dashboard.shareCode', { defaultValue: 'Share my code' })}
          </Text>
        </TouchableOpacity>
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
    backgroundColor: theme.colors.background,
  },
  banner: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  bannerText: {
    textAlign: 'center',
  },
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  idCard: {
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  idHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  avatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.md,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.mutedText,
  },
  idDetails: {
    flex: 1,
  },
  idName: {
    marginBottom: 4,
  },
  idStats: {
    gap: theme.spacing.sm,
  },
  pointsText: {
    color: '#1B7A3D', // Kerala Green
    fontSize: 40,
    fontWeight: '800',
  },
  referredText: {
    fontSize: 16,
    fontWeight: '500',
  },
  codeText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
  },
  shareBtn: {
    backgroundColor: '#FFC107', // Amber element
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  shareBtnText: {
    color: theme.colors.ink,
    fontWeight: '700',
    fontSize: 16,
  },
});
