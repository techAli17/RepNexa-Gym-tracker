import { z } from 'zod';
import { EQUIPMENT, MUSCLE_GROUPS, TRACKING_TYPES } from '../models/exercise';
import { DomainError } from '../errors';

export const customExerciseSchema = z.object({
  name: z.string().trim().min(1, 'Give the exercise a name').max(80),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT),
  trackingType: z.enum(TRACKING_TYPES),
  instructions: z.string().trim().max(2000).nullable().default(null),
});

export type CustomExerciseInput = z.input<typeof customExerciseSchema>;
export type CustomExerciseValues = z.output<typeof customExerciseSchema>;

export function parseCustomExercise(input: unknown): CustomExerciseValues {
  const r = customExerciseSchema.safeParse(input);
  if (!r.success) {
    throw new DomainError('VALIDATION', r.error.issues[0]?.message ?? 'Invalid exercise', {
      issues: r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return r.data;
}
