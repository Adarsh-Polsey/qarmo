import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';

interface Props {
  onRegister: () => void;
  onLogin: () => void;
}

export const LandingScreen: React.FC<Props> = ({ onRegister, onLogin }) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Welcome image placeholder — centered */}
        <View style={styles.heroContainer}>
          <Text style={styles.heroEmoji}>🛺</Text>
          <Text variant="title" color={theme.colors.ink} style={styles.heroTitle}>
            {t('landing.welcomeTitle', { defaultValue: 'Welcome to Qarmo' })}
          </Text>
          <Text variant="body" color={theme.colors.mutedText} style={styles.heroSubtitle}>
            {t('landing.tagline', { defaultValue: 'Rides & deliveries, made simple' })}
          </Text>
        </View>

        {/* Bottom section — Register + Login */}
        <View style={styles.bottomSection}>
          <Button
            label={t('landing.register', { defaultValue: 'Register' })}
            variant="primary"
            onPress={onRegister}
            style={styles.registerBtn}
          />

          <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
            <Text
              variant="caption"
              color={theme.colors.mutedText}
              style={styles.loginLink}
            >
              {t('landing.login', { defaultValue: 'Log in' })}
            </Text>
          </TouchableOpacity>
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
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  heroEmoji: {
    fontSize: 80,
    marginBottom: theme.spacing.sm,
  },
  heroTitle: {
    textAlign: 'center',
  },
  heroSubtitle: {
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  bottomSection: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  registerBtn: {
    width: '100%',
    height: 64,
    borderRadius: theme.radius.sm,
  },
  registerText: {
    fontFamily: theme.fonts.medium,
    fontSize: 20,
    fontWeight: '500',
  },
  loginLink: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
