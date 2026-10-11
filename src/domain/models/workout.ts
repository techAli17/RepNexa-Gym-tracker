import type { Exercise } from './exercise';
import type { DistanceUnit, Timestamp, Uuid, WeightUnit } from './units';

export type WorkoutStatus = 'in_progress' | 'completed';

export interface Workout {
  id: Uuid;
  name: string;
  routineId: Uuid | null;
  status: WorkoutStatus;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  /** Set while the workout is paused; cleared on resume. */
  pausedAt: Timestamp | null;
  /** Total time spent paused, excluded from the workout duration. */
  pausedDurationMs: number;
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface WorkoutExercise {
  id: Uuid;
  workoutId: Uuid;
  exerciseId: Uuid;
  position: number;
  notes: string | null;
  restSeconds: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

/**
 * Weight and distance keep the value and unit exactly as entered, so a 225 lb
 * set never drifts to 224.99 after a round trip through kilograms.
 */
export interface WorkoutSet {
  id: Uuid;
  workoutExerciseId: Uuid;
  position: number;
  setType: SetType;
  weightValue: number | null;
  weightUnit: WeightUnit;
  reps: number | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: DistanceUnit | null;
  rpe: number | null;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkoutExerciseDetail extends WorkoutExercise {
  exercise: Exercise;
  sets: WorkoutSet[];
}

export interface WorkoutDetail {
  workout: Workout;
  exercises: WorkoutExerciseDetail[];
}

/** Row shape for history lists; avoids loading every set. */
export interface WorkoutListItem {
  workout: Workout;
  exerciseCount: number;
  completedSetCount: number;
  volumeKg: number;
  recordCount: number;
}
