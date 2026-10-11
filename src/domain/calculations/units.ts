import type { DistanceUnit, WeightUnit } from '../models/units';

/** Exact by definition (international avoirdupois pound). */
export const KG_PER_LB = 0.45359237;
const METERS_PER_UNIT: Record<DistanceUnit, number> = { m: 1, km: 1000, mi: 1609.344 };

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'lb' ? value * KG_PER_LB : value / KG_PER_LB;
}

export const toKg = (value: number, unit: WeightUnit): number => convertWeight(value, unit, 'kg');

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  return (value * METERS_PER_UNIT[from]) / METERS_PER_UNIT[to];
}

export const toMeters = (value: number, unit: DistanceUnit): number =>
  convertDistance(value, unit, 'm');

/** Rounds to a plate-friendly increment, e.g. 2.5 kg or 5 lb. Avoids float noise. */
export function roundToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value;
  const n = Math.round(value / increment) * increment;
  return Math.round(n * 1000) / 1000;
}

/** Display rounding: at most `digits` decimals, trailing zeros dropped. */
export function roundForDisplay(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
