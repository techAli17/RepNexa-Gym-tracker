import type { RoutineTemplate } from '../../domain/models';
import { builtInId } from '../exercises/builtInExercises';

const ex = (name: string, targetSets: number, targetReps: number | null = null) => ({
  exerciseId: builtInId(name),
  targetSets,
  targetReps,
});

export const ROUTINE_TEMPLATES: readonly RoutineTemplate[] = [
  {
    key: 'push',
    name: 'Push',
    description: 'Chest, shoulders and triceps',
    exercises: [
      ex('Bench Press', 4, 8),
      ex('Overhead Press', 3, 6),
      ex('Incline Dumbbell Press', 3, 10),
      ex('Lateral Raise', 3, 12),
      ex('Triceps Pushdown', 3, 12),
    ],
  },
  {
    key: 'pull',
    name: 'Pull',
    description: 'Back and biceps',
    exercises: [
      ex('Deadlift', 3, 5),
      ex('Barbell Row', 3, 8),
      ex('Lat Pulldown', 3, 10),
      ex('Face Pull', 3, 15),
      ex('Dumbbell Curl', 3, 10),
    ],
  },
  {
    key: 'legs',
    name: 'Legs',
    description: 'Quads, hamstrings and glutes',
    exercises: [
      ex('Back Squat', 4, 6),
      ex('Romanian Deadlift', 3, 10),
      ex('Leg Press', 3, 12),
      ex('Leg Curl', 3, 12),
      ex('Standing Calf Raise', 3, 15),
    ],
  },
  {
    key: 'upper',
    name: 'Upper',
    description: 'Press and pull for the whole upper body',
    exercises: [
      ex('Bench Press', 3, 8),
      ex('Barbell Row', 3, 8),
      ex('Seated Dumbbell Shoulder Press', 3, 10),
      ex('Lat Pulldown', 3, 10),
      ex('Hammer Curl', 2, 12),
      ex('Triceps Pushdown', 2, 12),
    ],
  },
  {
    key: 'lower',
    name: 'Lower',
    description: 'Squat, hinge and accessories',
    exercises: [
      ex('Back Squat', 3, 6),
      ex('Romanian Deadlift', 3, 8),
      ex('Walking Lunge', 3, 12),
      ex('Leg Extension', 2, 15),
      ex('Hanging Leg Raise', 3, 12),
    ],
  },
  {
    key: 'full_body',
    name: 'Full Body',
    description: 'One session that covers everything',
    exercises: [
      ex('Goblet Squat', 3, 10),
      ex('Push-up', 3, 12),
      ex('Seated Cable Row', 3, 10),
      ex('Hip Thrust', 3, 10),
      ex('Plank', 3),
    ],
  },
];
