import { z } from 'zod';
import type { TrackingType } from '../models/exercise';
import { SET_TYPES, type WorkoutSet } from '../models/workout';
import { DISTANCE_UNITS, WEIGHT_UNITS } from '../models/units';
import { DomainError } from '../errors';

/** Ceilings well beyond world records; they exist to catch typos like 1000 for 100. */
export const LIMITS = {
  weight: 1500,
  reps: 999,
  durationSeconds: 24 * 3600,
  distance: 1_000_000,
} as const;

export const setPatchSchema = z
  .object({
    setType: z.enum(SET_TYPES),
    weightValue: z.number().finite().min(0).max(LIMITS.weight).nullable(),
    weightUnit: z.enum(WEIGHT_UNITS),
    reps: z.number().int().min(0).max(LIMITS.reps).nullable(),
    durationSeconds: z.number().int().min(0).max(LIMITS.durationSeconds).nullable(),
    distanceValue: z.number().finite().min(0).max(LIMITS.distance).nullable(),
    distanceUnit: z.enum(DISTANCE_UNITS).nullable(),
    rpe: z.number().min(1).max(10).multipleOf(0.5).nullable(),
  })
  .partial()
  .strict();

export type SetPatch = z.infer<typeof setPatchSchema>;

export function parseSetPatch(input: unknown): SetPatch {
  const r = setPatchSchema.safeParse(input);
  if (!r.success) {
    throw new DomainError('VALIDATION', 'Invalid set values', {
      issues: r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return r.data;
}

/**
 * Parses a number typed into a set field. Accepts a comma decimal separator,
 * which many locales use. Returns undefined for invalid input and null for empty.
 */
export function parseNumericInput(raw: string): number | null | undefined {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export type MissingField = 'reps' | 'weight' | 'duration' | 'distance';

/** Which required fields stop this set from being checked off, for its exercise type. */
export function missingFieldsForCompletion(s: WorkoutSet, tracking: TrackingType): MissingField[] {
  const missing: MissingField[] = [];
  switch (tracking) {
    case 'weight_reps':
      if (!(s.reps! > 0)) missing.push('reps');
      if (s.weightValue == null) missing.push('weight');
      break;
    case 'bodyweight_reps':
      if (!(s.reps! > 0)) missing.push('reps');
      break;
    case 'duration':
      if (!(s.durationSeconds! > 0)) missing.push('duration');
      break;
    case 'distance_duration':
      if (!(s.distanceValue! > 0)) missing.push('distance');
      if (!(s.durationSeconds! > 0)) missing.push('duration');
      break;
  }
  return missing;
}
