import type { Equipment, Exercise, MuscleGroup, TrackingType } from '../../domain/models';

/**
 * Starter catalog. IDs are fixed forever: logged workouts and backups refer to
 * them. When the licensed image catalog is added, map its entries onto these
 * IDs instead of replacing them. Instructions are original text.
 */
type Seed = {
  id: string;
  name: string;
  g: MuscleGroup;
  eq: Equipment;
  t?: TrackingType;
  p: string[];
  s?: string[];
  how: string;
};

const SEEDS: Seed[] = [
  { id: '67ebb917-9827-4c6d-9952-f742b2f9be79', name: 'Bench Press', g: 'chest', eq: 'barbell', p: ['chest'], s: ['triceps', 'front delts'], how: 'Lower the bar to mid-chest with elbows about 45° from your body, then press up and slightly back.' },
  { id: '4abc5bf2-971d-4bc4-9a24-7bcaa10561d0', name: 'Incline Dumbbell Press', g: 'chest', eq: 'dumbbell', p: ['upper chest'], s: ['front delts', 'triceps'], how: 'On a 30° bench, press the dumbbells over your upper chest and lower them under control.' },
  { id: 'cf9fb1e1-df40-4c11-b6f8-a7860bdc83d7', name: 'Cable Chest Fly', g: 'chest', eq: 'cable', p: ['chest'], s: ['front delts'], how: 'With a slight bend in the elbows, bring the handles together in a wide arc in front of your chest.' },
  { id: 'a104c289-8a61-4e27-b679-9f59b976a556', name: 'Push-up', g: 'chest', eq: 'bodyweight', t: 'bodyweight_reps', p: ['chest'], s: ['triceps', 'core'], how: 'Keep a straight line from head to heels and lower until your chest nearly touches the floor.' },
  { id: '9a32bd91-e962-4369-aa8f-6834894b07b1', name: 'Dip', g: 'chest', eq: 'bodyweight', t: 'bodyweight_reps', p: ['chest', 'triceps'], s: ['front delts'], how: 'Lower until your upper arms are about parallel to the floor, leaning slightly forward, then press up.' },

  { id: '3afc525d-efab-46d1-b752-a30c11893c00', name: 'Overhead Press', g: 'shoulders', eq: 'barbell', p: ['front delts'], s: ['triceps', 'upper back'], how: 'Brace your core, press the bar straight overhead and bring your head through once the bar passes your face.' },
  { id: '41a0ca6c-bd57-4ce1-be32-8e171ce5401a', name: 'Seated Dumbbell Shoulder Press', g: 'shoulders', eq: 'dumbbell', p: ['front delts'], s: ['side delts', 'triceps'], how: 'Sit tall with back support and press the dumbbells overhead without clashing them.' },
  { id: '375dd9b2-0fdc-4be4-a371-135cd8927bde', name: 'Lateral Raise', g: 'shoulders', eq: 'dumbbell', p: ['side delts'], s: ['upper back'], how: 'Raise the dumbbells out to the sides to shoulder height, leading with your elbows.' },
  { id: 'acfc7f10-410d-40c9-90d0-2297d1ce451e', name: 'Face Pull', g: 'shoulders', eq: 'cable', p: ['rear delts'], s: ['upper back'], how: 'Pull the rope towards your face, splitting the ends and finishing with hands beside your ears.' },

  { id: '4345fcb5-d725-4763-a0cb-43321337e331', name: 'Deadlift', g: 'back', eq: 'barbell', p: ['lower back', 'glutes', 'hamstrings'], s: ['lats', 'forearms'], how: 'Keep the bar against your legs and your back flat, and stand up by pushing the floor away.' },
  { id: '6edc74e3-0114-4bfc-9114-f1ecb726440c', name: 'Barbell Row', g: 'back', eq: 'barbell', p: ['upper back', 'lats'], s: ['biceps'], how: 'Hinge forward with a flat back and pull the bar to your lower ribs.' },
  { id: '7f62acf1-2892-4e9f-b4ba-266f54294c56', name: 'Seated Cable Row', g: 'back', eq: 'cable', p: ['upper back', 'lats'], s: ['biceps'], how: 'Sit tall and pull the handle to your stomach, squeezing your shoulder blades together.' },
  { id: 'd3e01a97-57ed-44e8-9ea2-cc27f5e53668', name: 'Pull-up', g: 'back', eq: 'bodyweight', t: 'bodyweight_reps', p: ['lats'], s: ['biceps', 'upper back'], how: 'Start from a dead hang and pull until your chin clears the bar. Log added weight, if any.' },
  { id: 'bf28ad58-6893-4264-93d3-9ef3a5dd2624', name: 'Lat Pulldown', g: 'back', eq: 'cable', p: ['lats'], s: ['biceps'], how: 'Pull the bar to your upper chest while keeping your torso tall.' },

  { id: '4b52ffc1-cf68-45a1-8659-cc79be32dd66', name: 'Back Squat', g: 'legs', eq: 'barbell', p: ['quads', 'glutes'], s: ['hamstrings', 'core'], how: 'Sit down between your heels until your thighs are at least parallel, knees tracking over your toes.' },
  { id: '5a259e37-1a8f-45c6-91f6-352f821c9318', name: 'Goblet Squat', g: 'legs', eq: 'dumbbell', p: ['quads', 'glutes'], s: ['core'], how: 'Hold a dumbbell at your chest and squat deep, keeping your chest up.' },
  { id: '0d145006-db24-4f2d-9d93-1116492cba75', name: 'Leg Press', g: 'legs', eq: 'machine', p: ['quads'], s: ['glutes'], how: 'Lower the sled until your knees reach about 90°, then press through your whole foot.' },
  { id: 'a475a6b2-8bb8-43fa-82f9-ae6de1ca9827', name: 'Romanian Deadlift', g: 'legs', eq: 'barbell', p: ['hamstrings', 'glutes'], s: ['lower back'], how: 'Push your hips back with soft knees until you feel a stretch in your hamstrings, then stand up.' },
  { id: 'f4c7de61-f716-41a5-812e-0ea13bef1e52', name: 'Walking Lunge', g: 'legs', eq: 'dumbbell', p: ['quads', 'glutes'], s: ['calves'], how: 'Step forward and lower your back knee towards the floor, then step through.' },
  { id: 'f64732dd-379e-43a6-a4b8-c73a4430796c', name: 'Leg Curl', g: 'legs', eq: 'machine', p: ['hamstrings'], s: ['calves'], how: 'Curl the pad towards you under control, pause, and return slowly.' },
  { id: '113277cb-ba28-409f-84be-81a90d832a59', name: 'Leg Extension', g: 'legs', eq: 'machine', p: ['quads'], how: 'Extend your knees until your legs are straight, then lower slowly.' },
  { id: '167ea266-2dd1-4680-9a23-d70c23a676ad', name: 'Hip Thrust', g: 'legs', eq: 'barbell', p: ['glutes'], s: ['hamstrings'], how: 'With your upper back on a bench, drive your hips up until your body is level from knees to shoulders.' },
  { id: 'fbb6f155-02f0-4233-aae3-e0cf0a19ca4d', name: 'Standing Calf Raise', g: 'legs', eq: 'machine', p: ['calves'], how: 'Rise onto the balls of your feet as high as you can, pause, and lower to a full stretch.' },

  { id: '39c8b1ec-89e5-413a-ad27-d72a8038e40d', name: 'Dumbbell Curl', g: 'arms', eq: 'dumbbell', p: ['biceps'], s: ['forearms'], how: 'Keep your elbows pinned to your sides and curl without swinging.' },
  { id: '6da67a38-490b-43a6-9f52-2cc9a7115d3f', name: 'Hammer Curl', g: 'arms', eq: 'dumbbell', p: ['biceps', 'forearms'], how: 'Curl with your palms facing each other, keeping your elbows still.' },
  { id: '5be6407d-bf53-4060-b5f9-f8e23068d630', name: 'Triceps Pushdown', g: 'arms', eq: 'cable', p: ['triceps'], how: 'Keep your elbows at your sides and push the handle down until your arms are straight.' },

  { id: '5c1e5350-6733-49bb-a32b-034900431ef3', name: 'Plank', g: 'core', eq: 'bodyweight', t: 'duration', p: ['core'], s: ['front delts'], how: 'Hold a straight line on your forearms, squeeze your glutes and keep breathing.' },
  { id: '09894077-3030-4785-b482-fd5862bf2798', name: 'Hanging Leg Raise', g: 'core', eq: 'bodyweight', t: 'bodyweight_reps', p: ['core'], s: ['hip flexors'], how: 'Hang from a bar and raise your legs without swinging, then lower under control.' },

  { id: 'b2b1b7ab-6ba1-495f-aa1b-15dc3e095d71', name: 'Treadmill Run', g: 'cardio', eq: 'machine', t: 'distance_duration', p: ['legs'], how: 'Log the distance and time for the run.' },
  { id: 'b592f751-0dd7-483b-814f-5c6fab3fb7e3', name: 'Rowing Machine', g: 'cardio', eq: 'machine', t: 'distance_duration', p: ['back', 'legs'], how: 'Drive with your legs first, then lean back and pull the handle to your lower ribs.' },
];

/** Fixed timestamp so re-seeding is a no-op unless catalog content actually changed. */
const CATALOG_TIMESTAMP = Date.UTC(2026, 9, 1);

export const BUILT_IN_EXERCISES: readonly Exercise[] = SEEDS.map(s => ({
  id: s.id,
  name: s.name,
  muscleGroup: s.g,
  equipment: s.eq,
  trackingType: s.t ?? 'weight_reps',
  primaryMuscles: s.p,
  secondaryMuscles: s.s ?? [],
  instructions: s.how,
  imageKey: null,
  isCustom: false,
  createdAt: CATALOG_TIMESTAMP,
  updatedAt: CATALOG_TIMESTAMP,
  deletedAt: null,
}));

const byName = new Map(BUILT_IN_EXERCISES.map(e => [e.name, e.id]));
/** Looks up a built-in ID by name; throws at module load if a template references a typo. */
export function builtInId(name: string): string {
  const id = byName.get(name);
  if (!id) throw new Error(`Unknown built-in exercise: ${name}`);
  return id;
}
