import { startOfWeek, workoutDurationMs } from '../../domain/calculations';
import type { Uuid, WorkoutDetail, WorkoutListItem } from '../../domain/models';
import type { Repositories, WorkoutListQuery } from '../ports/repositories';
import type { Clock } from '../ports/system';

export interface WeekSummary {
  weekStart: number;
  workouts: number;
  durationMs: number;
  volumeKg: number;
  /** Local day indexes (0 = Monday) with at least one workout. */
  activeDays: number[];
}

export class HistoryService {
  constructor(private readonly d: { repos: Repositories; clock: Clock }) {}

  list(q: WorkoutListQuery): Promise<WorkoutListItem[]> {
    return this.d.repos.workouts.listCompleted(q);
  }

  detail(id: Uuid): Promise<WorkoutDetail | null> {
    return this.d.repos.workouts.getDetail(id);
  }

  async thisWeek(): Promise<WeekSummary> {
    const weekStart = startOfWeek(this.d.clock.now());
    // A week holds few workouts; 50 is a generous bound for one query.
    const items = (await this.list({ limit: 50 })).filter(i => i.workout.startedAt >= weekStart);
    const days = new Set<number>();
    let durationMs = 0;
    let volumeKg = 0;
    for (const i of items) {
      durationMs += workoutDurationMs(i.workout, this.d.clock.now());
      volumeKg += i.volumeKg;
      days.add((new Date(i.workout.startedAt).getDay() + 6) % 7);
    }
    return { weekStart, workouts: items.length, durationMs, volumeKg, activeDays: [...days].sort((a, b) => a - b) };
  }
}
