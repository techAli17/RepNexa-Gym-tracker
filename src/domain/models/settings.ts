import type { WeightUnit } from './units';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  weightUnit: WeightUnit;
  theme: ThemePreference;
  defaultRestSeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  weightUnit: 'kg',
  theme: 'system',
  defaultRestSeconds: 90,
};
