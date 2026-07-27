import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import * as ImagePicker from 'expo-image-picker';
import { WizardData } from '../hooks/useWizard';
import { WizardProgress } from '../components/WizardProgress';
import { compressImage } from '../utils/image';

type DocField = 'aadhaarUri' | 'drivingLicenceUri';

interface Props {
  /** Which document is being captured */
  docType: 'aadhaar' | 'driving_licence';
  /** The field key in WizardData */
  fieldKey: DocField;
  formData: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  currentStep: number;
  totalSteps: number;
}

export const WizardDocumentScreen: React.FC<Props> = ({
  docType,
  fieldKey,
  formData,
  onUpdate,
  onNext,
  onBack,
  currentStep,
  totalSteps,
}) => {
  const { t } = useTranslation();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const imageUri = formData[fieldKey] as string;
  const isValid = !!imageUri;

  const titleKey = docType === 'aadhaar' ? 'wizard.aadhaar' : 'wizard.drivingLicence';
  const hintKey = docType === 'aadhaar' ? 'wizard.aadhaarHint' : 'wizard.drivingLicenceHint';
  const defaultTitle = docType === 'aadhaar' ? 'Aadhaar Card' : 'Driving Licence';
  const defaultHint =
    docType === 'aadhaar' ? 'Upload your Aadhaar card' : 'Upload your driving licence';

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

  const handlePickImage = async (useCamera: boolean) => {
    const granted = await requestPermission(useCamera ? 'camera' : 'library');
    if (!granted) return;
    setUploadError(null);

    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        // Reject files that are clearly too large (> 10MB original)
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          setUploadError(t('wizard.errors.fileTooLarge', { defaultValue: 'Photo too big. Try again.' }));
          return;
        }
        const compressed = await compressImage(asset.uri);
        onUpdate({ [fieldKey]: compressed } as Partial<WizardData>);
      }
    } catch (err) {
      console.error('Error picking document image:', err);
      setUploadError(t('wizard.errors.uploadFailed', { defaultValue: 'Upload failed. Try again.' }));
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
            {t(titleKey, { defaultValue: defaultTitle })}
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.sublabel}>
            {t(hintKey, { defaultValue: defaultHint })}
          </Text>

          {/* Document preview */}
          <View style={styles.previewWrapper}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.placeholderIcon}>🪪</Text>
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

          {/* Retake hint */}
          {imageUri && (
            <Text variant="caption" color={theme.colors.primary} style={styles.retakeHint}>
              {t('wizard.retake', { defaultValue: 'Retake' })} / {t('wizard.replace', { defaultValue: 'Replace' })} — tap a button above
            </Text>
          )}

          {/* Upload error */}
          {uploadError && (
            <View style={styles.errorRow}>
              <Text variant="caption" color={theme.colors.danger}>{uploadError} </Text>
              <TouchableOpacity onPress={() => setUploadError(null)}>
                <Text variant="caption" color={theme.colors.primary} style={styles.retryText}>
                  {t('wizard.tryAgain', { defaultValue: 'Try again' })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Nudge when no image */}
          {!isValid && !uploadError && (
            <Text variant="caption" color={theme.colors.mutedText} style={styles.hint}>
              {t('wizard.addDocumentToContinue', { defaultValue: 'Add a document to continue' })}
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
  label: { alignSelf: 'flex-start', marginBottom: theme.spacing.sm },
  sublabel: { alignSelf: 'flex-start', marginBottom: theme.spacing.xl },
  previewWrapper: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  },
  placeholderIcon: { fontSize: 64 },
  pickerRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  pickerBtn: {
    flex: 1,
    borderWidth: 1,
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
  pickerLabel: { fontFamily: theme.fonts.medium, fontWeight: '500', textAlign: 'center' },
  retakeHint: { marginBottom: theme.spacing.sm },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  retryText: { fontFamily: theme.fonts.medium, fontWeight: '500', textDecorationLine: 'underline' },
  hint: { marginTop: theme.spacing.sm },
  footer: { gap: theme.spacing.sm, alignItems: 'center' },
  btn: { width: '100%' },
});
