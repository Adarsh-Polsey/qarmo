import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { theme, Text, Card, IconMapPin } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { GlobalCounter } from '../components/GlobalCounter';

export const CustomerMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <GlobalCounter />
      
      <View style={styles.centerContainer}>
        <Card style={styles.card} shadow="lg">
          <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.iconBackground}>
              <IconMapPin size={48} color={theme.colors.primary} />
            </View>
          </Animated.View>
          
          <Text variant="title" style={styles.title}>
            {t('map.openOnPhone', { defaultValue: 'Open on your phone to see the map' })}
          </Text>
          
          <Text variant="body" style={styles.description}>
            {t('map.webPlaceholderDesc', { 
              defaultValue: 'For the best experience, including real-time locations and interactive features, please access this map using the Qarmo app on your mobile device.' 
            })}
          </Text>
        </Card>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  card: {
    maxWidth: 440,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconWrapper: {
    marginBottom: theme.spacing.lg,
  },
  iconBackground: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(232, 164, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(232, 164, 0, 0.25)',
  },
  title: {
    textAlign: 'center',
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    marginBottom: theme.spacing.md,
    color: theme.colors.ink,
  },
  description: {
    textAlign: 'center',
    color: theme.colors.mutedText,
    lineHeight: 22,
  },
});
