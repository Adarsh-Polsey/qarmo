import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, theme, IconComponent } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';

interface Props {
  icon: IconComponent;
  titleKey?: string;
}

export const ComingSoonScreen: React.FC<Props> = ({ icon: Icon, titleKey = 'common.comingSoon' }) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <Icon size={64} color={theme.colors.mutedText} style={styles.icon} />
      <Text variant="title" color={theme.colors.ink}>
        {t(titleKey, { defaultValue: 'Coming soon' })}
      </Text>
    </SafeAreaView>
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
