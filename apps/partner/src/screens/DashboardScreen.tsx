import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
  Clipboard,
  Share,
  Platform,
} from 'react-native';
import { theme, Text, Card, getInitials, withTimeout } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { supabase } from '@qarmo/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface Props {
  onNavigateToReferrals: () => void;
  onNavigateToProfile: () => void;
}

interface RecentReferral {
  id: string;
  status: 'pending' | 'awarded';
  created_at: string;
  referred: {
    full_name: string | null;
  } | null;
}

export const DashboardScreen: React.FC<Props> = ({
  onNavigateToReferrals,
  onNavigateToProfile,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [points, setPoints] = useState<number>(0);
  const [recentReferrals, setRecentReferrals] = useState<RecentReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referralCode = profile?.referral_code || '';
  const firstName = profile?.full_name?.split(' ')[0] || 'Driver';

  // Request push notification permission and register token
  const registerForPushNotifications = useCallback(async () => {
    if (!profile) return;
    if (Platform.OS === 'web') return;

    try {
      if (Device.isDevice) {
        const existingStatusResult = (await Notifications.getPermissionsAsync()) as any;
        let finalStatus = existingStatusResult.status;

        if (finalStatus !== 'granted') {
          const requestStatusResult = (await Notifications.requestPermissionsAsync()) as any;
          finalStatus = requestStatusResult.status;
        }

        if (finalStatus !== 'granted') {
          console.warn('Failed to get push token for push notifications!');
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;

        if (token) {
          const platform = Platform.OS === 'ios' ? 'ios' : 'android';
          await withTimeout(
            supabase.from('push_tokens').upsert(
              {
                user_id: profile.id,
                expo_token: token,
                platform,
              },
              { onConflict: 'user_id,expo_token' },
            ),
            10000,
            'Registering push token timed out',
          );
        }
      } else {
        console.warn('Must use physical device for push notifications');
      }
    } catch (error) {
      console.error('Error during push notification registration:', error);
    }
  }, [profile]);

  const fetchDashboardData = useCallback(async () => {
    if (!profile) return;

    try {
      setError(null);
      // 1. Fetch points balance
      const { data: pointsData, error: pointsError } = await withTimeout(
        supabase
          .from('referral_points')
          .select('total_points')
          .eq('user_id', profile.id)
          .maybeSingle(),
        10000,
        'Fetching points timed out',
      );

      if (pointsError) {
        throw pointsError;
      } else if (pointsData) {
        setPoints(pointsData.total_points || 0);
      } else {
        setPoints(0);
      }

      // 2. Fetch recent referrals (last 3)
      const { data: recentData, error: recentError } = await withTimeout(
        supabase
          .from('referrals')
          .select(
            `
            id,
            status,
            created_at,
            referred:profiles!referred_id (
              full_name
            )
          `,
          )
          .eq('referrer_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(3),
        10000,
        'Fetching referrals timed out',
      );

      if (recentError) {
        throw recentError;
      } else {
        const formattedRecent: RecentReferral[] = (recentData || []).map((ref) => {
          const referred = ref.referred as { full_name: string | null } | null;
          return {
            id: ref.id,
            status: ref.status as 'pending' | 'awarded',
            created_at: ref.created_at,
            referred,
          };
        });
        setRecentReferrals(formattedRecent);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Error loading dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchDashboardData();
    registerForPushNotifications();
  }, [fetchDashboardData, registerForPushNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleCopy = () => {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      const shareMessage = t('referralScreen.shareMessage', { code: referralCode });
      await Share.share({
        message: shareMessage,
      });
    } catch (err) {
      console.error('Error sharing code from dashboard:', err);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="title" color={theme.colors.ink}>
              {t('dashboard.greeting', { name: firstName, defaultValue: `Hi, ${firstName}` })}
            </Text>
            <Text variant="caption" color={theme.colors.mutedText}>
              {t('dashboard.welcomeBack', { defaultValue: 'Welcome back to Qarmo' })}
            </Text>
          </View>

          <TouchableOpacity onPress={onNavigateToProfile} activeOpacity={0.8}>
            <View style={styles.avatarWrapper}>
              {profile.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.placeholderText}>{getInitials(profile.full_name)}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.content}>
            {error && (
              <Card style={styles.errorCard}>
                <Text variant="body" color={theme.colors.danger} style={styles.errorText}>
                  ⚠️ {error}
                </Text>
              </Card>
            )}
            {/* Stats / Points Card (tappable -> Referral tab) */}
            <TouchableOpacity onPress={onNavigateToReferrals} activeOpacity={0.9}>
              <Card style={styles.statsCard}>
                <View style={styles.statsRow}>
                  <View>
                    <Text variant="caption" color={theme.colors.mutedText}>
                      {t('partner.referrals')} {t('dashboard.points', { defaultValue: 'Points' })}
                    </Text>
                    <Text
                      variant="heroNumber"
                      color={theme.colors.primaryPressed}
                      style={styles.pointsText}
                    >
                      ⭐ {points}
                    </Text>
                  </View>
                  <Text
                    variant="caption"
                    color={theme.colors.primary}
                    style={styles.viewDetailsText}
                  >
                    {t('dashboard.viewDetails', { defaultValue: 'View details →' })}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>

            {/* Primary Refer & Earn Card */}
            <Card style={styles.shareCard}>
              <Text variant="body" style={styles.shareTitle}>
                {t('dashboard.referAndEarn', { defaultValue: '📣 Refer & Earn 50 points' })}
              </Text>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.shareDesc}>
                {t('dashboard.shareDesc', { defaultValue: 'Share your referral code to invite drivers and earn points.' })}
              </Text>

              <View style={styles.codeContainer}>
                <Text style={styles.codeText}>{referralCode}</Text>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={handleCopy}
                    style={[styles.actionBtn, copied && styles.copiedBtn]}
                    activeOpacity={0.8}
                  >
                    <Text
                      variant="caption"
                      color={copied ? theme.colors.textOnColored : theme.colors.primary}
                      style={styles.actionBtnText}
                    >
                      {copied ? t('referralScreen.copied') : t('referralScreen.copy')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleShare}
                    style={[styles.actionBtn, styles.shareBtn]}
                    activeOpacity={0.8}
                  >
                    <Text
                      variant="caption"
                      color={theme.colors.textOnColored}
                      style={styles.actionBtnText}
                    >
                      {t('referralScreen.share')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            {/* Rides & Deliveries Coming Soon Card */}
            <Card style={styles.comingSoonCard}>
              <Text variant="body" style={styles.comingSoonTitle}>
                {t('dashboard.ridesAndDeliveries', { defaultValue: '🚕 Rides & Deliveries' })}
              </Text>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.comingSoonDesc}>
                {t('dashboard.comingSoonDesc', {
                  defaultValue: "Coming soon — we'll notify you as soon as rides and deliveries are live in your city.",
                })}
              </Text>
            </Card>

            {/* Recent referrals (last 3) */}
            <Card style={styles.recentReferralsCard}>
              <View style={styles.recentHeaderRow}>
                <Text variant="body" style={styles.recentTitle}>
                  {t('dashboard.recentReferrals', { defaultValue: 'Recent Referrals' })}
                </Text>
                <TouchableOpacity onPress={onNavigateToReferrals}>
                  <Text variant="caption" color={theme.colors.primary} style={styles.viewAllText}>
                    {t('dashboard.viewAll', { defaultValue: 'View all →' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {recentReferrals.length === 0 ? (
                <Text variant="caption" color={theme.colors.mutedText} style={styles.emptyText}>
                  {t('dashboard.noReferralsYet', { defaultValue: 'No referrals yet.' })}
                </Text>
              ) : (
                <View style={styles.recentList}>
                  {recentReferrals.map((ref) => (
                    <View key={ref.id} style={styles.recentRow}>
                      <Text variant="body" style={styles.recentName}>
                        • {ref.referred?.full_name || 'Partner'}
                      </Text>
                      <Text
                        variant="caption"
                        color={
                          ref.status === 'awarded' ? theme.colors.success : theme.colors.mutedText
                        }
                        style={styles.recentStatus}
                      >
                        {ref.status === 'awarded'
                          ? t('referralScreen.earned')
                          : t('referralScreen.pending')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>
        )}
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
  container: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  avatarWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.mutedText,
  },
  loader: {
    marginVertical: theme.spacing.xl,
  },
  content: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statsCard: {
    padding: theme.spacing.md,
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 36,
    fontWeight: '800',
    marginTop: theme.spacing.xs,
  },
  viewDetailsText: {
    fontWeight: '600',
  },
  shareCard: {
    padding: theme.spacing.md,
  },
  shareTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginBottom: theme.spacing.xs,
  },
  shareDesc: {
    marginBottom: theme.spacing.md,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  codeText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.ink,
    letterSpacing: 1.5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiedBtn: {
    backgroundColor: theme.colors.primary,
  },
  shareBtn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  actionBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  comingSoonCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 0,
  },
  comingSoonTitle: {
    fontWeight: '700',
    color: theme.colors.mutedText,
    marginBottom: theme.spacing.xs,
  },
  comingSoonDesc: {
    lineHeight: 20,
  },
  recentReferralsCard: {
    padding: theme.spacing.md,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  recentTitle: {
    fontWeight: '700',
  },
  viewAllText: {
    fontWeight: '600',
  },
  emptyText: {
    paddingVertical: theme.spacing.xs,
  },
  recentList: {
    gap: theme.spacing.xs,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderColor: theme.colors.surface,
  },
  recentName: {
    fontWeight: '500',
  },
  recentStatus: {
    fontWeight: '600',
  },
  errorCard: {
    padding: theme.spacing.md,
    borderColor: theme.colors.danger,
    borderWidth: 1.5,
    backgroundColor: '#FFEBEE',
  },
  errorText: {
    fontWeight: '600',
  },
});
