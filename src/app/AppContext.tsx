import React, { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { AppServices } from '../application/container';
import type { ActiveWorkoutState, ActiveWorkoutStore } from '../store/activeWorkoutStore';
import type { SettingsState, SettingsStore } from '../store/settingsStore';

export interface AppContextValue {
  services: AppServices;
  activeWorkout: ActiveWorkoutStore;
  settings: SettingsStore;
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

/** The store itself, for calling actions without subscribing to state. */
export const useActiveWorkoutStore = () => useApp().activeWorkout;

/** Subscribe to a slice so components re-render only when that slice changes. */
export function useActiveWorkout<T>(selector: (s: ActiveWorkoutState) => T): T {
  return useStore(useApp().activeWorkout, selector);
}

export function useSettings<T>(selector: (s: SettingsState) => T): T {
  return useStore(useApp().settings, selector);
}
