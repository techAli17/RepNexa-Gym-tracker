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
