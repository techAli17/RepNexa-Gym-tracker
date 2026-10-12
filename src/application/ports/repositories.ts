import type {
  PlanDayRecord,
  WeekPlanRecord,
  Weekday,
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
import type { BackupData } from '../../domain/backup/format';
import type { MergeChanges } from '../../domain/backup/merge';

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
  /** Updates a custom exercise's editable fields. Built-ins are never changed this way. */
  updateCustom(exercise: Exercise): Promise<void>;
  /** Inserts or refreshes bundled exercises without touching custom ones. */
  upsertBuiltIns(exercises: readonly Exercise[]): Promise<void>;
  softDelete(id: Uuid, at: Timestamp): Promise<void>;
}

export interface WorkoutListQuery {
  limit: number;
  /** Cursor: return workouts that started strictly before this time. */
  startedBefore?: Timestamp;
  /** Date filter: only workouts that started at or after this time. */
  startedAfter?: Timestamp;
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
  /** Bumps updated_at so a backup merge sees the workout as changed. */
  touch(id: Uuid, at: Timestamp): Promise<void>;
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
  /** Swaps the exercise of a workout entry (substitution). Caller replaces its sets. */
  setWorkoutExerciseExercise(id: Uuid, exerciseId: Uuid, at: Timestamp): Promise<void>;
  /** How often and how recently each exercise appears in completed, non-deleted workouts. */
  exerciseUsage(): Promise<ExerciseUsage[]>;
}

export interface ExerciseUsage {
  exerciseId: Uuid;
  workoutCount: number;
  lastPerformedAt: Timestamp;
}

export interface RoutineRepository {
  listActive(): Promise<Routine[]>;
  getDetail(id: Uuid): Promise<RoutineDetail | null>;
  /** Replaces the routine and its exercise list. */
  save(routine: Routine, exercises: readonly RoutineExercise[]): Promise<void>;
  softDelete(id: Uuid, at: Timestamp): Promise<void>;
  /** Rewrites routine positions 0..n-1 in the given order. */
  setPositions(orderedIds: readonly Uuid[], at: Timestamp): Promise<void>;
}

export interface PersonalRecordRepository {
  listForExercises(exerciseIds: readonly Uuid[]): Promise<PersonalRecord[]>;
  replaceForExercise(exerciseId: Uuid, records: readonly PersonalRecord[], at: Timestamp): Promise<void>;
  countForWorkout(workoutId: Uuid): Promise<number>;
  listAll(): Promise<PersonalRecord[]>;
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

export interface SyncState extends BackupState {
  lastAttemptAt: Timestamp | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  accountId: string | null;
  remoteFileId: string | null;
  /** Drive file `version` after our last verified upload. A different value means someone else wrote it. */
  remoteVersion: string | null;
  /** Local time the last verified snapshot was taken. */
  snapshotAt: Timestamp | null;
}

export interface SyncSuccess {
  revision: number;
  at: Timestamp;
  snapshotAt: Timestamp;
  accountId: string;
  remoteFileId: string;
  remoteVersion: string;
}

/** Snapshot export and transactional apply for backups, plus sync bookkeeping. */
export interface BackupDataRepository {
  /** Finished workouts (with tombstones), routines, custom and referenced exercises. Preferences excluded. */
  exportData(): Promise<Omit<BackupData, 'preferences'>>;
  /** Replaces each given aggregate wholesale. Returns the exercise ids whose records must be rebuilt. */
  applyChanges(changes: MergeChanges): Promise<Uuid[]>;
  prunedIds(): Promise<Set<Uuid>>;
  /** Finished, live workouts that started before `startedBefore` and were not changed after `unchangedSince`. */
  pruneCandidates(startedBefore: Timestamp, unchangedSince: Timestamp): Promise<Array<{ id: Uuid; startedAt: Timestamp }>>;
  /** Removes workouts from this phone only, remembering them as pruned (not deleted). */
  prune(workouts: ReadonlyArray<{ id: Uuid; startedAt: Timestamp }>, at: Timestamp): Promise<void>;
  getSyncState(): Promise<SyncState>;
  recordSuccess(s: SyncSuccess): Promise<void>;
  recordFailure(code: string, message: string, at: Timestamp): Promise<void>;
  /** Forgets the remote file (deleted in Drive, or account changed). */
  clearRemote(): Promise<void>;
}

export interface PlanRepository {
  get(): Promise<WeekPlanRecord>;
  setWeekStart(weekStart: Weekday, at: Timestamp): Promise<void>;
  /** Writes one day; `null` routine with isRest false keeps the day as "not planned". */
  putDay(day: PlanDayRecord): Promise<void>;
  /** Replaces the whole plan (restore from backup). */
  replace(plan: WeekPlanRecord): Promise<void>;
}

export interface Repositories {
  exercises: ExerciseRepository;
  workouts: WorkoutRepository;
  routines: RoutineRepository;
  records: PersonalRecordRepository;
  settings: SettingsRepository;
  backupState: BackupStateRepository;
  backupData: BackupDataRepository;
  plan: PlanRepository;
}

/** Runs `fn` against repositories bound to one database transaction. */
export interface UnitOfWork {
  run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
}
