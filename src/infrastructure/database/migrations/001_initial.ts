import type { Migration } from './types';

/**
 * Conventions:
 * - ids are TEXT UUIDs, never rowids, so they survive backup/restore across devices.
 * - timestamps are INTEGER epoch milliseconds (UTC).
 * - weights/distances store the value and its unit as entered.
 * - deleted_at is a tombstone for rows whose deletion must reach the backup.
 */
export const migration001: Migration = {
  version: 1,
  name: 'initial schema',
  statements: [
    `CREATE TABLE exercises (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
      muscle_group TEXT NOT NULL CHECK (muscle_group IN ('chest','back','legs','shoulders','arms','core','full_body','cardio')),
      equipment TEXT NOT NULL CHECK (equipment IN ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other')),
      tracking_type TEXT NOT NULL CHECK (tracking_type IN ('weight_reps','bodyweight_reps','duration','distance_duration')),
      primary_muscles TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(primary_muscles)),
      secondary_muscles TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(secondary_muscles)),
      instructions TEXT,
      image_key TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0,1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    )`,
    `CREATE INDEX idx_exercises_group ON exercises (muscle_group) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX ux_exercises_custom_name ON exercises (lower(trim(name)))
      WHERE is_custom = 1 AND deleted_at IS NULL`,

    `CREATE TABLE routines (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
      notes TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    )`,
    `CREATE TABLE routine_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      routine_id TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
      position INTEGER NOT NULL CHECK (position >= 0),
      target_sets INTEGER NOT NULL CHECK (target_sets BETWEEN 1 AND 20),
      target_reps INTEGER CHECK (target_reps IS NULL OR target_reps BETWEEN 1 AND 999),
      rest_seconds INTEGER CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600),
      notes TEXT,
      UNIQUE (routine_id, position)
    )`,
    `CREATE INDEX idx_routine_exercises_exercise ON routine_exercises (exercise_id)`,

    `CREATE TABLE workouts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
      routine_id TEXT REFERENCES routines (id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK (status IN ('in_progress','completed')),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      paused_at INTEGER,
      paused_duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (paused_duration_ms >= 0),
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      CHECK (status = 'in_progress' OR ended_at IS NOT NULL),
      CHECK (ended_at IS NULL OR ended_at >= started_at),
      CHECK (status = 'in_progress' OR paused_at IS NULL)
    )`,
    // At most one active workout: the guard that makes "start" safe to double-tap.
    `CREATE UNIQUE INDEX ux_workouts_single_active ON workouts (status) WHERE status = 'in_progress'`,
    `CREATE INDEX idx_workouts_history ON workouts (started_at DESC)
      WHERE status = 'completed' AND deleted_at IS NULL`,

    `CREATE TABLE workout_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises (id) ON DELETE RESTRICT,
      position INTEGER NOT NULL,
      notes TEXT,
      rest_seconds INTEGER CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (workout_id, position)
    )`,
    `CREATE INDEX idx_workout_exercises_exercise ON workout_exercises (exercise_id)`,

    `CREATE TABLE sets (
      id TEXT PRIMARY KEY NOT NULL,
      workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position >= 0),
      set_type TEXT NOT NULL CHECK (set_type IN ('normal','warmup','drop','failure')),
      weight_value REAL CHECK (weight_value IS NULL OR weight_value >= 0),
      weight_unit TEXT NOT NULL CHECK (weight_unit IN ('kg','lb')),
      reps INTEGER CHECK (reps IS NULL OR reps >= 0),
      duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
      distance_value REAL CHECK (distance_value IS NULL OR distance_value >= 0),
      distance_unit TEXT CHECK (distance_unit IS NULL OR distance_unit IN ('m','km','mi')),
      rpe REAL CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (distance_value IS NULL OR distance_unit IS NOT NULL),
      UNIQUE (workout_exercise_id, position)
    )`,

    `CREATE TABLE personal_records (
      exercise_id TEXT NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
      record_type TEXT NOT NULL CHECK (record_type IN ('e1rm','max_weight','max_reps','best_set_volume')),
      value REAL NOT NULL,
      workout_id TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
      set_id TEXT NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
      achieved_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (exercise_id, record_type)
    )`,
    `CREATE INDEX idx_personal_records_workout ON personal_records (workout_id)`,

    `CREATE TABLE app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL CHECK (json_valid(value)),
      updated_at INTEGER NOT NULL
    )`,

    // Single row. Drive fields are filled in Phase 4.
    `CREATE TABLE backup_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      local_revision INTEGER NOT NULL DEFAULT 0,
      backed_up_revision INTEGER NOT NULL DEFAULT 0,
      last_success_at INTEGER,
      last_attempt_at INTEGER,
      last_error_code TEXT,
      account_id TEXT,
      remote_folder_id TEXT,
      remote_file_id TEXT,
      remote_revision_id TEXT,
      remote_modified_at INTEGER,
      CHECK (backed_up_revision <= local_revision)
    )`,
    `INSERT INTO backup_state (id) VALUES (1)`,
  ],
};
