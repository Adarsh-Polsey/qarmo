import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  Linking,
} from 'react-native';
import { theme, Text, Button, Card, getInitials, formatDate, withTimeout, Input } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { supabase } from '@qarmo/supabase';
import { useAuth } from '../hooks/useAuth';
import { APP_VERSION, CITIES } from '@qarmo/core';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../utils/image';

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { profile, signOut, refreshProfile } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editVehicles, setEditVehicles] = useState<
    Record<string, { vehicleType: string; registrationNumber: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);
      // Fetch vehicles
      const { data: vehicleData, error: vehicleError } = await withTimeout(
        supabase.from('vehicles').select('*').eq('owner_id', profile.id),
        10000,
        'Fetching vehicles timed out',
      );

      if (vehicleError) {
        throw vehicleError;
      }
      if (vehicleData) {
        setVehicles(vehicleData);
      }
    } catch (err: any) {
      console.error('Error fetching vehicles:', err);
      setError(err.message || 'Error loading profile data');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Prepopulate edit states
  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditCity(profile.city || '');
      setEditPhotoUri(profile.photo_url);
      setEditRoles(profile.roles || []);

      const vMap: Record<string, { vehicleType: string; registrationNumber: string }> = {};
      vehicles.forEach((v) => {
        vMap[v.role] = {
          vehicleType: v.vehicle_type,
          registrationNumber: v.registration_number || '',
        };
      });

      // Default values for toggled roles
      if (!vMap.auto_driver) {
        vMap.auto_driver = { vehicleType: 'auto', registrationNumber: '' };
      }
      if (!vMap.delivery_executive) {
        vMap.delivery_executive = { vehicleType: 'bike', registrationNumber: '' };
      }
      setEditVehicles(vMap);
    }
  }, [isEditing, profile, vehicles]);

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const validateRegNumber = (num: string) => {
    const clean = num.replace(/\s+/g, '').toUpperCase();
    const regex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;
    return regex.test(clean);
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert(t('wizard.errors.permissionRequired', { defaultValue: 'Permission required to access media library' }));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const compressed = await compressImage(result.assets[0].uri);
        setEditPhotoUri(compressed);
      }
    } catch (err) {
      console.error('Error picking profile image:', err);
    }
  };

  const toggleRole = (role: 'auto_driver' | 'delivery_executive') => {
    setEditRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSave = async () => {
    if (editName.trim().length < 2 || editName.trim().length > 60) {
      alert(t('wizard.errors.nameLength', { defaultValue: 'Name must be between 2 and 60 characters' }));
      return;
    }
    if (!editCity) {
      alert(t('wizard.errors.cityRequired', { defaultValue: 'Please select a city' }));
      return;
    }
    if (editRoles.length === 0) {
      alert(t('wizard.selectAtLeastOne'));
      return;
    }

    // Validate vehicles
    if (editRoles.includes('auto_driver')) {
      const autoReg = editVehicles.auto_driver?.registrationNumber || '';
      if (!validateRegNumber(autoReg)) {
        alert(t('wizard.errors.registrationInvalid', { defaultValue: 'Invalid auto registration number (format: AA00AA0000)' }));
        return;
      }
    }
    if (editRoles.includes('delivery_executive')) {
      const devType = editVehicles.delivery_executive?.vehicleType;
      const devReg = editVehicles.delivery_executive?.registrationNumber || '';
      if (!devType) {
        alert(t('wizard.errors.vehicleTypeRequired', { defaultValue: 'Please select a vehicle type' }));
        return;
      }
      if (devType !== 'bicycle' && !validateRegNumber(devReg)) {
        alert(t('wizard.errors.registrationInvalid', { defaultValue: 'Invalid delivery registration number (format: AA00AA0000)' }));
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Upload photo if selected local URI
      let photoUrl = profile.photo_url;
      if (editPhotoUri && editPhotoUri.startsWith('file://')) {
        const response = await fetch(editPhotoUri);
        const blob = await response.blob();
        const fileExt = editPhotoUri.split('.').pop() || 'jpg';
        const fileName = `${profile.id}/profile.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
            upsert: true,
          });

        if (uploadError) {
          throw new Error('Failed to upload photo: ' + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        photoUrl = publicUrlData.publicUrl;
      }

      // 2. Update profile table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          photo_url: photoUrl,
          roles: editRoles,
          city: editCity,
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // 3. Clear existing vehicles and insert new ones
      const { error: deleteVehiclesError } = await supabase
        .from('vehicles')
        .delete()
        .eq('owner_id', profile.id);

      if (deleteVehiclesError) throw deleteVehiclesError;

      const vehiclesToInsert = editRoles.map((role) => {
        const v = editVehicles[role];
        return {
          owner_id: profile.id,
          role,
          vehicle_type: v.vehicleType,
          registration_number: v.vehicleType === 'bicycle' ? 'N/A' : v.registrationNumber.toUpperCase(),
        };
      });

      const { error: insertVehiclesError } = await supabase
        .from('vehicles')
        .insert(vehiclesToInsert);

      if (insertVehiclesError) throw insertVehiclesError;

      // 4. Refresh Auth Context profile
      await refreshProfile();

      // 5. Success
      setIsEditing(false);
      await fetchProfileData();
    } catch (err: any) {
      console.error('Error saving profile updates:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header / Avatar */}
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            {isEditing ? (
              <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} style={styles.photoPickerTouch}>
                {editPhotoUri ? (
                  <Image source={{ uri: editPhotoUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.placeholderText}>{getInitials(editName)}</Text>
                  </View>
                )}
                <View style={styles.photoEditOverlay}>
                  <Text variant="caption" color={theme.colors.textOnColored} style={styles.editPhotoText}>
                    Change
                  </Text>
                </View>
              </TouchableOpacity>
            ) : profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.placeholderText}>{getInitials(profile.full_name)}</Text>
              </View>
            )}
          </View>
          {!isEditing && (
            <>
              <Text variant="title" style={styles.nameText}>
                {profile.full_name || 'Driver'}
              </Text>
              <Text variant="caption" color={theme.colors.mutedText}>
                {t('profile.memberSince', {
                  date: formatDate(profile.created_at),
                  defaultValue: `Member since ${formatDate(profile.created_at)}`,
                })}
              </Text>
            </>
          )}
        </View>

        {loading && !isEditing ? (
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

            {isEditing ? (
              // Edit Form Views
              <View style={styles.editContainer}>
                <Input
                  label={t('wizard.fullName')}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full Name"
                />

                <View style={styles.cityField}>
                  <Text variant="caption" color={theme.colors.mutedText} style={styles.label}>
                    {t('wizard.city')}
                  </Text>
                  <TouchableOpacity style={styles.pickerTrigger} onPress={() => setCityModalVisible(true)}>
                    <Text variant="body" color={editCity ? theme.colors.ink : theme.colors.mutedText}>
                      {editCity || t('wizard.selectCity')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Roles & Vehicles Editing */}
                <View style={styles.rolesEditSection}>
                  <Text variant="body" style={styles.sectionTitle}>
                    {t('wizard.role')}
                  </Text>

                  {/* Auto Driver Toggle */}
                  <TouchableOpacity
                    style={[styles.roleSelectRow, editRoles.includes('auto_driver') && styles.roleSelectRowSelected]}
                    onPress={() => toggleRole('auto_driver')}
                  >
                    <Text variant="body">{t('wizard.autoDriver')}</Text>
                    <View style={[styles.checkbox, editRoles.includes('auto_driver') && styles.checkboxChecked]}>
                      {editRoles.includes('auto_driver') && <View style={styles.checkboxDot} />}
                    </View>
                  </TouchableOpacity>

                  {editRoles.includes('auto_driver') && (
                    <Card style={styles.editVehicleCard}>
                      <Input
                        label={t('wizard.registrationNumber')}
                        placeholder="e.g. KL07BZ1234"
                        value={editVehicles.auto_driver?.registrationNumber}
                        onChangeText={(text) =>
                          setEditVehicles((prev) => ({
                            ...prev,
                            auto_driver: { ...prev.auto_driver, registrationNumber: text },
                          }))
                        }
                        autoCapitalize="characters"
                      />
                    </Card>
                  )}

                  {/* Delivery Executive Toggle */}
                  <TouchableOpacity
                    style={[
                      styles.roleSelectRow,
                      editRoles.includes('delivery_executive') && styles.roleSelectRowSelected,
                    ]}
                    onPress={() => toggleRole('delivery_executive')}
                  >
                    <Text variant="body">{t('wizard.deliveryExecutive')}</Text>
                    <View style={[styles.checkbox, editRoles.includes('delivery_executive') && styles.checkboxChecked]}>
                      {editRoles.includes('delivery_executive') && <View style={styles.checkboxDot} />}
                    </View>
                  </TouchableOpacity>

                  {editRoles.includes('delivery_executive') && (
                    <Card style={styles.editVehicleCard}>
                      <Text variant="caption" color={theme.colors.mutedText} style={styles.label}>
                        {t('wizard.vehicleType')}
                      </Text>
                      <View style={styles.typeButtons}>
                        {(['bike', 'scooter', 'bicycle'] as const).map((type) => {
                          const isSelected = editVehicles.delivery_executive?.vehicleType === type;
                          return (
                            <TouchableOpacity
                              key={type}
                              style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
                              onPress={() =>
                                setEditVehicles((prev) => ({
                                  ...prev,
                                  delivery_executive: { ...prev.delivery_executive, vehicleType: type },
                                }))
                              }
                            >
                              <Text variant="caption" color={isSelected ? theme.colors.textOnColored : theme.colors.ink}>
                                {type.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {editVehicles.delivery_executive?.vehicleType !== 'bicycle' && (
                        <Input
                          label={t('wizard.registrationNumber')}
                          placeholder="e.g. KL08CA5678"
                          value={editVehicles.delivery_executive?.registrationNumber}
                          onChangeText={(text) =>
                            setEditVehicles((prev) => ({
                              ...prev,
                              delivery_executive: { ...prev.delivery_executive, registrationNumber: text },
                            }))
                          }
                          autoCapitalize="characters"
                        />
                      )}
                    </Card>
                  )}
                </View>

                {/* Edit Controls */}
                <View style={styles.editBtnRow}>
                  <Button
                    label={t('common.cancel')}
                    variant="ghost"
                    onPress={() => setIsEditing(false)}
                    disabled={saving}
                    style={styles.halfBtn}
                  />
                  <Button
                    label={t('common.save', { defaultValue: 'Save' })}
                    variant="primary"
                    onPress={handleSave}
                    loading={saving}
                    disabled={saving}
                    style={styles.halfBtn}
                  />
                </View>
              </View>
            ) : (
              // Read Only View
              <>
                <Card style={styles.infoCard}>
                  <Text variant="body" style={styles.cardTitle}>
                    {t('wizard.nameAndPhoto')}
                  </Text>
                  <View style={styles.infoRow}>
                    <Text variant="caption" color={theme.colors.mutedText}>
                      Name
                    </Text>
                    <Text variant="body">{profile.full_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text variant="caption" color={theme.colors.mutedText}>
                      {t('auth.phone')}
                    </Text>
                    <Text variant="body">{profile.phone}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text variant="caption" color={theme.colors.mutedText}>
                      {t('profile.roles', { defaultValue: 'Roles' })}
                    </Text>
                    <View style={styles.badgeContainer}>
                      {profile.roles?.map((role: string) => (
                        <View key={role} style={styles.roleBadge}>
                          <Text variant="caption" color={theme.colors.textOnColored} style={styles.badgeText}>
                            {role === 'auto_driver'
                              ? t('wizard.autoDriver', { defaultValue: 'Auto Driver' })
                              : t('wizard.deliveryExecutive', { defaultValue: 'Delivery Executive' })}
                          </Text>
                        </View>
                      )) || <Text variant="body">N/A</Text>}
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text variant="caption" color={theme.colors.mutedText}>
                      {t('wizard.city')}
                    </Text>
                    <Text variant="body">{profile.city || t('common.notSelected', { defaultValue: 'Not Selected' })}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text variant="caption" color={theme.colors.mutedText}>
                      {t('wizard.referral')}
                    </Text>
                    <Text variant="body" style={styles.codeText}>
                      {profile.referral_code || 'N/A'}
                    </Text>
                  </View>
                </Card>

                {/* Vehicles Card */}
                <Card style={styles.infoCard}>
                  <Text variant="body" style={styles.cardTitle}>
                    {t('wizard.vehicle')}
                  </Text>
                  {vehicles.length === 0 ? (
                    <Text variant="caption" color={theme.colors.mutedText}>
                      {t('profile.noVehicles', { defaultValue: 'No vehicles registered.' })}
                    </Text>
                  ) : (
                    vehicles.map((v) => (
                      <View key={v.id} style={styles.vehicleRow}>
                        <Text variant="body" style={styles.vehicleRoleText}>
                          {v.role === 'auto_driver' ? t('wizard.autoDriver') : t('wizard.deliveryExecutive')}
                        </Text>
                        <Text variant="caption" color={theme.colors.mutedText}>
                          {v.vehicle_type.toUpperCase()} • {v.registration_number || 'N/A'}
                        </Text>
                      </View>
                    ))
                  )}
                </Card>

                {/* Edit Toggle Button */}
                <Button
                  label={t('profile.editProfile', { defaultValue: 'Edit Profile' })}
                  variant="primary"
                  onPress={() => setIsEditing(true)}
                  style={styles.editBtn}
                />

                {/* Log Out */}
                <Button label={t('auth.logout')} variant="secondary" onPress={signOut} style={styles.logoutBtn} />
              </>
            )}

            {/* App version */}
            <View style={styles.versionContainer}>
              <Text variant="caption" color={theme.colors.mutedText}>
                {t('profile.appVersion', {
                  version: APP_VERSION,
                  defaultValue: `Qarmo Partner App v${APP_VERSION}`,
                })}
              </Text>
              <View style={styles.linksContainer}>
                <TouchableOpacity onPress={() => Linking.openURL('https://qarmo.com/terms')}>
                  <Text variant="caption" color={theme.colors.primary} style={styles.linkText}>
                    {t('profile.termsOfService', { defaultValue: 'Terms of Service' })}
                  </Text>
                </TouchableOpacity>
                <Text variant="caption" color={theme.colors.mutedText}> • </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://qarmo.com/privacy')}>
                  <Text variant="caption" color={theme.colors.primary} style={styles.linkText}>
                    {t('profile.privacyPolicy', { defaultValue: 'Privacy Policy' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* City Picker Modal */}
      <Modal
        visible={cityModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="title">{t('wizard.selectCity')}</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Text variant="body" color={theme.colors.primary}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => {
                    setEditCity(item);
                    setCityModalVisible(false);
                  }}
                >
                  <Text variant="body" style={styles.cityItemText}>
                    {item}
                  </Text>
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
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: theme.colors.primary,
    marginBottom: theme.spacing.sm,
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
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.mutedText,
  },
  photoPickerTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEditOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  editPhotoText: {
    fontSize: 10,
    fontWeight: '700',
  },
  nameText: {
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  loader: {
    marginVertical: theme.spacing.xl,
  },
  content: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  infoCard: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderColor: theme.colors.surface,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  roleBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontWeight: '600',
    fontSize: 12,
  },
  linksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  codeText: {
    fontWeight: '700',
    color: theme.colors.primaryPressed,
  },
  vehicleRow: {
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderColor: theme.colors.surface,
  },
  vehicleRoleText: {
    fontWeight: '600',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  editBtn: {
    width: '100%',
  },
  logoutBtn: {
    width: '100%',
  },
  errorCard: {
    padding: theme.spacing.md,
    borderColor: theme.colors.danger,
    borderWidth: 1.5,
    backgroundColor: '#FFEBEE',
    borderRadius: theme.radius.md,
  },
  errorText: {
    fontWeight: '600',
  },
  editContainer: {
    gap: theme.spacing.md,
  },
  label: {
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  cityField: {
    marginBottom: theme.spacing.sm,
  },
  pickerTrigger: {
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  rolesEditSection: {
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  roleSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  roleSelectRowSelected: {
    borderColor: theme.colors.primary,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkboxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.background,
  },
  editVehicleCard: {
    padding: theme.spacing.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  typeButton: {
    flex: 1,
    height: 40,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  typeButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  editBtnRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  halfBtn: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
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
  cityItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  cityItemText: {
    fontSize: 18,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
});
