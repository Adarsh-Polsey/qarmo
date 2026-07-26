import React from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { theme, Text, Button } from '@qarmo/ui';
import { useTranslation } from '@qarmo/i18n';

interface Props {
  onSelectDelivery: () => void;
  onSelectRide: () => void;
  onBack: () => void;
}

export const PartnerTypeScreen: React.FC<Props> = ({
  onSelectDelivery,
  onSelectRide,
  onBack,
}) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text variant="title" style={styles.title}>
          {t('partnerType.title', { defaultValue: 'What do you do?' })}
        </Text>

        <View style={styles.cardsContainer}>
          {/* Delivery Partner card */}
          <TouchableOpacity
            style={styles.card}
            onPress={onSelectDelivery}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>
              {t('partnerType.deliveryIcon', { defaultValue: '🛵' })}
            </Text>
            <Text variant="body" style={styles.cardLabel} color={theme.colors.ink}>
              {t('partnerType.delivery', { defaultValue: 'Delivery Partner' })}
            </Text>
          </TouchableOpacity>

          {/* Ride Partner card */}
          <TouchableOpacity
            style={styles.card}
            onPress={onSelectRide}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>
              {t('partnerType.rideIcon', { defaultValue: '🛺' })}
            </Text>
            <Text variant="body" style={styles.cardLabel} color={theme.colors.ink}>
              {t('partnerType.ride', { defaultValue: 'Ride Partner' })}
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          label={t('common.cancel', { defaultValue: 'Cancel' })}
          variant="ghost"
          onPress={onBack}
          style={styles.backBtn}
        />
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
  backBtn: {
    marginTop: theme.spacing.md,
  },
});
