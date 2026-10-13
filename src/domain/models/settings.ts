import type { WeightUnit } from './units';

export type ThemePreference = 'system' | 'light' | 'dark';

/** 'system' follows the phone's language (Hindi when the phone is set to Hindi, else English). */
export type LanguagePreference = 'system' | 'en' | 'hi';

/**
 * Where finished workouts are kept.
 * - 'phone_and_drive': on this phone (optionally trimmed by localRetentionMonths) and in Drive.
 * - 'drive_only': removed from this phone as soon as a verified Drive backup holds them;
 *   viewing them needs the Drive connection. The workout in progress always stays on the phone.
 */
export type StoragePolicy = 'phone_and_drive' | 'drive_only';

export interface AppSettings {
  weightUnit: WeightUnit;
  theme: ThemePreference;
  language: LanguagePreference;
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
  language: 'system',
  defaultRestSeconds: 90,
  storagePolicy: 'phone_and_drive',
  autoBackup: true,
  localRetentionMonths: null,
  gymName: null,
  gymPhotoFile: null,
};
