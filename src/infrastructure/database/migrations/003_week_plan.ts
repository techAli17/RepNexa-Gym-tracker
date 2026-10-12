import type { Migration } from './types';

export const migration003: Migration = {
  version: 3,
  name: 'weekly plan',
  statements: [
    // Single row. week_start uses JavaScript's getDay(): 0 = Sunday … 6 = Saturday.
    `CREATE TABLE plan_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      week_start INTEGER NOT NULL DEFAULT 1 CHECK (week_start BETWEEN 0 AND 6),
      updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `INSERT INTO plan_settings (id) VALUES (1)`,
    // One row per planned weekday. A day with no row is "not planned".
    // Deleting a routine clears the day instead of deleting it.
    `CREATE TABLE plan_days (
      weekday INTEGER PRIMARY KEY NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      routine_id TEXT REFERENCES routines (id) ON DELETE SET NULL,
      is_rest INTEGER NOT NULL DEFAULT 0 CHECK (is_rest IN (0, 1)),
      updated_at INTEGER NOT NULL,
      CHECK (is_rest = 0 OR routine_id IS NULL)
    )`,
  ],
};
