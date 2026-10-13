/**
 * Large-history check: ~3 years of heavy training (3,000 workouts, 60,000 sets)
 * through every query the screens use. Thresholds are generous ceilings on a
 * laptop (better-sqlite3); the point is to catch anything that grows badly.
 *
 * @jest-environment node
 */
import { BUILT_IN_EXERCISES } from '../../data/exercises/builtInExercises';
import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, toIso, type BackupFile } from '../../domain/backup/format';
import { uuidv4 } from '../../utils/uuid';
import { createTestServices, resetAllDatabases } from '../../test/testServices';

jest.setTimeout(240_000);
afterAll(() => resetAllDatabases());

const WORKOUTS = 3000;
const DAY = 86_400_000;
const weighted = BUILT_IN_EXERCISES.filter(e => e.trackingType === 'weight_reps');

function bigBackup(now: number): BackupFile {
  const workouts = [];
  for (let i = 0; i < WORKOUTS; i++) {
    const start = now - (WORKOUTS - i) * (DAY / 3); // three a day over ~2.7 years: heavier than any real lifter
    const exercises = [];
    for (let k = 0; k < 5; k++) {
      const ex = weighted[(i + k * 3) % weighted.length];
      const sets = [];
      for (let j = 0; j < 4; j++) {
        sets.push({
          id: uuidv4(),
          setType: j === 0 ? ('warmup' as const) : ('normal' as const),
          weightValue: 40 + ((i / 10) % 60) + j * 2.5,
          weightUnit: 'kg' as const,
          reps: 5 + (j % 3),
          durationSeconds: null,
          distanceValue: null,
          distanceUnit: null,
          rpe: null,
          completedAt: toIso(start + 60_000 * (k * 4 + j)),
          createdAt: toIso(start),
          updatedAt: toIso(start),
        });
      }
      exercises.push({
        id: uuidv4(),
        exerciseId: ex.id,
        notes: null,
        restSeconds: null,
        createdAt: toIso(start),
        updatedAt: toIso(start),
        sets,
      });
    }
    workouts.push({
      id: uuidv4(),
      name: `Session ${i + 1}`,
      routineId: null,
      startedAt: toIso(start),
      endedAt: toIso(start + 3_600_000),
      pausedDurationMs: 0,
      notes: null,
      createdAt: toIso(start),
      updatedAt: toIso(start),
      deletedAt: null,
      exercises,
    });
  }
  const exercises = weighted.map(e => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
    trackingType: e.trackingType,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    instructions: e.instructions,
    isCustom: false,
    createdAt: toIso(e.createdAt),
    updatedAt: toIso(e.updatedAt),
    deletedAt: null,
  }));
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: toIso(now),
    appVersion: 'test',
    dataRevision: 1,
    data: { exercises, workouts, routines: [], preferences: {} },
  };
}

async function timed<T>(label: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const out = await fn();
  const took = Date.now() - t0;
  console.log(`${label.padEnd(34)} ${String(took).padStart(6)} ms (ceiling ${ms})`);
  expect(took).toBeLessThan(ms);
  return out;
}

it('stays responsive with 3,000 workouts and 60,000 sets', async () => {
  const { services, clock, db } = await createTestServices();
  const file = bigBackup(clock.now());

  await timed('import 3,000 workouts', 120_000, () => services.backup.applyImport(file));
  const [{ n }] = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM sets');
  expect(Number(n)).toBe(WORKOUTS * 20);

  const page = await timed('history: first page', 300, () => services.history.list({ limit: 30 }));
  expect(page).toHaveLength(30);
  await timed('history: page 50', 300, () => services.history.list({ limit: 30, startedBefore: page[29].workout.startedAt - 49 * 30 * DAY }));
  await timed('history: filter by exercise', 500, () => services.history.list({ limit: 30, exerciseId: weighted[0].id }));
  await timed('home: this week', 300, () => services.history.thisWeek());
  await timed('analytics: 52 weeks', 2_000, () => services.analytics.weekly(52));
  await timed('analytics: week streak (104 wk)', 3_000, () => services.analytics.weekStreak());
  await timed('analytics: e1RM series', 1_500, () => services.analytics.e1rmSeries(weighted[0].id));
  await timed('analytics: logged exercises', 1_000, () => services.analytics.loggedExercises());
  await timed('analytics: records', 500, () => services.analytics.records());

  // Finishing a workout rebuilds records from every past set of its exercises.
  let d = await services.workouts.startEmpty('kg');
  d = await services.workouts.addExercise(d.workout.id, weighted[0].id, 'kg');
  const s = d.exercises[0].sets[0];
  await services.workouts.updateSet(s.id, { weightValue: 200, reps: 1 });
  await services.workouts.setCompleted(s.id, true);
  const sum = await timed('finish a workout (rebuild records)', 3_000, () => services.workouts.complete(d.workout.id));
  expect(sum.improvements.length).toBeGreaterThan(0);

  const exported = await timed('export to JSON', 20_000, () => services.backup.exportJson());
  expect(exported.json.length).toBeLessThan(40 * 1024 * 1024);
  await timed('re-import same file (no changes)', 60_000, async () => {
    const p = await services.backup.previewImport(exported.json);
    expect(p.noChanges).toBe(true);
  });
});
