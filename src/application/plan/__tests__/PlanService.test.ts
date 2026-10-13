/**
 * @jest-environment node
 */
import { builtInId } from '../../../data/exercises/builtInExercises';
import { createTestServices, resetAllDatabases } from '../../../test/testServices';

afterAll(() => resetAllDatabases());

const BENCH = builtInId('Bench Press');
const SQUAT = builtInId('Back Squat');
const dayInput = (name: string, exerciseId: string) => ({
  name,
  exercises: [{ exerciseId, targetSets: 3, targetReps: 8, restSeconds: null }],
});

describe('weekly plan', () => {
  it('starts empty, Monday-first, with today marked', async () => {
    const { services, clock } = await createTestServices();
    clock.t = new Date(2026, 9, 14, 9).getTime(); // a Wednesday
    const plan = await services.plan.get();
    expect(plan.weekStart).toBe(1);
    expect(plan.days.map(d => d.name)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(plan.days.every(d => d.kind === 'unplanned')).toBe(true);
    expect(plan.days.find(d => d.isToday)!.name).toBe('Wednesday');
    expect((await services.plan.today()).weekday).toBe(3);
  });

  it('reorders the week from the chosen starting day', async () => {
    const { services } = await createTestServices();
    await services.plan.setWeekStart(6);
    expect((await services.plan.get()).days.map(d => d.weekday)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    await expect(services.plan.setWeekStart(9)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('plans training and rest days, and counts them', async () => {
    const { services, repos } = await createTestServices();
    const mon = await services.plan.createDayRoutine(1, dayInput('Monday – Chest', BENCH));
    await services.plan.createDayRoutine(3, dayInput('Wednesday – Legs', SQUAT));
    await services.plan.setRest(0, true);
    await services.plan.setRest(6, true);
    const plan = await services.plan.get();
    expect(plan).toMatchObject({ trainingDays: 2, restDays: 2 });
    const monday = plan.days.find(d => d.weekday === 1)!;
    expect(monday).toMatchObject({ kind: 'training' });
    expect(monday.routine!.routine.id).toBe(mon);
    expect(monday.routine!.exerciseNames).toEqual(['Bench Press']);
    expect((await repos.backupState.get()).localRevision).toBeGreaterThanOrEqual(6);
  });

  it('switches a training day to rest and back, keeping the routine itself', async () => {
    const { services } = await createTestServices();
    const id = await services.plan.createDayRoutine(2, dayInput('Tuesday', BENCH));
    await services.plan.setRest(2, true);
    expect((await services.plan.get()).days.find(d => d.weekday === 2)!.kind).toBe('rest');
    expect((await services.routines.get(id))).not.toBeNull();
    await services.plan.assignRoutine(2, id);
    expect((await services.plan.get()).days.find(d => d.weekday === 2)!.kind).toBe('training');
  });

  it('leaves the day unplanned when its routine is deleted', async () => {
    const { services } = await createTestServices();
    const id = await services.plan.createDayRoutine(4, dayInput('Thursday', BENCH));
    await services.routines.remove(id);
    expect((await services.plan.get()).days.find(d => d.weekday === 4)!.kind).toBe('unplanned');
  });

  it('rejects unknown routines and days', async () => {
    const { services } = await createTestServices();
    await expect(services.plan.assignRoutine(1, '00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(services.plan.setRest(7, true)).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('weekly plan in backups', () => {
  it('travels with export/import, routines included', async () => {
    const a = await createTestServices();
    await a.services.plan.setWeekStart(0);
    await a.services.plan.createDayRoutine(1, dayInput('Monday – Chest', BENCH));
    await a.services.plan.setRest(3, true);
    await a.services.settings.update({ gymName: 'Iron Temple' });
    const { json } = await a.services.backup.exportJson();

    const b = await createTestServices();
    await b.services.backup.applyImport((await b.services.backup.previewImport(json)).file);
    const plan = await b.services.plan.get();
    expect(plan.weekStart).toBe(0);
    expect(plan.days.find(d => d.weekday === 1)!.routine!.routine.name).toBe('Monday – Chest');
    expect(plan.days.find(d => d.weekday === 3)!.kind).toBe('rest');
    expect((await b.services.settings.load()).gymName).toBe('Iron Temple');
  });

  it('keeps the newer plan and treats an untouched plan as nothing', async () => {
    const a = await createTestServices();
    const b = await createTestServices();
    // b has never touched its plan: importing a's plan must replace the default.
    await a.services.plan.setRest(5, true);
    const fromA = (await a.services.backup.exportJson()).json;
    expect((await b.services.backup.previewImport(fromA)).noChanges).toBe(false);
    // a newer local change wins over an older file.
    a.clock.advance(60_000);
    await a.services.plan.setRest(5, false);
    expect((await a.services.backup.previewImport(fromA)).noChanges).toBe(true);
    expect((await a.services.plan.get()).days.find(d => d.weekday === 5)!.kind).toBe('unplanned');
  });

  it('rejects a plan that lists a day twice', async () => {
    const a = await createTestServices();
    await a.services.plan.setRest(1, true);
    const file = JSON.parse((await a.services.backup.exportJson()).json);
    file.data.plan.days.push({ ...file.data.plan.days[0] });
    await expect(a.services.backup.previewImport(JSON.stringify(file))).rejects.toMatchObject({
      details: expect.objectContaining({ problem: 'DUPLICATE_IDS' }),
    });
  });
});

describe('weekly stats follow the plan’s first day', () => {
  async function workoutAt(ctx: Awaited<ReturnType<typeof createTestServices>>, at: number) {
    ctx.clock.t = at;
    let d = await ctx.services.workouts.startEmpty('kg');
    d = await ctx.services.workouts.addExercise(d.workout.id, BENCH, 'kg');
    const set = d.exercises[0].sets[0];
    await ctx.services.workouts.updateSet(set.id, { weightValue: 50, reps: 5 });
    await ctx.services.workouts.setCompleted(set.id, true);
    ctx.clock.advance(3_600_000);
    await ctx.services.workouts.complete(d.workout.id);
  }

  it('counts this week from the chosen day on Home', async () => {
    const ctx = await createTestServices();
    await ctx.services.plan.setWeekStart(0); // Sunday
    await workoutAt(ctx, new Date(2026, 9, 10, 10).getTime()); // Saturday: last week
    await workoutAt(ctx, new Date(2026, 9, 11, 10).getTime()); // Sunday: this week
    ctx.clock.t = new Date(2026, 9, 13, 12).getTime(); // Tuesday
    const week = await ctx.services.history.thisWeek();
    expect(week.firstDay).toBe(0);
    expect(new Date(week.weekStart).getDay()).toBe(0);
    expect(week.workouts).toBe(1);
    expect(week.activeDays).toEqual([0]);

    // With the default Monday start, both fall in the previous week.
    await ctx.services.plan.setWeekStart(1);
    expect((await ctx.services.history.thisWeek()).workouts).toBe(0);
  });

  it('aligns Progress buckets to the chosen day', async () => {
    const ctx = await createTestServices();
    await ctx.services.plan.setWeekStart(6); // Saturday
    await workoutAt(ctx, new Date(2026, 9, 10, 10).getTime()); // Saturday 10 Oct
    ctx.clock.t = new Date(2026, 9, 13, 12).getTime();
    const weeks = await ctx.services.analytics.weekly(3);
    expect(weeks.every(w => new Date(w.weekStart).getDay() === 6)).toBe(true);
    expect(weeks[2].workouts).toBe(1);
  });
});
