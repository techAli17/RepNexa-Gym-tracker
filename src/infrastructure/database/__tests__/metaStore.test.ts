/**
 * @jest-environment node
 */
import { createAppServices } from '../../../application/container';
import { builtInId } from '../../../data/exercises/builtInExercises';
import { openTestDb, resetAllDatabases } from '../../../test/testServices';
import { LOCAL_OWNER, createMetaStore, ownerForAccount } from '../metaStore';

afterAll(() => resetAllDatabases());

it('remembers the owner, defaulting to local', async () => {
  const meta = await createMetaStore(openTestDb());
  expect(await meta.getOwner()).toBe(LOCAL_OWNER);
  await meta.setOwner(ownerForAccount('123'));
  expect(await meta.getOwner()).toBe('g_123');
  await meta.setOwner(LOCAL_OWNER);
  expect(await meta.getOwner()).toBe(LOCAL_OWNER);
});

it('keeps each owner’s data in its own database', async () => {
  const a = await createAppServices(openTestDb('repnexa-g_a.db'));
  const b = await createAppServices(openTestDb('repnexa-g_b.db'));
  let d = await a.workouts.startEmpty('kg');
  d = await a.workouts.addExercise(d.workout.id, builtInId('Bench Press'), 'kg');
  await a.workouts.updateSet(d.exercises[0].sets[0].id, { weightValue: 50, reps: 5 });
  await a.workouts.setCompleted(d.exercises[0].sets[0].id, true);
  await a.workouts.complete(d.workout.id);
  expect(await a.history.list({ limit: 5 })).toHaveLength(1);
  expect(await b.history.list({ limit: 5 })).toHaveLength(0);
  expect(await b.workouts.getActiveDetail()).toBeNull();
});
