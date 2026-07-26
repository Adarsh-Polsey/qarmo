import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, Text } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';

interface Props {
  current: number; // 1-indexed
  total: number;
}

export const WizardProgress: React.FC<Props> = ({ current, total }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < current ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
      <Text variant="caption" color={theme.colors.mutedText}>
        {t('wizard.stepTracker', {
          step: current,
          total,
          defaultValue: `Step ${current} of ${total}`,
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
  },
  dotInactive: {
    backgroundColor: theme.colors.border,
  },
});
