import { DomainError } from '../../domain/errors';
import type { Exercise, MuscleGroup, Uuid } from '../../domain/models';
import { parseCustomExercise } from '../../domain/validation';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock, IdGenerator } from '../ports/system';

export interface ExerciseFilter {
  query?: string;
  muscleGroup?: MuscleGroup | 'all';
}

/** Case- and accent-insensitive, so "romanian" finds "Romanian" and "creme" finds "crème". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function filterExercises(list: readonly Exercise[], f: ExerciseFilter): Exercise[] {
  const words = fold(f.query ?? '').split(/\s+/).filter(Boolean);
  return list.filter(e => {
    if (f.muscleGroup && f.muscleGroup !== 'all' && e.muscleGroup !== f.muscleGroup) return false;
    if (!words.length) return true;
    const hay = fold(`${e.name} ${e.equipment} ${e.primaryMuscles.join(' ')} ${e.secondaryMuscles.join(' ')}`);
    return words.every(w => hay.includes(w));
  });
}

export class ExerciseService {
  constructor(
    private readonly d: { repos: Repositories; uow: UnitOfWork; clock: Clock; ids: IdGenerator },
  ) {}

  list(): Promise<Exercise[]> {
    return this.d.repos.exercises.listActive();
  }

  get(id: Uuid): Promise<Exercise | null> {
    return this.d.repos.exercises.getById(id);
  }

  async seedBuiltIns(catalog: readonly Exercise[]): Promise<void> {
    await this.d.uow.run(r => r.exercises.upsertBuiltIns(catalog));
  }

  /**
   * Substitutes for when equipment is taken: same muscle group, ranked by shared
   * primary muscles, then by being a different piece of equipment.
   */
  async similar(id: Uuid, limit = 8): Promise<Exercise[]> {
    const target = await this.get(id);
    if (!target) return [];
    const primary = new Set(target.primaryMuscles);
    const score = (e: Exercise) =>
      e.primaryMuscles.filter(m => primary.has(m)).length * 2 + (e.equipment !== target.equipment ? 1 : 0);
    return (await this.list())
      .filter(e => e.id !== id && e.muscleGroup === target.muscleGroup)
      .map(e => ({ e, s: score(e) }))
      .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
      .slice(0, limit)
      .map(x => x.e);
  }

  async updateCustom(id: Uuid, input: unknown): Promise<Exercise> {
    const v = parseCustomExercise(input);
    return this.d.uow.run(async r => {
      const existing = await r.exercises.getById(id);
      if (!existing || existing.deletedAt != null) throw new DomainError('NOT_FOUND', 'Exercise not found');
      if (!existing.isCustom) throw new DomainError('VALIDATION', 'Built-in exercises cannot be edited');
      const clash = await r.exercises.findCustomByName(v.name);
      if (clash && clash.id !== id) throw new DomainError('DUPLICATE_NAME', 'You already have an exercise with that name');
      const next: Exercise = {
        ...existing,
        name: v.name,
        muscleGroup: v.muscleGroup,
        equipment: v.equipment,
        trackingType: v.trackingType,
        instructions: v.instructions || null,
        updatedAt: this.d.clock.now(),
      };
      await r.exercises.updateCustom(next);
      await r.backupState.bumpLocalRevision();
      return next;
    });
  }

  /** Hides a custom exercise. Past workouts keep showing it; nothing logged is lost. */
  async deleteCustom(id: Uuid): Promise<void> {
    await this.d.uow.run(async r => {
      const existing = await r.exercises.getById(id);
      if (!existing?.isCustom) throw new DomainError('VALIDATION', 'Only your own exercises can be deleted');
      await r.exercises.softDelete(id, this.d.clock.now());
      await r.backupState.bumpLocalRevision();
    });
  }

  async createCustom(input: unknown): Promise<Exercise> {
    const v = parseCustomExercise(input);
    return this.d.uow.run(async r => {
      if (await r.exercises.findCustomByName(v.name)) {
        throw new DomainError('DUPLICATE_NAME', 'You already have an exercise with that name');
      }
      const now = this.d.clock.now();
      const e: Exercise = {
        id: this.d.ids.next(),
        name: v.name,
        muscleGroup: v.muscleGroup,
        equipment: v.equipment,
        trackingType: v.trackingType,
        primaryMuscles: [],
        secondaryMuscles: [],
        instructions: v.instructions || null,
        imageKey: null,
        isCustom: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await r.exercises.insert(e);
      await r.backupState.bumpLocalRevision();
      return e;
    });
  }
}
