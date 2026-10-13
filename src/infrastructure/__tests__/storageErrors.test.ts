/**
 * @jest-environment node
 */
import { builtInId } from '../../data/exercises/builtInExercises';
import { createTestServices, resetAllDatabases } from '../../test/testServices';
import { STORAGE_FULL_MESSAGE, isStorageFull } from '../storageErrors';

afterAll(() => resetAllDatabases());

describe('storage full', () => {
  it('recognises the ways each layer says "disk full"', () => {
    expect(isStorageFull(new Error('database or disk is full'))).toBe(true);
    expect(isStorageFull(new Error('SQLITE_FULL: database or disk is full'))).toBe(true);
    expect(isStorageFull(new Error('ENOSPC: no space left on device, write'))).toBe(true);
    expect(isStorageFull(new Error('No space left on device'))).toBe(true);
    expect(isStorageFull(new Error('UNIQUE constraint failed'))).toBe(false);
  });

  it('turns a real SQLite "disk full" into a clear message and keeps earlier data', async () => {
    const { services, db } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, builtInId('Bench Press'), 'kg');
    const first = d.exercises[0].sets[0];
    await services.workouts.updateSet(first.id, { weightValue: 60, reps: 5 });

    // Cap the file at its current size: the next growth fails like a full phone.
    const [{ page_count }] = await db.query<{ page_count: number }>('PRAGMA page_count');
    await db.query(`PRAGMA max_page_count = ${Number(page_count)}`);

    let error: unknown;
    try {
      for (let i = 0; i < 400; i++) {
        await services.exercises.createCustom({
          name: `Filler exercise ${i} ${'x'.repeat(60)}`,
          muscleGroup: 'legs',
          equipment: 'other',
          trackingType: 'weight_reps',
          instructions: 'y'.repeat(1900),
        });
      }
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({ code: 'STORAGE_FULL', message: STORAGE_FULL_MESSAGE });

    // The set saved before the disk filled is intact, and the active workout still loads.
    const active = (await services.workouts.getActiveDetail())!;
    expect(active.exercises[0].sets[0]).toMatchObject({ weightValue: 60, reps: 5 });
  });
});
