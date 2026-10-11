/**
 * @jest-environment node
 */
import { BUILT_IN_EXERCISES } from '../../../data/exercises/builtInExercises';
import { ROUTINE_TEMPLATES } from '../../../data/routines/templates';
import { isDomainError } from '../../../domain/errors';
import { UUID_RE } from '../../../utils/uuid';
import { createTestServices, resetAllDatabases } from '../../../test/testServices';
import { filterExercises } from '../ExerciseService';

afterAll(() => resetAllDatabases());

describe('built-in catalog', () => {
  it('has unique, valid UUIDs and templates that reference it', () => {
    const ids = BUILT_IN_EXERCISES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(id => expect(id).toMatch(UUID_RE));
    const known = new Set(ids);
    for (const t of ROUTINE_TEMPLATES) for (const e of t.exercises) expect(known.has(e.exerciseId)).toBe(true);
  });

  it('seeds once and re-seeding is idempotent', async () => {
    const { services, db } = await createTestServices();
    expect(await services.exercises.list()).toHaveLength(BUILT_IN_EXERCISES.length);
    await services.exercises.seedBuiltIns(BUILT_IN_EXERCISES);
    const rows = await db.query('SELECT COUNT(*) AS n FROM exercises');
    expect(Number(rows[0].n)).toBe(BUILT_IN_EXERCISES.length);
  });
});

describe('custom exercises', () => {
  it('creates one, bumps the backup revision, and blocks duplicates', async () => {
    const { services, repos } = await createTestServices();
    const e = await services.exercises.createCustom({
      name: 'Zercher Squat',
      muscleGroup: 'legs',
      equipment: 'barbell',
      trackingType: 'weight_reps',
    });
    expect(e.isCustom).toBe(true);
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await repos.backupState.get()).localRevision).toBe(1);
    try {
      await services.exercises.createCustom({ name: 'zercher squat', muscleGroup: 'legs', equipment: 'barbell', trackingType: 'weight_reps' });
      throw new Error('expected duplicate error');
    } catch (err) {
      expect(isDomainError(err, 'DUPLICATE_NAME')).toBe(true);
    }
  });
});

describe('filterExercises', () => {
  it('matches every word across name, equipment and muscles, ignoring case', () => {
    const names = (q: string, g?: 'legs') =>
      filterExercises(BUILT_IN_EXERCISES, { query: q, muscleGroup: g }).map(e => e.name);
    expect(names('ROMANIAN')).toEqual(['Romanian Deadlift']);
    expect(names('dumbbell press')).toEqual(['Incline Dumbbell Press', 'Seated Dumbbell Shoulder Press']);
    expect(names('hamstrings', 'legs')).toEqual(expect.arrayContaining(['Leg Curl', 'Romanian Deadlift']));
    expect(names('zzz')).toEqual([]);
  });
});
