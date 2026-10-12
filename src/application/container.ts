import { BUILT_IN_EXERCISES } from '../data/exercises/builtInExercises';
import { migrate } from '../infrastructure/database/migrations';
import { createRepositories, createUnitOfWork } from '../infrastructure/database/repositories';
import { configureConnection, type SqlDatabase } from '../infrastructure/database/SqlDatabase';
import { uuidGenerator } from '../utils/uuid';
import { AnalyticsService } from './analytics/AnalyticsService';
import { BackupService } from './backup/BackupService';
import { ExerciseService } from './exercises/ExerciseService';
import { HistoryService } from './history/HistoryService';
import { PlanService } from './plan/PlanService';
import { RoutineService } from './routines/RoutineService';
import { systemClock, type Clock, type IdGenerator } from './ports/system';
import { SettingsService } from './settings/SettingsService';
import { WorkoutService } from './workouts/WorkoutService';

export interface AppServices {
  workouts: WorkoutService;
  exercises: ExerciseService;
  history: HistoryService;
  settings: SettingsService;
  routines: RoutineService;
  analytics: AnalyticsService;
  backup: BackupService;
  plan: PlanService;
  /** Subscribe to committed changes that need backing up. Returns an unsubscribe function. */
  onDataChanged(listener: () => void): () => void;
}

export const APP_VERSION = '0.1.0';

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
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());
  const deps = {
    repos: createRepositories(db),
    uow: createUnitOfWork(db, emit),
    clock: opts.clock ?? systemClock,
    ids: opts.ids ?? uuidGenerator,
  };
  const settings = new SettingsService(deps);
  const routines = new RoutineService(deps);
  const services: AppServices = {
    workouts: new WorkoutService(deps),
    exercises: new ExerciseService(deps),
    history: new HistoryService(deps),
    settings,
    routines,
    plan: new PlanService({ ...deps, routines }),
    analytics: new AnalyticsService(deps),
    backup: new BackupService({ ...deps, appVersion: APP_VERSION, loadSettings: r => settings.load(r) }),
    onDataChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  await services.exercises.seedBuiltIns(BUILT_IN_EXERCISES);
  return services;
}
