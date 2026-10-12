import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { workoutDurationMs } from '../../domain/calculations';
import type { WeightUnit, WorkoutListItem } from '../../domain/models';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate, formatDuration, formatVolume } from '../../utils/format';
import { AppText } from '../common/AppText';

export const WorkoutRow = React.memo(function WorkoutRowView({
  item,
  unit,
  onPress,
}: {
  item: WorkoutListItem;
  unit: WeightUnit;
  onPress: (id: string) => void;
}) {
  const s = useStyles(styles);
  const w = item.workout;
  const dur = formatDuration(workoutDurationMs(w, w.endedAt ?? w.startedAt));
  const vol = `${formatVolume(item.volumeKg, unit)} ${unit}`;
  const sets = `${item.completedSetCount} sets`;
  const day = formatDate(w.startedAt, { day: 'numeric' });
  const month = formatDate(w.startedAt, { month: 'short' });
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      onPress={() => onPress(w.id)}
      accessibilityRole="button"
      accessibilityLabel={`${w.name}, ${formatDate(w.startedAt, { weekday: 'long', day: 'numeric', month: 'long' })}, ${dur}, ${vol}, ${sets}${item.recordCount ? `, ${item.recordCount} records` : ''}`}
    >
      <View style={s.date}>
        <AppText style={s.day}>{day}</AppText>
        <AppText variant="caption" color="ink3">
          {month}
        </AppText>
      </View>
      <View style={s.main}>
        <AppText variant="label" style={s.name} numberOfLines={1}>
          {w.name}
        </AppText>
        <AppText variant="caption" color="ink3" numberOfLines={1}>
          {dur} · {vol} · {sets}
        </AppText>
      </View>
      {item.recordCount ? (
        <View style={s.pr}>
          <AppText variant="caption" color="accent" style={s.prText}>
            {item.recordCount} PR
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    pressed: { opacity: 0.85 },
    date: { width: 48, alignItems: 'center', borderRightWidth: 1, borderRightColor: t.colors.line, paddingRight: 12 },
    day: { fontSize: 24, fontWeight: '800', color: t.colors.ink, lineHeight: 26 },
    main: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, fontWeight: '700' },
    pr: { backgroundColor: t.colors.amberSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    prText: { fontWeight: '700' },
  });
