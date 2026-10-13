/**
 * @jest-environment node
 */
import { openTestDb, resetAllDatabases } from '../../../test/testServices';
import {
  LATEST_SCHEMA_VERSION,
  getSchemaVersion,
  migrate,
} from '../migrations';
import { configureConnection } from '../SqlDatabase';

afterAll(() => resetAllDatabases());

/**
 * better-sqlite3 errors come from another realm, so Jest's rejects/toThrow
 * matcher does not recognise them. Assert on the message instead.
 */
async function rejectsWith(p: Promise<unknown>, pattern: RegExp) {
  let error: unknown;
  try {
    await p;
  } catch (e) {
    error = e;
  }
  expect(error).toBeDefined();
  expect(String((error as { message?: string })?.message ?? error)).toMatch(
    pattern,
  );
}

async function freshDb() {
  const db = openTestDb();
  await configureConnection(db);
  return db;
}

const now = 1_700_000_000_000;

async function insertExercise(
  db: Awaited<ReturnType<typeof freshDb>>,
  id = 'ex1',
) {
  await db.run(
    `INSERT INTO exercises (id, name, muscle_group, equipment, tracking_type, created_at, updated_at)
     VALUES (?, 'Squat', 'legs', 'barbell', 'weight_reps', ?, ?)`,
    [id, now, now],
  );
}

async function insertWorkout(
  db: Awaited<ReturnType<typeof freshDb>>,
  id: string,
  status = 'in_progress',
) {
  await db.run(
    `INSERT INTO workouts (id, name, status, started_at, ended_at, created_at, updated_at)
     VALUES (?, 'W', ?, ?, ?, ?, ?)`,
    [id, status, now, status === 'completed' ? now + 1 : null, now, now],
  );
}

describe('migrations', () => {
  it('creates every table and records the schema version', async () => {
    const db = await freshDb();
    expect(await migrate(db)).toEqual({ from: 0, to: LATEST_SCHEMA_VERSION });
    const tables = (
      await db.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
      )
    ).map(r => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'exercises',
        'workouts',
        'workout_exercises',
        'sets',
        'routines',
        'routine_exercises',
        'personal_records',
        'app_settings',
        'backup_state',
        'exercise_photos',
      ]),
    );
    expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('is a no-op when already current', async () => {
    const db = await freshDb();
    await migrate(db);
    expect(await migrate(db)).toEqual({
      from: LATEST_SCHEMA_VERSION,
      to: LATEST_SCHEMA_VERSION,
    });
  });

  it('refuses a database from a newer app version', async () => {
    const db = await freshDb();
    await db.run('PRAGMA user_version = 999');
    await rejectsWith(migrate(db), /newer than this app supports/);
  });

  it('rolls back a failing migration without bumping the version', async () => {
    const db = await freshDb();
    await migrate(db);
    const bad = {
      version: LATEST_SCHEMA_VERSION + 1,
      name: 'bad',
      statements: ['CREATE TABLE t_ok (x)', 'NOT SQL'],
    };
    await rejectsWith(
      migrate(db, [
        { version: LATEST_SCHEMA_VERSION, name: 'cur', statements: [] },
        bad,
      ]),
      /syntax error/,
    );
    expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    const t = await db.query(
      `SELECT name FROM sqlite_master WHERE name = 't_ok'`,
    );
    expect(t).toHaveLength(0);
  });
});

describe('schema constraints', () => {
  it('allows only one in-progress workout', async () => {
    const db = await freshDb();
    await migrate(db);
    await insertWorkout(db, 'w1');
    await rejectsWith(insertWorkout(db, 'w2'), /UNIQUE constraint failed/);
    await insertWorkout(db, 'w3', 'completed');
  });

  it('enforces foreign keys and cascades sets with their workout', async () => {
    const db = await freshDb();
    await migrate(db);
    await insertExercise(db);
    await insertWorkout(db, 'w1');
    await rejectsWith(
      db.run(
        `INSERT INTO workout_exercises (id, workout_id, exercise_id, position, created_at, updated_at)
              VALUES ('we-x', 'w1', 'missing', 0, ?, ?)`,
        [now, now],
      ),
      /FOREIGN KEY constraint failed/,
    );
    await db.run(
      `INSERT INTO workout_exercises (id, workout_id, exercise_id, position, created_at, updated_at)
                  VALUES ('we1', 'w1', 'ex1', 0, ?, ?)`,
      [now, now],
    );
    await db.run(
      `INSERT INTO sets (id, workout_exercise_id, position, set_type, weight_unit, created_at, updated_at)
                  VALUES ('s1', 'we1', 0, 'normal', 'kg', ?, ?)`,
      [now, now],
    );
    await db.run(`DELETE FROM workouts WHERE id = 'w1'`);
    expect(await db.query('SELECT id FROM sets')).toHaveLength(0);
  });

  it('rejects invalid values at the database level too', async () => {
    const db = await freshDb();
    await migrate(db);
    await rejectsWith(
      db.run(
        `INSERT INTO workouts (id, name, status, started_at, created_at, updated_at)
              VALUES ('w', 'W', 'completed', ?, ?, ?)`,
        [now, now, now],
      ),
      /CHECK constraint failed/,
    ); // completed needs ended_at
    await insertExercise(db);
    await insertWorkout(db, 'w1');
    await db.run(
      `INSERT INTO workout_exercises (id, workout_id, exercise_id, position, created_at, updated_at)
                  VALUES ('we1', 'w1', 'ex1', 0, ?, ?)`,
      [now, now],
    );
    for (const bad of [`'stone'`, 'NULL']) {
      await rejectsWith(
        db.run(
          `INSERT INTO sets (id, workout_exercise_id, position, set_type, weight_unit, created_at, updated_at)
                VALUES ('s', 'we1', 0, 'normal', ${bad}, ?, ?)`,
          [now, now],
        ),
        /constraint failed/,
      );
    }
    await rejectsWith(
      db.run(
        `INSERT INTO sets (id, workout_exercise_id, position, set_type, weight_unit, reps, created_at, updated_at)
              VALUES ('s', 'we1', 0, 'normal', 'kg', -1, ?, ?)`,
        [now, now],
      ),
      /CHECK constraint failed/,
    );
  });

  it('prevents duplicate custom exercise names, case-insensitively', async () => {
    const db = await freshDb();
    await migrate(db);
    const ins = (id: string, name: string) =>
      db.run(
        `INSERT INTO exercises (id, name, muscle_group, equipment, tracking_type, is_custom, created_at, updated_at)
              VALUES (?, ?, 'legs', 'barbell', 'weight_reps', 1, ?, ?)`,
        [id, name, now, now],
      );
    await ins('a', 'Zercher Squat');
    await rejectsWith(ins('b', ' zercher squat '), /UNIQUE constraint failed/);
  });
});
