import {
  completedSetCount,
  computePersonalRecords,
  diffRecords,
  workoutDurationMs,
  workoutVolumeKg,
  type RecordImprovement,
} from '../../domain/calculations';
import { DomainError } from '../../domain/errors';
import {
  SET_TYPES,
  type Exercise,
  type PersonalRecord,
  type RoutineTemplate,
  type Uuid,
  type WeightUnit,
  type Workout,
  type WorkoutDetail,
  type WorkoutExercise,
  type WorkoutSet,
} from '../../domain/models';
import { missingFieldsForCompletion, parseSetPatch } from '../../domain/validation';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock, IdGenerator } from '../ports/system';

export interface WorkoutServiceDeps {
  repos: Repositories;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

export interface PlannedExercise {
  exerciseId: Uuid;
  targetSets: number;
  targetReps: number | null;
  restSeconds?: number | null;
}

export interface WorkoutSummary {
  detail: WorkoutDetail;
  durationMs: number;
  volumeKg: number;
  completedSets: number;
  /** Empty when `complete` is called again for an already completed workout. */
  improvements: Array<RecordImprovement & { exerciseName: string }>;
  alreadyCompleted: boolean;
}

const DEFAULT_SETS = 3;

/**
 * Workout lifecycle use cases. Every change is written to SQLite before the
 * promise resolves, so an app kill loses at most the edit in flight.
 */
export class WorkoutService {
  constructor(private readonly d: WorkoutServiceDeps) {}

  private get repos() {
    return this.d.repos;
  }
  private now() {
    return this.d.clock.now();
  }

  /* ----------------------------- queries ----------------------------- */

  async getActiveDetail(): Promise<WorkoutDetail | null> {
    const w = await this.repos.workouts.getActive();
    return w ? this.repos.workouts.getDetail(w.id) : null;
  }

  getDetail(id: Uuid): Promise<WorkoutDetail | null> {
    return this.repos.workouts.getDetail(id);
  }

  /** Completed sets from the latest earlier workout, per exercise, for the "Previous" column. */
  async previousSets(exerciseIds: readonly Uuid[], excludeWorkoutId?: Uuid): Promise<Record<Uuid, WorkoutSet[]>> {
    const out: Record<Uuid, WorkoutSet[]> = {};
    for (const id of new Set(exerciseIds)) {
      out[id] = await this.repos.workouts.lastCompletedSets(id, excludeWorkoutId);
    }
    return out;
  }

  /* ------------------------------ start ------------------------------ */

  startEmpty(unit: WeightUnit, name = 'Workout'): Promise<WorkoutDetail> {
    return this.start(name, null, [], unit);
  }

  startFromTemplate(t: RoutineTemplate, unit: WeightUnit): Promise<WorkoutDetail> {
    return this.start(t.name, null, t.exercises, unit);
  }

  async startFromRoutine(routineId: Uuid, unit: WeightUnit): Promise<WorkoutDetail> {
    const r = await this.repos.routines.getDetail(routineId);
    if (!r) throw new DomainError('NOT_FOUND', 'Routine not found');
    return this.start(r.routine.name, r.routine.id, r.exercises, unit);
  }

  private async start(
    name: string,
    routineId: Uuid | null,
    plan: readonly PlannedExercise[],
    unit: WeightUnit,
  ): Promise<WorkoutDetail> {
    const id = await this.d.uow.run(async r => {
      if (await r.workouts.getActive()) {
        throw new DomainError('ACTIVE_WORKOUT_EXISTS', 'Finish or discard the current workout first');
      }
      const now = this.now();
      const w: Workout = {
        id: this.d.ids.next(),
        name: name.trim().slice(0, 80) || 'Workout',
        routineId,
        status: 'in_progress',
        startedAt: now,
        endedAt: null,
        pausedAt: null,
        pausedDurationMs: 0,
        notes: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await r.workouts.insertWorkout(w);
      for (let i = 0; i < plan.length; i++) {
        await this.insertExercise(r, w.id, i, plan[i], unit);
      }
      return w.id;
    });
    return (await this.repos.workouts.getDetail(id))!;
  }

  /**
   * Prefills sets from the last time this exercise was done (working sets only),
   * so the lifter sees and adjusts real numbers instead of typing from scratch.
   */
  private async insertExercise(
    r: Repositories,
    workoutId: Uuid,
    position: number,
    plan: PlannedExercise,
    unit: WeightUnit,
  ): Promise<WorkoutExercise> {
    const exercise = await r.exercises.getById(plan.exerciseId);
    if (!exercise || exercise.deletedAt != null) throw new DomainError('NOT_FOUND', 'Exercise not found');
    const now = this.now();
    const we: WorkoutExercise = {
      id: this.d.ids.next(),
      workoutId,
      exerciseId: exercise.id,
      position,
      notes: null,
      restSeconds: plan.restSeconds ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await r.workouts.insertWorkoutExercise(we);

    const prev = (await r.workouts.lastCompletedSets(exercise.id, workoutId)).filter(s => s.setType !== 'warmup');
    const count = Math.max(1, plan.targetSets || prev.length || DEFAULT_SETS);
    for (let i = 0; i < count; i++) {
      const p = prev[Math.min(i, prev.length - 1)];
      await r.workouts.insertSet(
        this.newSet(we.id, i, exercise, unit, p ?? null, plan.targetReps),
      );
    }
    return we;
  }

  private newSet(
    weId: Uuid,
    position: number,
    exercise: Exercise,
    unit: WeightUnit,
    from: WorkoutSet | null,
    targetReps: number | null,
  ): WorkoutSet {
    const now = this.now();
    const t = exercise.trackingType;
    return {
      id: this.d.ids.next(),
      workoutExerciseId: weId,
      position,
      setType: 'normal',
      weightValue: t === 'weight_reps' || t === 'bodyweight_reps' ? from?.weightValue ?? null : null,
      weightUnit: from?.weightUnit ?? unit,
      reps: t === 'weight_reps' || t === 'bodyweight_reps' ? from?.reps ?? targetReps : null,
      durationSeconds: t === 'duration' || t === 'distance_duration' ? from?.durationSeconds ?? null : null,
      distanceValue: t === 'distance_duration' ? from?.distanceValue ?? null : null,
      distanceUnit: t === 'distance_duration' ? from?.distanceUnit ?? (unit === 'lb' ? 'mi' : 'km') : null,
      rpe: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /* --------------------------- exercises ----------------------------- */

  async addExercise(workoutId: Uuid, exerciseId: Uuid, unit: WeightUnit): Promise<WorkoutDetail> {
    await this.d.uow.run(async r => {
      await this.requireActive(r, workoutId);
      const existing = await r.workouts.listWorkoutExercises(workoutId);
      const position = existing.reduce((m, e) => Math.max(m, e.position + 1), 0);
      await this.insertExercise(r, workoutId, position, { exerciseId, targetSets: 0, targetReps: null }, unit);
    });
    return (await this.repos.workouts.getDetail(workoutId))!;
  }

  async removeExercise(workoutExerciseId: Uuid): Promise<void> {
    await this.d.uow.run(async r => {
      const we = await this.requireWorkoutExercise(r, workoutExerciseId);
      await this.requireActive(r, we.workoutId);
      await r.workouts.deleteWorkoutExercise(we.id);
    });
  }

  async moveExercise(workoutExerciseId: Uuid, direction: -1 | 1): Promise<void> {
    await this.d.uow.run(async r => {
      const we = await this.requireWorkoutExercise(r, workoutExerciseId);
      await this.requireActive(r, we.workoutId);
      const ids = (await r.workouts.listWorkoutExercises(we.workoutId)).map(x => x.id);
      const i = ids.indexOf(we.id);
      const j = i + direction;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await r.workouts.reorderWorkoutExercises(we.workoutId, ids, this.now());
    });
  }

  async updateExerciseNotes(workoutExerciseId: Uuid, notes: string): Promise<void> {
    await this.d.uow.run(async r => {
      const we = await this.requireWorkoutExercise(r, workoutExerciseId);
      await this.requireActive(r, we.workoutId);
      await r.workouts.updateWorkoutExercise(we.id, { notes: notes.trim() ? notes.slice(0, 1000) : null }, this.now());
    });
  }

  /* ------------------------------ sets ------------------------------- */

  /** Copies the last set's values; that is what lifters want for the next set almost every time. */
  async addSet(workoutExerciseId: Uuid, unit: WeightUnit): Promise<WorkoutSet> {
    return this.d.uow.run(async r => {
      const we = await this.requireWorkoutExercise(r, workoutExerciseId);
      await this.requireActive(r, we.workoutId);
      const exercise = (await r.exercises.getById(we.exerciseId))!;
      const sets = await r.workouts.listSets(we.id);
      const last = sets[sets.length - 1] ?? null;
      const position = sets.reduce((m, s) => Math.max(m, s.position + 1), 0);
      const s = this.newSet(we.id, position, exercise, unit, last, null);
      await r.workouts.insertSet(s);
      return s;
    });
  }

  async updateSet(setId: Uuid, patch: unknown): Promise<WorkoutSet> {
    const p = parseSetPatch(patch);
    return this.d.uow.run(async r => {
      const { set } = await this.requireActiveSet(r, setId);
      const next: WorkoutSet = { ...set, ...p, updatedAt: this.now() };
      if (next.distanceValue != null && next.distanceUnit == null) next.distanceUnit = 'km';
      await r.workouts.updateSet(next);
      return next;
    });
  }

  async setCompleted(setId: Uuid, completed: boolean): Promise<WorkoutSet> {
    return this.d.uow.run(async r => {
      const { set, exercise } = await this.requireActiveSet(r, setId);
      if (completed === (set.completedAt != null)) return set;
      if (completed) {
        const missing = missingFieldsForCompletion(set, exercise.trackingType);
        if (missing.length) {
          throw new DomainError('SET_INCOMPLETE', `Enter ${missing.join(' and ')} first`, { missing });
        }
      }
      const now = this.now();
      const next: WorkoutSet = { ...set, completedAt: completed ? now : null, updatedAt: now };
      await r.workouts.updateSet(next);
      return next;
    });
  }

  async cycleSetType(setId: Uuid): Promise<WorkoutSet> {
    return this.d.uow.run(async r => {
      const { set } = await this.requireActiveSet(r, setId);
      const setType = SET_TYPES[(SET_TYPES.indexOf(set.setType) + 1) % SET_TYPES.length];
      const next: WorkoutSet = { ...set, setType, updatedAt: this.now() };
      await r.workouts.updateSet(next);
      return next;
    });
  }

  async removeSet(setId: Uuid): Promise<void> {
    await this.d.uow.run(async r => {
      const { set } = await this.requireActiveSet(r, setId);
      await r.workouts.deleteSet(set.id);
    });
  }

  /* ---------------------------- lifecycle ---------------------------- */

  async rename(workoutId: Uuid, name: string): Promise<void> {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) throw new DomainError('VALIDATION', 'Give the workout a name');
    await this.d.uow.run(async r => {
      await this.requireActive(r, workoutId);
      await r.workouts.updateWorkout(workoutId, { name: trimmed }, this.now());
    });
  }

  async updateNotes(workoutId: Uuid, notes: string): Promise<void> {
    await this.d.uow.run(async r => {
      await this.requireActive(r, workoutId);
      await r.workouts.updateWorkout(workoutId, { notes: notes.trim() ? notes.slice(0, 2000) : null }, this.now());
    });
  }

  async pause(workoutId: Uuid): Promise<void> {
    await this.d.uow.run(async r => {
      const w = await this.requireActive(r, workoutId);
      if (w.pausedAt != null) return;
      await r.workouts.updateWorkout(w.id, { pausedAt: this.now() }, this.now());
    });
  }

  async resume(workoutId: Uuid): Promise<void> {
    await this.d.uow.run(async r => {
      const w = await this.requireActive(r, workoutId);
      if (w.pausedAt == null) return;
      const now = this.now();
      await r.workouts.updateWorkout(
        w.id,
        { pausedAt: null, pausedDurationMs: w.pausedDurationMs + Math.max(0, now - w.pausedAt) },
        now,
      );
    });
  }

  /**
   * Idempotent: a second call (double tap, retry after a crash) returns the
   * summary of the already-completed workout instead of failing or duplicating.
   */
  async complete(workoutId: Uuid): Promise<WorkoutSummary> {
    return this.d.uow.run(async r => {
      const w = await r.workouts.getById(workoutId);
      if (!w || w.deletedAt != null) throw new DomainError('NOT_FOUND', 'Workout not found');

      let improvements: WorkoutSummary['improvements'] = [];
      const alreadyCompleted = w.status === 'completed';
      if (!alreadyCompleted) {
        const before = await r.workouts.getDetail(workoutId);
        if (!before || completedSetCount(before) === 0) {
          throw new DomainError('NO_COMPLETED_SETS', 'Check off at least one set to finish');
        }
        await r.workouts.pruneIncomplete(workoutId);
        await r.workouts.markCompleted(workoutId, this.now());
        const exerciseIds = await r.workouts.exerciseIdsInWorkout(workoutId);
        const prevRecords = await r.records.listForExercises(exerciseIds);
        const nextRecords = await this.recomputeRecords(r, exerciseIds);
        const names = new Map(before.exercises.map(e => [e.exerciseId, e.exercise.name]));
        improvements = diffRecords(prevRecords, nextRecords)
          .filter(i => nextRecords.some(n => n.recordType === i.recordType && n.exerciseId === i.exerciseId && n.workoutId === workoutId))
          .map(i => ({ ...i, exerciseName: names.get(i.exerciseId) ?? '' }));
        await r.backupState.bumpLocalRevision();
      }
      const detail = (await r.workouts.getDetail(workoutId))!;
      return {
        detail,
        durationMs: workoutDurationMs(detail.workout, this.now()),
        volumeKg: workoutVolumeKg(detail),
        completedSets: completedSetCount(detail),
        improvements,
        alreadyCompleted,
      };
    });
  }

  /** Throws away an in-progress workout. Never applies to completed history. */
  async discard(workoutId: Uuid): Promise<void> {
    await this.d.uow.run(async r => {
      await this.requireActive(r, workoutId);
      await r.workouts.hardDelete(workoutId);
    });
  }

  /** Tombstones a completed workout so the deletion reaches the backup, and rebuilds affected records. */
  async deleteCompleted(workoutId: Uuid): Promise<void> {
    await this.d.uow.run(async r => {
      const w = await r.workouts.getById(workoutId);
      if (!w || w.deletedAt != null) return;
      if (w.status !== 'completed') throw new DomainError('WORKOUT_NOT_ACTIVE', 'Use discard for an active workout');
      const exerciseIds = await r.workouts.exerciseIdsInWorkout(workoutId);
      await r.workouts.softDelete(workoutId, this.now());
      await this.recomputeRecords(r, exerciseIds);
      await r.backupState.bumpLocalRevision();
    });
  }

  /* ----------------------------- helpers ----------------------------- */

  private async recomputeRecords(r: Repositories, exerciseIds: readonly Uuid[]): Promise<PersonalRecord[]> {
    const all: PersonalRecord[] = [];
    for (const id of exerciseIds) {
      const recs = computePersonalRecords(id, await r.workouts.completedSetsForExercise(id));
      await r.records.replaceForExercise(id, recs, this.now());
      all.push(...recs);
    }
    return all;
  }

  private async requireActive(r: Repositories, workoutId: Uuid): Promise<Workout> {
    const w = await r.workouts.getById(workoutId);
    if (!w || w.deletedAt != null) throw new DomainError('NOT_FOUND', 'Workout not found');
    if (w.status !== 'in_progress') throw new DomainError('WORKOUT_NOT_ACTIVE', 'This workout is already finished');
    return w;
  }

  private async requireWorkoutExercise(r: Repositories, id: Uuid): Promise<WorkoutExercise> {
    const we = await r.workouts.getWorkoutExercise(id);
    if (!we) throw new DomainError('NOT_FOUND', 'Exercise not found in workout');
    return we;
  }

  private async requireActiveSet(r: Repositories, setId: Uuid): Promise<{ set: WorkoutSet; exercise: Exercise }> {
    const set = await r.workouts.getSet(setId);
    if (!set) throw new DomainError('NOT_FOUND', 'Set not found');
    const we = await this.requireWorkoutExercise(r, set.workoutExerciseId);
    await this.requireActive(r, we.workoutId);
    const exercise = await r.exercises.getById(we.exerciseId);
    if (!exercise) throw new DomainError('NOT_FOUND', 'Exercise not found');
    return { set, exercise };
  }
}

