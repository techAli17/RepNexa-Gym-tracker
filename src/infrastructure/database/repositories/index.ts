import type { Repositories, UnitOfWork } from '../../../application/ports/repositories';
import type { SqlDatabase, SqlExecutor } from '../SqlDatabase';
import { SqliteExerciseRepository } from './SqliteExerciseRepository';
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
  };
}

export function createUnitOfWork(db: SqlDatabase): UnitOfWork {
  return { run: fn => db.transaction(tx => fn(createRepositories(tx))) };
}
