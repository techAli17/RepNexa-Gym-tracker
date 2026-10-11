import {
  computePersonalRecords,
  convertDistance,
  convertWeight,
  diffRecords,
  estimateOneRepMax,
  roundToIncrement,
  setVolumeKg,
  startOfWeek,
  toKg,
  workoutDurationMs,
  workoutVolumeKg,
  type SetWithContext,
} from '..';
import type { Exercise, WorkoutDetail, WorkoutSet } from '../../models';

const set = (p: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: p.id ?? 's1',
  workoutExerciseId: 'we1',
  position: 0,
  setType: 'normal',
  weightValue: 100,
  weightUnit: 'kg',
  reps: 5,
  durationSeconds: null,
  distanceValue: null,
  distanceUnit: null,
  rpe: null,
  completedAt: 1,
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('unit conversion', () => {
  it('converts pounds and kilograms with the exact factor', () => {
    expect(toKg(1, 'lb')).toBe(0.45359237);
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.462, 3);
    expect(convertWeight(convertWeight(225, 'lb', 'kg'), 'kg', 'lb')).toBeCloseTo(225, 10);
    expect(convertWeight(80, 'kg', 'kg')).toBe(80);
  });

  it('converts distances', () => {
    expect(convertDistance(1, 'mi', 'm')).toBeCloseTo(1609.344, 6);
    expect(convertDistance(5, 'km', 'mi')).toBeCloseTo(3.10686, 4);
    expect(convertDistance(1500, 'm', 'km')).toBe(1.5);
  });

  it('rounds to plate increments without float noise', () => {
    expect(roundToIncrement(101.3, 2.5)).toBe(102.5);
    expect(roundToIncrement(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundToIncrement(7, 0)).toBe(7);
  });
});

describe('estimateOneRepMax', () => {
  it('uses Epley and returns the weight itself for a single', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.667, 3);
  });

  it('refuses inputs where the estimate is meaningless', () => {
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    expect(estimateOneRepMax(100, 13)).toBeNull();
    expect(estimateOneRepMax(100, 2.5)).toBeNull();
  });
});

describe('volume and duration', () => {
  it('counts only completed working sets, in kg', () => {
    expect(setVolumeKg(set())).toBe(500);
    expect(setVolumeKg(set({ weightUnit: 'lb', weightValue: 100, reps: 10 }))).toBeCloseTo(453.59237, 5);
    expect(setVolumeKg(set({ setType: 'warmup' }))).toBe(0);
    expect(setVolumeKg(set({ completedAt: null }))).toBe(0);
    expect(setVolumeKg(set({ weightValue: null }))).toBe(0);
  });

  it('sums a workout', () => {
    const detail = {
      workout: {} as never,
      exercises: [
        { exercise: {} as Exercise, sets: [set(), set({ id: 's2', setType: 'drop', weightValue: 80, reps: 8 })] },
        { exercise: {} as Exercise, sets: [set({ id: 's3', setType: 'warmup' })] },
      ],
    } as unknown as WorkoutDetail;
    expect(workoutVolumeKg(detail)).toBe(500 + 640);
  });

  it('excludes paused time and freezes while paused', () => {
    const base = { startedAt: 0, endedAt: null, pausedAt: null, pausedDurationMs: 60_000 };
    expect(workoutDurationMs(base, 600_000)).toBe(540_000);
    expect(workoutDurationMs({ ...base, pausedAt: 300_000 }, 900_000)).toBe(240_000);
    expect(workoutDurationMs({ ...base, endedAt: 120_000 }, 999_999)).toBe(60_000);
    expect(workoutDurationMs({ ...base, pausedDurationMs: 0, startedAt: 10 }, 5)).toBe(0);
  });

  it('starts weeks on Monday', () => {
    const wed = new Date(2026, 9, 7, 15, 30).getTime();
    const mon = new Date(startOfWeek(wed));
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(5);
    expect(mon.getHours()).toBe(0);
    const sun = new Date(2026, 9, 11, 23, 0).getTime();
    expect(startOfWeek(sun)).toBe(mon.getTime());
  });
});

describe('personal records', () => {
  const ctx = (s: WorkoutSet, workoutId: string, at: number): SetWithContext => ({ set: s, workoutId, workoutStartedAt: at });

  it('finds the best value per record type and ignores warm-ups', () => {
    const recs = computePersonalRecords('ex', [
      ctx(set({ id: 'a', weightValue: 100, reps: 5 }), 'w1', 1),
      ctx(set({ id: 'b', weightValue: 110, reps: 1 }), 'w2', 2),
      ctx(set({ id: 'c', weightValue: 60, reps: 20 }), 'w2', 2),
      ctx(set({ id: 'd', weightValue: 200, reps: 3, setType: 'warmup' }), 'w3', 3),
    ]);
    const by = Object.fromEntries(recs.map(r => [r.recordType, r]));
    expect(by.e1rm.setId).toBe('a'); // 116.7 beats 110
    expect(by.max_weight.setId).toBe('b');
    expect(by.max_reps.value).toBe(20);
    expect(by.best_set_volume.setId).toBe('c'); // 1200
  });

  it('keeps the earliest set on a tie', () => {
    const recs = computePersonalRecords('ex', [
      ctx(set({ id: 'later', position: 0 }), 'w2', 20),
      ctx(set({ id: 'first', position: 0 }), 'w1', 10),
    ]);
    expect(recs.find(r => r.recordType === 'max_weight')!.setId).toBe('first');
  });

  it('reports only improvements over an existing record', () => {
    const before = computePersonalRecords('ex', [ctx(set({ id: 'a' }), 'w1', 1)]);
    const after = computePersonalRecords('ex', [ctx(set({ id: 'a' }), 'w1', 1), ctx(set({ id: 'b', weightValue: 105 }), 'w2', 2)]);
    const diff = diffRecords(before, after);
    expect(diff.map(d => d.recordType).sort()).toEqual(['best_set_volume', 'e1rm', 'max_weight']);
    expect(diffRecords([], after)).toEqual([]);
  });
});
