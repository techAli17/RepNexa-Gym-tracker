import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useActiveWorkoutStore, useServices } from '../../app/AppContext';
import type { RootScreenProps, TabScreenProps } from '../../app/navigation/types';
import { filterExercises } from '../../application/exercises/ExerciseService';
import { AppText } from '../../components/common/AppText';
import { Chip } from '../../components/common/Chip';
import { EmptyState } from '../../components/common/EmptyState';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../../domain/models';
import { toast, toastError } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { titleCase } from '../../utils/text';

const ExerciseItem = React.memo(function ExerciseItem({ e, onPress, hint }: { e: Exercise; onPress: (e: Exercise) => void; hint: string }) {
  const s = useStyles(styles);
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      onPress={() => onPress(e)}
      accessibilityRole="button"
      accessibilityHint={hint}
    >
      <View style={s.thumb} importantForAccessibility="no-hide-descendants">
        <AppText variant="heading" color="ink2">
          {e.name.charAt(0)}
        </AppText>
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
    </Pressable>
  );
});

/** Shared list with search and muscle-group filters. */
function ExerciseList({ onSelect, hint }: { onSelect: (e: Exercise) => void; hint: string }) {
  const services = useServices();
  const s = useStyles(styles);
  const t = useTheme();
  const [all, setAll] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    services.exercises.list().then(setAll, toastError);
  }, [services]);

  const list = useMemo(() => filterExercises(all, { query: deferredQuery, muscleGroup: group }), [all, deferredQuery, group]);
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} keyboardShouldPersistTaps="handled">
            <Chip label="All" selected={group === 'all'} onPress={() => setGroup('all')} />
            {MUSCLE_GROUPS.map(g => (
              <Chip key={g} label={titleCase(g)} selected={group === g} onPress={() => setGroup(g)} />
            ))}
          </ScrollView>
          <AppText variant="caption" color="ink3" style={s.count}>
            {list.length} {list.length === 1 ? 'exercise' : 'exercises'}
          </AppText>
        </View>
      }
      ListEmptyComponent={
        <EmptyState title="No matches" message={query ? `Nothing matches “${query}”. Try another name.` : 'No exercises in this group yet.'} />
      }
    />
  );
}

export function ExerciseLibraryScreen({ navigation }: TabScreenProps<'Exercises'>) {
  const onSelect = useCallback((e: Exercise) => navigation.navigate('ExerciseDetail', { id: e.id }), [navigation]);
  return <ExerciseList onSelect={onSelect} hint="Shows instructions" />;
}

export function ExercisePickerScreen({ navigation }: RootScreenProps<'ExercisePicker'>) {
  const store = useActiveWorkoutStore();
  const [busy, setBusy] = useState(false);
  const onSelect = useCallback(
    async (e: Exercise) => {
      if (busy) return; // ignore a second tap while the first add is saving
      setBusy(true);
      try {
        await store.getState().addExercise(e.id);
        toast(`${e.name} added`);
        navigation.goBack();
      } catch (err) {
        toastError(err);
        setBusy(false);
      }
    },
    [busy, store, navigation],
  );
  return <ExerciseList onSelect={onSelect} hint="Adds it to your workout" />;
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { padding: 18, paddingBottom: 40 },
    flex: { flex: 1 },
    search: {
      height: 48,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface,
      paddingHorizontal: 14,
      fontSize: 16,
      color: t.colors.ink,
    },
    chips: { marginTop: 12, marginHorizontal: -18, paddingHorizontal: 18 },
    count: { marginTop: 12, marginBottom: 8 },
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
