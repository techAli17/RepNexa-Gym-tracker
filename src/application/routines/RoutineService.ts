import { DomainError } from '../../domain/errors';
import type { Exercise, Routine, RoutineDetail, RoutineExercise, RoutineTemplate, Uuid } from '../../domain/models';
import { parseRoutineInput, type RoutineValues } from '../../domain/validation/routineInput';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock, IdGenerator } from '../ports/system';

export interface RoutineSummary {
  routine: Routine;
  exerciseNames: string[];
  totalSets: number;
}

export interface RoutineView {
  detail: RoutineDetail;
  exercises: Record<Uuid, Exercise>;
}

/** Saved routines: create, edit, duplicate, reorder, delete. Deletes are tombstones for the backup. */
export class RoutineService {
  constructor(private readonly d: { repos: Repositories; uow: UnitOfWork; clock: Clock; ids: IdGenerator }) {}

  async list(): Promise<RoutineSummary[]> {
    const routines = await this.d.repos.routines.listActive();
    const out: RoutineSummary[] = [];
    for (const routine of routines) {
      const detail = await this.d.repos.routines.getDetail(routine.id);
      if (!detail) continue;
      const exercises = await this.d.repos.exercises.getByIds(detail.exercises.map(e => e.exerciseId));
      const names = new Map(exercises.map(e => [e.id, e.name]));
      out.push({
        routine,
        exerciseNames: detail.exercises.map(e => names.get(e.exerciseId) ?? 'Unknown exercise'),
        totalSets: detail.exercises.reduce((n, e) => n + e.targetSets, 0),
      });
    }
    return out;
  }

  async get(id: Uuid): Promise<RoutineView | null> {
    const detail = await this.d.repos.routines.getDetail(id);
    if (!detail) return null;
    const exercises = await this.d.repos.exercises.getByIds(detail.exercises.map(e => e.exerciseId));
    return { detail, exercises: Object.fromEntries(exercises.map(e => [e.id, e])) };
  }

  /** async so validation errors arrive as rejections, like every other failure. */
  async create(input: unknown): Promise<Routine> {
    return this.save(null, parseRoutineInput(input));
  }

  async update(id: Uuid, input: unknown): Promise<Routine> {
    return this.save(id, parseRoutineInput(input));
  }

  async duplicate(id: Uuid): Promise<Routine> {
    const src = await this.d.repos.routines.getDetail(id);
    if (!src) throw new DomainError('NOT_FOUND', 'Routine not found');
    const name = `${src.routine.name} (copy)`.slice(0, 80);
    return this.save(null, {
      name,
      notes: src.routine.notes,
      exercises: src.exercises.map(e => ({
        exerciseId: e.exerciseId,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSeconds: e.restSeconds,
        notes: e.notes,
      })),
    });
  }

  createFromTemplate(t: RoutineTemplate): Promise<Routine> {
    return this.create({
      name: t.name,
      notes: t.description,
      exercises: t.exercises.map(e => ({ ...e, restSeconds: null })),
    });
  }

  /** "Save as routine" after a workout: one entry per exercise, counting its working sets. */
  async createFromWorkout(workoutId: Uuid, name?: string): Promise<Routine> {
    const detail = await this.d.repos.workouts.getDetail(workoutId);
    if (!detail) throw new DomainError('NOT_FOUND', 'Workout not found');
    return this.create({
      name: (name ?? detail.workout.name).trim() || 'Routine',
      notes: null,
      exercises: detail.exercises.map(e => {
        const working = e.sets.filter(s => s.setType !== 'warmup');
        return {
          exerciseId: e.exerciseId,
          targetSets: Math.min(20, Math.max(1, working.length)),
          targetReps: working[0]?.reps && working[0].reps > 0 ? working[0].reps : null,
          restSeconds: e.restSeconds,
        };
      }),
    });
  }

  async remove(id: Uuid): Promise<void> {
    await this.d.uow.run(async r => {
      await r.routines.softDelete(id, this.d.clock.now());
      await r.backupState.bumpLocalRevision();
    });
  }

  async reorder(orderedIds: readonly Uuid[]): Promise<void> {
    await this.d.uow.run(async r => {
      await r.routines.setPositions(orderedIds, this.d.clock.now());
      await r.backupState.bumpLocalRevision();
    });
  }

  private async save(id: Uuid | null, v: RoutineValues): Promise<Routine> {
    return this.d.uow.run(async r => {
      const found = await r.exercises.getByIds(v.exercises.map(e => e.exerciseId));
      const ok = new Set(found.filter(e => e.deletedAt == null).map(e => e.id));
      const missing = v.exercises.find(e => !ok.has(e.exerciseId));
      if (missing) throw new DomainError('NOT_FOUND', 'One of the exercises no longer exists');

      const now = this.d.clock.now();
      let routine: Routine;
      if (id) {
        const existing = await r.routines.getDetail(id);
        if (!existing) throw new DomainError('NOT_FOUND', 'Routine not found');
        routine = { ...existing.routine, name: v.name, notes: v.notes || null, updatedAt: now };
      } else {
        const position = (await r.routines.listActive()).reduce((m, x) => Math.max(m, x.position + 1), 0);
        routine = {
          id: this.d.ids.next(),
          name: v.name,
          notes: v.notes || null,
          position,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
      }
      const exercises: RoutineExercise[] = v.exercises.map((e, i) => ({
        id: this.d.ids.next(),
        routineId: routine.id,
        exerciseId: e.exerciseId,
        position: i,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSeconds: e.restSeconds,
        notes: e.notes || null,
      }));
      await r.routines.save(routine, exercises);
      await r.backupState.bumpLocalRevision();
      return routine;
    });
  }
}
