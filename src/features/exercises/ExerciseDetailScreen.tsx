import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useActiveWorkout, useActiveWorkoutStore, useServices, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import type { E1rmPoint, ExerciseRecords } from '../../application/analytics/AnalyticsService';
import { LineChart } from '../../components/charts/ProgressChart';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon, iconForEquipment } from '../../components/common/Icon';
import { convertWeight, roundForDisplay } from '../../domain/calculations';
import type { Exercise } from '../../domain/models';
import { toast, toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate, formatWeight } from '../../utils/format';
import { titleCase } from '../../utils/text';

export function ExerciseDetailScreen({ route, navigation }: RootScreenProps<'ExerciseDetail'>) {
  const services = useServices();
  const store = useActiveWorkoutStore();
  const hasActive = useActiveWorkout(s => s.detail != null);
  const unit = useSettings(s => s.settings.weightUnit);
  const s = useStyles(styles);
  const [e, setE] = useState<Exercise | null | undefined>(undefined);
  const [series, setSeries] = useState<E1rmPoint[]>([]);
  const [records, setRecords] = useState<ExerciseRecords | null>(null);
  const [similar, setSimilar] = useState<Exercise[]>([]);
  const id = route.params.id;

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        try {
          const [ex, ser, recs, sim] = await Promise.all([
            services.exercises.get(id),
            services.analytics.e1rmSeries(id),
            services.analytics.records(),
            services.exercises.similar(id, 5),
          ]);
          if (!live) return;
          setE(ex);
          setSeries(ser);
          setRecords(recs.find(r => r.exercise.id === id) ?? null);
          setSimilar(sim);
        } catch (err) {
          toastError(err);
          if (live) setE(null);
        }
      })();
      return () => {
        live = false;
      };
    }, [services, id]),
  );

  if (e === undefined) return <View style={s.screen} />;
  if (e === null) return <EmptyState title="Exercise not found" />;

  const show = (kg: number) => `${formatWeight(kg, 'kg', unit)} ${unit}`;
  const r = records?.records ?? {};
  const df = (ts: number) => formatDate(ts, { day: 'numeric', month: 'short' });

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      {/* Placeholder until licensed illustrations are bundled; see docs/EXERCISE_IMAGES.md. */}
      <View style={s.hero} accessibilityLabel="Illustration not available yet">
        <Icon name={iconForEquipment(e.equipment)} size={64} tint="ink3" strokeWidth={1.6} />
        <AppText variant="caption" color="ink3">
          Illustration coming soon
        </AppText>
      </View>
      <AppText variant="title" accessibilityRole="header">
        {e.name}
      </AppText>
      <AppText color="ink2" style={s.meta}>
        {titleCase(e.muscleGroup)} · {titleCase(e.equipment)}
        {e.isCustom ? ' · Custom' : ''}
      </AppText>

      <View style={s.actions}>
        {hasActive ? (
          <Button
            label="Add to workout"
            onPress={async () => {
              try {
                await store.getState().addExercise(e.id);
                toast(`${e.name} added`);
                navigation.goBack();
              } catch (err) {
                toastError(err);
              }
            }}
            style={s.flex}
          />
        ) : null}
        {e.isCustom ? (
          <Button label="Edit" variant="outline" onPress={() => navigation.navigate('ExerciseForm', { id: e.id })} style={s.flex} />
        ) : null}
      </View>

      {e.primaryMuscles.length ? <Section title="Primary muscles" body={e.primaryMuscles.map(titleCase).join(', ')} /> : null}
      {e.secondaryMuscles.length ? <Section title="Secondary muscles" body={e.secondaryMuscles.map(titleCase).join(', ')} /> : null}
      {e.instructions ? <Section title="How to do it" body={e.instructions} /> : null}

      <Card style={s.card}>
        <AppText variant="heading">Your records</AppText>
        {r.e1rm || r.max_weight || r.max_reps ? (
          <View style={s.recs}>
            {r.e1rm ? <Rec label="Est. 1RM" value={show(r.e1rm.value)} date={df(r.e1rm.achievedAt)} /> : null}
            {r.max_weight ? <Rec label="Heaviest" value={show(r.max_weight.value)} date={df(r.max_weight.achievedAt)} /> : null}
            {r.max_reps ? <Rec label="Most reps" value={String(r.max_reps.value)} date={df(r.max_reps.achievedAt)} /> : null}
          </View>
        ) : (
          <AppText color="ink2" style={s.mt}>
            Not logged yet. Finish a workout with this exercise to see your records.
          </AppText>
        )}
        {series.length >= 2 ? (
          <View style={s.mt}>
            <AppText variant="label" color="ink3">
              Estimated 1-rep max, {unit}
            </AppText>
            <LineChart
              points={series.map(p => ({ x: p.date, y: roundForDisplay(convertWeight(p.e1rm, 'kg', unit), 1), label: df(p.date) }))}
              accessibilityLabel={`Estimated 1-rep max over time: ${series.map(p => `${df(p.date)} ${show(p.e1rm)}`).join(', ')}`}
            />
          </View>
        ) : null}
      </Card>

      {series.length ? (
        <Card style={s.card}>
          <AppText variant="heading">Recent sessions</AppText>
          {[...series]
            .reverse()
            .slice(0, 5)
            .map(p => (
              <Pressable
                key={p.workoutId}
                style={s.session}
                onPress={() => navigation.navigate('WorkoutDetail', { id: p.workoutId })}
                accessibilityRole="button"
              >
                <AppText style={s.flex}>{formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}</AppText>
                <AppText color="ink2">
                  {p.set.weightValue != null ? `${formatWeight(p.set.weightValue, p.set.weightUnit, unit)} ${unit}` : ''} × {p.set.reps}
                </AppText>
              </Pressable>
            ))}
        </Card>
      ) : null}

      {similar.length ? (
        <View style={s.mtLg}>
          <AppText variant="heading">Similar exercises</AppText>
          {similar.map(x => (
            <Pressable key={x.id} style={s.similar} onPress={() => navigation.push('ExerciseDetail', { id: x.id })} accessibilityRole="button">
              <Icon name={iconForEquipment(x.equipment)} size={20} tint="ink2" />
              <AppText style={s.flex}>{x.name}</AppText>
              <Icon name="chevronRight" size={18} tint="ink3" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  const s = useStyles(styles);
  return (
    <View style={s.section}>
      <AppText variant="label" color="ink3">
        {title}
      </AppText>
      <AppText style={s.sectionBody}>{body}</AppText>
    </View>
  );
}

function Rec({ label, value, date }: { label: string; value: string; date: string }) {
  const s = useStyles(styles);
  return (
    <View style={s.rec}>
      <AppText variant="caption" color="ink3">
        {label}
      </AppText>
      <AppText style={s.recValue}>{value}</AppText>
      <AppText variant="caption" color="ink3">
        {date}
      </AppText>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    flex: { flex: 1 },
    hero: {
      height: 150,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: t.colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 16,
    },
    meta: { marginTop: 4 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
    section: { marginTop: 18 },
    sectionBody: { marginTop: 4 },
    card: { marginTop: 18 },
    mt: { marginTop: 10 },
    mtLg: { marginTop: 22 },
    recs: { flexDirection: 'row', marginTop: 12 },
    rec: { flex: 1 },
    recValue: { fontSize: 18, fontWeight: '800', color: t.colors.ink },
    session: { flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.colors.line, marginTop: 4 },
    similar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: t.colors.line },
  });
