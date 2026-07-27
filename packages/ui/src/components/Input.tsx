import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  StyleProp,
  ViewStyle,
  FocusEvent,
  BlurEvent,
} from 'react-native';
import { theme } from '../theme';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: FocusEvent) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: BlurEvent) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const borderColor = error
    ? theme.colors.danger
    : isFocused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text variant="caption" color={theme.colors.mutedText} style={styles.label}>
          {label}
        </Text>
      )}
      <View style={[styles.inputWrapper, { borderColor }]}>
        <TextInput
          style={[styles.input, style]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.colors.mutedText}
          {...props}
        />
      </View>
      {error && (
        <Text variant="caption" color={theme.colors.danger} style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  label: {
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    height: 56,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.ink,
    paddingVertical: 0,
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
});
