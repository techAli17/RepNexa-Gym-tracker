import type {
  Exercise,
  PersonalRecord,
  Routine,
  RoutineDetail,
  RoutineExercise,
  Timestamp,
  Uuid,
  Workout,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutListItem,
  WorkoutSet,
} from '../../domain/models';
import type { SetWithContext } from '../../domain/calculations';

/**
 * Persistence ports. The application layer depends only on these; SQLite
 * implementations live in infrastructure/database. Every method is a single
 * statement or is internally atomic; multi-step use cases wrap calls in
 * `UnitOfWork.run` so they commit or roll back together.
 */

export interface ExerciseRepository {
  listActive(): Promise<Exercise[]>;
  getById(id: Uuid): Promise<Exercise | null>;
  getByIds(ids: readonly Uuid[]): Promise<Exercise[]>;
  findCustomByName(name: string): Promise<Exercise | null>;
  insert(exercise: Exercise): Promise<void>;
  /** Inserts or refreshes bundled exercises without touching custom ones. */
  upsertBuiltIns(exercises: readonly Exercise[]): Promise<void>;
  softDelete(id: Uuid, at: Timestamp): Promise<void>;
}

export interface WorkoutListQuery {
  limit: number;
  /** Cursor: return workouts that started strictly before this time. */
  startedBefore?: Timestamp;
  exerciseId?: Uuid;
}

export interface WorkoutRepository {
  getActive(): Promise<Workout | null>;
  getById(id: Uuid): Promise<Workout | null>;
  getDetail(id: Uuid): Promise<WorkoutDetail | null>;
  listCompleted(query: WorkoutListQuery): Promise<WorkoutListItem[]>;
  countCompletedSince(since: Timestamp): Promise<number>;

  insertWorkout(workout: Workout): Promise<void>;
  updateWorkout(
    id: Uuid,
    patch: Partial<Pick<Workout, 'name' | 'notes' | 'pausedAt' | 'pausedDurationMs'>>,
    updatedAt: Timestamp,
  ): Promise<void>;
  /** Transitions in_progress → completed. Returns false if it was not in progress (idempotency guard). */
  markCompleted(id: Uuid, endedAt: Timestamp): Promise<boolean>;
  /** Permanent delete, for discarded in-progress workouts that were never backed up. */
  hardDelete(id: Uuid): Promise<void>;
  /** Tombstone, so the deletion can propagate to backups. */
  softDelete(id: Uuid, at: Timestamp): Promise<void>;

  getWorkoutExercise(id: Uuid): Promise<WorkoutExercise | null>;
  listWorkoutExercises(workoutId: Uuid): Promise<WorkoutExercise[]>;
  insertWorkoutExercise(we: WorkoutExercise): Promise<void>;
  updateWorkoutExercise(
    id: Uuid,
    patch: Partial<Pick<WorkoutExercise, 'notes' | 'restSeconds'>>,
    updatedAt: Timestamp,
  ): Promise<void>;
  deleteWorkoutExercise(id: Uuid): Promise<void>;
  /** Rewrites positions 0..n-1 in the given order. */
  reorderWorkoutExercises(workoutId: Uuid, orderedIds: readonly Uuid[], at: Timestamp): Promise<void>;

  getSet(id: Uuid): Promise<WorkoutSet | null>;
  listSets(workoutExerciseId: Uuid): Promise<WorkoutSet[]>;
  insertSet(set: WorkoutSet): Promise<void>;
  updateSet(set: WorkoutSet): Promise<void>;
  deleteSet(id: Uuid): Promise<void>;
  /** Drops unchecked sets, then exercises left with no sets. Used when finishing. */
  pruneIncomplete(workoutId: Uuid): Promise<void>;

  /** Sets from the most recent completed workout that included this exercise. */
  lastCompletedSets(exerciseId: Uuid, excludeWorkoutId?: Uuid): Promise<WorkoutSet[]>;
  /** Every completed set of an exercise in non-deleted, completed workouts. */
  completedSetsForExercise(exerciseId: Uuid): Promise<SetWithContext[]>;
  exerciseIdsInWorkout(workoutId: Uuid): Promise<Uuid[]>;
}

export interface RoutineRepository {
  listActive(): Promise<Routine[]>;
  getDetail(id: Uuid): Promise<RoutineDetail | null>;
  /** Replaces the routine and its exercise list. */
  save(routine: Routine, exercises: readonly RoutineExercise[]): Promise<void>;
  softDelete(id: Uuid, at: Timestamp): Promise<void>;
}

export interface PersonalRecordRepository {
  listForExercises(exerciseIds: readonly Uuid[]): Promise<PersonalRecord[]>;
  replaceForExercise(exerciseId: Uuid, records: readonly PersonalRecord[], at: Timestamp): Promise<void>;
  countForWorkout(workoutId: Uuid): Promise<number>;
}

export interface SettingsRepository {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, at: Timestamp): Promise<void>;
}

export interface BackupState {
  /** Incremented on every change that must reach the backup. */
  localRevision: number;
  /** Highest local revision confirmed in a verified Drive upload. */
  backedUpRevision: number;
  lastSuccessAt: Timestamp | null;
}

export interface BackupStateRepository {
  get(): Promise<BackupState>;
  bumpLocalRevision(): Promise<number>;
}

export interface Repositories {
  exercises: ExerciseRepository;
  workouts: WorkoutRepository;
  routines: RoutineRepository;
  records: PersonalRecordRepository;
  settings: SettingsRepository;
  backupState: BackupStateRepository;
}

/** Runs `fn` against repositories bound to one database transaction. */
export interface UnitOfWork {
  run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
}
