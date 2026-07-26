import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  TouchableOpacity,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { theme, Text, Button, Card, getInitials } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { supabase } from '@qarmo/supabase';
import { useAuth } from '../hooks/useAuth';
import { APP_VERSION } from '@qarmo/core';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../utils/image';

interface DocStatus {
  doc_type: string;
  review_status: string;
}

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { profile, signOut, refreshProfile } = useAuth();
  const [plateNumber, setPlateNumber] = useState('');
  const [docs, setDocs] = useState<DocStatus[]>([]);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Fetch vehicle registration number
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

    // Fetch uploaded document statuses for partners
    const fetchDocs = async () => {
      if (profile.account_type !== 'partner') return;
      const { data } = await supabase
        .from('partner_documents')
        .select('doc_type, review_status')
        .eq('partner_id', profile.id);

      if (data) {
        setDocs(data);
      }
    };

    fetchVehicle();
    fetchDocs();
  }, [profile]);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('auth.logoutConfirmTitle', { defaultValue: 'Log out?' }))) {
        signOut();
      }
      return;
    }

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
      ],
    );
  };

  const handleShareReferral = async () => {
    if (!profile?.referral_code) return;
    try {
      await Share.share({
        message: t('dashboard.shareMessage', {
          code: profile.referral_code,
          defaultValue: `Join Qarmo with my code ${profile.referral_code}`,
        }),
      });
    } catch (err) {
      console.error('Error sharing code:', err);
    }
  };

  const requestPermission = async (type: 'camera' | 'library') => {
    const { status } =
      type === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        t('wizard.permissionDenied', { defaultValue: 'Permission denied.' }),
        t('wizard.errors.permissionRequired', {
          defaultValue: 'Permission required to access media/camera',
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('wizard.openSettings', { defaultValue: 'Open settings' }),
            onPress: () => Linking.openSettings(),
          },
        ],
      );
      return false;
    }
    return true;
  };

  const handlePickAvatar = async (useCamera: boolean) => {
    if (!profile) return;
    const granted = await requestPermission(useCamera ? 'camera' : 'library');
    if (!granted) return;

    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets?.length > 0) {
        setUpdatingAvatar(true);
        const compressedUri = await compressImage(result.assets[0].uri, 800, 0.7);
        const response = await fetch(compressedUri);
        const blob = await response.blob();
        const fileName = `${profile.id}/profile.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

        if (uploadErr) throw new Error('Failed to upload photo: ' + uploadErr.message);

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        const newPhotoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ photo_url: newPhotoUrl })
          .eq('id', profile.id);

        if (updateErr) throw new Error('Failed to update profile: ' + updateErr.message);

        await refreshProfile();
      }
    } catch (err: any) {
      console.error('Error updating avatar:', err);
      Alert.alert(t('common.error', { defaultValue: 'Error' }), err.message || 'Failed to update avatar');
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const showAvatarPickerOptions = () => {
    Alert.alert(
      t('wizard.photo', { defaultValue: 'Profile Photo' }),
      t('wizard.chooseGallery', { defaultValue: 'Choose how to add your photo' }),
      [
        {
          text: t('wizard.takePhoto', { defaultValue: 'Take photo' }),
          onPress: () => handlePickAvatar(true),
        },
        {
          text: t('wizard.chooseGallery', { defaultValue: 'Choose from gallery' }),
          onPress: () => handlePickAvatar(false),
        },
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
      ],
    );
  };

  const handleEditName = () => {
    if (!profile) return;
    if (Platform.OS === 'ios') {
      Alert.prompt(
        t('profile.editProfile', { defaultValue: 'Edit Name' }),
        t('wizard.fullName', { defaultValue: 'Enter your full name' }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('common.save', { defaultValue: 'Save' }),
            onPress: async (newName?: string) => {
              if (newName && newName.trim().length >= 2) {
                await supabase.from('profiles').update({ full_name: newName.trim() }).eq('id', profile.id);
                await refreshProfile();
              }
            },
          },
        ],
        'plain-text',
        profile.full_name || '',
      );
    } else {
      // For Android / Web
      const newName = prompt(t('wizard.fullName', { defaultValue: 'Enter your full name' }), profile.full_name || '');
      if (newName && newName.trim().length >= 2) {
        supabase.from('profiles').update({ full_name: newName.trim() }).eq('id', profile.id).then(() => {
          refreshProfile();
        });
      }
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const isCustomer = profile.account_type === 'customer';
  const isPartner = profile.account_type === 'partner';

  const partnerTypeLabel =
    profile.partner_type === 'ride'
      ? t('partner.ridePartner', { defaultValue: '🛺 Ride Partner' })
      : profile.partner_type === 'delivery'
      ? t('partner.deliveryPartner', { defaultValue: '🛵 Delivery Partner' })
      : t('profile.partner', { defaultValue: 'Partner' });

  const memberDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const hasAadhaar = docs.some((d) => d.doc_type === 'aadhaar');
  const hasLicence = docs.some((d) => d.doc_type === 'driving_licence');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text variant="title" style={styles.pageTitle}>
          {t('profile.account', { defaultValue: 'Account' })}
        </Text>

        {/* Header Profile Card */}
        <Card style={styles.headerCard}>
          <TouchableOpacity
            style={styles.avatarTouchable}
            onPress={showAvatarPickerOptions}
            disabled={updatingAvatar}
            activeOpacity={0.8}
          >
            <View style={styles.avatarWrapper}>
              {profile.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.placeholderText}>{getInitials(profile.full_name)}</Text>
                </View>
              )}
              {updatingAvatar && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color={theme.colors.background} />
                </View>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerDetails}>
            <TouchableOpacity onPress={handleEditName} style={styles.nameRowTouch} activeOpacity={0.7}>
              <Text variant="title" style={styles.nameText}>
                {profile.full_name || 'User'}
              </Text>
              <Text style={styles.editNameIcon}>✏️</Text>
            </TouchableOpacity>

            <Text variant="body" color={theme.colors.mutedText} style={styles.phoneText}>
              📱 {profile.phone}
            </Text>

            <TouchableOpacity onPress={showAvatarPickerOptions} activeOpacity={0.7}>
              <Text variant="caption" color={theme.colors.primaryPressed} style={styles.changePhotoText}>
                {t('wizard.retake', { defaultValue: 'Change Photo' })} →
              </Text>
            </TouchableOpacity>

            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text variant="caption" style={styles.badgeText}>
                  {isCustomer ? '🧍 Customer' : partnerTypeLabel}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Section 1: Account & Details Card */}
        <Card style={styles.sectionCard}>
          <Text variant="body" style={styles.sectionHeader}>
            {t('profile.accountDetails', { defaultValue: 'Account Details' })}
          </Text>

          <View style={styles.detailRow}>
            <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
              {t('profile.fullNameLabel', { defaultValue: 'Full Name' })}
            </Text>
            <TouchableOpacity onPress={handleEditName} style={styles.nameValTouch} activeOpacity={0.7}>
              <Text variant="body" style={styles.detailValue}>
                {profile.full_name || '—'}
              </Text>
              <Text style={styles.smallEditIcon}> ✏️</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
              {t('profile.phoneNumberLabel', { defaultValue: 'Phone Number' })}
            </Text>
            <Text variant="body" style={styles.detailValue}>
              {profile.phone}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
              {t('profile.accountTypeLabel', { defaultValue: 'Account Type' })}
            </Text>
            <Text variant="body" style={styles.detailValue}>
              {isCustomer ? t('profile.customer', { defaultValue: 'Customer' }) : t('profile.partner', { defaultValue: 'Partner' })}
            </Text>
          </View>

          {isPartner && (
            <>
              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
                  {t('profile.partnerTypeLabel', { defaultValue: 'Partner Role' })}
                </Text>
                <Text variant="body" style={styles.detailValue}>
                  {partnerTypeLabel}
                </Text>
              </View>

              {profile.city && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
                      {t('profile.operatingCityLabel', { defaultValue: 'Operating City' })}
                    </Text>
                    <Text variant="body" style={styles.detailValue}>
                      📍 {profile.city}
                    </Text>
                  </View>
                </>
              )}

              {plateNumber ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
                      {t('profile.vehiclePlateLabel', { defaultValue: 'Vehicle Number' })}
                    </Text>
                    <Text variant="body" style={styles.detailValue}>
                      🚗 {plateNumber}
                    </Text>
                  </View>
                </>
              ) : null}
            </>
          )}

          {profile.referral_code && (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
                  {t('profile.referralCodeLabel', { defaultValue: 'Referral Code' })}
                </Text>
                <TouchableOpacity onPress={handleShareReferral} style={styles.referralTouch}>
                  <Text variant="body" style={styles.referralCodeVal}>
                    🎁 {profile.referral_code}
                  </Text>
                  <Text variant="caption" color={theme.colors.primary} style={styles.shareText}>
                    Share
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Card>

        {/* Section 2: Submitted Documents (for Partners) */}
        {isPartner && (
          <Card style={styles.sectionCard}>
            <Text variant="body" style={styles.sectionHeader}>
              {t('profile.documents', { defaultValue: 'Submitted Documents' })}
            </Text>

            <View style={styles.docRow}>
              <View style={styles.docInfo}>
                <Text style={styles.docIcon}>🪪</Text>
                <Text variant="body" style={styles.docTitle}>
                  {t('profile.aadhaarDoc', { defaultValue: 'Aadhaar Card' })}
                </Text>
              </View>
              <View style={[styles.docBadge, hasAadhaar ? styles.docBadgeUploaded : styles.docBadgePending]}>
                <Text variant="caption" style={hasAadhaar ? styles.docTextUploaded : styles.docTextPending}>
                  {hasAadhaar ? `✓ ${t('profile.docUploaded', { defaultValue: 'Uploaded & stored' })}` : t('common.notSelected', { defaultValue: 'Not Uploaded' })}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.docRow}>
              <View style={styles.docInfo}>
                <Text style={styles.docIcon}>🪪</Text>
                <Text variant="body" style={styles.docTitle}>
                  {t('profile.licenceDoc', { defaultValue: 'Driving Licence' })}
                </Text>
              </View>
              <View style={[styles.docBadge, hasLicence ? styles.docBadgeUploaded : styles.docBadgePending]}>
                <Text variant="caption" style={hasLicence ? styles.docTextUploaded : styles.docTextPending}>
                  {hasLicence ? `✓ ${t('profile.docUploaded', { defaultValue: 'Uploaded & stored' })}` : t('common.notSelected', { defaultValue: 'Not Uploaded' })}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Section 3: App Info Card */}
        <Card style={styles.sectionCard}>
          <Text variant="body" style={styles.sectionHeader}>
            {t('profile.appInfo', { defaultValue: 'App Info' })}
          </Text>

          <View style={styles.detailRow}>
            <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
              Version
            </Text>
            <Text variant="caption" color={theme.colors.ink} style={styles.detailValue}>
              v{APP_VERSION} (Beta)
            </Text>
          </View>

          {memberDate ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text variant="caption" color={theme.colors.mutedText} style={styles.detailLabel}>
                  {t('profile.memberSince', { date: memberDate, defaultValue: `Member since ${memberDate}` })}
                </Text>
                <Text variant="caption" color={theme.colors.mutedText}>
                  {memberDate}
                </Text>
              </View>
            </>
          ) : null}
        </Card>

        {/* Log Out Action */}
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
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  pageTitle: {
    marginBottom: theme.spacing.xs,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  avatarTouchable: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 2.5,
    borderColor: theme.colors.primary,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.mutedText,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 12,
  },
  headerDetails: {
    flex: 1,
    gap: 4,
  },
  nameRowTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
  },
  editNameIcon: {
    fontSize: 14,
  },
  nameValTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallEditIcon: {
    fontSize: 12,
  },
  phoneText: {
    fontSize: 15,
  },
  changePhotoText: {
    fontWeight: '600',
    fontSize: 13,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  badge: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  badgeText: {
    fontWeight: '600',
    fontSize: 13,
    color: theme.colors.ink,
  },
  sectionCard: {
    padding: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  sectionHeader: {
    fontWeight: '700',
    fontSize: 18,
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  detailLabel: {
    fontWeight: '500',
    fontSize: 15,
  },
  detailValue: {
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  referralTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  referralCodeVal: {
    fontWeight: '700',
    color: theme.colors.primaryPressed,
  },
  shareText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  docIcon: {
    fontSize: 20,
  },
  docTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  docBadge: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  docBadgeUploaded: {
    backgroundColor: '#E8F5E9',
  },
  docBadgePending: {
    backgroundColor: theme.colors.surface,
  },
  docTextUploaded: {
    color: '#1B7A3D',
    fontWeight: '700',
    fontSize: 13,
  },
  docTextPending: {
    color: theme.colors.mutedText,
    fontWeight: '500',
    fontSize: 13,
  },
  actionsContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  logoutBtn: {
    width: '100%',
  },
});
