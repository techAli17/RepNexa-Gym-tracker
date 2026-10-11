import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveWorkout, useActiveWorkoutStore, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { ElapsedClock } from '../../components/workout/ElapsedClock';
import { ExerciseBlock, type ExerciseBlockActions } from '../../components/workout/ExerciseBlock';
import { RestTimerBar } from '../../components/workout/RestTimerBar';
import { completedSetCount, workoutVolumeKg } from '../../domain/calculations';
import type { WorkoutExerciseDetail } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useStyles } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatVolume } from '../../utils/format';

export function WorkoutScreen({ navigation }: RootScreenProps<'Workout'>) {
  const store = useActiveWorkoutStore();
  const detail = useActiveWorkout(s => s.detail);
  const previous = useActiveWorkout(s => s.previous);
  const unit = useSettings(s => s.settings.weightUnit);
  const insets = useSafeAreaInsets();
  const s = useStyles(styles);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);

  const actions: ExerciseBlockActions = useMemo(() => {
    const a = store.getState();
    const run = (p: Promise<unknown>) => p.catch(toastError);
    return {
      updateSet: (id, patch) =>
        a.updateSet(id, patch).catch(e => {
          toastError(e);
          throw e; // lets the field mark itself invalid
        }),
      toggleSet: id => void run(a.toggleSet(id)),
      cycleSetType: id => void run(a.cycleSetType(id)),
      addSet: id => void run(a.addSet(id)),
      removeLastSet: id => {
        const ex = store.getState().detail?.exercises.find(e => e.id === id);
        const last = ex?.sets[ex.sets.length - 1];
        if (last) void run(a.removeSet(last.id));
      },
      move: (id, dir) => void run(a.moveExercise(id, dir)),
      remove: (id, name) =>
        Alert.alert(`Remove ${name}?`, 'Its sets in this workout will be deleted.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => void run(a.removeExercise(id)) },
        ]),
      saveNotes: (id, notes) => void run(a.setExerciseNotes(id, notes)),
      openInfo: exerciseId => navigation.navigate('ExerciseDetail', { id: exerciseId }),
    };
  }, [store, navigation]);

  const finish = useCallback(() => {
    if (!detail || finishingRef.current) return;
    const unchecked = detail.exercises.reduce((n, e) => n + e.sets.filter(x => x.completedAt == null).length, 0);
    const go = async () => {
      if (finishingRef.current) return; // a second tap must not finish twice
      finishingRef.current = true;
      setFinishing(true);
      try {
        await store.getState().finish();
        navigation.replace('WorkoutSummary');
      } catch (e) {
        toastError(e);
      } finally {
        finishingRef.current = false;
        setFinishing(false);
      }
    };
    if (unchecked > 0) {
      Alert.alert(
        'Finish workout?',
        `${unchecked} unchecked ${unchecked === 1 ? 'set' : 'sets'} will be left out. Checked sets are saved.`,
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'Finish', onPress: () => void go() },
        ],
      );
    } else {
      void go();
    }
  }, [detail, store, navigation]);

  const discard = useCallback(() => {
    Alert.alert('Discard this workout?', 'The sets you logged in this workout will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          try {
            await store.getState().discard();
            navigation.goBack();
          } catch (e) {
            toastError(e);
          }
        },
      },
    ]);
  }, [store, navigation]);

  const renderItem = useCallback(
    ({ item, index }: { item: WorkoutExerciseDetail; index: number }) => (
      <ExerciseBlock
        item={item}
        index={index}
        count={detail?.exercises.length ?? 0}
        previous={previous[item.exerciseId]}
        unit={unit}
        actions={actions}
      />
    ),
    [detail?.exercises.length, previous, unit, actions],
  );

  if (!detail) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState title="No workout in progress" actionLabel="Back" onAction={() => navigation.goBack()} />
      </View>
    );
  }

  const w = detail.workout;
  const paused = w.pausedAt != null;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={s.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Minimize workout"
          accessibilityHint="The workout keeps running. Resume it from Home."
        >
          <AppText variant="heading">⌄</AppText>
        </Pressable>
        <AppText variant="title" numberOfLines={1} style={s.title} accessibilityRole="header">
          {w.name}
        </AppText>
        <Button label="Finish" onPress={finish} busy={finishing} compact />
      </View>

      <View style={s.strip}>
        <View style={s.stat}>
          <ElapsedClock workout={w} />
          <AppText variant="caption" color="ink3">
            {paused ? 'Paused' : 'Duration'}
          </AppText>
        </View>
        <View style={[s.stat, s.statDivider]}>
          <AppText variant="number">{formatVolume(workoutVolumeKg(detail), unit)}</AppText>
          <AppText variant="caption" color="ink3">
            Volume, {unit}
          </AppText>
        </View>
        <View style={[s.stat, s.statDivider]}>
          <AppText variant="number">{completedSetCount(detail)}</AppText>
          <AppText variant="caption" color="ink3">
            Sets done
          </AppText>
        </View>
      </View>

      <FlatList
        data={detail.exercises}
        keyExtractor={e => e.id}
        renderItem={renderItem}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        removeClippedSubviews={false}
        ListEmptyComponent={
          <EmptyState title="Add your first exercise" message="Pick from the library or create your own." />
        }
        ListFooterComponent={
          <View style={s.footer}>
            <AppText variant="caption" color="ink3">
              Tap a set number to mark it as a warm-up (W), drop set (D) or set to failure (F).
            </AppText>
            <Button label="+ Add exercise" variant="ghost" onPress={() => navigation.navigate('ExercisePicker')} />
            <Button
              label={paused ? 'Resume workout' : 'Pause workout'}
              variant="outline"
              onPress={() => void (paused ? store.getState().resume() : store.getState().pause()).catch(toastError)}
            />
            <Button label="Discard workout" variant="dangerText" onPress={discard} />
          </View>
        }
      />

      <View style={[s.restWrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <RestTimerBar />
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1 },
    strip: {
      flexDirection: 'row',
      marginHorizontal: 16,
      backgroundColor: t.colors.surface,
      borderColor: t.colors.line,
      borderWidth: 1,
      borderRadius: t.radii.lg,
      paddingVertical: 10,
    },
    stat: { flex: 1, alignItems: 'center' },
    statDivider: { borderLeftWidth: 1, borderLeftColor: t.colors.line },
    list: { paddingHorizontal: 16 },
    footer: { gap: 10, marginTop: 16 },
    restWrap: { position: 'absolute', left: 14, right: 14 },
  });
