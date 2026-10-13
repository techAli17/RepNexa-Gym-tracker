import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useT } from '../../i18n';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';

/** A placeholder block that gently pulses (or stays still under Reduce Motion). */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles(styles);
  const reduce = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  const shape = { width, height, borderRadius: radius, opacity: reduce ? 0.7 : pulse };
  return <Animated.View style={[s.block, shape, style]} />;
}

/** Card-shaped rows, like History or a list of days, while data loads. */
export function SkeletonList({ rows = 6, rowHeight = 72 }: { rows?: number; rowHeight?: number }) {
  const s = useStyles(styles);
  const { t } = useT();
  return (
    <View style={s.list} accessible accessibilityLabel={t('common.loading')} accessibilityState={{ busy: true }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[s.row, { height: rowHeight }]}>
          <SkeletonBlock width={44} height={rowHeight - 28} radius={10} />
          <View style={s.lines}>
            <SkeletonBlock width="60%" height={14} />
            <SkeletonBlock width="85%" height={11} style={s.gap} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A full card placeholder (chart, stats). */
export function SkeletonCard({ height = 180 }: { height?: number }) {
  const s = useStyles(styles);
  const { t } = useT();
  return (
    <View style={[s.card, { height }]} accessible accessibilityLabel={t('common.loading')} accessibilityState={{ busy: true }}>
      <SkeletonBlock width="40%" height={16} />
      <SkeletonBlock height={height - 64} radius={12} style={s.gap} />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    block: { backgroundColor: t.colors.raise },
    list: { padding: 18, gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      paddingHorizontal: 14,
    },
    lines: { flex: 1 },
    gap: { marginTop: 10 },
    card: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.xl,
      padding: 16,
      marginTop: 14,
    },
  });
