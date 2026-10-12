import type { ExerciseRepository } from '../../../application/ports/repositories';
import type { Exercise, Timestamp, Uuid } from '../../../domain/models';
import type { SqlExecutor } from '../SqlDatabase';
import { EXERCISE_COLS, exerciseParams, placeholders, rowToExercise } from './mappers';

export class SqliteExerciseRepository implements ExerciseRepository {
  constructor(private readonly db: SqlExecutor) {}

  async listActive(): Promise<Exercise[]> {
    const rows = await this.db.query(
      `SELECT ${EXERCISE_COLS} FROM exercises WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
    );
    return rows.map(rowToExercise);
  }

  async getById(id: Uuid): Promise<Exercise | null> {
    const rows = await this.db.query(`SELECT ${EXERCISE_COLS} FROM exercises WHERE id = ?`, [id]);
    return rows[0] ? rowToExercise(rows[0]) : null;
  }

  /** Includes soft-deleted rows: past workouts must still show a deleted custom exercise. */
  async getByIds(ids: readonly Uuid[]): Promise<Exercise[]> {
    if (!ids.length) return [];
    const unique = [...new Set(ids)];
    const rows = await this.db.query(
      `SELECT ${EXERCISE_COLS} FROM exercises WHERE id IN (${placeholders(unique.length)})`,
      unique,
    );
    return rows.map(rowToExercise);
  }

  async findCustomByName(name: string): Promise<Exercise | null> {
    const rows = await this.db.query(
      `SELECT ${EXERCISE_COLS} FROM exercises
       WHERE is_custom = 1 AND deleted_at IS NULL AND lower(trim(name)) = lower(trim(?))`,
      [name],
    );
    return rows[0] ? rowToExercise(rows[0]) : null;
  }

  async insert(e: Exercise): Promise<void> {
    await this.db.run(
      `INSERT INTO exercises (${EXERCISE_COLS}) VALUES (${placeholders(13)})`,
      exerciseParams(e),
    );
  }

  async updateCustom(e: Exercise): Promise<void> {
    await this.db.run(
      `UPDATE exercises SET name = ?, muscle_group = ?, equipment = ?, tracking_type = ?, instructions = ?, updated_at = ?
       WHERE id = ? AND is_custom = 1`,
      [e.name, e.muscleGroup, e.equipment, e.trackingType, e.instructions, e.updatedAt, e.id],
    );
  }

  async upsertBuiltIns(exercises: readonly Exercise[]): Promise<void> {
    for (const e of exercises) {
      await this.db.run(
        `INSERT INTO exercises (${EXERCISE_COLS}) VALUES (${placeholders(13)})
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, muscle_group = excluded.muscle_group, equipment = excluded.equipment,
           tracking_type = excluded.tracking_type, primary_muscles = excluded.primary_muscles,
           secondary_muscles = excluded.secondary_muscles, instructions = excluded.instructions,
           image_key = excluded.image_key, updated_at = excluded.updated_at
         WHERE exercises.is_custom = 0 AND (
           exercises.name IS NOT excluded.name OR exercises.muscle_group IS NOT excluded.muscle_group OR
           exercises.equipment IS NOT excluded.equipment OR exercises.tracking_type IS NOT excluded.tracking_type OR
           exercises.primary_muscles IS NOT excluded.primary_muscles OR
           exercises.secondary_muscles IS NOT excluded.secondary_muscles OR
           exercises.instructions IS NOT excluded.instructions OR exercises.image_key IS NOT excluded.image_key)`,
        exerciseParams({ ...e, isCustom: false }),
      );
    }
  }

  async softDelete(id: Uuid, at: Timestamp): Promise<void> {
    await this.db.run(
      'UPDATE exercises SET deleted_at = ?, updated_at = ? WHERE id = ? AND is_custom = 1 AND deleted_at IS NULL',
      [at, at, id],
    );
  }
}
