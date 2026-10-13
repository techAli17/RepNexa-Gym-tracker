import { AppState } from 'react-native';
import { createStore } from 'zustand/vanilla';
import { createAppServices } from '../application/container';
import { BackupScheduler, type BackupSchedulerState } from '../application/backup/BackupScheduler';
import type { AuthGateway } from '../application/ports/cloud';
import { DriveBackupStore } from '../infrastructure/google-drive/DriveBackupStore';
import { openAppDatabase } from '../infrastructure/database/openDatabase';
import type { SqlDatabase } from '../infrastructure/database/SqlDatabase';
import { createActiveWorkoutStore } from '../store/activeWorkoutStore';
import { createSettingsStore } from '../store/settingsStore';
import type { AppContextValue } from './AppContext';

export interface Session extends Omit<AppContextValue, 'account'> {
  owner: string;
  db: SqlDatabase;
  /** Stops background work and closes the database. */
  dispose(): Promise<void>;
}

const initialBackupState: BackupSchedulerState = {
  phase: 'idle',
  account: null,
  pending: false,
  lastSuccessAt: null,
  error: null,
  nextAttemptAt: null,
  lastOutcome: null,
};

/**
 * Everything bound to one owner's database: services, stores and the backup
 * scheduler. Switching accounts disposes the session and opens another, so two
 * accounts' data never share a connection, a cache or a store.
 */
export async function openSession(owner: string, auth: AuthGateway): Promise<Session> {
  const db = openAppDatabase(owner);
  try {
    const services = await createAppServices(db);
    const settings = createSettingsStore(services);
    await settings.getState().load();
    const activeWorkout = createActiveWorkoutStore(services, () => settings.getState().settings);
    await activeWorkout.getState().load();

    const backupStatus = createStore<BackupSchedulerState>()(() => initialBackupState);
    const scheduler = new BackupScheduler({
      backup: services.backup,
      auth,
      cloud: new DriveBackupStore(auth),
      // Drive only depends on backups to move workouts off the phone, so it always backs up.
      autoBackupEnabled: () => {
        const st = settings.getState().settings;
        return st.autoBackup || st.storagePolicy === 'drive_only';
      },
      onState: s => backupStatus.setState(s, true),
    });

    const unsubscribeChanges = services.onDataChanged(() => scheduler.notifyChange());
    const appState = AppState.addEventListener('change', s => {
      if (s === 'active') void scheduler.refresh().catch(() => undefined);
    });
    void scheduler.refresh().catch(() => undefined);

    return {
      owner,
      db,
      services,
      settings,
      activeWorkout,
      backupStatus,
      scheduler,
      auth,
      async dispose() {
        scheduler.stop();
        unsubscribeChanges();
        appState.remove();
        // A queued operation makes close() throw; give it a moment to drain.
        for (let i = 0; i < 20; i++) {
          try {
            db.close();
            return;
          } catch {
            await new Promise<void>(r => setTimeout(r, 100));
          }
        }
        db.close();
      },
    };
  } catch (e) {
    db.close(); // free the name so a retry can reopen it
    throw e;
  }
}
