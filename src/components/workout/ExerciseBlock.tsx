import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { WeightUnit, WorkoutExerciseDetail, WorkoutSet } from '../../domain/models';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { SET_GRID, SetRow } from './SetRow';

export interface ExerciseBlockActions {
  updateSet: (id: string, patch: Partial<WorkoutSet>) => Promise<void>;
  toggleSet: (id: string) => void;
  cycleSetType: (id: string) => void;
  openSetOptions: (id: string) => void;
  addSet: (workoutExerciseId: string) => void;
  removeLastSet: (workoutExerciseId: string) => void;
  removeSet: (setId: string) => void;
  move: (workoutExerciseId: string, dir: -1 | 1) => void;
  remove: (workoutExerciseId: string, name: string) => void;
  replace?: (workoutExerciseId: string, exerciseId: string) => void;
  editRest?: (workoutExerciseId: string, current: number | null) => void;
  saveNotes: (workoutExerciseId: string, notes: string) => void;
  openInfo: (exerciseId: string) => void;
}

const LABEL = { warmup: 'W', drop: 'D', failure: 'F' } as const;

/** Working sets are numbered; warm-ups, drops and failure sets get a letter. */
export function setLabels(sets: readonly WorkoutSet[]): string[] {
  let n = 0;
  return sets.map(s => (s.setType === 'normal' ? String(++n) : LABEL[s.setType]));
}

const restText = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export const ExerciseBlock = React.memo(function ExerciseBlockCard({
  item,
  index,
  count,
  previous,
  unit,
  actions,
  mode = 'live',
  defaultRest,
}: {
  item: WorkoutExerciseDetail;
  index: number;
  count: number;
  previous: WorkoutSet[] | undefined;
  unit: WeightUnit;
  actions: ExerciseBlockActions;
  mode?: 'live' | 'edit';
  defaultRest?: number;
}) {
  const s = useStyles(styles);
  const t = useTheme();
  const [menu, setMenu] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? '');
  const labels = setLabels(item.sets);
  const tracking = item.exercise.trackingType;
  const prevWorking = (previous ?? []).filter(p => p.setType !== 'warmup');
  let workingIndex = 0;

  const colA =
    tracking === 'weight_reps'
      ? unit
      : tracking === 'bodyweight_reps'
        ? `+${unit}`
        : tracking === 'distance_duration'
          ? unit === 'lb'
            ? 'mi'
            : 'km'
          : '';
  const colB = tracking === 'duration' ? 'Sec' : tracking === 'distance_duration' ? 'Min' : 'Reps';
  const rest = item.restSeconds ?? defaultRest ?? null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Pressable
          style={s.nameBtn}
          onPress={() => actions.openInfo(item.exerciseId)}
          accessibilityRole="button"
          accessibilityHint="Shows how to do this exercise"
        >
          <AppText variant="heading" style={s.name}>
            {item.exercise.name}
          </AppText>
          {mode === 'live' && rest != null ? (
            <AppText variant="caption" color="ink3">
              Rest {restText(rest)}
            </AppText>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => setMenu(m => !m)}
          style={s.more}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${item.exercise.name}`}
          accessibilityState={{ expanded: menu }}
          hitSlop={6}
        >
          <Icon name="more" size={20} tint="ink2" />
        </Pressable>
      </View>
      {menu ? (
        <View style={s.menu}>
          {actions.replace && mode === 'live' ? (
            <MenuButton icon="swap" label="Replace" onPress={() => actions.replace!(item.id, item.exerciseId)} />
          ) : null}
          {actions.editRest && mode === 'live' ? (
            <MenuButton icon="timer" label="Rest" onPress={() => actions.editRest!(item.id, item.restSeconds)} />
          ) : null}
          <MenuButton icon="arrowUp" label="Up" disabled={index === 0} onPress={() => actions.move(item.id, -1)} />
          <MenuButton icon="arrowDown" label="Down" disabled={index === count - 1} onPress={() => actions.move(item.id, 1)} />
          <MenuButton icon="trash" label="Remove" danger onPress={() => actions.remove(item.id, item.exercise.name)} />
        </View>
      ) : null}
      <TextInput
        value={notes}
        onChangeText={setNotes}
        onEndEditing={() => {
          if (notes !== (item.notes ?? '')) actions.saveNotes(item.id, notes);
        }}
        placeholder="Add a note"
        placeholderTextColor={t.colors.ink3}
        accessibilityLabel={`Note for ${item.exercise.name}`}
        style={s.note}
        maxLength={1000}
      />
      <View style={s.colHead} importantForAccessibility="no-hide-descendants">
        <AppText variant="caption" color="ink3" style={[s.center, { width: SET_GRID.badge }]}>
          Set
        </AppText>
        <AppText variant="caption" color="ink3" style={s.flex}>
          {mode === 'edit' ? '' : 'Previous'}
        </AppText>
        <AppText variant="caption" color="ink3" style={[s.center, { width: SET_GRID.a }]}>
          {colA}
        </AppText>
        <AppText variant="caption" color="ink3" style={[s.center, { width: SET_GRID.b }]}>
          {colB}
        </AppText>
        <View style={{ width: SET_GRID.check }} />
      </View>
      {item.sets.map((set, i) => (
        <SetRow
          key={set.id}
          set={set}
          label={labels[i]}
          tracking={tracking}
          previous={set.setType === 'warmup' ? undefined : prevWorking[workingIndex++]}
          unit={unit}
          onUpdate={actions.updateSet}
          onToggle={actions.toggleSet}
          onCycleType={actions.cycleSetType}
          onOpenOptions={actions.openSetOptions}
          mode={mode}
          onRemove={actions.removeSet}
        />
      ))}
      <View style={s.foot}>
        <Pressable style={[s.footBtn, s.footMain]} onPress={() => actions.addSet(item.id)} accessibilityRole="button">
          <AppText variant="label">+ Add set</AppText>
        </Pressable>
        {mode === 'live' ? (
          <Pressable
            style={[s.footBtn, item.sets.length < 2 && s.dim]}
            disabled={item.sets.length < 2}
            onPress={() => actions.removeLastSet(item.id)}
            accessibilityRole="button"
            accessibilityState={{ disabled: item.sets.length < 2 }}
          >
            <AppText variant="label" color="ink2">
              Remove set
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

function MenuButton({
  label,
  icon,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const s = useStyles(styles);
  return (
    <Pressable
      style={[s.menuBtn, disabled && s.dim]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label === 'Up' ? 'Move up' : label === 'Down' ? 'Move down' : label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Icon name={icon} size={18} tint={danger ? 'danger' : 'ink'} />
      <AppText variant="caption" color={danger ? 'danger' : 'ink'} style={s.menuText}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.line,
      borderWidth: 1,
      borderRadius: t.radii.xl,
      paddingHorizontal: 10,
      paddingTop: 12,
      paddingBottom: 10,
      marginTop: 12,
    },
    head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
    nameBtn: { flex: 1, paddingVertical: 4 },
    name: { color: t.colors.ink },
    more: {
      width: 44,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.line,
    },
    menu: { flexDirection: 'row', gap: 6, marginTop: 10, paddingHorizontal: 4 },
    menuBtn: {
      flex: 1,
      minHeight: 52,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    menuText: { fontWeight: '600' },
    note: {
      marginTop: 8,
      marginHorizontal: 4,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.line,
      color: t.colors.ink,
      fontSize: 15,
    },
    colHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 10, paddingBottom: 4, paddingHorizontal: 2 },
    center: { textAlign: 'center' },
    flex: { flex: 1 },
    foot: { flexDirection: 'row', gap: 8, marginTop: 8 },
    footBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: t.colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footMain: { flex: 2 },
    dim: { opacity: 0.4 },
  });
