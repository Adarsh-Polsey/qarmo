import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, theme, IconConfetti } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';

export const GlobalCounter: React.FC = () => {
  const { t } = useTranslation();
  const text = t('counter.partners_static', { defaultValue: '3000+ partners on Qarmo' });

  return (
    <View style={styles.container}>
      <IconConfetti size={16} color={theme.colors.ink} />
      <Text variant="body" style={styles.text}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: theme.fonts.medium,
    fontWeight: '500',
    color: theme.colors.ink,
  },
});
