export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const DISTANCE_UNITS = ['m', 'km', 'mi'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

/** Epoch milliseconds, always UTC. */
export type Timestamp = number;

/** Stable cross-device identifier (UUID v4). Never a SQLite rowid. */
export type Uuid = string;
