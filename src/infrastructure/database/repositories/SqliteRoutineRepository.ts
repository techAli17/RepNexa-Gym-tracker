import type { RoutineRepository } from '../../../application/ports/repositories';
import type { Routine, RoutineDetail, RoutineExercise, Timestamp, Uuid } from '../../../domain/models';
import type { SqlExecutor } from '../SqlDatabase';
import { rowToRoutine, rowToRoutineExercise } from './mappers';

const ROUTINE_COLS = 'id, name, notes, position, created_at, updated_at, deleted_at';
const RE_COLS = 'id, routine_id, exercise_id, position, target_sets, target_reps, rest_seconds, notes';

export class SqliteRoutineRepository implements RoutineRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listActive(): Promise<Routine[]> {
    const rows = await this.db.query(
      `SELECT ${ROUTINE_COLS} FROM routines WHERE deleted_at IS NULL ORDER BY position, name COLLATE NOCASE`,
    );
    return rows.map(rowToRoutine);
  }

  async getDetail(id: Uuid): Promise<RoutineDetail | null> {
    const rows = await this.db.query(
      `SELECT ${ROUTINE_COLS} FROM routines WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!rows[0]) return null;
    const ex = await this.db.query(
      `SELECT ${RE_COLS} FROM routine_exercises WHERE routine_id = ? ORDER BY position`,
      [id],
    );
    return { routine: rowToRoutine(rows[0]), exercises: ex.map(rowToRoutineExercise) };
  }

  /** Callers should run this inside a UnitOfWork; it is several statements. */
  async save(r: Routine, exercises: readonly RoutineExercise[]): Promise<void> {
    await this.db.run(
      `INSERT INTO routines (${ROUTINE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, notes = excluded.notes,
         position = excluded.position, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
      [r.id, r.name, r.notes, r.position, r.createdAt, r.updatedAt, r.deletedAt],
    );
    await this.db.run('DELETE FROM routine_exercises WHERE routine_id = ?', [r.id]);
    for (const e of exercises) {
      await this.db.run(`INSERT INTO routine_exercises (${RE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        e.id,
        r.id,
        e.exerciseId,
        e.position,
        e.targetSets,
        e.targetReps,
        e.restSeconds,
        e.notes,
      ]);
    }
  }

  async setPositions(orderedIds: readonly Uuid[], at: Timestamp): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.run('UPDATE routines SET position = ?, updated_at = ? WHERE id = ?', [i, at, orderedIds[i]]);
    }
  }

  async softDelete(id: Uuid, at: Timestamp): Promise<void> {
    await this.db.run(
      'UPDATE routines SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [at, at, id],
    );
  }
}
