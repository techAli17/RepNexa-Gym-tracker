import type { Timestamp, Uuid } from './units';

export interface Routine {
  id: Uuid;
  name: string;
  notes: string | null;
  position: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface RoutineExercise {
  id: Uuid;
  routineId: Uuid;
  exerciseId: Uuid;
  position: number;
  targetSets: number;
  targetReps: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface RoutineDetail {
  routine: Routine;
  exercises: RoutineExercise[];
}

/** Built-in starting points. Not stored until the user saves one as a routine. */
export interface RoutineTemplate {
  key: string;
  name: string;
  description: string;
  exercises: Array<{ exerciseId: Uuid; targetSets: number; targetReps: number | null }>;
}
