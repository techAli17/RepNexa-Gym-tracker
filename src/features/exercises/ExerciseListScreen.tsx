import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useActiveWorkoutStore, useServices } from '../../app/AppContext';
import type { PickerMode, RootScreenProps, TabScreenProps } from '../../app/navigation/types';
import { filterExercises } from '../../application/exercises/ExerciseService';
import { AppText } from '../../components/common/AppText';
import { Chip } from '../../components/common/Chip';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon, iconForEquipment } from '../../components/common/Icon';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../../domain/models';
import { toast, toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { titleCase } from '../../utils/text';

export const ExerciseItem = React.memo(function ExerciseItemRow({
  e,
  onPress,
  hint,
}: {
  e: Exercise;
  onPress: (e: Exercise) => void;
  hint: string;
}) {
  const s = useStyles(styles);
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && s.pressed]} onPress={() => onPress(e)} accessibilityRole="button" accessibilityHint={hint}>
      <View style={s.thumb}>
        <Icon name={iconForEquipment(e.equipment)} size={26} tint="ink2" />
      </View>
      <View style={s.flex}>
        <AppText variant="label" style={s.name}>
          {e.name}
        </AppText>
        <AppText variant="caption" color="ink3">
          {titleCase(e.muscleGroup)} · {titleCase(e.equipment)}
          {e.isCustom ? ' · Custom' : ''}
        </AppText>
      </View>
      <Icon name="chevronRight" size={18} tint="ink3" />
    </Pressable>
  );
});

/** Shared list with search, muscle-group filters and a create entry. */
function ExerciseList({
  onSelect,
  onCreate,
  hint,
  suggestions,
  excludeId,
}: {
  onSelect: (e: Exercise) => void;
  onCreate: () => void;
  hint: string;
  suggestions?: Exercise[];
  excludeId?: string;
}) {
  const services = useServices();
  const s = useStyles(styles);
  const t = useTheme();
  const [all, setAll] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const deferredQuery = useDeferredValue(query);

  // Reload on focus so a just-created custom exercise appears.
  useFocusEffect(
    useCallback(() => {
      services.exercises.list().then(setAll, toastError);
    }, [services]),
  );

  const list = useMemo(
    () => filterExercises(all, { query: deferredQuery, muscleGroup: group }).filter(e => e.id !== excludeId),
    [all, deferredQuery, group, excludeId],
  );
  const showSuggestions = !!suggestions?.length && !deferredQuery && group === 'all';
  const render = useCallback(({ item }: { item: Exercise }) => <ExerciseItem e={item} onPress={onSelect} hint={hint} />, [onSelect, hint]);

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.body}
      data={list}
      keyExtractor={e => e.id}
      renderItem={render}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={14}
      ListHeaderComponent={
        <View>
          <View style={s.searchWrap}>
            <View style={s.searchIcon}>
              <Icon name="search" size={18} tint="ink3" />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              placeholderTextColor={t.colors.ink3}
              accessibilityLabel="Search exercises"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
              style={s.search}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} keyboardShouldPersistTaps="handled">
            <Chip label="All" selected={group === 'all'} onPress={() => setGroup('all')} />
            {MUSCLE_GROUPS.map(g => (
              <Chip key={g} label={titleCase(g)} selected={group === g} onPress={() => setGroup(g)} />
            ))}
          </ScrollView>
          <Pressable style={s.create} onPress={onCreate} accessibilityRole="button">
            <Icon name="plus" size={18} tint="ink2" />
            <AppText variant="label" color="ink2">
              Create exercise
            </AppText>
          </Pressable>
          {showSuggestions ? (
            <View>
              <AppText variant="label" color="ink3" style={s.count}>
                Suggested substitutes
              </AppText>
              {suggestions!.map(e => (
                <ExerciseItem key={e.id} e={e} onPress={onSelect} hint={hint} />
              ))}
              <AppText variant="label" color="ink3" style={s.count}>
                All exercises
              </AppText>
            </View>
          ) : (
            <AppText variant="caption" color="ink3" style={s.count}>
              {list.length} {list.length === 1 ? 'exercise' : 'exercises'}
            </AppText>
          )}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="No matches"
          message={query ? `Nothing matches “${query}”. Try another name, or create your own exercise.` : 'No exercises in this group yet.'}
          actionLabel="Create exercise"
          onAction={onCreate}
        />
      }
    />
  );
}

export function ExerciseLibraryScreen({ navigation }: TabScreenProps<'Exercises'>) {
  const onSelect = useCallback((e: Exercise) => navigation.navigate('ExerciseDetail', { id: e.id }), [navigation]);
  return <ExerciseList onSelect={onSelect} onCreate={() => navigation.navigate('ExerciseForm', {})} hint="Shows details" />;
}

/**
 * One picker, three jobs: add to the active workout, replace an exercise in it,
 * or hand the choice back to the routine editor.
 */
export function ExercisePickerScreen({ navigation, route }: RootScreenProps<'ExercisePicker'>) {
  const params = route.params;
  const store = useActiveWorkoutStore();
  const services = useServices();
  const busy = useRef(false);
  const [suggestions, setSuggestions] = useState<Exercise[] | undefined>();
  const replacing = params.mode === 'replace' ? params : null;

  useEffect(() => {
    navigation.setOptions({ title: replacing ? 'Replace exercise' : params.mode === 'routine' ? 'Add to routine' : 'Add exercise' });
    if (replacing) services.exercises.similar(replacing.exerciseId).then(setSuggestions, toastError);
  }, [navigation, params.mode, replacing, services]);

  const onSelect = useCallback(
    async (e: Exercise) => {
      if (busy.current) return; // a second tap while the first is saving must not add twice
      busy.current = true;
      try {
        await applyPick(params, e);
      } catch (err) {
        toastError(err);
      } finally {
        busy.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  );

  async function applyPick(p: PickerMode, e: Exercise) {
    const a = store.getState();
    if (p.mode === 'routine') {
      navigation.popTo('RoutineEditor', { addExerciseId: e.id, addNonce: Date.now() }, { merge: true });
      return;
    }
    if (p.mode === 'replace') {
      await a.replaceExercise(p.workoutExerciseId, e.id);
      toast(`Replaced with ${e.name}`);
    } else {
      await a.addExercise(e.id);
      toast(`${e.name} added`);
    }
    navigation.goBack();
  }

  return (
    <ExerciseList
      onSelect={onSelect}
      onCreate={() => navigation.navigate('ExerciseForm', { pickFor: params })}
      hint={replacing ? 'Replaces the exercise' : params.mode === 'routine' ? 'Adds it to the routine' : 'Adds it to your workout'}
      suggestions={suggestions}
      excludeId={replacing?.exerciseId}
    />
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    flex: { flex: 1 },
    searchWrap: { justifyContent: 'center' },
    searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
    search: {
      height: 48,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface,
      paddingLeft: 42,
      paddingRight: 14,
      fontSize: 16,
      color: t.colors.ink,
    },
    chips: { marginTop: 12, marginHorizontal: -18, paddingHorizontal: 18 },
    create: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 48,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: t.colors.line,
      borderRadius: 16,
      marginTop: 12,
    },
    count: { marginTop: 14, marginBottom: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      padding: 12,
      marginBottom: 8,
    },
    pressed: { opacity: 0.85 },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: t.colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { fontSize: 16, fontWeight: '700' },
  });
