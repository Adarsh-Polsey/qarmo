import React from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { theme, Text } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';

interface Props {
  onSelectCustomer: () => void;
  onSelectPartner: () => void;
}

export const AccountTypeScreen: React.FC<Props> = ({
  onSelectCustomer,
  onSelectPartner,
}) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text variant="title" style={styles.title}>
          {t('accountType.title', { defaultValue: 'How will you use Qarmo?' })}
        </Text>

        <View style={styles.cardsContainer}>
          {/* Customer card */}
          <TouchableOpacity
            style={styles.card}
            onPress={onSelectCustomer}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>
              {t('accountType.customerIcon', { defaultValue: '🧍' })}
            </Text>
            <Text variant="body" style={styles.cardLabel} color={theme.colors.ink}>
              {t('accountType.customer', { defaultValue: 'Customer' })}
            </Text>
          </TouchableOpacity>

          {/* Partner card */}
          <TouchableOpacity
            style={styles.card}
            onPress={onSelectPartner}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>
              {t('accountType.partnerIcon', { defaultValue: '🛺' })}
            </Text>
            <Text variant="body" style={styles.cardLabel} color={theme.colors.ink}>
              {t('accountType.partner', { defaultValue: 'Partner' })}
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 140,
    justifyContent: 'center',
    // shadows
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardIcon: {
    fontSize: 44,
  },
  cardLabel: {
    fontWeight: '700',
    fontSize: 20,
    textAlign: 'center',
  },
});
