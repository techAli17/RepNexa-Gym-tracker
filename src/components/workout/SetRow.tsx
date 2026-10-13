import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  convertDistance,
  convertWeight,
  roundForDisplay,
} from '../../domain/calculations';
import type {
  DistanceUnit,
  TrackingType,
  WeightUnit,
  WorkoutSet,
} from '../../domain/models';
import { useT, type TKey, type Params } from '../../i18n';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { formatWeight } from '../../utils/format';
import { AppText } from '../common/AppText';
import { NumberField } from './NumberField';

export const SET_GRID = {
  badge: 40,
  prev: undefined,
  a: 78,
  b: 64,
  check: 48,
} as const;

export interface SetRowProps {
  set: WorkoutSet;
  /** "1", "2", "W", "D", "F" */
  label: string;
  tracking: TrackingType;
  previous: WorkoutSet | undefined;
  unit: WeightUnit;
  onUpdate: (id: string, patch: Partial<WorkoutSet>) => Promise<void>;
  onToggle: (id: string) => void;
  onCycleType: (id: string) => void;
  /** Long-press on the set number: set type and RPE. */
  onOpenOptions: (id: string) => void;
  /** 'edit' is for finished workouts: no check, a remove button instead. */
  mode?: 'live' | 'edit';
  onRemove?: (id: string) => void;
}

const distanceUnitFor = (u: WeightUnit): DistanceUnit =>
  u === 'lb' ? 'mi' : 'km';

function previousText(
  p: WorkoutSet | undefined,
  tracking: TrackingType,
  unit: WeightUnit,
  t: (key: TKey, params?: Params) => string,
): string {
  if (!p) return '—';
  switch (tracking) {
    case 'weight_reps':
      return p.weightValue != null && p.reps != null
        ? `${formatWeight(p.weightValue, p.weightUnit, unit)} × ${p.reps}`
        : '—';
    case 'bodyweight_reps':
      return p.reps == null
        ? '—'
        : p.weightValue
        ? `+${formatWeight(p.weightValue, p.weightUnit, unit)} × ${p.reps}`
        : t('workout.set.repsOnly', { reps: p.reps });
    case 'duration':
      return p.durationSeconds != null
        ? t('workout.set.secondsShort', { s: p.durationSeconds })
        : '—';
    case 'distance_duration':
      return p.distanceValue != null && p.distanceUnit
        ? `${roundForDisplay(
            convertDistance(
              p.distanceValue,
              p.distanceUnit,
              distanceUnitFor(unit),
            ),
            2,
          )} ${distanceUnitFor(unit)}`
        : '—';
  }
}

/**
 * One set: type badge, previous performance, two value fields and the check.
 * Values are shown in the viewer's unit; an edited value is saved in that unit,
 * untouched values keep the unit they were logged in.
 */
export const SetRow = React.memo(function SetRowView({
  set,
  label,
  tracking,
  previous,
  unit,
  onUpdate,
  onToggle,
  onCycleType,
  onOpenOptions,
  mode = 'live',
  onRemove,
}: SetRowProps) {
  const s = useStyles(styles);
  const theme = useTheme();
  const { t } = useT();
  const done = set.completedAt != null;
  // A small pop when a set is ticked: confirmation you can feel at a glance.
  const reduce = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current && !reduce) {
      pop.setValue(0.8);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    }
    wasDone.current = done;
  }, [done, pop, reduce]);
  const id = set.id;
  const dUnit = distanceUnitFor(unit);

  const saveWeight = useCallback(
    (v: number | null) => onUpdate(id, { weightValue: v, weightUnit: unit }),
    [id, unit, onUpdate],
  );
  const saveReps = useCallback(
    (v: number | null) => onUpdate(id, { reps: v }),
    [id, onUpdate],
  );
  const saveSeconds = useCallback(
    (v: number | null) => onUpdate(id, { durationSeconds: v }),
    [id, onUpdate],
  );
  const saveMinutes = useCallback(
    (v: number | null) =>
      onUpdate(id, { durationSeconds: v == null ? null : Math.round(v * 60) }),
    [id, onUpdate],
  );
  const saveDistance = useCallback(
    (v: number | null) =>
      onUpdate(id, {
        distanceValue: v,
        distanceUnit: v == null ? null : dUnit,
      }),
    [id, dUnit, onUpdate],
  );

  const weightShown =
    set.weightValue == null
      ? null
      : roundForDisplay(
          convertWeight(set.weightValue, set.weightUnit, unit),
          2,
        );
  const badgeColor =
    set.setType === 'warmup'
      ? theme.colors.accent
      : set.setType === 'drop'
      ? theme.colors.dropSet
      : set.setType === 'failure'
      ? theme.colors.danger
      : theme.colors.ink;
  const typeName = t(`workout.set.typeName.${set.setType}`);
  const a11y = t('workout.set.label', { label });

  let fieldA: React.ReactNode = <View style={s.spacer} />;
  let fieldB: React.ReactNode;
  switch (tracking) {
    case 'weight_reps':
    case 'bodyweight_reps':
      fieldA = (
        <NumberField
          value={weightShown}
          onCommit={saveWeight}
          placeholder={tracking === 'bodyweight_reps' ? '+0' : '0'}
          accessibilityLabel={t(
            tracking === 'bodyweight_reps'
              ? 'workout.set.addedWeightIn'
              : 'workout.set.weightIn',
            { set: a11y, unit },
          )}
          muted={done}
        />
      );
      fieldB = (
        <NumberField
          value={set.reps}
          onCommit={saveReps}
          integer
          accessibilityLabel={t('workout.set.reps', { set: a11y })}
          muted={done}
        />
      );
      break;
    case 'duration':
      fieldB = (
        <NumberField
          value={set.durationSeconds}
          onCommit={saveSeconds}
          integer
          accessibilityLabel={t('workout.set.seconds', { set: a11y })}
          muted={done}
        />
      );
      break;
    case 'distance_duration':
      fieldA = (
        <NumberField
          value={
            set.distanceValue == null || !set.distanceUnit
              ? null
              : roundForDisplay(
                  convertDistance(set.distanceValue, set.distanceUnit, dUnit),
                  2,
                )
          }
          onCommit={saveDistance}
          accessibilityLabel={t('workout.set.distanceIn', {
            set: a11y,
            unit: dUnit,
          })}
          muted={done}
        />
      );
      fieldB = (
        <NumberField
          value={
            set.durationSeconds == null
              ? null
              : roundForDisplay(set.durationSeconds / 60, 2)
          }
          onCommit={saveMinutes}
          accessibilityLabel={t('workout.set.minutes', { set: a11y })}
          muted={done}
        />
      );
      break;
  }

  return (
    <View style={[s.row, done && mode === 'live' && s.done]}>
      <Pressable
        onPress={() => onCycleType(id)}
        onLongPress={() => onOpenOptions(id)}
        accessibilityRole="button"
        accessibilityLabel={`${a11y}, ${typeName}${
          set.rpe != null ? `, RPE ${set.rpe}` : ''
        }`}
        accessibilityHint={t('workout.set.badgeHint')}
        accessibilityActions={[
          { name: 'longpress', label: t('workout.set.optionsAction') },
        ]}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'longpress') onOpenOptions(id);
        }}
        style={[
          s.badge,
          set.setType === 'warmup' && {
            backgroundColor: theme.colors.amberSoft,
          },
        ]}
      >
        <AppText variant="label" style={[s.badgeText, { color: badgeColor }]}>
          {label}
        </AppText>
      </Pressable>
      <View style={s.prev}>
        <AppText
          variant="caption"
          color="ink3"
          numberOfLines={1}
          accessibilityLabel={t('workout.set.previous', {
            text: previousText(previous, tracking, unit, t),
          })}
        >
          {mode === 'edit' ? '' : previousText(previous, tracking, unit, t)}
        </AppText>
        {set.rpe != null ? (
          <AppText
            variant="caption"
            color="accent"
            style={s.rpe}
            importantForAccessibility="no"
          >
            RPE {set.rpe}
          </AppText>
        ) : null}
      </View>
      <View style={s.a}>{fieldA}</View>
      <View style={s.b}>{fieldB}</View>
      {mode === 'edit' && done ? (
        <Pressable
          onPress={() => onRemove?.(id)}
          accessibilityRole="button"
          accessibilityLabel={t('workout.set.remove', { label })}
          hitSlop={4}
          style={s.check}
        >
          <AppText style={s.removeText}>✕</AppText>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => onToggle(id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={t('workout.set.done', { set: a11y })}
          hitSlop={4}
          style={[s.check, done && s.checkOn]}
        >
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <AppText style={[s.checkText, done && s.checkTextOn]}>✓</AppText>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
});

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 5,
      paddingHorizontal: 2,
      borderRadius: 13,
    },
    done: { backgroundColor: t.colors.goodSoft },
    badge: {
      width: SET_GRID.badge,
      height: 38,
      borderRadius: 10,
      backgroundColor: t.colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prev: { flex: 1, minWidth: 0 },
    rpe: { fontSize: 11.5, fontWeight: '700' },
    a: { width: SET_GRID.a },
    b: { width: SET_GRID.b },
    spacer: { height: 48 },
    check: {
      width: SET_GRID.check,
      height: 44,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.colors.line,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: t.colors.good, borderColor: t.colors.good },
    badgeText: { fontWeight: '800', fontSize: 15 },
    removeText: { color: t.colors.danger, fontSize: 18, fontWeight: '800' },
    checkText: { color: t.colors.ink3, fontSize: 20, fontWeight: '800' },
    checkTextOn: { color: t.colors.surface },
  });
