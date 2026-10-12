import type { PlanRepository } from '../../../application/ports/repositories';
import type { PlanDayRecord, Timestamp, WeekPlanRecord, Weekday } from '../../../domain/models';
import type { SqlExecutor } from '../SqlDatabase';

export class SqlitePlanRepository implements PlanRepository {
  constructor(private readonly db: SqlExecutor) {}

  async get(): Promise<WeekPlanRecord> {
    const s = (await this.db.query('SELECT week_start, updated_at FROM plan_settings WHERE id = 1'))[0] ?? {};
    const rows = await this.db.query('SELECT weekday, routine_id, is_rest, updated_at FROM plan_days ORDER BY weekday');
    const days: PlanDayRecord[] = rows.map(r => ({
      weekday: Number(r.weekday) as Weekday,
      routineId: r.routine_id == null ? null : String(r.routine_id),
      isRest: Number(r.is_rest) === 1,
      updatedAt: Number(r.updated_at),
    }));
    // The plan as a whole is as new as its newest part; backups merge on this.
    const updatedAt = Math.max(Number(s.updated_at ?? 0), ...days.map(d => d.updatedAt));
    return { weekStart: Number(s.week_start ?? 1) as Weekday, updatedAt, days };
  }

  async setWeekStart(weekStart: Weekday, at: Timestamp): Promise<void> {
    await this.db.run('UPDATE plan_settings SET week_start = ?, updated_at = ? WHERE id = 1', [weekStart, at]);
  }

  async putDay(d: PlanDayRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO plan_days (weekday, routine_id, is_rest, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (weekday) DO UPDATE SET routine_id = excluded.routine_id, is_rest = excluded.is_rest,
         updated_at = excluded.updated_at`,
      [d.weekday, d.isRest ? null : d.routineId, d.isRest ? 1 : 0, d.updatedAt],
    );
  }

  async replace(plan: WeekPlanRecord): Promise<void> {
    await this.db.run('UPDATE plan_settings SET week_start = ?, updated_at = ? WHERE id = 1', [plan.weekStart, plan.updatedAt]);
    await this.db.run('DELETE FROM plan_days');
    for (const d of plan.days) {
      // A routine missing on this phone leaves the day unplanned rather than failing the restore.
      await this.db.run(
        `INSERT INTO plan_days (weekday, routine_id, is_rest, updated_at)
         VALUES (?, (SELECT id FROM routines WHERE id = ? AND deleted_at IS NULL), ?, ?)`,
        [d.weekday, d.isRest ? null : d.routineId, d.isRest ? 1 : 0, d.updatedAt],
      );
    }
  }
}
