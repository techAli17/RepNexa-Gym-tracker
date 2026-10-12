import { DomainError } from '../../domain/errors';
import {
  WEEKDAY_NAMES,
  WEEKDAYS,
  orderedWeek,
  type PlanDayRecord,
  type Uuid,
  type Weekday,
} from '../../domain/models';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock } from '../ports/system';
import type { RoutineService, RoutineSummary } from '../routines/RoutineService';

export type PlanDayKind = 'training' | 'rest' | 'unplanned';

export interface PlanDayView {
  weekday: Weekday;
  name: string;
  kind: PlanDayKind;
  /** Set on training days. */
  routine: RoutineSummary | null;
  isToday: boolean;
}

export interface WeekPlanView {
  weekStart: Weekday;
  /** The 7 days in display order, starting on `weekStart`. */
  days: PlanDayView[];
  trainingDays: number;
  restDays: number;
}

const isWeekday = (d: number): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6;

/**
 * The user's week: which day it starts on, which days are rest days, and the
 * exercises for each training day. A training day's exercises are a routine,
 * so they get the routine editor, targets, reordering and backup for free.
 */
export class PlanService {
  constructor(
    private readonly d: { repos: Repositories; uow: UnitOfWork; clock: Clock; routines: RoutineService },
  ) {}

  async get(): Promise<WeekPlanView> {
    const plan = await this.d.repos.plan.get();
    const routines = new Map((await this.d.routines.list()).map(r => [r.routine.id, r]));
    const byDay = new Map(plan.days.map(x => [x.weekday, x]));
    const today = new Date(this.d.clock.now()).getDay() as Weekday;
    const days = orderedWeek(plan.weekStart).map<PlanDayView>(weekday => {
      const rec = byDay.get(weekday);
      const routine = rec?.routineId ? routines.get(rec.routineId) ?? null : null;
      const kind: PlanDayKind = rec?.isRest ? 'rest' : routine ? 'training' : 'unplanned';
      return { weekday, name: WEEKDAY_NAMES[weekday], kind, routine, isToday: weekday === today };
    });
    return {
      weekStart: plan.weekStart,
      days,
      trainingDays: days.filter(x => x.kind === 'training').length,
      restDays: days.filter(x => x.kind === 'rest').length,
    };
  }

  async today(): Promise<PlanDayView> {
    return (await this.get()).days.find(x => x.isToday)!;
  }

  async setWeekStart(weekStart: number): Promise<void> {
    if (!isWeekday(weekStart)) throw new DomainError('VALIDATION', 'Pick a day of the week');
    await this.d.uow.run(async r => {
      await r.plan.setWeekStart(weekStart, this.d.clock.now());
      await r.backupState.bumpLocalRevision();
    });
  }

  /** Marks a day as a rest day, or back to "not planned". A routine it had is kept, just unassigned. */
  async setRest(weekday: number, rest: boolean): Promise<void> {
    await this.put(weekday, { routineId: null, isRest: rest });
  }

  /** Trains `routineId` on this day; null clears it. */
  async assignRoutine(weekday: number, routineId: Uuid | null): Promise<void> {
    await this.put(weekday, { routineId, isRest: false });
  }

  /** Creates the day's routine from editor input and assigns it, e.g. "Monday – Chest". */
  async createDayRoutine(weekday: number, input: unknown): Promise<Uuid> {
    if (!isWeekday(weekday)) throw new DomainError('VALIDATION', 'Pick a day of the week');
    const routine = await this.d.routines.create(input);
    await this.assignRoutine(weekday, routine.id);
    return routine.id;
  }

  /** Days of the week with their default display names, for pickers. */
  static weekdays(): Array<{ weekday: Weekday; name: string }> {
    return WEEKDAYS.map(w => ({ weekday: w, name: WEEKDAY_NAMES[w] }));
  }

  private async put(weekday: number, v: Pick<PlanDayRecord, 'routineId' | 'isRest'>): Promise<void> {
    if (!isWeekday(weekday)) throw new DomainError('VALIDATION', 'Pick a day of the week');
    await this.d.uow.run(async r => {
      if (v.routineId) {
        const routine = await r.routines.getDetail(v.routineId);
        if (!routine) throw new DomainError('NOT_FOUND', 'Routine not found');
      }
      await r.plan.putDay({ weekday, routineId: v.routineId, isRest: v.isRest, updatedAt: this.d.clock.now() });
      await r.backupState.bumpLocalRevision();
    });
  }
}
