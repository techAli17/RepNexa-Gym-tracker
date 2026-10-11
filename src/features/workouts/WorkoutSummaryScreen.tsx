import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveWorkout, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import type { RecordType } from '../../domain/models';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDuration, formatVolume, formatWeight } from '../../utils/format';

const RECORD_LABEL: Record<RecordType, string> = {
  e1rm: 'Best estimated 1-rep max',
  max_weight: 'Heaviest weight',
  max_reps: 'Most reps in a set',
  best_set_volume: 'Best set volume',
};

export function WorkoutSummaryScreen({ navigation }: RootScreenProps<'WorkoutSummary'>) {
  const summary = useActiveWorkout(s => s.lastSummary);
  const unit = useSettings(s => s.settings.weightUnit);
  const insets = useSafeAreaInsets();
  const s = useStyles(styles);

  useEffect(() => {
    if (!summary) navigation.goBack();
  }, [summary, navigation]);
  if (!summary) return null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}>
      <AppText variant="title" style={s.center} accessibilityRole="header">
        Workout complete
      </AppText>
      <AppText color="ink2" style={s.center}>
        {summary.detail.workout.name}
      </AppText>
      <AppText style={[s.center, s.big]}>{formatDuration(summary.durationMs)}</AppText>

      <View style={s.grid}>
        <Stat value={formatVolume(summary.volumeKg, unit)} label={`Volume, ${unit}`} />
        <Stat value={String(summary.completedSets)} label="Sets done" divider />
        <Stat value={String(summary.improvements.length)} label="Records" divider />
      </View>

      <AppText variant="heading" style={s.h}>
        Personal records
      </AppText>
      {summary.improvements.length ? (
        summary.improvements.map(i => (
          <View key={`${i.exerciseId}:${i.recordType}`} style={s.pr}>
            <View style={s.prText}>
              <AppText variant="label">{i.exerciseName}</AppText>
              <AppText variant="caption" color="ink3">
                {RECORD_LABEL[i.recordType]}
              </AppText>
            </View>
            <AppText variant="number" color="accent">
              {i.recordType === 'max_reps' ? i.current : `${formatWeight(i.current, 'kg', unit)} ${unit}`}
            </AppText>
          </View>
        ))
      ) : (
        <AppText color="ink2">No new records this time. Showing up is what builds them.</AppText>
      )}

      <AppText variant="caption" color="ink3" style={s.saved}>
        Saved on this phone.
      </AppText>
      <Button label="Done" variant="ink" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  const s = useStyles(styles);
  return (
    <View style={[s.stat, divider && s.divider]}>
      <AppText variant="number">{value}</AppText>
      <AppText variant="caption" color="ink3">
        {label}
      </AppText>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.surface },
    body: { padding: 20, paddingTop: 28 },
    center: { textAlign: 'center' },
    big: { fontSize: 52, fontWeight: '800', marginTop: 6, color: t.colors.ink, fontVariant: ['tabular-nums'] },
    grid: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: 18, paddingVertical: 12, marginVertical: 18 },
    stat: { flex: 1, alignItems: 'center' },
    divider: { borderLeftWidth: 1, borderLeftColor: t.colors.line },
    h: { marginBottom: 6 },
    pr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.colors.line },
    prText: { flex: 1 },
    saved: { marginTop: 18, marginBottom: 12 },
  });
