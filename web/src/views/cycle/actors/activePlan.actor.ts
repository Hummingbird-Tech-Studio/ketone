import { extractErrorMessage } from '@/services/http/errors';
import { runWithUi } from '@/utils/effects/helpers';
import { programGetActivePlan, type GetActivePlanSuccess } from '@/views/plan/services/plan.service';
import type { PeriodResponse } from '@ketone/shared';
import { addHours } from 'date-fns';
import { Match } from 'effect';
import { assign, emit, fromCallback, setup, type EventObject } from 'xstate';
import { timerLogic } from './shared/timerLogic';

/**
 * Ensures a value is a Date object
 */
function ensureDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

/**
 * Determines which window phase the current period is in based on the current time.
 * - Fasting window: from startDate to startDate + fastingDuration hours
 * - Eating window: from startDate + fastingDuration hours to endDate
 */
function determineWindowPhase(period: PeriodResponse, now: Date): 'fasting' | 'eating' | null {
  const startDate = ensureDate(period.startDate);
  const endDate = ensureDate(period.endDate);
  const fastingEnd = addHours(startDate, period.fastingDuration);

  if (now < startDate) {
    return null;
  }

  if (now >= startDate && now < fastingEnd) {
    return 'fasting';
  }

  if (now >= fastingEnd && now < endDate) {
    return 'eating';
  }

  return null;
}

/**
 * Finds the current in-progress period from the plan.
 * First checks for a period with status 'in_progress', then falls back to finding by time.
 */
function findCurrentPeriod(plan: GetActivePlanSuccess): PeriodResponse | null {
  // First try to find by status
  const inProgressPeriod = plan.periods.find((p) => p.status === 'in_progress');
  if (inProgressPeriod) {
    return inProgressPeriod;
  }

  // Fall back to finding by current time
  const now = new Date();
  return plan.periods.find((p) => {
    const startDate = ensureDate(p.startDate);
    const endDate = ensureDate(p.endDate);
    return now >= startDate && now < endDate;
  }) ?? null;
}

export enum ActivePlanState {
  Idle = 'Idle',
  Loading = 'Loading',
  InFastingWindow = 'InFastingWindow',
  InEatingWindow = 'InEatingWindow',
  PeriodCompleted = 'PeriodCompleted',
  AllPeriodsCompleted = 'AllPeriodsCompleted',
}

export enum Event {
  TICK = 'TICK',
  LOAD = 'LOAD',
  REFRESH = 'REFRESH',
  ON_SUCCESS = 'ON_SUCCESS',
  ON_NO_ACTIVE_PLAN = 'ON_NO_ACTIVE_PLAN',
  ON_ERROR = 'ON_ERROR',
}

type EventType =
  | { type: Event.TICK }
  | { type: Event.LOAD }
  | { type: Event.REFRESH }
  | { type: Event.ON_SUCCESS; result: GetActivePlanSuccess }
  | { type: Event.ON_NO_ACTIVE_PLAN }
  | { type: Event.ON_ERROR; error: string };

export enum Emit {
  TICK = 'TICK',
  PLAN_ERROR = 'PLAN_ERROR',
  NO_ACTIVE_PLAN = 'NO_ACTIVE_PLAN',
}

export type EmitType =
  | { type: Emit.TICK }
  | { type: Emit.PLAN_ERROR; error: string }
  | { type: Emit.NO_ACTIVE_PLAN };

type Context = {
  activePlan: GetActivePlanSuccess | null;
  currentPeriod: PeriodResponse | null;
  windowPhase: 'fasting' | 'eating' | null;
};

function getInitialContextValues(): Omit<Context, never> {
  return {
    activePlan: null,
    currentPeriod: null,
    windowPhase: null,
  };
}

const loadActivePlanLogic = fromCallback<EventObject, void>(({ sendBack }) =>
  runWithUi(
    programGetActivePlan(),
    (result) => {
      sendBack({ type: Event.ON_SUCCESS, result });
    },
    (error) => {
      Match.value(error).pipe(
        Match.when({ _tag: 'NoActivePlanError' }, () => {
          sendBack({ type: Event.ON_NO_ACTIVE_PLAN });
        }),
        Match.orElse((err) => {
          sendBack({ type: Event.ON_ERROR, error: extractErrorMessage(err) });
        }),
      );
    },
  ),
);

export const activePlanMachine = setup({
  types: {
    context: {} as Context,
    events: {} as EventType,
    emitted: {} as EmitType,
  },
  actions: {
    setActivePlanData: assign(({ event }) => {
      if (event.type !== Event.ON_SUCCESS) {
        return {};
      }

      const currentPeriod = findCurrentPeriod(event.result);
      const windowPhase = currentPeriod ? determineWindowPhase(currentPeriod, new Date()) : null;

      return {
        activePlan: event.result,
        currentPeriod,
        windowPhase,
      };
    }),
    updateWindowPhase: assign(({ context }) => {
      if (!context.currentPeriod) {
        return { windowPhase: null };
      }

      return {
        windowPhase: determineWindowPhase(context.currentPeriod, new Date()),
      };
    }),
    emitPlanError: emit(({ event }) => {
      if (event.type !== Event.ON_ERROR) {
        return { type: Emit.PLAN_ERROR, error: 'Unknown error' };
      }

      return {
        type: Emit.PLAN_ERROR,
        error: event.error,
      };
    }),
    emitNoActivePlan: emit(() => ({
      type: Emit.NO_ACTIVE_PLAN,
    })),
    resetContext: assign(() => getInitialContextValues()),
  },
  guards: {
    isInFastingWindowFromEvent: ({ event }) => {
      if (event.type !== Event.ON_SUCCESS) return false;
      const currentPeriod = findCurrentPeriod(event.result);
      if (!currentPeriod) return false;
      const now = new Date();
      const startDate = ensureDate(currentPeriod.startDate);
      const fastingEnd = addHours(startDate, currentPeriod.fastingDuration);
      return now >= startDate && now < fastingEnd;
    },
    isInEatingWindowFromEvent: ({ event }) => {
      if (event.type !== Event.ON_SUCCESS) return false;
      const currentPeriod = findCurrentPeriod(event.result);
      if (!currentPeriod) return false;
      const now = new Date();
      const startDate = ensureDate(currentPeriod.startDate);
      const endDate = ensureDate(currentPeriod.endDate);
      const fastingEnd = addHours(startDate, currentPeriod.fastingDuration);
      return now >= fastingEnd && now < endDate;
    },
    isPeriodCompletedFromEvent: ({ event }) => {
      if (event.type !== Event.ON_SUCCESS) return false;
      const currentPeriod = findCurrentPeriod(event.result);
      if (!currentPeriod) return false;
      const now = new Date();
      const endDate = ensureDate(currentPeriod.endDate);
      return now >= endDate;
    },
    allPeriodsCompletedFromEvent: ({ event }) => {
      if (event.type !== Event.ON_SUCCESS) return false;
      return event.result.periods.every((p) => p.status === 'completed');
    },
    isInEatingWindow: ({ context }) => {
      if (!context.currentPeriod) return false;
      const now = new Date();
      const startDate = ensureDate(context.currentPeriod.startDate);
      const endDate = ensureDate(context.currentPeriod.endDate);
      const fastingEnd = addHours(startDate, context.currentPeriod.fastingDuration);
      return now >= fastingEnd && now < endDate;
    },
    isPeriodCompleted: ({ context }) => {
      if (!context.currentPeriod) return false;
      const now = new Date();
      const endDate = ensureDate(context.currentPeriod.endDate);
      return now >= endDate;
    },
  },
  actors: {
    timerActor: timerLogic,
    loadActivePlanActor: loadActivePlanLogic,
  },
}).createMachine({
  id: 'activePlan',
  context: getInitialContextValues(),
  initial: ActivePlanState.Loading,
  on: {
    [Event.REFRESH]: {
      actions: ['resetContext'],
      target: `.${ActivePlanState.Loading}`,
    },
  },
  states: {
    [ActivePlanState.Loading]: {
      invoke: {
        id: 'loadActivePlanActor',
        src: 'loadActivePlanActor',
      },
      on: {
        [Event.ON_SUCCESS]: [
          {
            guard: 'allPeriodsCompletedFromEvent',
            actions: ['setActivePlanData'],
            target: ActivePlanState.AllPeriodsCompleted,
          },
          {
            guard: 'isInFastingWindowFromEvent',
            actions: ['setActivePlanData'],
            target: ActivePlanState.InFastingWindow,
          },
          {
            guard: 'isInEatingWindowFromEvent',
            actions: ['setActivePlanData'],
            target: ActivePlanState.InEatingWindow,
          },
          {
            guard: 'isPeriodCompletedFromEvent',
            actions: ['setActivePlanData'],
            target: ActivePlanState.PeriodCompleted,
          },
          {
            actions: ['setActivePlanData'],
            target: ActivePlanState.Idle,
          },
        ],
        [Event.ON_NO_ACTIVE_PLAN]: {
          actions: ['emitNoActivePlan'],
          target: ActivePlanState.Idle,
        },
        [Event.ON_ERROR]: {
          actions: ['emitPlanError'],
          target: ActivePlanState.Idle,
        },
      },
    },
    [ActivePlanState.Idle]: {},
    [ActivePlanState.InFastingWindow]: {
      invoke: {
        id: 'timerActor',
        src: 'timerActor',
      },
      on: {
        [Event.TICK]: [
          {
            guard: 'isInEatingWindow',
            actions: ['updateWindowPhase'],
            target: ActivePlanState.InEatingWindow,
          },
          {
            actions: [emit({ type: Emit.TICK })],
          },
        ],
      },
    },
    [ActivePlanState.InEatingWindow]: {
      invoke: {
        id: 'timerActor',
        src: 'timerActor',
      },
      on: {
        [Event.TICK]: [
          {
            guard: 'isPeriodCompleted',
            actions: ['updateWindowPhase'],
            target: ActivePlanState.PeriodCompleted,
          },
          {
            actions: [emit({ type: Emit.TICK })],
          },
        ],
      },
    },
    [ActivePlanState.PeriodCompleted]: {},
    [ActivePlanState.AllPeriodsCompleted]: {},
  },
});
