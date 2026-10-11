/**
 * Epley estimate. Beyond ~12 reps the formula overestimates badly, so those
 * sets do not produce an estimate (they still count toward volume and max reps).
 */
export const E1RM_MAX_REPS = 12;

export function estimateOneRepMax(weight: number, reps: number): number | null {
  if (!(weight > 0) || !Number.isInteger(reps) || reps < 1 || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
