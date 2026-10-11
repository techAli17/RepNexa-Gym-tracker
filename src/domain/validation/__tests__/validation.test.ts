import { isDomainError } from '../../errors';
import type { WorkoutSet } from '../../models';
import { missingFieldsForCompletion, parseCustomExercise, parseNumericInput, parseSetPatch } from '..';

describe('parseSetPatch', () => {
  it('accepts valid partial patches', () => {
    expect(parseSetPatch({ reps: 8 })).toEqual({ reps: 8 });
    expect(parseSetPatch({ weightValue: 102.5, weightUnit: 'lb', rpe: 8.5 })).toEqual({
      weightValue: 102.5,
      weightUnit: 'lb',
      rpe: 8.5,
    });
    expect(parseSetPatch({ weightValue: null })).toEqual({ weightValue: null });
  });

  it.each([
    [{ reps: -1 }],
    [{ reps: 2.5 }],
    [{ weightValue: 5000 }],
    [{ weightValue: Number.NaN }],
    [{ rpe: 8.3 }],
    [{ rpe: 11 }],
    [{ setType: 'giant' }],
    [{ weightUnit: 'stone' }],
    [{ unknownField: 1 }],
  ])('rejects %j', input => {
    try {
      parseSetPatch(input);
      throw new Error('expected rejection');
    } catch (e) {
      expect(isDomainError(e, 'VALIDATION')).toBe(true);
    }
  });
});

describe('parseNumericInput', () => {
  it('handles empty, dot and comma decimals, and garbage', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('  ')).toBeNull();
    expect(parseNumericInput('82.5')).toBe(82.5);
    expect(parseNumericInput('82,5')).toBe(82.5);
    expect(parseNumericInput('.5')).toBe(0.5);
    expect(parseNumericInput('5.')).toBe(5);
    expect(parseNumericInput('.')).toBeUndefined();
    expect(parseNumericInput('-3')).toBeUndefined();
    expect(parseNumericInput('1e3')).toBeUndefined();
    expect(parseNumericInput('12kg')).toBeUndefined();
  });
});

describe('missingFieldsForCompletion', () => {
  const s = (p: Partial<WorkoutSet>) => ({ reps: null, weightValue: null, durationSeconds: null, distanceValue: null, ...p }) as WorkoutSet;

  it('requires fields by tracking type', () => {
    expect(missingFieldsForCompletion(s({}), 'weight_reps')).toEqual(['reps', 'weight']);
    expect(missingFieldsForCompletion(s({ reps: 5, weightValue: 0 }), 'weight_reps')).toEqual([]);
    expect(missingFieldsForCompletion(s({ reps: 0 }), 'bodyweight_reps')).toEqual(['reps']);
    expect(missingFieldsForCompletion(s({ reps: 10 }), 'bodyweight_reps')).toEqual([]);
    expect(missingFieldsForCompletion(s({}), 'duration')).toEqual(['duration']);
    expect(missingFieldsForCompletion(s({ durationSeconds: 600 }), 'distance_duration')).toEqual(['distance']);
  });
});

describe('parseCustomExercise', () => {
  it('trims and defaults', () => {
    expect(
      parseCustomExercise({ name: '  Zercher Squat ', muscleGroup: 'legs', equipment: 'barbell', trackingType: 'weight_reps' }),
    ).toEqual({ name: 'Zercher Squat', muscleGroup: 'legs', equipment: 'barbell', trackingType: 'weight_reps', instructions: null });
  });

  it('rejects a blank name with a readable message', () => {
    expect(() =>
      parseCustomExercise({ name: '   ', muscleGroup: 'legs', equipment: 'barbell', trackingType: 'weight_reps' }),
    ).toThrow('Give the exercise a name');
  });
});
