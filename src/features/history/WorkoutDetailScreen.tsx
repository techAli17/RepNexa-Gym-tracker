import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useServices, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import type { ExerciseComparison } from '../../application/analytics/AnalyticsService';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { TextPrompt } from '../../components/common/TextPrompt';
import { SkeletonList, SkeletonCard } from '../../components/common/Skeleton';
import { ExerciseBlock, setLabels, type ExerciseBlockActions } from '../../components/workout/ExerciseBlock';
import { SetOptionsSheet } from '../../components/workout/SetOptionsSheet';
import { completedSetCount, workoutDurationMs, workoutVolumeKg } from '../../domain/calculations';
import type { WeightUnit, WorkoutDetail, WorkoutSet } from '../../domain/models';
import { useT, type Params, type TKey } from '../../i18n';
import { toast, toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatDate, formatDuration, formatVolume, formatWeight } from '../../utils/format';

type T = (key: TKey, params?: Params) => string;

function describeSet(s: WorkoutSet, unit: WeightUnit, t: T): string {
  const parts: string[] = [];
  if (s.weightValue != null && s.reps != null) parts.push(`${formatWeight(s.weightValue, s.weightUnit, unit)} ${unit} × ${s.reps}`);
  else if (s.reps != null) parts.push(t('history.reps', { reps: s.reps }));
  if (s.distanceValue != null && s.distanceUnit) parts.push(`${s.distanceValue} ${s.distanceUnit}`);
  if (s.durationSeconds != null)
    parts.push(s.durationSeconds >= 120 ? t('common.durationM', { m: Math.round(s.durationSeconds / 60) }) : t('history.seconds', { s: s.durationSeconds }));
  if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
  return parts.join(', ') || '—';
}

function delta(cur: number, prev: number, fmt: (v: number) => string, t: T): { text: string; up: boolean | null } {
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return { text: t('history.detail.same'), up: null };
  return { text: `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`, up: d > 0 };
}

export function WorkoutDetailScreen({ route, navigation }: RootScreenProps<'WorkoutDetail'>) {
  const services = useServices();
  const unit = useSettings(s => s.settings.weightUnit);
  const s = useStyles(styles);
  const { t } = useT();
  const id = route.params.id;
  const [detail, setDetail] = useState<WorkoutDetail | null | undefined>(undefined);
  const [compare, setCompare] = useState<ExerciseComparison[]>([]);
  const [editing, setEditing] = useState(false);
  const [optionsSetId, setOptionsSetId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);

  /** Ends editing: unticked sets and empty exercises are removed, records rebuilt. */
  const finishEditing = useCallback(async () => {
    try {
      await services.workouts.tidyFinished(id);
    } catch (e) {
      toastError(e);
    }
    setEditing(false);
    void loadRef.current();
  }, [services, id]);

  // Leaving the screen mid-edit tidies too, so history never keeps unticked sets.
  useEffect(
    () => () => {
      void services.workouts.tidyFinished(id).catch(() => undefined);
    },
    [services, id],
  );

  const loadRef = useRef<() => Promise<void>>(async () => undefined);
  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([services.history.detail(id), services.analytics.compareWithPrevious(id)]);
      setDetail(d);
      setCompare(c);
    } catch (e) {
      toastError(e);
      setDetail(null);
    }
  }, [services, id]);

  loadRef.current = load;

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!detail) return;
    navigation.setOptions({
      title: detail.workout.name,
      headerRight: () => (
        <Pressable onPress={() => (editing ? void finishEditing() : setEditing(true))} hitSlop={10} accessibilityRole="button" style={s.headerBtn}>
          <AppText variant="label" color="accent">
            {editing ? t('common.done') : t('common.edit')}
          </AppText>
        </Pressable>
      ),
    });
  }, [detail, editing, finishEditing, navigation, s.headerBtn, t]);

  /** Every edit writes through the service, then reloads, so records and totals stay true. */
  const actions: ExerciseBlockActions = useMemo(() => {
    const w = services.workouts;
    const run = (p: Promise<unknown>) => p.then(load, toastError);
    return {
      updateSet: (sid, patch) =>
        w.updateSet(sid, patch).then(
          () => void load(),
          e => {
            toastError(e);
            throw e;
          },
        ),
      toggleSet: sid => void run(w.setCompleted(sid, true)),
      cycleSetType: sid => void run(w.cycleSetType(sid)),
      openSetOptions: sid => setOptionsSetId(sid),
      addSet: weId => void run(w.addSet(weId, unit)),
      removeLastSet: () => undefined,
      removeSet: sid => void run(w.removeSet(sid)),
      move: (weId, dir) => void run(w.moveExercise(weId, dir)),
      remove: (weId, name) =>
        Alert.alert(t('history.detail.removeExerciseTitle', { name }), t('history.detail.removeExerciseMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.remove'), style: 'destructive', onPress: () => void run(w.removeExercise(weId)) },
        ]),
      saveNotes: (weId, notes) => void run(w.updateExerciseNotes(weId, notes)),
      openInfo: exerciseId => navigation.navigate('ExerciseDetail', { id: exerciseId }),
    };
  }, [services, load, unit, navigation, t]);

  if (detail === undefined) {
    return (
      <View style={[s.screen, s.body]}>
        <SkeletonCard height={90} />
        <SkeletonList rows={4} rowHeight={88} />
      </View>
    );
  }
  if (detail === null) return <EmptyState title={t('history.detail.notFoundTitle')} message={t('history.detail.notFoundMessage')} />;

  const w = detail.workout;
  const optionsSet = optionsSetId ? detail.exercises.flatMap(e => e.sets).find(x => x.id === optionsSetId) ?? null : null;
  const showW = (kg: number) => formatWeight(kg, 'kg', unit);

  const confirmDelete = () =>
    Alert.alert(t('history.detail.deleteTitle'), t('history.detail.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await services.workouts.deleteCompleted(w.id);
            toast(t('history.detail.deleted'));
            navigation.goBack();
          } catch (e) {
            toastError(e);
          }
        },
      },
    ]);

  const saveAsRoutine = async () => {
    setSavingRoutine(true);
    try {
      await services.routines.createFromWorkout(w.id);
      toast(t('history.detail.savedAsRoutine'));
    } catch (e) {
      toastError(e);
    } finally {
      setSavingRoutine(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <AppText color="ink2">{formatDate(w.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</AppText>
      <View style={s.grid}>
        <Stat value={formatDuration(workoutDurationMs(w, w.endedAt ?? w.startedAt))} label={t('history.detail.duration')} />
        <Stat value={formatVolume(workoutVolumeKg(detail), unit)} label={t('history.detail.volumeUnit', { unit })} divider />
        <Stat value={String(completedSetCount(detail))} label={t('history.detail.sets')} divider />
      </View>
      {w.notes ? <AppText color="ink2" style={s.notes}>{w.notes}</AppText> : null}

      {editing ? (
        <>
          <Button label={t('history.detail.rename')} variant="outline" onPress={() => setRenaming(true)} />
          <AppText variant="caption" color="ink3" style={s.editHint}>
            {t('history.detail.editHint')}
          </AppText>
          {detail.exercises.map((e, i) => (
            <ExerciseBlock
              key={e.id}
              item={e}
              index={i}
              count={detail.exercises.length}
              previous={undefined}
              unit={unit}
              actions={actions}
              mode="edit"
            />
          ))}
          <Button
            label={t('history.detail.addExercise')}
            variant="ghost"
            onPress={() => navigation.navigate('ExercisePicker', { mode: 'history', workoutId: w.id })}
            style={s.mtSm}
          />
          <AppText variant="caption" color="ink3" style={s.editHint}>
            {t('history.detail.addExerciseHint')}
          </AppText>
        </>
      ) : (
        detail.exercises.map(e => {
          const labels = setLabels(e.sets);
          const c = compare.find(x => x.exercise.id === e.exerciseId);
          const vol = c?.previous ? delta(c.current.volumeKg, c.previous.volumeKg, v => `${formatVolume(v, unit)} ${unit}`, t) : null;
          const e1 =
            c?.previous?.bestE1rm != null && c.current.bestE1rm != null
              ? delta(c.current.bestE1rm, c.previous.bestE1rm, v => `${showW(v)} ${unit}`, t)
              : null;
          return (
            <View key={e.id} style={s.ex}>
              <Pressable onPress={() => navigation.navigate('ExerciseDetail', { id: e.exerciseId })} accessibilityRole="button">
                <AppText variant="heading">{e.exercise.name}</AppText>
              </Pressable>
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
                  <AppText>{describeSet(set, unit, t)}</AppText>
                </View>
              ))}
              {c?.previous ? (
                <View
                  style={s.cmp}
                  accessible
                  accessibilityLabel={
                    t('history.detail.comparedWith', { date: formatDate(c.previous.date, { day: 'numeric', month: 'short' }), volume: vol?.text ?? '' }) +
                    (e1 ? t('history.detail.comparedE1rm', { e1rm: e1.text }) : '')
                  }
                >
                  <AppText variant="caption" color="ink3">
                    {t('history.detail.versus', { date: formatDate(c.previous.date, { day: 'numeric', month: 'short' }) })}
                  </AppText>
                  {vol ? <Delta label={t('history.detail.volume')} d={vol} /> : null}
                  {e1 ? <Delta label={t('history.detail.estE1rm')} d={e1} /> : null}
                </View>
              ) : (
                <AppText variant="caption" color="ink3" style={s.cmp}>
                  {t('history.detail.firstTime')}
                </AppText>
              )}
            </View>
          );
        })
      )}

      <Button label={t('history.detail.saveAsRoutine')} variant="outline" onPress={saveAsRoutine} busy={savingRoutine} style={s.mt} />
      <Button label={t('history.detail.deleteWorkout')} variant="dangerText" onPress={confirmDelete} style={s.mtSm} />

      <SetOptionsSheet
        set={optionsSet}
        onClose={() => setOptionsSetId(null)}
        onChange={patch => optionsSet && void actions.updateSet(optionsSet.id, patch).catch(() => undefined)}
      />
      <TextPrompt
        visible={renaming}
        title={t('history.detail.workoutName')}
        initial={w.name}
        onCancel={() => setRenaming(false)}
        onSubmit={name => {
          setRenaming(false);
          services.workouts.rename(w.id, name).then(load, toastError);
        }}
      />
    </ScrollView>
  );
}

const deltaStyle = { fontWeight: '700' } as const;

function Delta({ label, d }: { label: string; d: { text: string; up: boolean | null } }) {
  return (
    <AppText variant="caption" color={d.up == null ? 'ink3' : d.up ? 'good' : 'danger'} style={deltaStyle}>
      {' '}
      {label} {d.text}
    </AppText>
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
    body: { padding: 18, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
    headerBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
    grid: {
      flexDirection: 'row',
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: 18,
      paddingVertical: 12,
      marginVertical: 14,
    },
    stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    divider: { borderLeftWidth: 1, borderLeftColor: t.colors.line },
    statValue: { fontSize: 20, fontWeight: '800', color: t.colors.ink },
    notes: { marginBottom: 12 },
    editHint: { marginTop: 8 },
    ex: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.colors.line },
    note: { marginTop: 2 },
    setRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    setLabel: { width: 28 },
    cmp: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
    mt: { marginTop: 20 },
    mtSm: { marginTop: 6 },
  });
