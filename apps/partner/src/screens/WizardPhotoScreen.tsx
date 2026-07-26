import React from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import * as ImagePicker from 'expo-image-picker';
import { WizardData } from '../hooks/useWizard';
import { WizardProgress } from '../components/WizardProgress';
import { compressImage } from '../utils/image';

interface Props {
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
}

export const WizardPhotoScreen: React.FC<Props> = ({
  formData,
  onUpdate,
  onNext,
  onBack,
  currentStep,
  totalSteps,
}) => {
  const { t } = useTranslation();

  const photoUri = formData.photoUri;
  const isValid = !!photoUri;

  const requestPermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('wizard.permissionDenied', { defaultValue: 'Permission denied.' }),
          t('wizard.errors.permissionRequired', { defaultValue: 'Permission required to access media/camera' }),
          [
            { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
            { text: t('wizard.openSettings', { defaultValue: 'Open settings' }), onPress: () => Linking.openSettings() },
          ],
        );
        return false;
      }
      return true;
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('wizard.permissionDenied', { defaultValue: 'Permission denied.' }),
          t('wizard.errors.permissionRequired', { defaultValue: 'Permission required to access media/camera' }),
          [
            { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
            { text: t('wizard.openSettings', { defaultValue: 'Open settings' }), onPress: () => Linking.openSettings() },
          ],
        );
        return false;
      }
      return true;
    }
  };

  const handlePickImage = async (useCamera: boolean) => {
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
        const compressed = await compressImage(result.assets[0].uri);
        onUpdate({ photoUri: compressed });
      }
    } catch (err) {
      console.error('Error picking profile photo:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Progress */}
        <WizardProgress current={currentStep} total={totalSteps} />

        {/* Content */}
        <View style={styles.content}>
          <Text variant="title" style={styles.label}>
            {t('wizard.photo', { defaultValue: 'Profile Photo' })}
          </Text>

          {/* Preview */}
          <View style={styles.previewWrapper}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.preview} />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.placeholderText}>📷</Text>
              </View>
            )}
          </View>

          {/* Pick buttons */}
          <View style={styles.pickerRow}>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => handlePickImage(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerIcon}>📷</Text>
              <Text variant="caption" color={theme.colors.ink} style={styles.pickerLabel}>
                {t('wizard.takePhoto', { defaultValue: 'Take photo' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => handlePickImage(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerIcon}>🖼️</Text>
              <Text variant="caption" color={theme.colors.ink} style={styles.pickerLabel}>
                {t('wizard.chooseGallery', { defaultValue: 'Choose from gallery' })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Retake / Replace after photo set */}
          {photoUri && (
            <Text variant="caption" color={theme.colors.primary} style={styles.retakeHint}>
              {t('wizard.retake', { defaultValue: 'Retake' })} / {t('wizard.replace', { defaultValue: 'Replace' })} — tap a button above
            </Text>
          )}

          {!isValid && (
            <Text variant="caption" color={theme.colors.mutedText} style={styles.hint}>
              {t('wizard.addPhotoToContinue', { defaultValue: 'Add a photo to continue' })}
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            label={t('wizard.continue', { defaultValue: 'Continue' })}
            variant="primary"
            disabled={!isValid}
            onPress={onNext}
            style={styles.btn}
          />
          <Button
            label={t('common.cancel', { defaultValue: 'Cancel' })}
            variant="ghost"
            onPress={onBack}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { alignSelf: 'flex-start', marginBottom: theme.spacing.xl },
  previewWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preview: { width: '100%', height: '100%' },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  placeholderText: { fontSize: 56 },
  pickerRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  pickerBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    minHeight: 80,
    justifyContent: 'center',
  },
  pickerIcon: { fontSize: 24 },
  pickerLabel: { fontWeight: '600', textAlign: 'center' },
  retakeHint: { marginBottom: theme.spacing.sm },
  hint: { marginTop: theme.spacing.sm },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  btn: { width: '100%' },
});
