import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';

export function Card({ style, ...rest }: ViewProps) {
  const s = useStyles(styles);
  return <View {...rest} style={[s.card, style]} />;
}

const styles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.line,
      borderWidth: 1,
      borderRadius: t.radii.xl,
      padding: t.spacing.lg,
    },
  });
