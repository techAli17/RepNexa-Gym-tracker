import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from './AppText';

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const s = useStyles(styles);
  return (
    <View style={s.field}>
      <AppText variant="label" color="ink3" style={s.label}>
        {label}
      </AppText>
      {children}
      {error ? (
        <AppText variant="caption" color="danger" style={s.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function TextField({ invalid, style, ...rest }: TextInputProps & { invalid?: boolean }) {
  const s = useStyles(styles);
  const t = useTheme();
  return <TextInput placeholderTextColor={t.colors.ink3} {...rest} style={[s.input, invalid && s.invalid, style]} />;
}

/** Wrapping single-choice chips; a radiogroup for screen readers. */
export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (v: T) => void;
}) {
  const s = useStyles(styles);
  return (
    <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={[s.chip, on && s.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
          >
            <AppText variant="label" color={on ? 'bg' : 'ink2'}>
              {l}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    field: { marginBottom: 16 },
    label: { marginBottom: 6 },
    error: { marginTop: 4 },
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface2,
      paddingHorizontal: 12,
      fontSize: 16,
      color: t.colors.ink,
    },
    invalid: { borderColor: t.colors.danger },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOn: { backgroundColor: t.colors.ink, borderColor: t.colors.ink },
  });
