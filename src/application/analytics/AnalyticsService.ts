import {
  estimateOneRepMax,
  isWorkingSet,
  setVolumeKg,
  startOfWeek,
  toKg,
  workoutDurationMs,
  type SetWithContext,
} from '../../domain/calculations';
import type {
  Exercise,
  PersonalRecord,
  RecordType,
  Timestamp,
  Uuid,
  WorkoutSet,
} from '../../domain/models';
import type { Repositories } from '../ports/repositories';
import type { Clock } from '../ports/system';

export interface E1rmPoint {
  workoutId: Uuid;
  date: Timestamp;
  /** kg */
  e1rm: number;
  set: WorkoutSet;
}

export interface WeekBucket {
  weekStart: Timestamp;
  workouts: number;
  volumeKg: number;
  durationMs: number;
}

export interface LoggedExercise {
  exercise: Exercise;
  workoutCount: number;
  lastPerformedAt: Timestamp;
}

export interface ExerciseRecords {
  exercise: Exercise;
  records: Partial<Record<RecordType, PersonalRecord>>;
}

export interface SessionStats {
  workoutId: Uuid;
  date: Timestamp;
  sets: number;
  volumeKg: number;
  bestE1rm: number | null;
  bestSet: WorkoutSet | null;
}

export interface ExerciseComparison {
  exercise: Exercise;
  current: SessionStats;
  previous: SessionStats | null;
}

const WEEK_MS = 7 * 86_400_000;

function sessionStats(
  workoutId: Uuid,
  date: Timestamp,
  sets: readonly WorkoutSet[],
): SessionStats {
  let volumeKg = 0;
  let bestE1rm: number | null = null;
  let bestSet: WorkoutSet | null = null;
  let n = 0;
  for (const s of sets) {
    if (s.completedAt == null) continue;
    n++;
    volumeKg += setVolumeKg(s);
    if (!isWorkingSet(s) || s.weightValue == null || s.reps == null) continue;
    const e = estimateOneRepMax(toKg(s.weightValue, s.weightUnit), s.reps);
    if (e != null && (bestE1rm == null || e > bestE1rm)) {
      bestE1rm = e;
      bestSet = s;
    }
  }
  return { workoutId, date, sets: n, volumeKg, bestE1rm, bestSet };
}

function groupByWorkout(
  rows: readonly SetWithContext[],
): Map<Uuid, { date: Timestamp; sets: WorkoutSet[] }> {
  const m = new Map<Uuid, { date: Timestamp; sets: WorkoutSet[] }>();
  for (const r of rows) {
    const g = m.get(r.workoutId);
    if (g) g.sets.push(r.set);
    else m.set(r.workoutId, { date: r.workoutStartedAt, sets: [r.set] });
  }
  return m;
}

/** Read-only, derived from workout records on demand. Nothing here is stored. */
export class AnalyticsService {
  constructor(private readonly d: { repos: Repositories; clock: Clock }) {}

  /** Exercises the user has actually logged, most used first, for pickers and charts. */
  async loggedExercises(): Promise<LoggedExercise[]> {
    const usage = await this.d.repos.workouts.exerciseUsage();
    const exercises = new Map(
      (await this.d.repos.exercises.getByIds(usage.map(u => u.exerciseId))).map(
        e => [e.id, e],
      ),
    );
    return usage.flatMap(u => {
      const exercise = exercises.get(u.exerciseId);
      return exercise
        ? [
            {
              exercise,
              workoutCount: u.workoutCount,
              lastPerformedAt: u.lastPerformedAt,
            },
          ]
        : [];
    });
  }

  /** Best estimated 1RM per session, oldest first. Sessions without a qualifying set are skipped. */
  async e1rmSeries(exerciseId: Uuid, since?: Timestamp): Promise<E1rmPoint[]> {
    const groups = groupByWorkout(
      await this.d.repos.workouts.completedSetsForExercise(exerciseId),
    );
    const out: E1rmPoint[] = [];
    for (const [workoutId, g] of groups) {
      if (since != null && g.date < since) continue;
      const st = sessionStats(workoutId, g.date, g.sets);
      if (st.bestE1rm != null && st.bestSet)
        out.push({
          workoutId,
          date: g.date,
          e1rm: st.bestE1rm,
          set: st.bestSet,
        });
    }
    return out.sort((a, b) => a.date - b.date);
  }

  /** The last `weeks` weeks including the current one, empty weeks included, oldest first. */
  async weekly(weeks: number): Promise<WeekBucket[]> {
    // Weeks begin on the day the user chose in their weekly plan.
    const firstDay = (await this.d.repos.plan.get()).weekStart;
    const current = startOfWeek(this.d.clock.now(), firstDay);
    const buckets: WeekBucket[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      // Re-derive from a date in that week so DST shifts never misalign buckets.
      buckets.push({
        weekStart: startOfWeek(
          current - i * WEEK_MS + 3 * 86_400_000,
          firstDay,
        ),
        workouts: 0,
        volumeKg: 0,
        durationMs: 0,
      });
    }
    const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
    const items = await this.d.repos.workouts.listCompleted({
      limit: 5000,
      startedAfter: buckets[0].weekStart,
    });
    for (const it of items) {
      const i = index.get(startOfWeek(it.workout.startedAt, firstDay));
      if (i == null) continue;
      const b = buckets[i];
      b.workouts++;
      b.volumeKg += it.volumeKg;
      b.durationMs += workoutDurationMs(
        it.workout,
        it.workout.endedAt ?? it.workout.startedAt,
      );
    }
    return buckets;
  }

  /** Consecutive weeks, ending this week or last, with at least `minPerWeek` workouts. */
  async weekStreak(minPerWeek = 2): Promise<number> {
    const weeks = await this.weekly(104);
    let i = weeks.length - 1;
    if (weeks[i].workouts < minPerWeek) i--; // the current week is still in progress
    let n = 0;
    for (; i >= 0 && weeks[i].workouts >= minPerWeek; i--) n++;
    return n;
  }

  async records(): Promise<ExerciseRecords[]> {
    const all = await this.d.repos.records.listAll();
    const exercises = new Map(
      (await this.d.repos.exercises.getByIds(all.map(r => r.exerciseId))).map(
        e => [e.id, e],
      ),
    );
    const by = new Map<Uuid, ExerciseRecords>();
    for (const r of all) {
      const exercise = exercises.get(r.exerciseId);
      if (!exercise) continue;
      const g = by.get(r.exerciseId) ?? { exercise, records: {} };
      g.records[r.recordType] = r;
      by.set(r.exerciseId, g);
    }
    return [...by.values()].sort((a, b) =>
      a.exercise.name.localeCompare(b.exercise.name),
    );
  }

  /** For each exercise in a workout: this session versus the one before it. */
  async compareWithPrevious(workoutId: Uuid): Promise<ExerciseComparison[]> {
    const detail = await this.d.repos.workouts.getDetail(workoutId);
    if (!detail) return [];
    const out: ExerciseComparison[] = [];
    for (const e of detail.exercises) {
      const current = sessionStats(workoutId, detail.workout.startedAt, e.sets);
      const groups = groupByWorkout(
        await this.d.repos.workouts.completedSetsForExercise(e.exerciseId),
      );
      let previous: SessionStats | null = null;
      for (const [id, g] of groups) {
        if (id === workoutId || g.date >= detail.workout.startedAt) continue;
        if (!previous || g.date > previous.date)
          previous = sessionStats(id, g.date, g.sets);
      }
      out.push({ exercise: e.exercise, current, previous });
    }
    return out;
  }
}
