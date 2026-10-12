import React, { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppServices } from '../application/container';
import type { BackupScheduler, BackupSchedulerState } from '../application/backup/BackupScheduler';
import type { AuthGateway } from '../application/ports/cloud';
import type { ActiveWorkoutState, ActiveWorkoutStore } from '../store/activeWorkoutStore';
import type { SettingsState, SettingsStore } from '../store/settingsStore';

/** Account actions change which database is open, so the app root implements them. */
export interface AccountActions {
  signIn(): Promise<void>;
  /** Grants Drive access (drive.file) and runs a first backup. */
  connectDrive(): Promise<void>;
  /** Signs out; this account's data stays on the phone for the next sign-in. */
  signOut(): Promise<void>;
  /** Revokes RepNexa's access to the Google account, then signs out. */
  disconnect(): Promise<void>;
  /** Deletes this account's data from this phone (Drive is untouched). */
  wipeLocal(): Promise<void>;
}

export interface AppContextValue {
  services: AppServices;
  activeWorkout: ActiveWorkoutStore;
  settings: SettingsStore;
  backupStatus: StoreApi<BackupSchedulerState>;
  scheduler: BackupScheduler;
  auth: AuthGateway;
  owner: string;
  account: AccountActions;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppContextProvider({ value, children }: { value: AppContextValue; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppContextProvider is missing');
  return v;
}

export const useServices = () => useApp().services;
export const useAccountActions = () => useApp().account;
export const useScheduler = () => useApp().scheduler;
export const useOwner = () => useApp().owner;
export const useAuth = () => useApp().auth;

/** The store itself, for calling actions without subscribing to state. */
export const useActiveWorkoutStore = () => useApp().activeWorkout;

/** Subscribe to a slice so components re-render only when that slice changes. */
export function useActiveWorkout<T>(selector: (s: ActiveWorkoutState) => T): T {
  return useStore(useApp().activeWorkout, selector);
}

export function useSettings<T>(selector: (s: SettingsState) => T): T {
  return useStore(useApp().settings, selector);
}

export function useBackupStatus<T>(selector: (s: BackupSchedulerState) => T): T {
  return useStore(useApp().backupStatus, selector);
}
