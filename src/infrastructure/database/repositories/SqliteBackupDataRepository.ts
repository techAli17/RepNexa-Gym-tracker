import type {
  BackupDataRepository,
  SyncState,
  SyncSuccess,
} from '../../../application/ports/repositories';
import {
  fromIso,
  fromIsoOrNull,
  toIso,
  toIsoOrNull,
  type BackupData,
  type BackupExercise,
  type BackupRoutine,
  type BackupWorkout,
} from '../../../domain/backup/format';
import type { MergeChanges } from '../../../domain/backup/merge';
import type { Timestamp, Uuid } from '../../../domain/models';
import type { SqlExecutor } from '../SqlDatabase';
import {
  EXERCISE_COLS,
  SET_COLS_S,
  WE_COLS,
  WORKOUT_COLS,
  placeholders,
  rowToExercise,
  rowToRoutine,
  rowToRoutineExercise,
  rowToSet,
  rowToWorkout,
  rowToWorkoutExercise,
} from './mappers';

const numOrNull = (v: unknown) => (v == null ? null : Number(v));
const strOrNull = (v: unknown) => (v == null ? null : String(v));

export class SqliteBackupDataRepository implements BackupDataRepository {
  constructor(private readonly db: SqlExecutor) {}

  async exportData(): Promise<Omit<BackupData, 'preferences'>> {
    const wRows = await this.db.query(
      `SELECT ${WORKOUT_COLS} FROM workouts WHERE status = 'completed' ORDER BY started_at`,
    );
    const weRows = await this.db.query(
      `SELECT ${WE_COLS.split(', ').map(c => `we.${c}`).join(', ')} FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id WHERE w.status = 'completed' AND w.deleted_at IS NULL
       ORDER BY we.workout_id, we.position`,
    );
    const setRows = await this.db.query(
      `SELECT ${SET_COLS_S} FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id WHERE w.status = 'completed' AND w.deleted_at IS NULL
       ORDER BY s.workout_exercise_id, s.position`,
    );
    const rRows = await this.db.query(
      'SELECT id, name, notes, position, created_at, updated_at, deleted_at FROM routines ORDER BY position',
    );
    const reRows = await this.db.query(
      `SELECT re.id, re.routine_id, re.exercise_id, re.position, re.target_sets, re.target_reps, re.rest_seconds, re.notes
       FROM routine_exercises re JOIN routines r ON r.id = re.routine_id WHERE r.deleted_at IS NULL
       ORDER BY re.routine_id, re.position`,
    );
    const exRows = await this.db.query(
      `SELECT ${EXERCISE_COLS} FROM exercises WHERE is_custom = 1
         OR id IN (SELECT exercise_id FROM workout_exercises) OR id IN (SELECT exercise_id FROM routine_exercises)`,
    );

    const setsByWe = new Map<string, BackupWorkout['exercises'][number]['sets']>();
    for (const r of setRows) {
      const s = rowToSet(r);
      const list = setsByWe.get(s.workoutExerciseId) ?? [];
      list.push({
        id: s.id,
        setType: s.setType,
        weightValue: s.weightValue,
        weightUnit: s.weightUnit,
        reps: s.reps,
        durationSeconds: s.durationSeconds,
        distanceValue: s.distanceValue,
        distanceUnit: s.distanceUnit,
        rpe: s.rpe,
        completedAt: toIsoOrNull(s.completedAt),
        createdAt: toIso(s.createdAt),
        updatedAt: toIso(s.updatedAt),
      });
      setsByWe.set(s.workoutExerciseId, list);
    }
    const exByWorkout = new Map<string, BackupWorkout['exercises']>();
    for (const r of weRows) {
      const we = rowToWorkoutExercise(r);
      const list = exByWorkout.get(we.workoutId) ?? [];
      list.push({
        id: we.id,
        exerciseId: we.exerciseId,
        notes: we.notes,
        restSeconds: we.restSeconds,
        createdAt: toIso(we.createdAt),
        updatedAt: toIso(we.updatedAt),
        sets: setsByWe.get(we.id) ?? [],
      });
      exByWorkout.set(we.workoutId, list);
    }
    const workouts: BackupWorkout[] = wRows.map(r => {
      const w = rowToWorkout(r);
      return {
        id: w.id,
        name: w.name,
        routineId: w.routineId,
        startedAt: toIso(w.startedAt),
        endedAt: toIsoOrNull(w.endedAt),
        pausedDurationMs: w.pausedDurationMs,
        notes: w.notes,
        createdAt: toIso(w.createdAt),
        updatedAt: toIso(w.updatedAt),
        deletedAt: toIsoOrNull(w.deletedAt),
        // A tombstone carries no children: the deletion is the whole message.
        exercises: w.deletedAt != null ? [] : exByWorkout.get(w.id) ?? [],
      };
    });

    const reByRoutine = new Map<string, BackupRoutine['exercises']>();
    for (const r of reRows) {
      const re = rowToRoutineExercise(r);
      const list = reByRoutine.get(re.routineId) ?? [];
      list.push({
        id: re.id,
        exerciseId: re.exerciseId,
        targetSets: re.targetSets,
        targetReps: re.targetReps,
        restSeconds: re.restSeconds,
        notes: re.notes,
      });
      reByRoutine.set(re.routineId, list);
    }
    const routines: BackupRoutine[] = rRows.map(r => {
      const x = rowToRoutine(r);
      return {
        id: x.id,
        name: x.name,
        notes: x.notes,
        position: x.position,
        createdAt: toIso(x.createdAt),
        updatedAt: toIso(x.updatedAt),
        deletedAt: toIsoOrNull(x.deletedAt),
        exercises: x.deletedAt != null ? [] : reByRoutine.get(x.id) ?? [],
      };
    });

    const exercises: BackupExercise[] = exRows.map(r => {
      const e = rowToExercise(r);
      return {
        id: e.id,
        name: e.name,
        muscleGroup: e.muscleGroup,
        equipment: e.equipment,
        trackingType: e.trackingType,
        primaryMuscles: e.primaryMuscles,
        secondaryMuscles: e.secondaryMuscles,
        instructions: e.instructions,
        isCustom: e.isCustom,
        createdAt: toIso(e.createdAt),
        updatedAt: toIso(e.updatedAt),
        deletedAt: toIsoOrNull(e.deletedAt),
      };
    });

    return { exercises, workouts, routines };
  }

  async applyChanges(c: MergeChanges): Promise<Uuid[]> {
    const affected = new Set<Uuid>();

    // Exercises first: workouts and routines reference them.
    for (const e of c.exercises) {
      const params = [
        e.id,
        e.name,
        e.muscleGroup,
        e.equipment,
        e.trackingType,
        JSON.stringify(e.primaryMuscles),
        JSON.stringify(e.secondaryMuscles),
        e.instructions,
        null,
        e.isCustom ? 1 : 0,
        fromIso(e.createdAt),
        fromIso(e.updatedAt),
        fromIsoOrNull(e.deletedAt),
      ];
      if (e.isCustom) {
        await this.db.run(
          `INSERT INTO exercises (${EXERCISE_COLS}) VALUES (${placeholders(13)})
           ON CONFLICT (id) DO UPDATE SET name = excluded.name, muscle_group = excluded.muscle_group,
             equipment = excluded.equipment, tracking_type = excluded.tracking_type,
             instructions = excluded.instructions, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
           WHERE exercises.is_custom = 1`,
          params,
        );
      } else {
        // Built-ins are owned by the app's catalog; only add ones this version lacks.
        await this.db.run(`INSERT INTO exercises (${EXERCISE_COLS}) VALUES (${placeholders(13)}) ON CONFLICT (id) DO NOTHING`, params);
      }
    }

    for (const r of c.routines) {
      // Upsert, never delete: deleting a routine row would unlink the workouts started from it.
      await this.db.run(
        `INSERT INTO routines (id, name, notes, position, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, notes = excluded.notes, position = excluded.position,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
        [r.id, r.name.slice(0, 80), r.notes, r.position, fromIso(r.createdAt), fromIso(r.updatedAt), fromIsoOrNull(r.deletedAt)],
      );
      await this.db.run('DELETE FROM routine_exercises WHERE routine_id = ?', [r.id]);
      for (let i = 0; i < r.exercises.length; i++) {
        const e = r.exercises[i];
        await this.db.run(
          `INSERT INTO routine_exercises (id, routine_id, exercise_id, position, target_sets, target_reps, rest_seconds, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [e.id, r.id, e.exerciseId, i, e.targetSets, e.targetReps, e.restSeconds, e.notes],
        );
      }
    }

    for (const w of c.workouts) {
      // Exercises in the copy being replaced may lose their records too.
      for (const row of await this.db.query('SELECT DISTINCT exercise_id FROM workout_exercises WHERE workout_id = ?', [w.id])) {
        affected.add(String(row.exercise_id));
      }
      const existing = await this.db.query<{ status: string }>('SELECT status FROM workouts WHERE id = ?', [w.id]);
      if (existing[0]?.status === 'in_progress') continue; // never overwrite the workout being logged
      await this.db.run('DELETE FROM workouts WHERE id = ?', [w.id]);
      await this.db.run(
        `INSERT INTO workouts (${WORKOUT_COLS}) VALUES (?, ?,
           (SELECT id FROM routines WHERE id = ?), 'completed', ?, ?, NULL, ?, ?, ?, ?, ?)`,
        [
          w.id,
          w.name.slice(0, 80),
          w.routineId,
          fromIso(w.startedAt),
          // A tombstone may lack an end time; the schema requires one for completed rows.
          fromIsoOrNull(w.endedAt) ?? fromIso(w.startedAt),
          w.pausedDurationMs,
          w.notes,
          fromIso(w.createdAt),
          fromIso(w.updatedAt),
          fromIsoOrNull(w.deletedAt),
        ],
      );
      // Positions are renumbered from array order, so a hand-edited file cannot break uniqueness.
      for (let i = 0; i < w.exercises.length; i++) {
        const we = w.exercises[i];
        affected.add(we.exerciseId);
        await this.db.run(`INSERT INTO workout_exercises (${WE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
          we.id,
          w.id,
          we.exerciseId,
          i,
          we.notes,
          we.restSeconds,
          fromIso(we.createdAt),
          fromIso(we.updatedAt),
        ]);
        for (let j = 0; j < we.sets.length; j++) {
          const s = we.sets[j];
          await this.db.run(
            `INSERT INTO sets (id, workout_exercise_id, position, set_type, weight_value, weight_unit, reps, duration_seconds,
               distance_value, distance_unit, rpe, completed_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id,
              we.id,
              j,
              s.setType,
              s.weightValue,
              s.weightUnit,
              s.reps,
              s.durationSeconds,
              s.distanceValue,
              s.distanceUnit,
              s.rpe,
              // Sets in finished workouts are done by definition.
              fromIsoOrNull(s.completedAt) ?? fromIso(w.endedAt ?? w.startedAt),
              fromIso(s.createdAt),
              fromIso(s.updatedAt),
            ],
          );
        }
      }
      await this.db.run('DELETE FROM pruned_workouts WHERE workout_id = ?', [w.id]);
    }
    return [...affected];
  }

  async prunedIds(): Promise<Set<Uuid>> {
    const rows = await this.db.query('SELECT workout_id FROM pruned_workouts');
    return new Set(rows.map(r => String(r.workout_id)));
  }

  async pruneCandidates(startedBefore: Timestamp, unchangedSince: Timestamp) {
    const rows = await this.db.query(
      `SELECT id, started_at FROM workouts
       WHERE status = 'completed' AND deleted_at IS NULL AND started_at < ? AND updated_at <= ?`,
      [startedBefore, unchangedSince],
    );
    return rows.map(r => ({ id: String(r.id), startedAt: Number(r.started_at) }));
  }

  async prune(workouts: ReadonlyArray<{ id: Uuid; startedAt: Timestamp }>, at: Timestamp): Promise<void> {
    for (const w of workouts) {
      await this.db.run('INSERT OR REPLACE INTO pruned_workouts (workout_id, started_at, pruned_at) VALUES (?, ?, ?)', [w.id, w.startedAt, at]);
      await this.db.run(`DELETE FROM workouts WHERE id = ? AND status = 'completed'`, [w.id]);
    }
  }

  async getSyncState(): Promise<SyncState> {
    const rows = await this.db.query('SELECT * FROM backup_state WHERE id = 1');
    const r = rows[0] ?? {};
    return {
      localRevision: Number(r.local_revision ?? 0),
      backedUpRevision: Number(r.backed_up_revision ?? 0),
      lastSuccessAt: numOrNull(r.last_success_at),
      lastAttemptAt: numOrNull(r.last_attempt_at),
      lastErrorCode: strOrNull(r.last_error_code),
      lastErrorMessage: strOrNull(r.last_error_message),
      accountId: strOrNull(r.account_id),
      remoteFileId: strOrNull(r.remote_file_id),
      remoteVersion: strOrNull(r.remote_revision_id),
      snapshotAt: numOrNull(r.snapshot_at),
    };
  }

  async recordSuccess(s: SyncSuccess): Promise<void> {
    await this.db.run(
      `UPDATE backup_state SET backed_up_revision = MIN(?, local_revision), last_success_at = ?, last_attempt_at = ?,
         snapshot_at = ?, account_id = ?, remote_file_id = ?, remote_revision_id = ?, remote_modified_at = ?,
         last_error_code = NULL, last_error_message = NULL
       WHERE id = 1`,
      [s.revision, s.at, s.at, s.snapshotAt, s.accountId, s.remoteFileId, s.remoteVersion, s.at],
    );
  }

  async recordFailure(code: string, message: string, at: Timestamp): Promise<void> {
    await this.db.run(
      'UPDATE backup_state SET last_attempt_at = ?, last_error_code = ?, last_error_message = ? WHERE id = 1',
      [at, code, message.slice(0, 500)],
    );
  }

  async clearRemote(): Promise<void> {
    await this.db.run(
      'UPDATE backup_state SET remote_file_id = NULL, remote_revision_id = NULL, remote_folder_id = NULL WHERE id = 1',
    );
  }
}
