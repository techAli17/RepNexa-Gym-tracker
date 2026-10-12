import type { Repositories, UnitOfWork } from '../../../application/ports/repositories';
import type { SqlDatabase, SqlExecutor } from '../SqlDatabase';
import { SqliteBackupDataRepository } from './SqliteBackupDataRepository';
import { SqliteExerciseRepository } from './SqliteExerciseRepository';
import { SqlitePlanRepository } from './SqlitePlanRepository';
import { SqliteRoutineRepository } from './SqliteRoutineRepository';
import {
  SqliteBackupStateRepository,
  SqlitePersonalRecordRepository,
  SqliteSettingsRepository,
} from './SqliteSupportRepositories';
import { SqliteWorkoutRepository } from './SqliteWorkoutRepository';

export function createRepositories(db: SqlExecutor): Repositories {
  return {
    exercises: new SqliteExerciseRepository(db),
    workouts: new SqliteWorkoutRepository(db),
    routines: new SqliteRoutineRepository(db),
    records: new SqlitePersonalRecordRepository(db),
    settings: new SqliteSettingsRepository(db),
    backupState: new SqliteBackupStateRepository(db),
    backupData: new SqliteBackupDataRepository(db),
    plan: new SqlitePlanRepository(db),
  };
}

/**
 * `onCommittedChange` fires after a transaction that bumped the backup revision
 * has committed, never for one that rolled back. Auto-backup listens to it.
 */
export function createUnitOfWork(db: SqlDatabase, onCommittedChange?: () => void): UnitOfWork {
  return {
    async run(fn) {
      let changed = false;
      const result = await db.transaction(tx => {
        const repos = createRepositories(tx);
        const bump = repos.backupState.bumpLocalRevision.bind(repos.backupState);
        repos.backupState.bumpLocalRevision = () => {
          changed = true;
          return bump();
        };
        return fn(repos);
      });
      if (changed) onCommittedChange?.();
      return result;
    },
  };
}
