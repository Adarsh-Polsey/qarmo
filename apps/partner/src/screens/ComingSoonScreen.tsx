import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, theme } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  titleKey?: string;
}

export const ComingSoonScreen: React.FC<Props> = ({ iconName, titleKey = 'common.comingSoon' }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Ionicons name={iconName} size={64} color={theme.colors.mutedText} style={styles.icon} />
      <Text variant="title" color={theme.colors.ink}>
        {t(titleKey, { defaultValue: 'Coming soon' })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  icon: {
    marginBottom: theme.spacing.md,
  },
});
