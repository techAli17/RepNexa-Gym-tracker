import { z } from 'zod';
import { EQUIPMENT, MUSCLE_GROUPS, SET_TYPES, TRACKING_TYPES, DISTANCE_UNITS, WEIGHT_UNITS } from '../models';

/**
 * RepNexa backup file, schema version 1.
 *
 * - Every entity carries a stable UUID; merges match on it, so importing the
 *   same file twice never duplicates anything.
 * - Workouts and routines are aggregates: their exercises and sets are nested,
 *   so a file can never reference a set without its workout.
 * - Timestamps are ISO 8601 strings in UTC. Weights and distances keep the
 *   value and unit as logged.
 * - Deletions travel as tombstones (`deletedAt` set, children empty) so they
 *   reach other devices instead of being resurrected by an older copy.
 */
export const BACKUP_FORMAT = 'repnexa.backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_FILE_NAME = 'RepNexa-Backup.json';
/** Larger files are rejected before parsing; years of training are well under 5 MB. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid id');
const iso = z.iso.datetime({ offset: false });
const isoOrNull = iso.nullable();

export const backupSetSchema = z.object({
  id: uuid,
  setType: z.enum(SET_TYPES),
  weightValue: z.number().finite().min(0).max(5000).nullable(),
  weightUnit: z.enum(WEIGHT_UNITS),
  reps: z.number().int().min(0).max(10000).nullable(),
  durationSeconds: z.number().int().min(0).max(7 * 86400).nullable(),
  distanceValue: z.number().finite().min(0).max(10_000_000).nullable(),
  distanceUnit: z.enum(DISTANCE_UNITS).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  completedAt: isoOrNull,
  createdAt: iso,
  updatedAt: iso,
});

export const backupWorkoutExerciseSchema = z.object({
  id: uuid,
  exerciseId: uuid,
  notes: z.string().max(5000).nullable(),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  createdAt: iso,
  updatedAt: iso,
  sets: z.array(backupSetSchema).max(200),
});

export const backupWorkoutSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
  routineId: uuid.nullable(),
  startedAt: iso,
  endedAt: isoOrNull,
  pausedDurationMs: z.number().int().min(0),
  notes: z.string().max(10000).nullable(),
  createdAt: iso,
  updatedAt: iso,
  deletedAt: isoOrNull,
  exercises: z.array(backupWorkoutExerciseSchema).max(100),
});

export const backupExerciseSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT),
  trackingType: z.enum(TRACKING_TYPES),
  primaryMuscles: z.array(z.string().max(60)).max(20),
  secondaryMuscles: z.array(z.string().max(60)).max(20),
  instructions: z.string().max(10000).nullable(),
  isCustom: z.boolean(),
  createdAt: iso,
  updatedAt: iso,
  deletedAt: isoOrNull,
});

export const backupRoutineSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
  notes: z.string().max(5000).nullable(),
  position: z.number().int().min(0),
  createdAt: iso,
  updatedAt: iso,
  deletedAt: isoOrNull,
  exercises: z
    .array(
      z.object({
        id: uuid,
        exerciseId: uuid,
        targetSets: z.number().int().min(1).max(20),
        targetReps: z.number().int().min(1).max(999).nullable(),
        restSeconds: z.number().int().min(0).max(3600).nullable(),
        notes: z.string().max(2000).nullable(),
      }),
    )
    .max(50),
});

export const backupPreferencesSchema = z
  .object({
    weightUnit: z.enum(WEIGHT_UNITS),
    theme: z.enum(['system', 'light', 'dark']),
    defaultRestSeconds: z.number().int().min(0).max(3600),
    gymName: z.string().max(60).nullable(),
  })
  .partial();

/** Weekly plan. Optional: files from before the plan existed have none. */
export const backupPlanSchema = z.object({
  weekStart: z.number().int().min(0).max(6),
  updatedAt: iso,
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        routineId: uuid.nullable(),
        isRest: z.boolean(),
        updatedAt: iso,
      }),
    )
    .max(7),
});

export const backupDataSchema = z.object({
  /** Custom exercises, plus every built-in a workout or routine references (for older app versions). */
  exercises: z.array(backupExerciseSchema),
  workouts: z.array(backupWorkoutSchema),
  routines: z.array(backupRoutineSchema),
  preferences: backupPreferencesSchema,
  plan: backupPlanSchema.optional(),
});

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: iso,
  appVersion: z.string().max(40),
  /** The exporting database's change counter; informational, never trusted for merging. */
  dataRevision: z.number().int().min(0),
  data: backupDataSchema,
});

export type BackupSet = z.infer<typeof backupSetSchema>;
export type BackupWorkoutExercise = z.infer<typeof backupWorkoutExerciseSchema>;
export type BackupWorkout = z.infer<typeof backupWorkoutSchema>;
export type BackupExercise = z.infer<typeof backupExerciseSchema>;
export type BackupRoutine = z.infer<typeof backupRoutineSchema>;
export type BackupData = z.infer<typeof backupDataSchema>;
export type BackupPlan = z.infer<typeof backupPlanSchema>;
export type BackupFile = z.infer<typeof backupFileSchema>;

export const toIso = (ms: number) => new Date(ms).toISOString();
export const toIsoOrNull = (ms: number | null) => (ms == null ? null : toIso(ms));
export const fromIso = (s: string) => Date.parse(s);
export const fromIsoOrNull = (s: string | null) => (s == null ? null : Date.parse(s));
