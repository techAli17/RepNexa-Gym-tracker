import type { Migration } from './types';

export const migration004: Migration = {
  version: 4,
  name: 'exercise photos',
  statements: [
    // Your own photo per exercise, built-in or custom. The file lives in the app's
    // documents folder; like the gym photo it is not in backups or exports.
    `CREATE TABLE exercise_photos (
      exercise_id TEXT PRIMARY KEY NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
      file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 100),
      updated_at INTEGER NOT NULL
    )`,
  ],
};
