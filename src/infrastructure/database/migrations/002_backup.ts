import type { Migration } from './types';

export const migration002: Migration = {
  version: 2,
  name: 'backup sync and retention',
  statements: [
    // Workouts removed from this phone by the retention policy after a verified
    // backup. They still live in Drive; listing them stops a sync from
    // downloading them again, and tells deletion apart from pruning.
    `CREATE TABLE pruned_workouts (
      workout_id TEXT PRIMARY KEY NOT NULL,
      started_at INTEGER NOT NULL,
      pruned_at INTEGER NOT NULL
    )`,
    // When the last verified snapshot was taken (local clock): rows not
    // updated since then are known to be in Drive.
    `ALTER TABLE backup_state ADD COLUMN snapshot_at INTEGER`,
    `ALTER TABLE backup_state ADD COLUMN last_error_message TEXT`,
    `CREATE INDEX idx_workouts_updated ON workouts (updated_at)`,
  ],
};
