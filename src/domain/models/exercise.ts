import type { Timestamp, Uuid } from './units';

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
  'cardio',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/**
 * Decides which fields a set records and which fields are required before a
 * set can be checked off.
 */
export const TRACKING_TYPES = [
  'weight_reps',
  'bodyweight_reps',
  'duration',
  'distance_duration',
] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export interface Exercise {
  id: Uuid;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  trackingType: TrackingType;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string | null;
  /** Key into the bundled image manifest; null falls back to an illustration. */
  imageKey: string | null;
  isCustom: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}
