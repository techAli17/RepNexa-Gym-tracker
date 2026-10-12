import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from './AppText';

/** −/+ stepper exposed to screen readers as an adjustable control. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  format = String,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const s = useStyles(styles);
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <View
      style={s.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <Pressable style={[s.btn, value <= min && s.dim]} onPress={() => set(value - 1)} disabled={value <= min} hitSlop={4}>
        <AppText variant="heading">−</AppText>
      </Pressable>
      <AppText variant="label" style={s.value}>
        {format(value)}
      </AppText>
      <Pressable style={[s.btn, value >= max && s.dim]} onPress={() => set(value + 1)} disabled={value >= max} hitSlop={4}>
        <AppText variant="heading">+</AppText>
      </Pressable>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: t.colors.line },
    btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    value: { minWidth: 34, textAlign: 'center', fontWeight: '800' },
    dim: { opacity: 0.35 },
  });
