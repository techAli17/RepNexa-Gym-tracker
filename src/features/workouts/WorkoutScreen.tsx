import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveWorkout, useActiveWorkoutStore, useSettings } from '../../app/AppContext';
import type { RootScreenProps } from '../../app/navigation/types';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon } from '../../components/common/Icon';
import { TextPrompt } from '../../components/common/TextPrompt';
import { ElapsedClock } from '../../components/workout/ElapsedClock';
import { ExerciseBlock, type ExerciseBlockActions } from '../../components/workout/ExerciseBlock';
import { flushPendingNumberFields } from '../../components/workout/NumberField';
import { RestPickerSheet } from '../../components/workout/RestPickerSheet';
import { RestTimerBar } from '../../components/workout/RestTimerBar';
import { SetOptionsSheet } from '../../components/workout/SetOptionsSheet';
import { useT } from '../../i18n';
import { completedSetCount, workoutVolumeKg } from '../../domain/calculations';
import type { WorkoutExerciseDetail } from '../../domain/models';
import { toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatVolume } from '../../utils/format';

export function WorkoutScreen({ navigation }: RootScreenProps<'Workout'>) {
  const store = useActiveWorkoutStore();
  const detail = useActiveWorkout(s => s.detail);
  const previous = useActiveWorkout(s => s.previous);
  const unit = useSettings(s => s.settings.weightUnit);
  const defaultRest = useSettings(s => s.settings.defaultRestSeconds);
  const insets = useSafeAreaInsets();
  const s = useStyles(styles);
  const theme = useTheme();
  const { t, tn } = useT();
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const [optionsSetId, setOptionsSetId] = useState<string | null>(null);
  const [restFor, setRestFor] = useState<{ id: string; current: number | null } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [notes, setNotes] = useState(detail?.workout.notes ?? '');

  const actions: ExerciseBlockActions = useMemo(() => {
    const a = store.getState();
    const run = (p: Promise<unknown>) => p.catch(toastError);
    return {
      updateSet: (id, patch) =>
        a.updateSet(id, patch).catch(e => {
          toastError(e);
          throw e; // lets the field mark itself invalid
        }),
      // Save a value typed a moment ago before deciding whether the set can be checked off.
      toggleSet: id => void run(flushPendingNumberFields().then(() => a.toggleSet(id))),
      cycleSetType: id => void run(a.cycleSetType(id)),
      openSetOptions: id => setOptionsSetId(id),
      addSet: id => void run(a.addSet(id)),
      removeLastSet: id => {
        const ex = store.getState().detail?.exercises.find(e => e.id === id);
        const last = ex?.sets[ex.sets.length - 1];
        if (last) void run(a.removeSet(last.id));
      },
      removeSet: id => void run(a.removeSet(id)),
      move: (id, dir) => void run(a.moveExercise(id, dir)),
      remove: (id, name) =>
        Alert.alert(t('workout.removeExerciseTitle', { name }), t('workout.removeExerciseMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.remove'), style: 'destructive', onPress: () => void run(a.removeExercise(id)) },
        ]),
      replace: (id, exerciseId) => navigation.navigate('ExercisePicker', { mode: 'replace', workoutExerciseId: id, exerciseId }),
      editRest: (id, current) => setRestFor({ id, current }),
      saveNotes: (id, text) => void run(a.setExerciseNotes(id, text)),
      openInfo: exerciseId => navigation.navigate('ExerciseDetail', { id: exerciseId }),
    };
  }, [store, navigation, t]);

  const finish = useCallback(() => {
    if (!detail || finishingRef.current) return;
    const unchecked = detail.exercises.reduce((n, e) => n + e.sets.filter(x => x.completedAt == null).length, 0);
    const go = async () => {
      if (finishingRef.current) return; // a second tap must not finish twice
      finishingRef.current = true;
      setFinishing(true);
      try {
        await flushPendingNumberFields();
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
        t('workout.finishTitle'),
        tn('workout.uncheckedSets', unchecked),
        [
          { text: t('workout.keepGoing'), style: 'cancel' },
          { text: t('workout.finish'), onPress: () => void go() },
        ],
      );
    } else {
      void go();
    }
  }, [detail, store, navigation, t, tn]);

  const discard = useCallback(() => {
    Alert.alert(t('workout.discardTitle'), t('workout.discardMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('workout.discard'),
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
  }, [store, navigation, t]);

  const renderItem = useCallback(
    ({ item, index }: { item: WorkoutExerciseDetail; index: number }) => (
      <ExerciseBlock
        item={item}
        index={index}
        count={detail?.exercises.length ?? 0}
        previous={previous[item.exerciseId]}
        unit={unit}
        actions={actions}
        defaultRest={defaultRest}
      />
    ),
    [detail?.exercises.length, previous, unit, actions, defaultRest],
  );

  if (!detail) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState title={t('workout.noWorkout')} actionLabel={t('workout.back')} onAction={() => navigation.goBack()} />
      </View>
    );
  }

  const w = detail.workout;
  const paused = w.pausedAt != null;
  const optionsSet = optionsSetId ? detail.exercises.flatMap(e => e.sets).find(x => x.id === optionsSetId) ?? null : null;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={s.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('workout.minimize')}
          accessibilityHint={t('workout.minimizeHint')}
        >
          <Icon name="chevronDown" />
        </Pressable>
        <Pressable style={s.titleBtn} onPress={() => setRenaming(true)} accessibilityRole="button" accessibilityHint={t('workout.renameHint')}>
          <AppText variant="title" numberOfLines={1} accessibilityRole="header">
            {w.name}
          </AppText>
        </Pressable>
        <Button label={t('workout.finish')} onPress={finish} busy={finishing} compact />
      </View>

      <View style={s.strip}>
        <View style={s.stat}>
          <ElapsedClock workout={w} />
          <AppText variant="caption" color={paused ? 'accent' : 'ink3'}>
            {paused ? t('workout.paused') : t('workout.duration')}
          </AppText>
        </View>
        <View style={[s.stat, s.statDivider]}>
          <AppText variant="number">{formatVolume(workoutVolumeKg(detail), unit)}</AppText>
          <AppText variant="caption" color="ink3">
            {t('workout.volumeUnit', { unit })}
          </AppText>
        </View>
        <View style={[s.stat, s.statDivider]}>
          <AppText variant="number">{completedSetCount(detail)}</AppText>
          <AppText variant="caption" color="ink3">
            {t('workout.setsDone')}
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
        ListEmptyComponent={<EmptyState title={t('workout.emptyTitle')} message={t('workout.emptyMessage')} />}
        ListFooterComponent={
          <View style={s.footer}>
            <AppText variant="caption" color="ink3">
              {t('workout.tip')}
            </AppText>
            <Button label={t('workout.addExercise')} variant="ghost" onPress={() => navigation.navigate('ExercisePicker', { mode: 'add' })} />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              onEndEditing={() => {
                if (notes !== (w.notes ?? '')) void store.getState().setNotes(notes).catch(toastError);
              }}
              placeholder={t('workout.notes')}
              placeholderTextColor={theme.colors.ink3}
              accessibilityLabel={t('workout.notes')}
              multiline
              maxLength={2000}
              style={s.notes}
            />
            <Button
              label={paused ? t('workout.resume') : t('workout.pause')}
              variant="outline"
              onPress={() => void (paused ? store.getState().resume() : store.getState().pause()).catch(toastError)}
            />
            <Button label={t('workout.discardWorkout')} variant="dangerText" onPress={discard} />
          </View>
        }
      />

      <View style={[s.restWrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <RestTimerBar />
      </View>

      <SetOptionsSheet
        set={optionsSet}
        onClose={() => setOptionsSetId(null)}
        onChange={patch => optionsSet && void actions.updateSet(optionsSet.id, patch).catch(() => undefined)}
      />
      <RestPickerSheet
        visible={!!restFor}
        current={restFor?.current ?? null}
        defaultSeconds={defaultRest}
        onClose={() => setRestFor(null)}
        onPick={v => {
          const target = restFor;
          setRestFor(null);
          if (target) void store.getState().setRestSeconds(target.id, v).catch(toastError);
        }}
      />
      <TextPrompt
        visible={renaming}
        title={t('workout.nameTitle')}
        initial={w.name}
        onCancel={() => setRenaming(false)}
        onSubmit={name => {
          setRenaming(false);
          void store.getState().rename(name).catch(toastError);
        }}
      />
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
    titleBtn: { flex: 1, minHeight: 44, justifyContent: 'center' },
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
    notes: {
      minHeight: 80,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface,
      padding: 12,
      fontSize: 15,
      color: t.colors.ink,
      textAlignVertical: 'top',
    },
    restWrap: { position: 'absolute', left: 14, right: 14 },
  });
