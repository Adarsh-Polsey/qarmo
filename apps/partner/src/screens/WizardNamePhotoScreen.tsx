import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { theme, Text, Button, Input } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import * as ImagePicker from 'expo-image-picker';
import { WizardData } from '../hooks/useWizard';
import { compressImage } from '../utils/image';

interface Props {
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onSignOut: () => void;
}

export const WizardNamePhotoScreen: React.FC<Props> = ({
  formData,
  onUpdate,
  onNext,
  onSignOut,
}) => {
  const { t } = useTranslation();
  const [nameError, setNameError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    onUpdate({ fullName: val });
    if (val.trim().length >= 2 && val.trim().length <= 60) {
      setNameError(null);
    } else {
      setNameError(t('wizard.errors.nameLength', { defaultValue: 'Name must be between 2 and 60 characters' }));
    }
  };

  const requestPermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  const handlePickImage = async (useCamera: boolean) => {
    try {
      const permissionGranted = await requestPermission(useCamera ? 'camera' : 'library');
      if (!permissionGranted) {
        alert(t('wizard.errors.permissionRequired', { defaultValue: 'Permission required to access media/camera' }));
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const compressed = await compressImage(result.assets[0].uri);
        onUpdate({ photoUri: compressed });
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const isNameValid = formData.fullName.trim().length >= 2 && formData.fullName.trim().length <= 60;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text variant="title">{t('wizard.nameAndPhoto')}</Text>
            <TouchableOpacity onPress={onSignOut}>
              <Text variant="caption" color={theme.colors.danger}>
                {t('auth.logout', { defaultValue: 'Log Out' })}
              </Text>
            </TouchableOpacity>
          </View>
          <Text variant="caption" color={theme.colors.mutedText}>
            {t('wizard.stepTracker', { step: 1, total: 4, defaultValue: 'Step 1 of 4' })}
          </Text>
        </View>

        {/* Photo Picker section */}
        <View style={styles.photoContainer}>
          <Text variant="caption" color={theme.colors.mutedText} style={styles.photoLabel}>
            {t('wizard.photo')}
          </Text>

          <View style={styles.avatarWrapper}>
            {formData.photoUri ? (
              <Image source={{ uri: formData.photoUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.placeholderText}>?</Text>
              </View>
            )}
          </View>

          <View style={styles.photoButtonsRow}>
            <TouchableOpacity
              style={[styles.photoButton, { borderColor: theme.colors.primary }]}
              onPress={() => handlePickImage(true)}
            >
              <Text variant="caption" color={theme.colors.primary}>
                {t('wizard.takePhoto')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.photoButton, { borderColor: theme.colors.primary }]}
              onPress={() => handlePickImage(false)}
            >
              <Text variant="caption" color={theme.colors.primary}>
                {t('wizard.chooseGallery')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name input */}
        <View style={styles.inputContainer}>
          <Input
            label={t('wizard.fullName')}
            placeholder="eg. Amal Kumar"
            value={formData.fullName}
            onChangeText={handleNameChange}
            autoCapitalize="words"
            error={nameError || undefined}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          label={t('wizard.next')}
          variant="primary"
          disabled={!isNameValid || !formData.photoUri}
          onPress={onNext}
          style={styles.nextBtn}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  photoLabel: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  avatarWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.primary,
    marginBottom: theme.spacing.md,
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
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.mutedText,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  photoButton: {
    borderWidth: 1.5,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    minWidth: 120,
    alignItems: 'center',
  },
  inputContainer: {
    width: '100%',
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  nextBtn: {
    width: '100%',
  },
});
