import type { Timestamp, Uuid } from './units';

export const RECORD_TYPES = ['e1rm', 'max_weight', 'max_reps', 'best_set_volume'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

/** Cached, derived from workout sets. Rebuilt after completes and deletes; never backed up. */
export interface PersonalRecord {
  exerciseId: Uuid;
  recordType: RecordType;
  /** kg for weight-based records, a count for max_reps. */
  value: number;
  workoutId: Uuid;
  setId: Uuid;
  achievedAt: Timestamp;
}
