import type { Equipment, MuscleGroup, TrackingType } from '../domain/models';
import { t as activeT, type TKey } from './index';

type T = (key: TKey) => string;

/** Labels for domain enums. Pass `t` from useT() inside components. */
export const weekdayName = (d: number, t: T = activeT) => t(`common.weekday.${d}` as TKey);
export const weekdayShort = (d: number, t: T = activeT) => t(`common.weekdayShort.${d}` as TKey);
export const muscleGroupLabel = (g: MuscleGroup, t: T = activeT) => t(`common.muscleGroup.${g}` as TKey);
export const equipmentLabel = (e: Equipment, t: T = activeT) => t(`common.equipment.${e}` as TKey);
export const trackingTypeLabel = (k: TrackingType, t: T = activeT) => t(`common.trackingType.${k}` as TKey);
