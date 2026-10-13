import { createStore } from 'zustand/vanilla';
import { animateNextLayout } from '../hooks/useReducedMotion';
import type { AppServices } from '../application/container';
import type { WorkoutSummary } from '../application/workouts/WorkoutService';
import type { AppSettings, RoutineTemplate, Uuid, WorkoutDetail, WorkoutSet } from '../domain/models';

export interface RestTimer {
  endsAt: number;
  totalSeconds: number;
}

export interface ActiveWorkoutState {
  detail: WorkoutDetail | null;
  /** Previous session's completed sets per exercise, for the "Previous" column. */
  previous: Record<Uuid, WorkoutSet[]>;
  ready: boolean;
  rest: RestTimer | null;
  lastSummary: WorkoutSummary | null;

  load(): Promise<void>;
  startEmpty(): Promise<void>;
  startTemplate(t: RoutineTemplate): Promise<void>;
  startRoutine(routineId: Uuid): Promise<void>;
  addExercise(exerciseId: Uuid): Promise<void>;
  removeExercise(workoutExerciseId: Uuid): Promise<void>;
  replaceExercise(workoutExerciseId: Uuid, exerciseId: Uuid): Promise<void>;
  setRestSeconds(workoutExerciseId: Uuid, seconds: number | null): Promise<void>;
  rename(name: string): Promise<void>;
  setNotes(notes: string): Promise<void>;
  moveExercise(workoutExerciseId: Uuid, dir: -1 | 1): Promise<void>;
  setExerciseNotes(workoutExerciseId: Uuid, notes: string): Promise<void>;
  addSet(workoutExerciseId: Uuid): Promise<void>;
  removeSet(setId: Uuid): Promise<void>;
  updateSet(setId: Uuid, patch: Partial<WorkoutSet>): Promise<void>;
  toggleSet(setId: Uuid): Promise<void>;
  cycleSetType(setId: Uuid): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  finish(): Promise<WorkoutSummary>;
  discard(): Promise<void>;
  startRest(seconds: number): void;
  adjustRest(deltaSeconds: number): void;
  clearRest(): void;
}

/** Replaces one set in place, leaving every other exercise's array identity intact for memoized rows. */
function patchSet(detail: WorkoutDetail, next: WorkoutSet): WorkoutDetail {
  return {
    ...detail,
    exercises: detail.exercises.map(e =>
      e.id === next.workoutExerciseId ? { ...e, sets: e.sets.map(s => (s.id === next.id ? next : s)) } : e,
    ),
  };
}

/**
 * Screen state for the workout in progress. SQLite is the source of truth:
 * every action writes through the service first and only then updates memory,
 * so what the user sees is what will survive an app kill.
 */
export function createActiveWorkoutStore(services: AppServices, getSettings: () => AppSettings) {
  return createStore<ActiveWorkoutState>()((set, get) => {
    const unit = () => getSettings().weightUnit;

    const refresh = async () => {
      const detail = await services.workouts.getActiveDetail();
      const known = get().previous;
      const missing = detail?.exercises.map(e => e.exerciseId).filter(id => !(id in known)) ?? [];
      const previous = missing.length
        ? { ...known, ...(await services.workouts.previousSets(missing, detail?.workout.id)) }
        : known;
      // Sets and exercises added, removed or reordered slide into place.
      if (get().detail) animateNextLayout();
      set({ detail, previous, ready: true });
    };

    const requireId = () => {
      const id = get().detail?.workout.id;
      if (!id) throw new Error('No active workout');
      return id;
    };

    return {
      detail: null,
      previous: {},
      ready: false,
      rest: null,
      lastSummary: null,

      load: refresh,

      async startEmpty() {
        await services.workouts.startEmpty(unit());
        set({ previous: {} });
        await refresh();
      },
      async startTemplate(t) {
        await services.workouts.startFromTemplate(t, unit());
        set({ previous: {} });
        await refresh();
      },
      async startRoutine(routineId) {
        await services.workouts.startFromRoutine(routineId, unit());
        set({ previous: {} });
        await refresh();
      },
      async addExercise(exerciseId) {
        await services.workouts.addExercise(requireId(), exerciseId, unit());
        await refresh();
      },
      async removeExercise(id) {
        await services.workouts.removeExercise(id);
        await refresh();
      },
      async replaceExercise(id, exerciseId) {
        await services.workouts.replaceExercise(id, exerciseId, unit());
        await refresh();
      },
      async setRestSeconds(id, seconds) {
        await services.workouts.setRestSeconds(id, seconds);
        await refresh();
      },
      async rename(name) {
        await services.workouts.rename(requireId(), name);
        await refresh();
      },
      async setNotes(notes) {
        await services.workouts.updateNotes(requireId(), notes);
        await refresh();
      },
      async moveExercise(id, dir) {
        await services.workouts.moveExercise(id, dir);
        await refresh();
      },
      async setExerciseNotes(id, notes) {
        await services.workouts.updateExerciseNotes(id, notes);
      },
      async addSet(id) {
        await services.workouts.addSet(id, unit());
        await refresh();
      },
      async removeSet(id) {
        await services.workouts.removeSet(id);
        await refresh();
      },
      async updateSet(id, patch) {
        const next = await services.workouts.updateSet(id, patch);
        const d = get().detail;
        if (d) set({ detail: patchSet(d, next) });
      },
      async toggleSet(id) {
        const d = get().detail;
        const current = d?.exercises.flatMap(e => e.sets).find(s => s.id === id);
        if (!d || !current) return;
        const next = await services.workouts.setCompleted(id, current.completedAt == null);
        const latest = get().detail;
        if (latest) set({ detail: patchSet(latest, next) });
        if (next.completedAt != null) {
          const we = d.exercises.find(e => e.id === next.workoutExerciseId);
          const seconds = next.setType === 'warmup' ? 60 : we?.restSeconds ?? getSettings().defaultRestSeconds;
          if (seconds > 0) get().startRest(seconds);
        }
      },
      async cycleSetType(id) {
        const next = await services.workouts.cycleSetType(id);
        const d = get().detail;
        if (d) set({ detail: patchSet(d, next) });
      },
      async pause() {
        await services.workouts.pause(requireId());
        await refresh();
      },
      async resume() {
        await services.workouts.resume(requireId());
        await refresh();
      },
      async finish() {
        const summary = await services.workouts.complete(requireId());
        set({ detail: null, previous: {}, rest: null, lastSummary: summary });
        return summary;
      },
      async discard() {
        await services.workouts.discard(requireId());
        set({ detail: null, previous: {}, rest: null });
      },

      startRest(seconds) {
        set({ rest: { endsAt: Date.now() + seconds * 1000, totalSeconds: seconds } });
      },
      adjustRest(delta) {
        const r = get().rest;
        if (!r) return;
        const endsAt = Math.max(Date.now() + 1000, r.endsAt + delta * 1000);
        set({ rest: { endsAt, totalSeconds: Math.max(15, r.totalSeconds + delta) } });
      },
      clearRest() {
        set({ rest: null });
      },
    };
  });
}

export type ActiveWorkoutStore = ReturnType<typeof createActiveWorkoutStore>;
