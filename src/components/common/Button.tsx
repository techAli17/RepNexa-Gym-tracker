import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { HIT, type Theme } from '../../theme/tokens';
import { AppText } from './AppText';

export type ButtonVariant =
  | 'primary'
  | 'ink'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'dangerText';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  compact,
  accessibilityHint,
  style,
}: ButtonProps) {
  const s = useStyles(styles);
  const t = useTheme();
  const fg = {
    primary: t.colors.onAmber,
    ink: t.colors.bg,
    outline: t.colors.ink,
    ghost: t.colors.ink2,
    danger: '#FFFFFF',
    dangerText: t.colors.danger,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.base,
        compact && s.compact,
        s[variant],
        (disabled || busy) && s.disabled,
        pressed && s.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <AppText
          variant="label"
          style={[s.label, compact && s.labelCompact, { color: fg }]}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: HIT + 4,
      borderRadius: t.radii.md,
      paddingHorizontal: t.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compact: {
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.sm + 2,
    },
    primary: { backgroundColor: t.colors.amber },
    ink: { backgroundColor: t.colors.ink },
    outline: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: t.colors.line,
    },
    danger: { backgroundColor: t.colors.danger },
    dangerText: { backgroundColor: 'transparent' },
    label: { fontSize: 16, fontWeight: '700' },
    labelCompact: { fontSize: 14 },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  });
