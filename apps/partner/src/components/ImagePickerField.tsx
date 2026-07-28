import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { theme, Text, IconComponent, IconImage, IconCamera, IconCheck } from '@qarmo/ui';
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
  /** Icon shown in the empty state */
  placeholderIcon?: IconComponent;
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
  placeholderIcon: PlaceholderIcon = IconImage,
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

  const filled = !!value;

  return (
    <View style={styles.wrap}>
      {/* Compact file row: thumbnail · label/status · pick actions */}
      <View style={[styles.row, filled && styles.rowFilled]}>
        <View style={[styles.tile, shape === 'circle' && styles.tileCircle]}>
          {filled ? (
            <Image source={{ uri: value }} style={styles.tileImage} resizeMode="cover" />
          ) : (
            <PlaceholderIcon size={20} color={theme.colors.mutedText} />
          )}
        </View>

        <View style={styles.info}>
          <Text variant="caption" color={theme.colors.ink} style={styles.title} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.subtitleRow}>
            {filled && <IconCheck size={12} color={theme.colors.success} />}
            <Text
              variant="caption"
              color={filled ? theme.colors.success : theme.colors.mutedText}
              style={styles.subtitle}
              numberOfLines={1}
            >
              {filled
                ? t('wizard.attached', { defaultValue: 'Attached' })
                : hint || t('wizard.notAdded', { defaultValue: 'Not added yet' })}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handlePick(true)}
            activeOpacity={0.7}
            hitSlop={6}
            accessibilityLabel={t('wizard.takePhoto', { defaultValue: 'Take photo' })}
          >
            <IconCamera size={18} color={theme.colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handlePick(false)}
            activeOpacity={0.7}
            hitSlop={6}
            accessibilityLabel={t('wizard.chooseGallery', { defaultValue: 'Gallery' })}
          >
            <IconImage size={18} color={theme.colors.ink} />
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
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  // Subtle tint once a file is attached, so "done" reads at a glance.
  rowFilled: {
    borderColor: theme.colors.success,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileCircle: {
    borderRadius: 22,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
  },
  title: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    marginTop: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
});
