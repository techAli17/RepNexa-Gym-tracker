import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from './AppText';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const s = useStyles(styles);
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={[s.chip, selected && s.on]}
    >
      <AppText variant="label" style={{ color: selected ? t.colors.bg : t.colors.ink2 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: t.spacing.sm,
    },
    on: { backgroundColor: t.colors.ink, borderColor: t.colors.ink },
  });
