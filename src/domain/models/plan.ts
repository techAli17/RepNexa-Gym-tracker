import type { Timestamp, Uuid } from './units';

/** 0 = Sunday … 6 = Saturday, as JavaScript's Date#getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface PlanDayRecord {
  weekday: Weekday;
  /** The routine trained that day; null on rest days and unplanned days. */
  routineId: Uuid | null;
  isRest: boolean;
  updatedAt: Timestamp;
}

export interface WeekPlanRecord {
  weekStart: Weekday;
  updatedAt: Timestamp;
  days: PlanDayRecord[];
}

/** The 7 weekdays in display order, starting from `weekStart`. */
export function orderedWeek(weekStart: Weekday): Weekday[] {
  return WEEKDAYS.map(i => ((weekStart + i) % 7) as Weekday);
}
