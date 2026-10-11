import type { PersonalRecord, RecordType } from '../models/records';
import type { Timestamp, Uuid } from '../models/units';
import type { WorkoutSet } from '../models/workout';
import { estimateOneRepMax } from './oneRepMax';
import { toKg } from './units';
import { isCompleted, isWorkingSet } from './workoutStats';

export interface SetWithContext {
  set: WorkoutSet;
  workoutId: Uuid;
  workoutStartedAt: Timestamp;
}

/**
 * Best value per record type across the given sets of one exercise. Ties keep
 * the earliest set, so re-matching a record does not move its date.
 */
export function computePersonalRecords(
  exerciseId: Uuid,
  sets: readonly SetWithContext[],
): PersonalRecord[] {
  const best = new Map<RecordType, PersonalRecord>();
  const ordered = [...sets].sort(
    (a, b) =>
      a.workoutStartedAt - b.workoutStartedAt || a.set.position - b.set.position,
  );
  const consider = (type: RecordType, value: number | null, c: SetWithContext) => {
    if (value == null || !(value > 0)) return;
    const cur = best.get(type);
    if (cur && value <= cur.value + 1e-9) return;
    best.set(type, {
      exerciseId,
      recordType: type,
      value,
      workoutId: c.workoutId,
      setId: c.set.id,
      achievedAt: c.set.completedAt ?? c.workoutStartedAt,
    });
  };
  for (const c of ordered) {
    const s = c.set;
    if (!isCompleted(s) || !isWorkingSet(s)) continue;
    const kg = s.weightValue != null ? toKg(s.weightValue, s.weightUnit) : null;
    if (kg != null && s.reps != null) {
      consider('e1rm', estimateOneRepMax(kg, s.reps), c);
      consider('best_set_volume', kg * s.reps, c);
    }
    if (kg != null && s.reps != null && s.reps > 0) consider('max_weight', kg, c);
    consider('max_reps', s.reps, c);
  }
  return [...best.values()];
}

export interface RecordImprovement {
  exerciseId: Uuid;
  recordType: RecordType;
  previous: number;
  current: number;
}

/**
 * Records that beat an existing record. A first-ever value is not reported as a
 * PR; otherwise the first session of every exercise would be a "record".
 */
export function diffRecords(
  before: readonly PersonalRecord[],
  after: readonly PersonalRecord[],
): RecordImprovement[] {
  const key = (r: PersonalRecord) => `${r.exerciseId}:${r.recordType}`;
  const prev = new Map(before.map(r => [key(r), r]));
  const out: RecordImprovement[] = [];
  for (const r of after) {
    const p = prev.get(key(r));
    if (p && r.value > p.value + 1e-9) {
      out.push({ exerciseId: r.exerciseId, recordType: r.recordType, previous: p.value, current: r.value });
    }
  }
  return out;
}
