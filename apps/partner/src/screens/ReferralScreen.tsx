import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Clipboard,
  Share,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { theme, Text, Button, Card, getInitials, formatDate, withTimeout } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { supabase } from '@qarmo/supabase';
import { useAuth } from '../hooks/useAuth';

interface ReferredProfile {
  full_name: string | null;
  photo_url: string | null;
}

interface ReferralItem {
  id: string;
  status: 'pending' | 'awarded';
  points_awarded: number;
  created_at: string;
  referred: ReferredProfile | null;
}

export const ReferralScreen: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [points, setPoints] = useState<number>(0);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referralCode = profile?.referral_code || '';

  const fetchReferralData = useCallback(async () => {
    if (!profile) return;

    try {
      setError(null);

      // 1. Fetch points from referral_points view
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

      // 2. Fetch referrals list joined with profiles
      const { data: referralsData, error: referralsError } = await withTimeout(
        supabase
          .from('referrals')
          .select(
            `
            id,
            status,
            points_awarded,
            created_at,
            referred:profiles!referred_id (
              full_name,
              photo_url
            )
          `,
          )
          .eq('referrer_id', profile.id)
          .order('created_at', { ascending: false }),
        10000,
        'Fetching referrals timed out',
      );

      if (referralsError) {
        throw referralsError;
      }

      const formattedReferrals: ReferralItem[] = (referralsData || []).map((ref) => {
        const referred = ref.referred as { full_name: string | null; photo_url: string | null } | null;
        return {
          id: ref.id,
          status: ref.status as 'pending' | 'awarded',
          points_awarded: ref.points_awarded,
          created_at: ref.created_at,
          referred,
        };
      });
      setReferrals(formattedReferrals);
    } catch (err: any) {
      console.error('Error fetching referral data:', err);
      setError(err.message || t('referralScreen.errorLoading'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, t]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReferralData();
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
      console.error('Error sharing code:', err);
    }
  };

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
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
          <Text variant="title" color={theme.colors.primary}>
            {t('referralScreen.title')}
          </Text>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.content}>
            {/* Points Summary Card */}
            <Card style={styles.pointsCard}>
              <Text variant="caption" color={theme.colors.mutedText}>
                {t('referralScreen.totalPoints')}
              </Text>
              <Text variant="heroNumber" color={theme.colors.success} style={styles.pointsNumber}>
                ⭐ {points}
              </Text>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.pointsSubtext}>
                {t('referralScreen.perReferral', { points: 50 })}
              </Text>
            </Card>

            {/* Share Card */}
            <Card style={styles.shareCard}>
              <Text variant="body" style={styles.shareTitle}>
                📣 {t('wizard.referralHint')}
              </Text>
              <Text variant="caption" color={theme.colors.mutedText} style={styles.shareDesc}>
                {t('referralScreen.myCode')}
              </Text>

              <View style={styles.codeContainer}>
                <Text style={styles.codeText}>{referralCode}</Text>

                <TouchableOpacity
                  onPress={handleCopy}
                  style={[styles.copyButton, copied && styles.copiedButton]}
                  activeOpacity={0.8}
                >
                  <Text
                    variant="caption"
                    color={copied ? theme.colors.textOnColored : theme.colors.primary}
                    style={styles.copyBtnText}
                  >
                    {copied ? t('referralScreen.copied') : t('referralScreen.copy')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Button
                label={t('referralScreen.share')}
                variant="primary"
                onPress={handleShare}
                style={styles.shareBtn}
              />
            </Card>

            {/* How It Works Card */}
            <Card style={styles.howCard}>
              <Text variant="body" style={styles.howTitle}>
                🤔 {t('referralScreen.howItWorks')}
              </Text>

              <View style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text
                    variant="caption"
                    color={theme.colors.textOnColored}
                    style={styles.stepNumText}
                  >
                    1
                  </Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text variant="body" style={styles.stepHeader}>
                    {t('referralScreen.step1')}
                  </Text>
                  <Text variant="caption" color={theme.colors.mutedText}>
                    {t('referralScreen.step1Desc')}
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text
                    variant="caption"
                    color={theme.colors.textOnColored}
                    style={styles.stepNumText}
                  >
                    2
                  </Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text variant="body" style={styles.stepHeader}>
                    {t('referralScreen.step2')}
                  </Text>
                  <Text variant="caption" color={theme.colors.mutedText}>
                    {t('referralScreen.step2Desc')}
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text
                    variant="caption"
                    color={theme.colors.textOnColored}
                    style={styles.stepNumText}
                  >
                    3
                  </Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text variant="body" style={styles.stepHeader}>
                    {t('referralScreen.step3')}
                  </Text>
                  <Text variant="caption" color={theme.colors.mutedText}>
                    {t('referralScreen.step3Desc')}
                  </Text>
                </View>
              </View>
            </Card>

            {/* My Referrals List */}
            <View style={styles.listHeaderContainer}>
              <Text variant="body" style={styles.listHeader}>
                👥 {t('referralScreen.myReferrals')}
              </Text>
            </View>

            {error && (
              <Card style={styles.errorCard}>
                <Text variant="body" color={theme.colors.danger} style={styles.errorText}>
                  ⚠️ {error}
                </Text>
              </Card>
            )}

            {referrals.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text variant="caption" color={theme.colors.mutedText} style={styles.emptyText}>
                  {t('referralScreen.noReferrals')}
                </Text>
              </Card>
            ) : (
              <View style={styles.listContainer}>
                {referrals.map((item) => (
                  <Card key={item.id} style={styles.referralItemCard}>
                    <View style={styles.referralItemRow}>
                      {/* Avatar */}
                      <View style={styles.avatarContainer}>
                        {item.referred?.photo_url ? (
                          <Image
                            source={{ uri: item.referred.photo_url }}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarFallbackText}>
                              {getInitials(item.referred?.full_name || null, 'Q')}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Info */}
                      <View style={styles.referralInfo}>
                        <Text variant="body" style={styles.referredName}>
                          {item.referred?.full_name || 'Partner'}
                        </Text>
                        <Text variant="caption" color={theme.colors.mutedText}>
                          {formatDate(item.created_at, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>

                      {/* Status */}
                      <View style={styles.statusContainer}>
                        {item.status === 'awarded' ? (
                          <Text
                            variant="body"
                            color={theme.colors.success}
                            style={styles.awardedStatusText}
                          >
                            +{item.points_awarded || 50}
                          </Text>
                        ) : (
                          <Text
                            variant="caption"
                            color={theme.colors.mutedText}
                            style={styles.pendingStatusText}
                          >
                            {t('referralScreen.pending')}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
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
  container: {
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  loader: {
    marginVertical: theme.spacing.xl,
  },
  content: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  pointsCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderColor: theme.colors.success,
    borderWidth: 1.5,
  },
  pointsNumber: {
    fontSize: 48,
    fontWeight: '800',
    marginVertical: theme.spacing.xs,
  },
  pointsSubtext: {
    marginTop: theme.spacing.xs,
  },
  shareCard: {
    padding: theme.spacing.md,
  },
  shareTitle: {
    fontWeight: '700',
    fontSize: 20,
    marginBottom: theme.spacing.sm,
  },
  shareDesc: {
    marginBottom: theme.spacing.xs,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  codeText: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.ink,
    letterSpacing: 2,
    paddingLeft: theme.spacing.xs,
  },
  copyButton: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  copiedButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  copyBtnText: {
    fontWeight: '700',
  },
  shareBtn: {
    width: '100%',
  },
  howCard: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  howTitle: {
    fontWeight: '700',
    fontSize: 20,
    marginBottom: theme.spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumText: {
    fontWeight: '700',
  },
  stepInfo: {
    flex: 1,
  },
  stepHeader: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  listHeaderContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  listHeader: {
    fontWeight: '700',
    fontSize: 20,
  },
  listContainer: {
    gap: theme.spacing.sm,
  },
  referralItemCard: {
    padding: theme.spacing.sm,
  },
  referralItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.mutedText,
  },
  referralInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  referredName: {
    fontWeight: '600',
  },
  statusContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  awardedStatusText: {
    fontWeight: '800',
    fontSize: 18,
  },
  pendingStatusText: {
    fontWeight: '600',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  emptyCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  errorText: {
    textAlign: 'center',
    marginVertical: theme.spacing.sm,
    fontWeight: '600',
  },
  errorCard: {
    padding: theme.spacing.md,
    borderColor: theme.colors.danger,
    borderWidth: 1.5,
    backgroundColor: '#FFEBEE',
    borderRadius: theme.radius.md,
  },
});
