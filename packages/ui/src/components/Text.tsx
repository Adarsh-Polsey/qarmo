import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { theme } from '../theme';

export type TextVariant = keyof typeof theme.typography;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = theme.colors.ink,
  style,
  children,
  ...props
}) => {
  return (
    <RNText style={[styles.base, theme.typography[variant], { color }, style]} {...props}>
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    fontStyle: 'normal',
  },
});
