import { z } from 'zod';
import { DomainError } from '../errors';

export const routineExerciseInputSchema = z.object({
  exerciseId: z.string().min(1),
  targetSets: z.number().int().min(1, 'At least 1 set').max(20, 'At most 20 sets'),
  targetReps: z.number().int().min(1).max(999).nullable(),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  notes: z.string().trim().max(500).nullable().default(null),
});

export const routineInputSchema = z.object({
  name: z.string().trim().min(1, 'Give the routine a name').max(80, 'Keep the name under 80 characters'),
  notes: z.string().trim().max(1000).nullable().default(null),
  exercises: z.array(routineExerciseInputSchema).min(1, 'Add at least one exercise').max(30, 'At most 30 exercises'),
});

export type RoutineInput = z.input<typeof routineInputSchema>;
export type RoutineValues = z.output<typeof routineInputSchema>;

export function parseRoutineInput(input: unknown): RoutineValues {
  const r = routineInputSchema.safeParse(input);
  if (!r.success) {
    throw new DomainError('VALIDATION', r.error.issues[0]?.message ?? 'Invalid routine', {
      issues: r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return r.data;
}
