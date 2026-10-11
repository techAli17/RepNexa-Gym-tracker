import type {
  WorkoutListQuery,
  WorkoutRepository,
} from '../../../application/ports/repositories';
import type { SetWithContext } from '../../../domain/calculations';
import type {
  Timestamp,
  Uuid,
  Workout,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutExerciseDetail,
  WorkoutListItem,
  WorkoutSet,
} from '../../../domain/models';
import type { SqlExecutor, SqlValue } from '../SqlDatabase';
import {
  EXERCISE_COLS,
  SET_COLS,
  SET_COLS_S,
  WE_COLS,
  WORKOUT_COLS,
  placeholders,
  rowToExercise,
  rowToSet,
  rowToWorkout,
  rowToWorkoutExercise,
  setParams,
} from './mappers';

/** kg conversion inside SQL for list aggregates; must match domain KG_PER_LB. */
const SET_VOLUME_KG_SQL = `CASE WHEN s.completed_at IS NOT NULL AND s.set_type <> 'warmup'
  THEN COALESCE(s.weight_value, 0) * (CASE s.weight_unit WHEN 'lb' THEN 0.45359237 ELSE 1 END) * COALESCE(s.reps, 0)
  ELSE 0 END`;

export class SqliteWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: SqlExecutor) {}

  async getActive(): Promise<Workout | null> {
    const rows = await this.db.query(
      `SELECT ${WORKOUT_COLS} FROM workouts WHERE status = 'in_progress' AND deleted_at IS NULL LIMIT 1`,
    );
    return rows[0] ? rowToWorkout(rows[0]) : null;
  }

  async getById(id: Uuid): Promise<Workout | null> {
    const rows = await this.db.query(`SELECT ${WORKOUT_COLS} FROM workouts WHERE id = ?`, [id]);
    return rows[0] ? rowToWorkout(rows[0]) : null;
  }

  /** Three flat queries rather than one wide join: simpler mapping, same round-trip count order. */
  async getDetail(id: Uuid): Promise<WorkoutDetail | null> {
    const workout = await this.getById(id);
    if (!workout || workout.deletedAt != null) return null;

    const weRows = await this.db.query(
      `SELECT ${WE_COLS} FROM workout_exercises WHERE workout_id = ? ORDER BY position`,
      [id],
    );
    const exerciseRows = await this.db.query(
      `SELECT ${EXERCISE_COLS} FROM exercises
       WHERE id IN (SELECT exercise_id FROM workout_exercises WHERE workout_id = ?)`,
      [id],
    );
    const setRows = await this.db.query(
      `SELECT ${SET_COLS_S} FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       WHERE we.workout_id = ? ORDER BY s.position`,
      [id],
    );

    const exercises = new Map(exerciseRows.map(r => [String(r.id), rowToExercise(r)]));
    const setsByWe = new Map<string, WorkoutSet[]>();
    for (const r of setRows) {
      const s = rowToSet(r);
      const list = setsByWe.get(s.workoutExerciseId);
      if (list) list.push(s);
      else setsByWe.set(s.workoutExerciseId, [s]);
    }
    const items: WorkoutExerciseDetail[] = [];
    for (const r of weRows) {
      const we = rowToWorkoutExercise(r);
      const exercise = exercises.get(we.exerciseId);
      if (!exercise) continue; // FK makes this unreachable; skip rather than crash the screen.
      items.push({ ...we, exercise, sets: setsByWe.get(we.id) ?? [] });
    }
    return { workout, exercises: items };
  }

  async listCompleted(q: WorkoutListQuery): Promise<WorkoutListItem[]> {
    const where = [`w.status = 'completed'`, 'w.deleted_at IS NULL'];
    const params: SqlValue[] = [];
    if (q.startedBefore != null) {
      where.push('w.started_at < ?');
      params.push(q.startedBefore);
    }
    if (q.exerciseId) {
      where.push('EXISTS (SELECT 1 FROM workout_exercises x WHERE x.workout_id = w.id AND x.exercise_id = ?)');
      params.push(q.exerciseId);
    }
    params.push(Math.max(1, Math.min(200, q.limit | 0)));
    const rows = await this.db.query(
      `SELECT ${WORKOUT_COLS.split(', ').map(c => `w.${c}`).join(', ')},
        (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exercise_count,
        (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
          WHERE we.workout_id = w.id AND s.completed_at IS NOT NULL) AS completed_set_count,
        (SELECT COALESCE(SUM(${SET_VOLUME_KG_SQL}), 0) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
          WHERE we.workout_id = w.id) AS volume_kg,
        (SELECT COUNT(*) FROM personal_records pr WHERE pr.workout_id = w.id) AS record_count
       FROM workouts w WHERE ${where.join(' AND ')}
       ORDER BY w.started_at DESC LIMIT ?`,
      params,
    );
    return rows.map(r => ({
      workout: rowToWorkout(r),
      exerciseCount: Number(r.exercise_count),
      completedSetCount: Number(r.completed_set_count),
      volumeKg: Number(r.volume_kg),
      recordCount: Number(r.record_count),
    }));
  }

  async countCompletedSince(since: Timestamp): Promise<number> {
    const rows = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM workouts WHERE status = 'completed' AND deleted_at IS NULL AND started_at >= ?`,
      [since],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async insertWorkout(w: Workout): Promise<void> {
    await this.db.run(`INSERT INTO workouts (${WORKOUT_COLS}) VALUES (${placeholders(12)})`, [
      w.id,
      w.name,
      w.routineId,
      w.status,
      w.startedAt,
      w.endedAt,
      w.pausedAt,
      w.pausedDurationMs,
      w.notes,
      w.createdAt,
      w.updatedAt,
      w.deletedAt,
    ]);
  }

  async updateWorkout(
    id: Uuid,
    patch: Partial<Pick<Workout, 'name' | 'notes' | 'pausedAt' | 'pausedDurationMs'>>,
    updatedAt: Timestamp,
  ): Promise<void> {
    const cols: Record<string, string> = {
      name: 'name',
      notes: 'notes',
      pausedAt: 'paused_at',
      pausedDurationMs: 'paused_duration_ms',
    };
    const sets: string[] = [];
    const params: SqlValue[] = [];
    for (const [k, col] of Object.entries(cols)) {
      if (k in patch) {
        sets.push(`${col} = ?`);
        params.push((patch as Record<string, SqlValue>)[k] ?? null);
      }
    }
    if (!sets.length) return;
    await this.db.run(`UPDATE workouts SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [
      ...params,
      updatedAt,
      id,
    ]);
  }

  async markCompleted(id: Uuid, endedAt: Timestamp): Promise<boolean> {
    // A paused workout ends at the moment it was paused; that time is already excluded.
    const r = await this.db.run(
      `UPDATE workouts SET status = 'completed',
         ended_at = MAX(started_at, COALESCE(paused_at, ?)),
         paused_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'in_progress'`,
      [endedAt, endedAt, id],
    );
    return r.rowsAffected === 1;
  }

  async hardDelete(id: Uuid): Promise<void> {
    await this.db.run('DELETE FROM workouts WHERE id = ?', [id]);
  }

  async softDelete(id: Uuid, at: Timestamp): Promise<void> {
    await this.db.run(
      'UPDATE workouts SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [at, at, id],
    );
  }

  async getWorkoutExercise(id: Uuid): Promise<WorkoutExercise | null> {
    const rows = await this.db.query(`SELECT ${WE_COLS} FROM workout_exercises WHERE id = ?`, [id]);
    return rows[0] ? rowToWorkoutExercise(rows[0]) : null;
  }

  async listWorkoutExercises(workoutId: Uuid): Promise<WorkoutExercise[]> {
    const rows = await this.db.query(
      `SELECT ${WE_COLS} FROM workout_exercises WHERE workout_id = ? ORDER BY position`,
      [workoutId],
    );
    return rows.map(rowToWorkoutExercise);
  }

  async insertWorkoutExercise(we: WorkoutExercise): Promise<void> {
    await this.db.run(`INSERT INTO workout_exercises (${WE_COLS}) VALUES (${placeholders(8)})`, [
      we.id,
      we.workoutId,
      we.exerciseId,
      we.position,
      we.notes,
      we.restSeconds,
      we.createdAt,
      we.updatedAt,
    ]);
  }

  async updateWorkoutExercise(
    id: Uuid,
    patch: Partial<Pick<WorkoutExercise, 'notes' | 'restSeconds'>>,
    updatedAt: Timestamp,
  ): Promise<void> {
    const sets: string[] = [];
    const params: SqlValue[] = [];
    if ('notes' in patch) {
      sets.push('notes = ?');
      params.push(patch.notes ?? null);
    }
    if ('restSeconds' in patch) {
      sets.push('rest_seconds = ?');
      params.push(patch.restSeconds ?? null);
    }
    if (!sets.length) return;
    await this.db.run(`UPDATE workout_exercises SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [
      ...params,
      updatedAt,
      id,
    ]);
  }

  async deleteWorkoutExercise(id: Uuid): Promise<void> {
    await this.db.run('DELETE FROM workout_exercises WHERE id = ?', [id]);
  }

  async reorderWorkoutExercises(workoutId: Uuid, orderedIds: readonly Uuid[], at: Timestamp): Promise<void> {
    // Two passes so UNIQUE(workout_id, position) never sees a transient duplicate.
    await this.db.run('UPDATE workout_exercises SET position = -1 - position WHERE workout_id = ?', [workoutId]);
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.run(
        'UPDATE workout_exercises SET position = ?, updated_at = ? WHERE id = ? AND workout_id = ?',
        [i, at, orderedIds[i], workoutId],
      );
    }
  }

  async getSet(id: Uuid): Promise<WorkoutSet | null> {
    const rows = await this.db.query(`SELECT ${SET_COLS} FROM sets WHERE id = ?`, [id]);
    return rows[0] ? rowToSet(rows[0]) : null;
  }

  async listSets(workoutExerciseId: Uuid): Promise<WorkoutSet[]> {
    const rows = await this.db.query(
      `SELECT ${SET_COLS} FROM sets WHERE workout_exercise_id = ? ORDER BY position`,
      [workoutExerciseId],
    );
    return rows.map(rowToSet);
  }

  async insertSet(s: WorkoutSet): Promise<void> {
    await this.db.run(`INSERT INTO sets (${SET_COLS}) VALUES (${placeholders(14)})`, setParams(s));
  }

  async updateSet(s: WorkoutSet): Promise<void> {
    await this.db.run(
      `UPDATE sets SET set_type = ?, weight_value = ?, weight_unit = ?, reps = ?, duration_seconds = ?,
         distance_value = ?, distance_unit = ?, rpe = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        s.setType,
        s.weightValue,
        s.weightUnit,
        s.reps,
        s.durationSeconds,
        s.distanceValue,
        s.distanceUnit,
        s.rpe,
        s.completedAt,
        s.updatedAt,
        s.id,
      ],
    );
  }

  async deleteSet(id: Uuid): Promise<void> {
    await this.db.run('DELETE FROM sets WHERE id = ?', [id]);
  }

  async pruneIncomplete(workoutId: Uuid): Promise<void> {
    await this.db.run(
      `DELETE FROM sets WHERE completed_at IS NULL
       AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)`,
      [workoutId],
    );
    await this.db.run(
      `DELETE FROM workout_exercises WHERE workout_id = ?
       AND NOT EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = workout_exercises.id)`,
      [workoutId],
    );
  }

  async lastCompletedSets(exerciseId: Uuid, excludeWorkoutId?: Uuid): Promise<WorkoutSet[]> {
    const rows = await this.db.query(
      `SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
       WHERE we.exercise_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL AND w.id IS NOT ?
       ORDER BY w.started_at DESC, we.position LIMIT 1`,
      [exerciseId, excludeWorkoutId ?? null],
    );
    if (!rows[0]) return [];
    const sets = await this.listSets(String(rows[0].id));
    return sets.filter(s => s.completedAt != null);
  }

  async completedSetsForExercise(exerciseId: Uuid): Promise<SetWithContext[]> {
    const rows = await this.db.query(
      `SELECT ${SET_COLS_S}, w.id AS w_id, w.started_at AS w_started_at
       FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
       WHERE we.exercise_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL
         AND s.completed_at IS NOT NULL`,
      [exerciseId],
    );
    return rows.map(r => ({
      set: rowToSet(r),
      workoutId: String(r.w_id),
      workoutStartedAt: Number(r.w_started_at),
    }));
  }

  async exerciseIdsInWorkout(workoutId: Uuid): Promise<Uuid[]> {
    const rows = await this.db.query(
      'SELECT DISTINCT exercise_id FROM workout_exercises WHERE workout_id = ?',
      [workoutId],
    );
    return rows.map(r => String(r.exercise_id));
  }
}
