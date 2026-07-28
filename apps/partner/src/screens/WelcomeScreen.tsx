import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button, IconTaxi } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';

interface Props {
  onContinue: () => void;
}

/**
 * Single entry point for the whole auth flow — no Register/Login split.
 * Everyone taps Continue and proceeds to phone → OTP; whether they're a new
 * or returning user is decided after verification by `profile_completed_at`.
 */
export const WelcomeScreen: React.FC<Props> = ({ onContinue }) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          {/* Image placeholder — swap for real artwork/illustration later */}
          <View style={styles.imagePlaceholder}>
            <IconTaxi size={88} color={theme.colors.mutedText} />
            <Text variant="caption" color={theme.colors.mutedText} style={styles.placeholderCaption}>
              {t('welcome.imagePlaceholder', { defaultValue: 'Image' })}
            </Text>
          </View>

          <Text variant="title" color={theme.colors.ink} style={styles.title}>
            {t('welcome.title', { defaultValue: 'Welcome to Qarmo' })}
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
            {t('welcome.subtitle', { defaultValue: 'Rides & deliveries, made simple' })}
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
            label={t('welcome.continue', { defaultValue: 'Get started' })}
            variant="primary"
            onPress={onContinue}
            style={styles.btn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 320,
    maxHeight: 320,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  placeholderCaption: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  btn: {
    width: '100%',
  },
});
