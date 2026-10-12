import type {
  BackupState,
  BackupStateRepository,
  PersonalRecordRepository,
  SettingsRepository,
} from '../../../application/ports/repositories';
import type { PersonalRecord, Timestamp, Uuid } from '../../../domain/models';
import type { SqlExecutor } from '../SqlDatabase';
import { placeholders, rowToRecord } from './mappers';

export class SqlitePersonalRecordRepository implements PersonalRecordRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listForExercises(exerciseIds: readonly Uuid[]): Promise<PersonalRecord[]> {
    if (!exerciseIds.length) return [];
    const ids = [...new Set(exerciseIds)];
    const rows = await this.db.query(
      `SELECT exercise_id, record_type, value, workout_id, set_id, achieved_at
       FROM personal_records WHERE exercise_id IN (${placeholders(ids.length)})`,
      ids,
    );
    return rows.map(rowToRecord);
  }

  async replaceForExercise(exerciseId: Uuid, records: readonly PersonalRecord[], at: Timestamp): Promise<void> {
    await this.db.run('DELETE FROM personal_records WHERE exercise_id = ?', [exerciseId]);
    for (const r of records) {
      await this.db.run(
        `INSERT INTO personal_records (exercise_id, record_type, value, workout_id, set_id, achieved_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [exerciseId, r.recordType, r.value, r.workoutId, r.setId, r.achievedAt, at],
      );
    }
  }

  async listAll(): Promise<PersonalRecord[]> {
    const rows = await this.db.query(
      'SELECT exercise_id, record_type, value, workout_id, set_id, achieved_at FROM personal_records ORDER BY achieved_at DESC',
    );
    return rows.map(rowToRecord);
  }

  async countForWorkout(workoutId: Uuid): Promise<number> {
    const rows = await this.db.query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM personal_records WHERE workout_id = ?',
      [workoutId],
    );
    return Number(rows[0]?.n ?? 0);
  }
}

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly db: SqlExecutor) {}

  async get<T>(key: string): Promise<T | undefined> {
    const rows = await this.db.query<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
    if (!rows[0]) return undefined;
    try {
      return JSON.parse(rows[0].value) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, at: Timestamp): Promise<void> {
    await this.db.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), at],
    );
  }
}

export class SqliteBackupStateRepository implements BackupStateRepository {
  constructor(private readonly db: SqlExecutor) {}

  async get(): Promise<BackupState> {
    const rows = await this.db.query(
      'SELECT local_revision, backed_up_revision, last_success_at FROM backup_state WHERE id = 1',
    );
    const r = rows[0] ?? {};
    return {
      localRevision: Number(r.local_revision ?? 0),
      backedUpRevision: Number(r.backed_up_revision ?? 0),
      lastSuccessAt: r.last_success_at == null ? null : Number(r.last_success_at),
    };
  }

  async bumpLocalRevision(): Promise<number> {
    await this.db.run('UPDATE backup_state SET local_revision = local_revision + 1 WHERE id = 1');
    return (await this.get()).localRevision;
  }
}
