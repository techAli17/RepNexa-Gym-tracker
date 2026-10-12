import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
        : `${p.reps} reps`;
    case 'duration':
      return p.durationSeconds != null ? `${p.durationSeconds} s` : '—';
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
export const SetRow = React.memo(function SetRow({
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
  const t = useTheme();
  const done = set.completedAt != null;
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
      ? t.colors.accent
      : set.setType === 'drop'
      ? t.colors.dropSet
      : set.setType === 'failure'
      ? t.colors.danger
      : t.colors.ink;
  const typeName = {
    normal: 'working set',
    warmup: 'warm-up',
    drop: 'drop set',
    failure: 'set to failure',
  }[set.setType];
  const a11y = `Set ${label}`;

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
          accessibilityLabel={`${a11y}, ${
            tracking === 'bodyweight_reps' ? 'added weight' : 'weight'
          } in ${unit}`}
          muted={done}
        />
      );
      fieldB = (
        <NumberField
          value={set.reps}
          onCommit={saveReps}
          integer
          accessibilityLabel={`${a11y}, reps`}
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
          accessibilityLabel={`${a11y}, seconds`}
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
          accessibilityLabel={`${a11y}, distance in ${dUnit}`}
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
          accessibilityLabel={`${a11y}, minutes`}
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
        accessibilityHint="Tap to change the set type. Long-press for set type and RPE."
        accessibilityActions={[
          { name: 'longpress', label: 'Set type and RPE' },
        ]}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'longpress') onOpenOptions(id);
        }}
        style={[
          s.badge,
          set.setType === 'warmup' && { backgroundColor: t.colors.amberSoft },
        ]}
      >
        <AppText
          variant="label"
          style={{ color: badgeColor, fontWeight: '800', fontSize: 15 }}
        >
          {label}
        </AppText>
      </Pressable>
      <View style={s.prev}>
        <AppText
          variant="caption"
          color="ink3"
          numberOfLines={1}
          accessibilityLabel={`Previous: ${previousText(
            previous,
            tracking,
            unit,
          )}`}
        >
          {mode === 'edit' ? '' : previousText(previous, tracking, unit)}
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
      {mode === 'edit' ? (
        <Pressable
          onPress={() => onRemove?.(id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove set ${label}`}
          hitSlop={4}
          style={s.check}
        >
          <AppText
            style={{ color: t.colors.danger, fontSize: 18, fontWeight: '800' }}
          >
            ✕
          </AppText>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => onToggle(id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`${a11y} done`}
          hitSlop={4}
          style={[s.check, done && s.checkOn]}
        >
          <AppText
            style={{
              color: done ? t.colors.surface : t.colors.ink3,
              fontSize: 20,
              fontWeight: '800',
            }}
          >
            ✓
          </AppText>
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
  });
