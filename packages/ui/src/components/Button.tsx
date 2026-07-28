import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { theme } from '../theme';
import { Text } from './Text';
import type { IconComponent } from './Icon';

export interface ButtonProps {
  onPress: () => void;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading icon, rendered in the label color */
  icon?: IconComponent;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  label,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon: Icon,
  style,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const containerStyle = [
    styles.button,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'ghost' && styles.ghost,
    disabled && styles.disabled,
  ];

  const labelColor =
    variant === 'primary'
      ? theme.colors.textOnColored
      : disabled
        ? theme.colors.mutedText
        : variant === 'secondary'
          ? theme.colors.ink
          : theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => animateTo(0.96)}
      onPressOut={() => animateTo(1)}
      style={style}
    >
      <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? theme.colors.background : theme.colors.primary}
            size="small"
          />
        ) : (
          <View style={styles.content}>
            {Icon && <Icon size={20} color={labelColor} style={styles.icon} />}
            <Text variant="button" color={labelColor}>
              {label}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: theme.spacing.xs,
  },
});
