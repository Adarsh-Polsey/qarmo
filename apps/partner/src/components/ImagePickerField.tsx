import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { theme, Text } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../utils/image';

interface Props {
  /** Field label shown above the picker */
  label: string;
  /** Optional helper text under the label */
  hint?: string;
  /** Current image uri ('' when empty) */
  value: string;
  onChange: (uri: string) => void;
  /** Circle = profile avatar, rect = document */
  shape?: 'circle' | 'rect';
  /** Crop aspect passed to the picker (e.g. [1, 1] for avatars) */
  aspect?: [number, number];
  /** Emoji shown in the empty state */
  placeholderIcon?: string;
}

/**
 * Reusable camera/gallery image picker. Consolidates the permission request +
 * pick + compress flow that the profile-photo and document capture screens used
 * to each duplicate, so the single onboarding screen can render several of them.
 */
export const ImagePickerField: React.FC<Props> = ({
  label,
  hint,
  value,
  onChange,
  shape = 'rect',
  aspect,
  placeholderIcon = '🖼️',
}) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

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

  const handlePick = async (useCamera: boolean) => {
    const granted = await requestPermission(useCamera ? 'camera' : 'library');
    if (!granted) return;
    setError(null);

    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        ...(aspect ? { aspect } : {}),
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        // Reject files that are clearly too large (> 10MB original)
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          setError(t('wizard.errors.fileTooLarge', { defaultValue: 'Photo too big. Try again.' }));
          return;
        }
        const compressed = await compressImage(asset.uri);
        onChange(compressed);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      setError(t('wizard.errors.uploadFailed', { defaultValue: 'Upload failed. Try again.' }));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text variant="caption" color={theme.colors.ink} style={styles.label}>
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" color={theme.colors.mutedText} style={styles.hint}>
          {hint}
        </Text>
      ) : null}

      <View style={styles.row}>
        <View style={[styles.preview, shape === 'circle' && styles.previewCircle]}>
          {value ? (
            <Image source={{ uri: value }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <Text style={styles.placeholderIcon}>{placeholderIcon}</Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handlePick(true)} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>📷</Text>
            <Text variant="caption" color={theme.colors.ink} style={styles.actionLabel}>
              {t('wizard.takePhoto', { defaultValue: 'Take photo' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handlePick(false)} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>🖼️</Text>
            <Text variant="caption" color={theme.colors.ink} style={styles.actionLabel}>
              {t('wizard.chooseGallery', { defaultValue: 'Gallery' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <Text variant="caption" color={theme.colors.danger} style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  hint: {
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  preview: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCircle: {
    borderRadius: 44,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderIcon: {
    fontSize: 32,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    minHeight: 72,
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 22,
  },
  actionLabel: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    textAlign: 'center',
  },
  error: {
    marginTop: theme.spacing.sm,
  },
});
