import type { MuscleGroup } from './exercise';

/** Body regions drawn on the muscle map. */
export const BODY_REGIONS = [
  'chest',
  'frontDelts',
  'sideDelts',
  'rearDelts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'hipFlexors',
  'upperBack',
  'lats',
  'lowerBack',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];

const DELTS: BodyRegion[] = ['frontDelts', 'sideDelts', 'rearDelts'];
const LEGS: BodyRegion[] = ['quads', 'hamstrings', 'glutes', 'calves'];
const BACK: BodyRegion[] = ['upperBack', 'lats', 'lowerBack'];

/**
 * Maps a free-text muscle name (built-in or typed for a custom exercise) to
 * regions. Order matters: specific names are checked before generic ones,
 * e.g. "side delts" before "lats" (which "lateral" would otherwise match).
 */
const RULES: Array<[RegExp, BodyRegion[]]> = [
  [/front delt|anterior delt/, ['frontDelts']],
  [/side delt|lateral delt|middle delt/, ['sideDelts']],
  [/rear delt|posterior delt/, ['rearDelts']],
  [/shoulder|delt/, DELTS],
  [/chest|pec/, ['chest']],
  [/bicep|brachialis/, ['biceps']],
  [/tricep/, ['triceps']],
  [/forearm|grip|wrist/, ['forearms']],
  [/oblique/, ['obliques']],
  [/core|abs\b|abdominal/, ['abs', 'obliques']],
  [/hip flexor/, ['hipFlexors']],
  [/upper back|trap|rhomboid/, ['upperBack']],
  [/lower back|erector/, ['lowerBack']],
  [/\blats?\b|latissimus/, ['lats']],
  [/back/, BACK],
  [/glute/, ['glutes']],
  [/quad/, ['quads']],
  [/hamstring/, ['hamstrings']],
  [/calf|calves/, ['calves']],
  [/leg/, LEGS],
];

const BY_GROUP: Record<MuscleGroup, BodyRegion[]> = {
  chest: ['chest'],
  back: ['upperBack', 'lats'],
  legs: LEGS,
  shoulders: DELTS,
  arms: ['biceps', 'triceps', 'forearms'],
  core: ['abs', 'obliques'],
  full_body: ['chest', 'frontDelts', 'upperBack', 'lats', 'abs', 'glutes', 'quads', 'hamstrings'],
  cardio: [],
};

export function regionsForMuscle(name: string): BodyRegion[] {
  const n = name.trim().toLowerCase();
  for (const [re, regions] of RULES) if (re.test(n)) return regions;
  return [];
}

export interface MuscleHighlight {
  primary: BodyRegion[];
  secondary: BodyRegion[];
}

/**
 * Regions to highlight for an exercise. Falls back to the muscle group when no
 * muscle names are known (custom exercises often have none). A region listed
 * as primary is never also shown as secondary.
 */
export function muscleHighlight(e: { muscleGroup: MuscleGroup; primaryMuscles: readonly string[]; secondaryMuscles: readonly string[] }): MuscleHighlight {
  let primary = unique(e.primaryMuscles.flatMap(regionsForMuscle));
  if (!primary.length) primary = BY_GROUP[e.muscleGroup] ?? [];
  const secondary = unique(e.secondaryMuscles.flatMap(regionsForMuscle)).filter(r => !primary.includes(r));
  return { primary, secondary };
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
