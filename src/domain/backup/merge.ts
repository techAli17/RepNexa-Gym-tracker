import type { BackupData, BackupExercise, BackupRoutine, BackupWorkout } from './format';
import { fromIso } from './format';

export interface MergeChanges {
  /** Items the incoming side adds or updates locally (already filtered by `skipLocal`). */
  workouts: BackupWorkout[];
  routines: BackupRoutine[];
  exercises: BackupExercise[];
}

export interface MergeStats {
  workoutsAdded: number;
  workoutsUpdated: number;
  workoutsDeleted: number;
  routinesChanged: number;
  exercisesChanged: number;
  /** Local items that are newer than the incoming copy and were kept. */
  keptLocal: number;
}

export interface MergeResult {
  /** Union of both sides with the newest version of every entity. This is what gets uploaded. */
  merged: BackupData;
  /** What must be written to the local database to match `merged`. */
  toApply: MergeChanges;
  stats: MergeStats;
}

type Entity = { id: string; updatedAt: string; deletedAt: string | null };

/** Newer wins; on a tie the local copy stays, so a re-import is a no-op. */
const incomingWins = (local: Entity | undefined, incoming: Entity) =>
  !local || fromIso(incoming.updatedAt) > fromIso(local.updatedAt);

function mergeById<T extends Entity>(
  local: readonly T[],
  incoming: readonly T[],
  skip: ReadonlySet<string>,
  onWin: (inc: T, loc: T | undefined) => void,
  onKeep: () => void,
): T[] {
  const byId = new Map(local.map(x => [x.id, x]));
  const out = new Map(byId);
  for (const inc of incoming) {
    const loc = byId.get(inc.id);
    if (incomingWins(loc, inc)) {
      out.set(inc.id, inc);
      if (!skip.has(inc.id)) onWin(inc, loc);
    } else if (loc && fromIso(loc.updatedAt) > fromIso(inc.updatedAt)) {
      onKeep();
    }
  }
  return [...out.values()];
}

/**
 * Merges two snapshots without losing anything:
 * - entities only on one side are kept (a pruned local workout survives in the backup),
 * - the newer copy of a shared entity wins, including tombstones,
 * - nothing is ever removed merely for being absent.
 *
 * `skipLocal` lists ids deliberately removed from this phone by the retention
 * policy; they stay in `merged` but are not re-downloaded.
 */
export function mergeBackups(local: BackupData, incoming: BackupData, skipLocal: ReadonlySet<string> = new Set()): MergeResult {
  const toApply: MergeChanges = { workouts: [], routines: [], exercises: [] };
  const stats: MergeStats = {
    workoutsAdded: 0,
    workoutsUpdated: 0,
    workoutsDeleted: 0,
    routinesChanged: 0,
    exercisesChanged: 0,
    keptLocal: 0,
  };
  const keep = () => stats.keptLocal++;

  const exercises = mergeById(
    local.exercises,
    incoming.exercises,
    skipLocal,
    inc => {
      toApply.exercises.push(inc);
      stats.exercisesChanged++;
    },
    keep,
  );
  const routines = mergeById(
    local.routines,
    incoming.routines,
    skipLocal,
    inc => {
      toApply.routines.push(inc);
      stats.routinesChanged++;
    },
    keep,
  );
  const workouts = mergeById(
    local.workouts,
    incoming.workouts,
    skipLocal,
    (inc, loc) => {
      toApply.workouts.push(inc);
      if (inc.deletedAt) {
        if (loc && !loc.deletedAt) stats.workoutsDeleted++;
      } else if (loc && !loc.deletedAt) stats.workoutsUpdated++;
      else stats.workoutsAdded++;
    },
    keep,
  );

  // Any exercise a winning workout or routine needs must exist locally too.
  const needed = new Set<string>();
  for (const w of toApply.workouts) for (const e of w.exercises) needed.add(e.exerciseId);
  for (const r of toApply.routines) for (const e of r.exercises) needed.add(e.exerciseId);
  const applied = new Set(toApply.exercises.map(e => e.id));
  const incomingEx = new Map(incoming.exercises.map(e => [e.id, e]));
  for (const id of needed) {
    const e = incomingEx.get(id);
    if (e && !applied.has(id)) {
      toApply.exercises.push(e);
      applied.add(id);
    }
  }

  return {
    merged: { exercises, routines, workouts, preferences: { ...incoming.preferences, ...local.preferences } },
    toApply,
    stats,
  };
}

/** True when the merge would change nothing locally. */
export const isEmptyChange = (c: MergeChanges) => !c.workouts.length && !c.routines.length && !c.exercises.length;
