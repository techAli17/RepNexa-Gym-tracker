import type { WeightUnit } from './units';

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Where history lives. Only 'phone_and_drive' exists today; a strict
 * 'drive_only' policy may be added later as a separate, explicit choice.
 */
export type StoragePolicy = 'phone_and_drive';

export interface AppSettings {
  weightUnit: WeightUnit;
  theme: ThemePreference;
  defaultRestSeconds: number;
  storagePolicy: StoragePolicy;
  /** Back up to Drive automatically after changes (when connected). */
  autoBackup: boolean;
  /**
   * Keep finished workouts on this phone for this many months; older ones are
   * removed from the phone only after a verified Drive backup holds them.
   * null keeps everything.
   */
  localRetentionMonths: number | null;
  /** The user's own name for their gym, shown on Home. */
  gymName: string | null;
  /**
   * Gym photo in the app's private documents folder, stored as a file name
   * (not a path: the documents path changes between iOS installs). Never backed up.
   */
  gymPhotoFile: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  weightUnit: 'kg',
  theme: 'system',
  defaultRestSeconds: 90,
  storagePolicy: 'phone_and_drive',
  autoBackup: true,
  localRetentionMonths: null,
  gymName: null,
  gymPhotoFile: null,
};
