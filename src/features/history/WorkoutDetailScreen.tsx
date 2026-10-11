import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useServices, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { setLabels } from '../../components/workout/ExerciseBlock';
import { completedSetCount, workoutDurationMs, workoutVolumeKg } from '../../domain/calculations';
import type { WeightUnit, WorkoutDetail, WorkoutSet } from '../../domain/models';
import { toast, toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate, formatDuration, formatVolume, formatWeight } from '../../utils/format';

function describeSet(s: WorkoutSet, unit: WeightUnit): string {
  const parts: string[] = [];
  if (s.weightValue != null && s.reps != null) parts.push(`${formatWeight(s.weightValue, s.weightUnit, unit)} ${unit} × ${s.reps}`);
  else if (s.reps != null) parts.push(`${s.reps} reps`);
  if (s.distanceValue != null && s.distanceUnit) parts.push(`${s.distanceValue} ${s.distanceUnit}`);
  if (s.durationSeconds != null) parts.push(s.durationSeconds >= 120 ? `${Math.round(s.durationSeconds / 60)} min` : `${s.durationSeconds} s`);
  if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
  return parts.join(', ') || '—';
}

export function WorkoutDetailScreen({ route, navigation }: RootScreenProps<'WorkoutDetail'>) {
  const services = useServices();
  const unit = useSettings(s => s.settings.weightUnit);
  const s = useStyles(styles);
  const t = useTheme();
  const [detail, setDetail] = useState<WorkoutDetail | null | undefined>(undefined);

  useEffect(() => {
    services.history.detail(route.params.id).then(setDetail, e => {
      toastError(e);
      setDetail(null);
    });
  }, [services, route.params.id]);

  useEffect(() => {
    if (detail) navigation.setOptions({ title: detail.workout.name });
  }, [detail, navigation]);

  if (detail === undefined) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.colors.ink3} />
      </View>
    );
  }
  if (detail === null) return <EmptyState title="Workout not found" message="It may have been deleted." />;

  const w = detail.workout;
  const confirmDelete = () =>
    Alert.alert('Delete this workout?', 'It will be removed from this phone, and from your backup the next time it updates.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await services.workouts.deleteCompleted(w.id);
            toast('Workout deleted');
            navigation.goBack();
          } catch (e) {
            toastError(e);
          }
        },
      },
    ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <AppText color="ink2">{formatDate(w.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</AppText>
      <View style={s.grid}>
        <Stat value={formatDuration(workoutDurationMs(w, w.endedAt ?? w.startedAt))} label="Duration" />
        <Stat value={formatVolume(workoutVolumeKg(detail), unit)} label={`Volume, ${unit}`} divider />
        <Stat value={String(completedSetCount(detail))} label="Sets" divider />
      </View>
      {detail.exercises.map(e => {
        const labels = setLabels(e.sets);
        return (
          <View key={e.id} style={s.ex}>
            <AppText variant="heading">{e.exercise.name}</AppText>
            {e.notes ? (
              <AppText variant="caption" color="ink2" style={s.note}>
                {e.notes}
              </AppText>
            ) : null}
            {e.sets.map((set, i) => (
              <View key={set.id} style={s.setRow}>
                <AppText variant="label" color={set.setType === 'warmup' ? 'accent' : 'ink3'} style={s.setLabel}>
                  {labels[i]}
                </AppText>
                <AppText>{describeSet(set, unit)}</AppText>
              </View>
            ))}
          </View>
        );
      })}
      <Button label="Delete workout" variant="dangerText" onPress={confirmDelete} style={s.delete} />
    </ScrollView>
  );
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  const s = useStyles(styles);
  return (
    <View style={[s.stat, divider && s.divider]}>
      <AppText style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" color="ink3">
        {label}
      </AppText>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
    grid: { flexDirection: 'row', backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.line, borderRadius: 18, paddingVertical: 12, marginVertical: 14 },
    stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    divider: { borderLeftWidth: 1, borderLeftColor: t.colors.line },
    statValue: { fontSize: 20, fontWeight: '800', color: t.colors.ink },
    ex: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.colors.line },
    note: { marginTop: 2 },
    setRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    setLabel: { width: 28 },
    delete: { marginTop: 20 },
  });
