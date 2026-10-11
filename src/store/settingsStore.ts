import { createStore } from 'zustand/vanilla';
import type { AppServices } from '../application/container';
import { DEFAULT_SETTINGS, type AppSettings } from '../domain/models';

export interface SettingsState {
  settings: AppSettings;
  load(): Promise<void>;
  update(patch: Partial<AppSettings>): Promise<void>;
}

export function createSettingsStore(services: AppServices) {
  return createStore<SettingsState>()(set => ({
    settings: DEFAULT_SETTINGS,
    async load() {
      set({ settings: await services.settings.load() });
    },
    async update(patch) {
      set({ settings: await services.settings.update(patch) });
    },
  }));
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
