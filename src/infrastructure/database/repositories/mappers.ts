import type {
  DistanceUnit,
  Equipment,
  Exercise,
  MuscleGroup,
  PersonalRecord,
  RecordType,
  Routine,
  RoutineExercise,
  SetType,
  TrackingType,
  WeightUnit,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutStatus,
} from '../../../domain/models';
import type { SqlRow } from '../SqlDatabase';

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v));
const jsonArray = (v: unknown): string[] => {
  try {
    const a = JSON.parse(String(v ?? '[]'));
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
};

export const EXERCISE_COLS =
  'id, name, muscle_group, equipment, tracking_type, primary_muscles, secondary_muscles, instructions, image_key, is_custom, created_at, updated_at, deleted_at';

export const rowToExercise = (r: SqlRow): Exercise => ({
  id: String(r.id),
  name: String(r.name),
  muscleGroup: r.muscle_group as MuscleGroup,
  equipment: r.equipment as Equipment,
  trackingType: r.tracking_type as TrackingType,
  primaryMuscles: jsonArray(r.primary_muscles),
  secondaryMuscles: jsonArray(r.secondary_muscles),
  instructions: strOrNull(r.instructions),
  imageKey: strOrNull(r.image_key),
  isCustom: num(r.is_custom) === 1,
  createdAt: num(r.created_at),
  updatedAt: num(r.updated_at),
  deletedAt: numOrNull(r.deleted_at),
});

export const exerciseParams = (e: Exercise) => [
  e.id,
  e.name,
  e.muscleGroup,
  e.equipment,
  e.trackingType,
  JSON.stringify(e.primaryMuscles),
  JSON.stringify(e.secondaryMuscles),
  e.instructions,
  e.imageKey,
  e.isCustom ? 1 : 0,
  e.createdAt,
  e.updatedAt,
  e.deletedAt,
];

export const WORKOUT_COLS =
  'id, name, routine_id, status, started_at, ended_at, paused_at, paused_duration_ms, notes, created_at, updated_at, deleted_at';

export const rowToWorkout = (r: SqlRow): Workout => ({
  id: String(r.id),
  name: String(r.name),
  routineId: strOrNull(r.routine_id),
  status: r.status as WorkoutStatus,
  startedAt: num(r.started_at),
  endedAt: numOrNull(r.ended_at),
  pausedAt: numOrNull(r.paused_at),
  pausedDurationMs: num(r.paused_duration_ms),
  notes: strOrNull(r.notes),
  createdAt: num(r.created_at),
  updatedAt: num(r.updated_at),
  deletedAt: numOrNull(r.deleted_at),
});

export const WE_COLS =
  'id, workout_id, exercise_id, position, notes, rest_seconds, created_at, updated_at';

export const rowToWorkoutExercise = (r: SqlRow): WorkoutExercise => ({
  id: String(r.id),
  workoutId: String(r.workout_id),
  exerciseId: String(r.exercise_id),
  position: num(r.position),
  notes: strOrNull(r.notes),
  restSeconds: numOrNull(r.rest_seconds),
  createdAt: num(r.created_at),
  updatedAt: num(r.updated_at),
});

export const SET_COLS =
  'id, workout_exercise_id, position, set_type, weight_value, weight_unit, reps, duration_seconds, distance_value, distance_unit, rpe, completed_at, created_at, updated_at';

/** Same columns, qualified with alias `s.` for joins. */
export const SET_COLS_S = SET_COLS.split(', ')
  .map(c => `s.${c}`)
  .join(', ');

export const rowToSet = (r: SqlRow): WorkoutSet => ({
  id: String(r.id),
  workoutExerciseId: String(r.workout_exercise_id),
  position: num(r.position),
  setType: r.set_type as SetType,
  weightValue: numOrNull(r.weight_value),
  weightUnit: r.weight_unit as WeightUnit,
  reps: numOrNull(r.reps),
  durationSeconds: numOrNull(r.duration_seconds),
  distanceValue: numOrNull(r.distance_value),
  distanceUnit: (r.distance_unit as DistanceUnit | null) ?? null,
  rpe: numOrNull(r.rpe),
  completedAt: numOrNull(r.completed_at),
  createdAt: num(r.created_at),
  updatedAt: num(r.updated_at),
});

export const setParams = (s: WorkoutSet) => [
  s.id,
  s.workoutExerciseId,
  s.position,
  s.setType,
  s.weightValue,
  s.weightUnit,
  s.reps,
  s.durationSeconds,
  s.distanceValue,
  s.distanceUnit,
  s.rpe,
  s.completedAt,
  s.createdAt,
  s.updatedAt,
];

export const rowToRoutine = (r: SqlRow): Routine => ({
  id: String(r.id),
  name: String(r.name),
  notes: strOrNull(r.notes),
  position: num(r.position),
  createdAt: num(r.created_at),
  updatedAt: num(r.updated_at),
  deletedAt: numOrNull(r.deleted_at),
});

export const rowToRoutineExercise = (r: SqlRow): RoutineExercise => ({
  id: String(r.id),
  routineId: String(r.routine_id),
  exerciseId: String(r.exercise_id),
  position: num(r.position),
  targetSets: num(r.target_sets),
  targetReps: numOrNull(r.target_reps),
  restSeconds: numOrNull(r.rest_seconds),
  notes: strOrNull(r.notes),
});

export const rowToRecord = (r: SqlRow): PersonalRecord => ({
  exerciseId: String(r.exercise_id),
  recordType: r.record_type as RecordType,
  value: num(r.value),
  workoutId: String(r.workout_id),
  setId: String(r.set_id),
  achievedAt: num(r.achieved_at),
});

export const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');
