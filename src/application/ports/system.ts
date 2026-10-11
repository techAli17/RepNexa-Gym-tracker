import type { Timestamp, Uuid } from '../../domain/models';

export interface Clock {
  now(): Timestamp;
}

export interface IdGenerator {
  next(): Uuid;
}

export const systemClock: Clock = { now: () => Date.now() };
