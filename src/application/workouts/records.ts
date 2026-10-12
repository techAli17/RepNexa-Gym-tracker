import { computePersonalRecords } from '../../domain/calculations';
import type { PersonalRecord, Timestamp, Uuid } from '../../domain/models';
import type { Repositories } from '../ports/repositories';

/** Rebuilds the cached personal records of the given exercises from their sets. */
export async function rebuildRecords(r: Repositories, exerciseIds: Iterable<Uuid>, at: Timestamp): Promise<PersonalRecord[]> {
  const all: PersonalRecord[] = [];
  for (const id of new Set(exerciseIds)) {
    const recs = computePersonalRecords(id, await r.workouts.completedSetsForExercise(id));
    await r.records.replaceForExercise(id, recs, at);
    all.push(...recs);
  }
  return all;
}
