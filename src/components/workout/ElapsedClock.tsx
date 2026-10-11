import React from 'react';
import type { TextStyle } from 'react-native';
import { workoutDurationMs } from '../../domain/calculations';
import type { Workout } from '../../domain/models';
import { useNow } from '../../hooks/useNow';
import { formatClock } from '../../utils/format';
import { AppText, type AppTextProps } from '../common/AppText';

/** Re-renders itself once a second; parents stay still. Freezes while paused. */
export function ElapsedClock({ workout, style, color }: { workout: Workout; style?: TextStyle; color?: AppTextProps['color'] }) {
  const now = useNow(1000, workout.pausedAt == null && workout.endedAt == null);
  return (
    <AppText variant="number" color={color} style={style} accessibilityRole="timer">
      {formatClock(workoutDurationMs(workout, now))}
    </AppText>
  );
}
