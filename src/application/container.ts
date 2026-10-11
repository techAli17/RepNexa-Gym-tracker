import { BUILT_IN_EXERCISES } from '../data/exercises/builtInExercises';
import { migrate } from '../infrastructure/database/migrations';
import { createRepositories, createUnitOfWork } from '../infrastructure/database/repositories';
import { configureConnection, type SqlDatabase } from '../infrastructure/database/SqlDatabase';
import { uuidGenerator } from '../utils/uuid';
import { ExerciseService } from './exercises/ExerciseService';
import { HistoryService } from './history/HistoryService';
import { systemClock, type Clock, type IdGenerator } from './ports/system';
import { SettingsService } from './settings/SettingsService';
import { WorkoutService } from './workouts/WorkoutService';

export interface AppServices {
  workouts: WorkoutService;
  exercises: ExerciseService;
  history: HistoryService;
  settings: SettingsService;
}

/**
 * Composition root: the only place that knows which infrastructure backs the
 * application ports. Screens receive `AppServices` and never see SQLite.
 */
export async function createAppServices(
  db: SqlDatabase,
  opts: { clock?: Clock; ids?: IdGenerator } = {},
): Promise<AppServices> {
  await configureConnection(db);
  await migrate(db);
  const deps = {
    repos: createRepositories(db),
    uow: createUnitOfWork(db),
    clock: opts.clock ?? systemClock,
    ids: opts.ids ?? uuidGenerator,
  };
  const services: AppServices = {
    workouts: new WorkoutService(deps),
    exercises: new ExerciseService(deps),
    history: new HistoryService(deps),
    settings: new SettingsService(deps),
  };
  await services.exercises.seedBuiltIns(BUILT_IN_EXERCISES);
  return services;
}
