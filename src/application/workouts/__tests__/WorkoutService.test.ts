/**
 * @jest-environment node
 */
import { builtInId } from '../../../data/exercises/builtInExercises';
import { ROUTINE_TEMPLATES } from '../../../data/routines/templates';
import { isDomainError, type DomainErrorCode } from '../../../domain/errors';
import { createAppServices } from '../../container';
import { createTestServices, openTestDb, resetAllDatabases } from '../../../test/testServices';

afterAll(() => resetAllDatabases());

const BENCH = builtInId('Bench Press');
const SQUAT = builtInId('Back Squat');
const PLANK = builtInId('Plank');
const PULLUP = builtInId('Pull-up');

async function expectCode(p: Promise<unknown>, code: DomainErrorCode) {
  try {
    await p;
  } catch (e) {
    expect(isDomainError(e, code)).toBe(true);
    return;
  }
  throw new Error(`expected ${code}`);
}

/** Logs and checks off every set of one exercise with the given weight and reps. */
async function logAll(services: Awaited<ReturnType<typeof createTestServices>>['services'], workoutId: string, weight: number, reps: number) {
  const d = (await services.workouts.getDetail(workoutId))!;
  for (const e of d.exercises) {
    for (const s of e.sets) {
      await services.workouts.updateSet(s.id, { weightValue: weight, reps });
      await services.workouts.setCompleted(s.id, true);
    }
  }
}

describe('starting workouts', () => {
  it('starts an empty workout and refuses a second active one', async () => {
    const { services } = await createTestServices();
    const d = await services.workouts.startEmpty('kg');
    expect(d.workout.status).toBe('in_progress');
    expect(d.exercises).toHaveLength(0);
    await expectCode(services.workouts.startEmpty('kg'), 'ACTIVE_WORKOUT_EXISTS');
  });

  it('starts from a template with the planned exercises and set counts', async () => {
    const { services } = await createTestServices();
    const push = ROUTINE_TEMPLATES.find(t => t.key === 'push')!;
    const d = await services.workouts.startFromTemplate(push, 'kg');
    expect(d.workout.name).toBe('Push');
    expect(d.exercises.map(e => e.exerciseId)).toEqual(push.exercises.map(e => e.exerciseId));
    expect(d.exercises.map(e => e.sets.length)).toEqual(push.exercises.map(e => e.targetSets));
    expect(d.exercises[0].sets[0]).toMatchObject({ reps: 8, weightValue: null, weightUnit: 'kg', completedAt: null });
  });

  it('prefills from the previous session, keeping its unit and skipping warm-ups', async () => {
    const { services } = await createTestServices();
    let d = await services.workouts.startEmpty('lb');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'lb');
    const [first] = d.exercises[0].sets;
    await services.workouts.cycleSetType(first.id); // warm-up
    await services.workouts.updateSet(first.id, { weightValue: 95, reps: 10 });
    await services.workouts.setCompleted(first.id, true);
    for (const s of d.exercises[0].sets.slice(1)) {
      await services.workouts.updateSet(s.id, { weightValue: 185, reps: 6 });
      await services.workouts.setCompleted(s.id, true);
    }
    await services.workouts.complete(d.workout.id);

    const next = await services.workouts.startEmpty('kg');
    const n = await services.workouts.addExercise(next.workout.id, BENCH, 'kg');
    expect(n.exercises[0].sets.map(s => [s.weightValue, s.weightUnit, s.reps])).toEqual([
      [185, 'lb', 6],
      [185, 'lb', 6],
    ]);
  });
});

describe('logging sets', () => {
  it('validates input and requires the right fields before checking off', async () => {
    const { services } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    d = await services.workouts.addExercise(d.workout.id, PLANK, 'kg');
    d = await services.workouts.addExercise(d.workout.id, PULLUP, 'kg');
    const bench = d.exercises[0].sets[0];
    const plank = d.exercises[1].sets[0];
    const pullup = d.exercises[2].sets[0];

    await expectCode(services.workouts.updateSet(bench.id, { reps: -2 }), 'VALIDATION');
    await expectCode(services.workouts.setCompleted(bench.id, true), 'SET_INCOMPLETE');
    await services.workouts.updateSet(bench.id, { weightValue: 60, reps: 8 });
    expect((await services.workouts.setCompleted(bench.id, true)).completedAt).not.toBeNull();

    expect(plank.reps).toBeNull();
    await expectCode(services.workouts.setCompleted(plank.id, true), 'SET_INCOMPLETE');
    await services.workouts.updateSet(plank.id, { durationSeconds: 60 });
    await services.workouts.setCompleted(plank.id, true);

    await services.workouts.updateSet(pullup.id, { reps: 8 }); // bodyweight: no weight needed
    await services.workouts.setCompleted(pullup.id, true);
  });

  it('adds sets copying the last one, removes sets, cycles set types', async () => {
    const { services } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, SQUAT, 'kg');
    const we = d.exercises[0];
    await services.workouts.updateSet(we.sets[2].id, { weightValue: 100, reps: 5 });
    const added = await services.workouts.addSet(we.id, 'kg');
    expect(added).toMatchObject({ weightValue: 100, reps: 5, position: 3, completedAt: null });
    await services.workouts.removeSet(we.sets[1].id);
    const types = [];
    for (let i = 0; i < 4; i++) types.push((await services.workouts.cycleSetType(added.id)).setType);
    expect(types).toEqual(['warmup', 'drop', 'failure', 'normal']);
    const after = (await services.workouts.getDetail(d.workout.id))!;
    expect(after.exercises[0].sets.map(s => s.position)).toEqual([0, 2, 3]);
  });

  it('reorders and removes exercises', async () => {
    const { services } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    for (const id of [BENCH, SQUAT, PLANK]) d = await services.workouts.addExercise(d.workout.id, id, 'kg');
    await services.workouts.moveExercise(d.exercises[2].id, -1);
    await services.workouts.moveExercise(d.exercises[0].id, -1); // already first: no-op
    let after = (await services.workouts.getDetail(d.workout.id))!;
    expect(after.exercises.map(e => e.exerciseId)).toEqual([BENCH, PLANK, SQUAT]);
    await services.workouts.removeExercise(after.exercises[1].id);
    after = (await services.workouts.getDetail(d.workout.id))!;
    expect(after.exercises.map(e => e.exerciseId)).toEqual([BENCH, SQUAT]);
  });
});

describe('finishing', () => {
  it('needs at least one completed set', async () => {
    const { services } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    await expectCode(services.workouts.complete(d.workout.id), 'NO_COMPLETED_SETS');
  });

  it('prunes unchecked sets and empty exercises, and computes the summary', async () => {
    const { services, clock } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    d = await services.workouts.addExercise(d.workout.id, SQUAT, 'kg');
    const [s1, s2] = d.exercises[0].sets;
    await services.workouts.updateSet(s1.id, { weightValue: 80, reps: 5 });
    await services.workouts.setCompleted(s1.id, true);
    await services.workouts.updateSet(s2.id, { weightValue: 80, reps: 5 });
    clock.advance(45 * 60_000);
    const sum = await services.workouts.complete(d.workout.id);
    expect(sum.alreadyCompleted).toBe(false);
    expect(sum.completedSets).toBe(1);
    expect(sum.volumeKg).toBe(400);
    expect(sum.durationMs).toBe(45 * 60_000);
    expect(sum.detail.exercises.map(e => e.exerciseId)).toEqual([BENCH]);
    expect(sum.detail.workout.status).toBe('completed');
    expect(await services.workouts.getActiveDetail()).toBeNull();
  });

  it('is idempotent: a repeated complete returns the same workout without side effects', async () => {
    const { services, repos } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    await logAll(services, d.workout.id, 60, 5);
    const [a, b] = await Promise.all([
      services.workouts.complete(d.workout.id),
      services.workouts.complete(d.workout.id),
    ]);
    expect([a.alreadyCompleted, b.alreadyCompleted].sort()).toEqual([false, true]);
    expect((await repos.backupState.get()).localRevision).toBe(1);
    expect(await services.history.list({ limit: 10 })).toHaveLength(1);
    await expectCode(services.workouts.pause(d.workout.id), 'WORKOUT_NOT_ACTIVE');
  });

  it('excludes paused time from the duration', async () => {
    const { services, clock } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    await logAll(services, d.workout.id, 60, 5);
    clock.advance(10 * 60_000);
    await services.workouts.pause(d.workout.id);
    clock.advance(30 * 60_000);
    await services.workouts.resume(d.workout.id);
    clock.advance(5 * 60_000);
    await services.workouts.pause(d.workout.id);
    clock.advance(60 * 60_000); // finished while paused: the paused tail is not counted
    const sum = await services.workouts.complete(d.workout.id);
    expect(sum.durationMs).toBe(15 * 60_000);
  });

  it('reports new personal records only when an existing record is beaten', async () => {
    const { services, clock } = await createTestServices();
    const run = async (weight: number) => {
      let d = await services.workouts.startEmpty('kg');
      d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
      await logAll(services, d.workout.id, weight, 5);
      clock.advance(86_400_000);
      return services.workouts.complete(d.workout.id);
    };
    expect((await run(80)).improvements).toEqual([]); // first time: no "record"
    expect((await run(75)).improvements).toEqual([]);
    const third = await run(85);
    expect(third.improvements.map(i => i.recordType).sort()).toEqual(['best_set_volume', 'e1rm', 'max_weight']);
    expect(third.improvements[0].exerciseName).toBe('Bench Press');
  });
});

describe('discard and delete', () => {
  it('discards an active workout completely', async () => {
    const { services, db } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    await services.workouts.discard(d.workout.id);
    expect(await services.workouts.getActiveDetail()).toBeNull();
    expect(await db.query('SELECT id FROM sets')).toHaveLength(0);
    await services.workouts.startEmpty('kg'); // a new one can start
  });

  it('will not discard completed history', async () => {
    const { services } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    await logAll(services, d.workout.id, 60, 5);
    await services.workouts.complete(d.workout.id);
    await expectCode(services.workouts.discard(d.workout.id), 'WORKOUT_NOT_ACTIVE');
  });

  it('tombstones a completed workout and rebuilds records from what remains', async () => {
    const { services, repos, clock, db } = await createTestServices();
    const ids: string[] = [];
    for (const w of [80, 90]) {
      let d = await services.workouts.startEmpty('kg');
      d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
      await logAll(services, d.workout.id, w, 5);
      clock.advance(86_400_000);
      await services.workouts.complete(d.workout.id);
      ids.push(d.workout.id);
    }
    const maxWeight = async () =>
      (await repos.records.listForExercises([BENCH])).find(r => r.recordType === 'max_weight')!.value;
    expect(await maxWeight()).toBe(90);
    await services.workouts.deleteCompleted(ids[1]);
    expect(await maxWeight()).toBe(80);
    expect(await services.history.list({ limit: 10 })).toHaveLength(1);
    const row = await db.query<{ deleted_at: number }>('SELECT deleted_at FROM workouts WHERE id = ?', [ids[1]]);
    expect(row[0].deleted_at).toBe(clock.now()); // kept as a tombstone for the backup
    expect((await repos.backupState.get()).localRevision).toBe(3);
    await services.workouts.deleteCompleted(ids[1]); // idempotent
    expect((await repos.backupState.get()).localRevision).toBe(3);
  });
});

describe('crash recovery', () => {
  it('restores the active workout and every logged set after reopening the database', async () => {
    const { services, db, dbName } = await createTestServices();
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    const s = d.exercises[0].sets[0];
    await services.workouts.updateSet(s.id, { weightValue: 70, reps: 6 });
    await services.workouts.setCompleted(s.id, true);
    db.close(); // simulate the process dying

    const reopened = await createAppServices(openTestDb(dbName));
    const active = (await reopened.workouts.getActiveDetail())!;
    expect(active.workout.id).toBe(d.workout.id);
    expect(active.exercises[0].sets[0]).toMatchObject({ weightValue: 70, reps: 6 });
    expect(active.exercises[0].sets[0].completedAt).not.toBeNull();
  });

  it('rolls back a multi-step use case that fails midway', async () => {
    const { services, db } = await createTestServices();
    const d = await services.workouts.startEmpty('kg');
    await expectCode(services.workouts.addExercise(d.workout.id, 'not-an-exercise', 'kg'), 'NOT_FOUND');
    expect(await db.query('SELECT id FROM workout_exercises')).toHaveLength(0);
  });
});

describe('history', () => {
  it('lists newest first with aggregates and supports cursor and exercise filters', async () => {
    const { services, clock } = await createTestServices();
    for (const [ex, w] of [[BENCH, 50], [SQUAT, 100], [BENCH, 55]] as const) {
      let d = await services.workouts.startEmpty('kg');
      d = await services.workouts.addExercise(d.workout.id, ex, 'kg');
      await logAll(services, d.workout.id, w, 10);
      clock.advance(3_600_000);
      await services.workouts.complete(d.workout.id);
      clock.advance(86_400_000);
    }
    const all = await services.history.list({ limit: 10 });
    // Three default sets each; the second bench session copies the first one's set count.
    expect(all.map(i => i.volumeKg)).toEqual([55 * 10 * 3, 100 * 10 * 3, 50 * 10 * 3]);
    expect(all[0].completedSetCount).toBe(3);
    const page2 = await services.history.list({ limit: 10, startedBefore: all[0].workout.startedAt });
    expect(page2).toHaveLength(2);
    const benchOnly = await services.history.list({ limit: 10, exerciseId: BENCH });
    expect(benchOnly).toHaveLength(2);
  });
});
