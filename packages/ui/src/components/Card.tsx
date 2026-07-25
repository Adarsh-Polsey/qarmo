import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { theme } from '../theme';

export interface CardProps extends ViewProps {
  padding?: keyof typeof theme.spacing;
  shadow?: keyof typeof theme.shadows;
}

export const Card: React.FC<CardProps> = ({
  padding = 'md',
  shadow = 'md',
  style,
  children,
  ...props
}) => {
  return (
    <View
      style={[styles.card, { padding: theme.spacing[padding] }, theme.shadows[shadow], style]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
