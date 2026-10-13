/**
 * @jest-environment node
 */
import { builtInId } from '../../data/exercises/builtInExercises';
import { ROUTINE_TEMPLATES } from '../../data/routines/templates';
import { isDomainError, type DomainErrorCode } from '../../domain/errors';
import { createTestServices, resetAllDatabases } from '../../test/testServices';

afterAll(() => resetAllDatabases());

const BENCH = builtInId('Bench Press');
const SQUAT = builtInId('Back Squat');
const INCLINE = builtInId('Incline Dumbbell Press');
const DAY = 86_400_000;

type Ctx = Awaited<ReturnType<typeof createTestServices>>;

async function expectCode(p: Promise<unknown>, code: DomainErrorCode) {
  try {
    await p;
  } catch (e) {
    if (!isDomainError(e, code)) throw e;
    return;
  }
  throw new Error(`expected ${code}`);
}

/** Starts, logs every set with weight × reps, finishes. Returns the workout id. */
async function doWorkout(ctx: Ctx, exercises: string[], weight: number, reps: number) {
  const { services, clock } = ctx;
  let d = await services.workouts.startEmpty('kg');
  for (const id of exercises) d = await services.workouts.addExercise(d.workout.id, id, 'kg');
  for (const e of d.exercises) {
    for (const s of e.sets) {
      await services.workouts.updateSet(s.id, { weightValue: weight, reps });
      await services.workouts.setCompleted(s.id, true);
    }
  }
  clock.advance(3_600_000);
  await services.workouts.complete(d.workout.id);
  clock.advance(DAY);
  return d.workout.id;
}

describe('routines', () => {
  it('creates, lists, updates, duplicates, reorders and deletes', async () => {
    const ctx = await createTestServices();
    const { services, repos } = ctx;
    const a = await services.routines.create({
      name: ' Push A ',
      exercises: [
        { exerciseId: BENCH, targetSets: 4, targetReps: 8, restSeconds: 120 },
        { exerciseId: INCLINE, targetSets: 3, targetReps: 10, restSeconds: null },
      ],
    });
    expect(a.name).toBe('Push A');
    const b = await services.routines.createFromTemplate(ROUTINE_TEMPLATES.find(t => t.key === 'legs')!);

    let list = await services.routines.list();
    expect(list.map(x => x.routine.name)).toEqual(['Push A', 'Legs']);
    expect(list[0]).toMatchObject({ exerciseNames: ['Bench Press', 'Incline Dumbbell Press'], totalSets: 7 });

    await services.routines.update(a.id, {
      name: 'Push A',
      exercises: [{ exerciseId: INCLINE, targetSets: 2, targetReps: null, restSeconds: 60 }],
    });
    const view = (await services.routines.get(a.id))!;
    expect(view.detail.exercises).toHaveLength(1);
    expect(view.exercises[INCLINE].name).toBe('Incline Dumbbell Press');

    const copy = await services.routines.duplicate(a.id);
    expect(copy.name).toBe('Push A (copy)');

    await services.routines.reorder([b.id, copy.id, a.id]);
    list = await services.routines.list();
    expect(list.map(x => x.routine.name)).toEqual(['Legs', 'Push A (copy)', 'Push A']);

    await services.routines.remove(copy.id);
    expect((await services.routines.list()).map(x => x.routine.id)).toEqual([b.id, a.id]);
    expect((await repos.backupState.get()).localRevision).toBe(6);
  });

  it('validates input', async () => {
    const { services } = await createTestServices();
    await expectCode(services.routines.create({ name: '', exercises: [] }), 'VALIDATION');
    await expectCode(
      services.routines.create({ name: 'X', exercises: [{ exerciseId: BENCH, targetSets: 0, targetReps: null, restSeconds: null }] }),
      'VALIDATION',
    );
    await expectCode(
      services.routines.create({ name: 'X', exercises: [{ exerciseId: 'nope', targetSets: 3, targetReps: null, restSeconds: null }] }),
      'NOT_FOUND',
    );
  });

  it('starts a workout from a routine, skipping deleted custom exercises', async () => {
    const ctx = await createTestServices();
    const { services } = ctx;
    const custom = await services.exercises.createCustom({ name: 'Sled Push', muscleGroup: 'legs', equipment: 'other', trackingType: 'weight_reps' });
    const r = await services.routines.create({
      name: 'Legs',
      exercises: [
        { exerciseId: SQUAT, targetSets: 5, targetReps: 5, restSeconds: 180 },
        { exerciseId: custom.id, targetSets: 2, targetReps: null, restSeconds: null },
      ],
    });
    await services.exercises.deleteCustom(custom.id);
    const d = await services.workouts.startFromRoutine(r.id, 'kg');
    expect(d.workout.routineId).toBe(r.id);
    expect(d.exercises.map(e => e.exerciseId)).toEqual([SQUAT]);
    expect(d.exercises[0]).toMatchObject({ restSeconds: 180 });
    expect(d.exercises[0].sets).toHaveLength(5);
  });

  it('saves a finished workout as a routine', async () => {
    const ctx = await createTestServices();
    const id = await doWorkout(ctx, [BENCH, SQUAT], 60, 8);
    const r = await ctx.services.routines.createFromWorkout(id, 'Monday');
    const view = (await ctx.services.routines.get(r.id))!;
    expect(view.detail.exercises.map(e => [e.exerciseId, e.targetSets, e.targetReps])).toEqual([
      [BENCH, 3, 8],
      [SQUAT, 3, 8],
    ]);
  });
});

describe('editing finished workouts', () => {
  it('updates a set, rebuilds records and marks the change for backup', async () => {
    const ctx = await createTestServices();
    const { services, repos } = ctx;
    const id = await doWorkout(ctx, [BENCH], 100, 5);
    const before = (await repos.backupState.get()).localRevision;
    const d = (await services.workouts.getDetail(id))!;
    await services.workouts.updateSet(d.exercises[0].sets[0].id, { weightValue: 120 });
    const rec = (await repos.records.listForExercises([BENCH])).find(r => r.recordType === 'max_weight')!;
    expect(rec.value).toBe(120);
    expect((await repos.backupState.get()).localRevision).toBe(before + 1);
    expect((await services.workouts.getDetail(id))!.workout.updatedAt).toBe(ctx.clock.now());
  });

  it('keeps finished sets valid and the workout non-empty', async () => {
    const ctx = await createTestServices();
    const { services } = ctx;
    const id = await doWorkout(ctx, [BENCH], 100, 5);
    let d = (await services.workouts.getDetail(id))!;
    await expectCode(services.workouts.updateSet(d.exercises[0].sets[0].id, { reps: null }), 'SET_INCOMPLETE');
    await services.workouts.removeSet(d.exercises[0].sets[0].id);
    await services.workouts.removeSet(d.exercises[0].sets[1].id);
    d = (await services.workouts.getDetail(id))!;
    expect(d.exercises[0].sets).toHaveLength(1);
    await expectCode(services.workouts.removeSet(d.exercises[0].sets[0].id), 'VALIDATION');
    await expectCode(services.workouts.removeExercise(d.exercises[0].id), 'VALIDATION');
  });

  it('adds a done copy of the last set and renames', async () => {
    const ctx = await createTestServices();
    const { services } = ctx;
    const id = await doWorkout(ctx, [BENCH], 100, 5);
    let d = (await services.workouts.getDetail(id))!;
    const added = await services.workouts.addSet(d.exercises[0].id, 'kg');
    expect(added.completedAt).not.toBeNull();
    await services.workouts.rename(id, 'Heavy bench');
    d = (await services.workouts.getDetail(id))!;
    expect(d.workout.name).toBe('Heavy bench');
    expect(d.exercises[0].sets).toHaveLength(4);
  });

  it('removing the exercise that held a record moves the record back', async () => {
    const ctx = await createTestServices();
    const { services, repos } = ctx;
    await doWorkout(ctx, [BENCH], 80, 5);
    const id = await doWorkout(ctx, [BENCH, SQUAT], 90, 5);
    const d = (await services.workouts.getDetail(id))!;
    await services.workouts.removeExercise(d.exercises[0].id);
    const rec = (await repos.records.listForExercises([BENCH])).find(r => r.recordType === 'max_weight')!;
    expect(rec.value).toBe(80);
  });
});

describe('adding exercises to a finished workout', () => {
  it('adds an unticked set, counts it once ticked, and tidies the rest away', async () => {
    const ctx = await createTestServices();
    const { services, repos } = ctx;
    await doWorkout(ctx, [SQUAT], 100, 5); // gives Back Squat a "last time"
    const id = await doWorkout(ctx, [BENCH], 80, 5);
    let d = await services.workouts.addExercise(id, SQUAT, 'kg');
    const added = d.exercises.find(e => e.exerciseId === SQUAT)!;
    expect(added.sets).toHaveLength(1);
    expect(added.sets[0]).toMatchObject({ weightValue: 100, reps: 5, completedAt: null });

    const done = await services.workouts.setCompleted(added.sets[0].id, true);
    expect(done.completedAt).toBe(d.workout.endedAt); // dated to the workout, not today
    await expectCode(services.workouts.setCompleted(added.sets[0].id, false), 'VALIDATION');
    const max = (await repos.records.listForExercises([SQUAT])).find(r => r.recordType === 'max_weight')!;
    expect(max.value).toBe(100);

    // An exercise added and left empty disappears on tidy.
    d = await services.workouts.addExercise(id, INCLINE, 'kg');
    await services.workouts.tidyFinished(id);
    d = (await services.workouts.getDetail(id))!;
    expect(d.exercises.map(e => e.exerciseId)).toEqual([BENCH, SQUAT]);
    expect(d.exercises.flatMap(e => e.sets).every(s => s.completedAt != null)).toBe(true);
  });

  it('tidy is a no-op for active workouts and clean history', async () => {
    const ctx = await createTestServices();
    const id = await doWorkout(ctx, [BENCH], 80, 5);
    const before = (await ctx.repos.backupState.get()).localRevision;
    await ctx.services.workouts.tidyFinished(id);
    expect((await ctx.repos.backupState.get()).localRevision).toBe(before);
    const active = await ctx.services.workouts.startEmpty('kg');
    await ctx.services.workouts.addExercise(active.workout.id, BENCH, 'kg');
    await ctx.services.workouts.tidyFinished(active.workout.id);
    expect((await ctx.services.workouts.getActiveDetail())!.exercises[0].sets).toHaveLength(3);
  });
});

describe('substitution and rest', () => {
  it('replaces an exercise and rebuilds its sets', async () => {
    const ctx = await createTestServices();
    const { services } = ctx;
    await doWorkout(ctx, [INCLINE], 30, 10);
    let d = await services.workouts.startEmpty('kg');
    d = await services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    await services.workouts.addSet(d.exercises[0].id, 'kg');
    await services.workouts.replaceExercise(d.exercises[0].id, INCLINE, 'kg');
    d = (await services.workouts.getActiveDetail())!;
    expect(d.exercises[0].exerciseId).toBe(INCLINE);
    expect(d.exercises[0].sets.map(s => [s.weightValue, s.reps])).toEqual([
      [30, 10],
      [30, 10],
      [30, 10],
      [30, 10],
    ]);
    await services.workouts.setRestSeconds(d.exercises[0].id, 75);
    expect((await services.workouts.getActiveDetail())!.exercises[0].restSeconds).toBe(75);
    await expectCode(services.workouts.setRestSeconds(d.exercises[0].id, -5), 'VALIDATION');
  });

  it('suggests substitutes from the same muscle group, closest first', async () => {
    const { services } = await createTestServices();
    const sims = await services.exercises.similar(BENCH);
    expect(sims.length).toBeGreaterThan(0);
    expect(sims.every(e => e.muscleGroup === 'chest')).toBe(true);
    expect(sims.map(e => e.id)).not.toContain(BENCH);
    expect(sims[0].primaryMuscles).toContain('chest');
  });
});

describe('custom exercise edits', () => {
  it('edits and deletes custom exercises but never built-ins', async () => {
    const { services } = await createTestServices();
    const c = await services.exercises.createCustom({ name: 'Sled Push', muscleGroup: 'legs', equipment: 'other', trackingType: 'weight_reps' });
    const u = await services.exercises.updateCustom(c.id, { name: 'Prowler Push', muscleGroup: 'legs', equipment: 'other', trackingType: 'weight_reps' });
    expect(u.name).toBe('Prowler Push');
    await expectCode(
      services.exercises.updateCustom(BENCH, { name: 'Bench', muscleGroup: 'chest', equipment: 'barbell', trackingType: 'weight_reps' }),
      'VALIDATION',
    );
    await expectCode(services.exercises.deleteCustom(BENCH), 'VALIDATION');
    await services.exercises.deleteCustom(c.id);
    expect((await services.exercises.list()).find(e => e.id === c.id)).toBeUndefined();
    expect((await services.exercises.get(c.id))!.deletedAt).not.toBeNull();
  });
});

describe('analytics', () => {
  it('builds an e1RM series, weekly buckets, streaks, records and comparisons', async () => {
    const ctx = await createTestServices();
    const { services, clock } = ctx;
    const w1 = await doWorkout(ctx, [BENCH], 80, 5);
    const w2 = await doWorkout(ctx, [BENCH, SQUAT], 85, 5);
    clock.advance(7 * DAY);
    const w3 = await doWorkout(ctx, [BENCH], 90, 3);

    const series = await services.analytics.e1rmSeries(BENCH);
    expect(series.map(p => p.workoutId)).toEqual([w1, w2, w3]);
    expect(series[2].e1rm).toBeCloseTo(99, 5);

    const weeks = await services.analytics.weekly(4);
    expect(weeks).toHaveLength(4);
    expect(weeks.reduce((n, w) => n + w.workouts, 0)).toBe(3);
    expect(weeks.every((w, i) => i === 0 || w.weekStart > weeks[i - 1].weekStart)).toBe(true);

    const logged = await services.analytics.loggedExercises();
    expect(logged[0]).toMatchObject({ workoutCount: 3 });
    expect(logged[0].exercise.id).toBe(BENCH);

    const recs = await services.analytics.records();
    const bench = recs.find(r => r.exercise.id === BENCH)!;
    expect(bench.records.max_weight!.value).toBe(90);

    const cmp = await services.analytics.compareWithPrevious(w3);
    expect(cmp[0].previous!.workoutId).toBe(w2);
    expect(cmp[0].current.volumeKg).toBe(90 * 3 * 3);
    const first = await services.analytics.compareWithPrevious(w1);
    expect(first[0].previous).toBeNull();
  });

  it('handles an empty history', async () => {
    const { services } = await createTestServices();
    expect(await services.analytics.e1rmSeries(BENCH)).toEqual([]);
    expect(await services.analytics.loggedExercises()).toEqual([]);
    expect(await services.analytics.records()).toEqual([]);
    expect(await services.analytics.weekStreak()).toBe(0);
    expect((await services.analytics.weekly(8)).every(w => w.workouts === 0)).toBe(true);
  });

  it('filters history by date', async () => {
    const ctx = await createTestServices();
    await doWorkout(ctx, [BENCH], 80, 5);
    const cut = ctx.clock.now();
    await doWorkout(ctx, [BENCH], 80, 5);
    expect(await ctx.services.history.list({ limit: 10, startedAfter: cut })).toHaveLength(1);
  });
});
