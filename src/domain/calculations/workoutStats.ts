import type { Timestamp } from '../models/units';
import type { Workout, WorkoutDetail, WorkoutSet } from '../models/workout';
import { toKg } from './units';

export const isCompleted = (s: WorkoutSet): boolean => s.completedAt != null;

/** Warm-ups are excluded from volume and records; they are preparation, not work. */
export const isWorkingSet = (s: WorkoutSet): boolean => s.setType !== 'warmup';

/** Completed working set load in kg × reps; 0 when weight or reps are missing. */
export function setVolumeKg(s: WorkoutSet): number {
  if (!isCompleted(s) || !isWorkingSet(s)) return 0;
  if (s.weightValue == null || s.reps == null) return 0;
  return toKg(s.weightValue, s.weightUnit) * s.reps;
}

export function workoutVolumeKg(detail: WorkoutDetail): number {
  let v = 0;
  for (const e of detail.exercises) for (const s of e.sets) v += setVolumeKg(s);
  return v;
}

export function completedSetCount(detail: WorkoutDetail): number {
  let n = 0;
  for (const e of detail.exercises) for (const s of e.sets) if (isCompleted(s)) n++;
  return n;
}

/** Active training time: wall-clock minus paused time. A paused workout's clock is frozen. */
export function workoutDurationMs(
  w: Pick<Workout, 'startedAt' | 'endedAt' | 'pausedAt' | 'pausedDurationMs'>,
  now: Timestamp,
): number {
  const end = w.endedAt ?? w.pausedAt ?? now;
  return Math.max(0, end - w.startedAt - w.pausedDurationMs);
}

/** Monday 00:00 local time of the week containing `ts`. */
export function startOfWeek(ts: Timestamp): Timestamp {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
