import { MILLISECONDS_PER_HOUR, MIN_FASTING_DURATION } from '@/shared/constants';
import { runWithUi } from '@/utils/effects/helpers';
import { addHours } from 'date-fns';
import { Match } from 'effect';
import { assertEvent, assign, emit, fromCallback, setup, type EventObject } from 'xstate';
import {
  createCycleProgram,
  getActiveCycleProgram,
  updateCycleProgram,
  type GetCycleSuccess,
} from '../services/cycle.service';

export enum CycleState {
  Idle = 'Idle',
  Loading = 'Loading',
  Creating = 'Creating',
  InProgress = 'InProgress',
  Updating = 'Updating',
  Finishing = 'Finishing',
  Completed = 'Completed',
}

export enum Event {
  TICK = 'TICK',
  LOAD = 'LOAD',
  CREATE = 'CREATE',
  INCREMENT_DURATION = 'INCREMENT_DURATION',
  DECREASE_DURATION = 'DECREASE_DURATION',
  UPDATE_START_DATE = 'UPDATE_START_DATE',
  UPDATE_END_DATE = 'UPDATE_END_DATE',
  ON_SUCCESS = 'ON_SUCCESS',
  NO_CYCLE_IN_PROGRESS = 'NO_CYCLE_IN_PROGRESS',
  ON_ERROR = 'ON_ERROR',
}

type EventType =
  | { type: Event.TICK }
  | { type: Event.LOAD }
  | { type: Event.CREATE }
  | { type: Event.INCREMENT_DURATION }
  | { type: Event.DECREASE_DURATION; date: Date }
  | { type: Event.UPDATE_START_DATE; date: Date }
  | { type: Event.UPDATE_END_DATE; date: Date }
  | { type: Event.ON_SUCCESS; result: GetCycleSuccess }
  | { type: Event.NO_CYCLE_IN_PROGRESS; message: string }
  | { type: Event.ON_ERROR; error: string };

export enum Emit {
  TICK = 'TICK',
  CYCLE_ERROR = 'CYCLE_ERROR',
}

export type EmitType = { type: Emit.TICK } | { type: Emit.CYCLE_ERROR; error: string };

type CycleMetadata = {
  id: string;
  userId: string;
  status: 'InProgress' | 'Completed';
  createdAt: Date;
  updatedAt: Date;
};

type Context = {
  cycleMetadata: CycleMetadata | null;
  startDate: Date;
  endDate: Date;
  initialDuration: number;
};

function calculateDurationInHours(startDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  const hours = Math.ceil(diffMs / MILLISECONDS_PER_HOUR);
  return Math.max(MIN_FASTING_DURATION, hours);
}

function calculateNewDates(
  eventType: Event,
  currentStart: Date,
  currentEnd: Date,
  eventDate?: Date,
): { startDate: Date; endDate: Date } {
  switch (eventType) {
    case Event.INCREMENT_DURATION:
      return {
        startDate: currentStart,
        endDate: addHours(currentEnd, 1),
      };

    case Event.DECREASE_DURATION: {
      const minEnd = addHours(currentStart, MIN_FASTING_DURATION);
      return {
        startDate: currentStart,
        endDate: eventDate! < minEnd ? minEnd : eventDate!,
      };
    }

    case Event.UPDATE_START_DATE: {
      const minEnd = addHours(eventDate!, MIN_FASTING_DURATION);
      return {
        startDate: eventDate!,
        endDate: new Date(Math.max(currentEnd.getTime(), minEnd.getTime())),
      };
    }

    case Event.UPDATE_END_DATE: {
      const minEnd = addHours(currentStart, MIN_FASTING_DURATION);
      return {
        startDate: currentStart,
        endDate: eventDate! < minEnd ? minEnd : eventDate!,
      };
    }

    default:
      return { startDate: currentStart, endDate: currentEnd };
  }
}

type UpdateCycleInput = {
  cycleId: string;
  eventType: Event;
  currentStart: Date;
  currentEnd: Date;
  eventDate?: Date;
};

function buildUpdateCycleInput(context: Context, event: EventType): UpdateCycleInput {
  const base = {
    cycleId: context.cycleMetadata!.id,
    eventType: event.type,
    currentStart: context.startDate,
    currentEnd: context.endDate,
  };

  switch (event.type) {
    case Event.DECREASE_DURATION:
    case Event.UPDATE_START_DATE:
    case Event.UPDATE_END_DATE:
      return { ...base, eventDate: event.date };
    default:
      return base;
  }
}

const timerLogic = fromCallback(({ sendBack, receive }) => {
  const intervalId = setInterval(() => {
    sendBack({ type: Event.TICK });
  }, 100);

  receive((event) => {
    if (event.type === 'xstate.stop') {
      clearInterval(intervalId);
    }
  });

  return () => {
    clearInterval(intervalId);
  };
});

const cycleLogic = fromCallback<EventObject, void>(({ sendBack }) => {
  runWithUi(
    getActiveCycleProgram(),
    (result) => {
      sendBack({ type: Event.ON_SUCCESS, result });
    },
    (error) => {
      Match.value(error).pipe(
        Match.when({ _tag: 'NoCycleInProgressError' }, (err) => {
          sendBack({ type: Event.NO_CYCLE_IN_PROGRESS, message: err.message });
        }),
        Match.orElse((err) => {
          const errorMessage = 'message' in err && typeof err.message === 'string' ? err.message : String(err);
          sendBack({ type: Event.ON_ERROR, error: errorMessage });
        }),
      );
    },
  );
});

const createCycleLogic = fromCallback<EventObject, { startDate: Date; endDate: Date }>(({ sendBack, input }) => {
  runWithUi(
    createCycleProgram(input.startDate, input.endDate),
    (result) => {
      sendBack({ type: Event.ON_SUCCESS, result });
    },
    (error) => {
      const errorMessage = 'message' in error && typeof error.message === 'string' ? error.message : String(error);
      sendBack({ type: Event.ON_ERROR, error: errorMessage });
    },
  );
});

const updateCycleLogic = fromCallback<EventObject, UpdateCycleInput>(({ sendBack, input }) => {
  const { startDate, endDate } = calculateNewDates(
    input.eventType,
    input.currentStart,
    input.currentEnd,
    input.eventDate,
  );

  runWithUi(
    updateCycleProgram(input.cycleId, startDate, endDate),
    (result) => {
      sendBack({ type: Event.ON_SUCCESS, result });
    },
    (error) => {
      const errorMessage = 'message' in error && typeof error.message === 'string' ? error.message : String(error);
      sendBack({ type: Event.ON_ERROR, error: errorMessage });
    },
  );
});

export const cycleMachine = setup({
  types: {
    context: {} as Context,
    events: {} as EventType,
    emitted: {} as EmitType,
  },
  actions: {
    onIncrementDuration: assign(({ context }) => {
      const { startDate, endDate } = calculateNewDates(Event.INCREMENT_DURATION, context.startDate, context.endDate);

      return {
        startDate,
        endDate,
        initialDuration: calculateDurationInHours(startDate, endDate),
      };
    }),
    onDecrementDuration: assign(({ context, event }) => {
      assertEvent(event, Event.DECREASE_DURATION);

      const { startDate, endDate } = calculateNewDates(
        Event.DECREASE_DURATION,
        context.startDate,
        context.endDate,
        event.date,
      );

      return {
        startDate,
        endDate,
        initialDuration: calculateDurationInHours(startDate, endDate),
      };
    }),
    onUpdateStartDate: assign(({ context, event }) => {
      assertEvent(event, Event.UPDATE_START_DATE);

      const { startDate, endDate } = calculateNewDates(
        Event.UPDATE_START_DATE,
        context.startDate,
        context.endDate,
        event.date,
      );

      return {
        startDate,
        endDate,
        initialDuration: calculateDurationInHours(startDate, endDate),
      };
    }),
    onUpdateEndDate: assign(({ context, event }) => {
      assertEvent(event, Event.UPDATE_END_DATE);

      const { startDate, endDate } = calculateNewDates(
        Event.UPDATE_END_DATE,
        context.startDate,
        context.endDate,
        event.date,
      );

      return {
        startDate,
        endDate,
        initialDuration: calculateDurationInHours(startDate, endDate),
      };
    }),
    emitCycleError: emit(({ event }) => {
      assertEvent(event, Event.ON_ERROR);

      return {
        type: Emit.CYCLE_ERROR,
        error: event.error,
      } as const;
    }),
    setCycleData: assign(({ event }) => {
      assertEvent(event, Event.ON_SUCCESS);
      const { id, userId, status, createdAt, updatedAt, startDate, endDate } = event.result;

      return {
        cycleMetadata: { id, userId, status, createdAt, updatedAt },
        startDate,
        endDate,
        initialDuration: calculateDurationInHours(startDate, endDate),
      };
    }),
  },
  guards: {
    isInitialDurationValid: ({ context, event }) => {
      assertEvent(event, Event.DECREASE_DURATION);
      return context.initialDuration > MIN_FASTING_DURATION;
    },
  },
  actors: {
    timerActor: timerLogic,
    cycleActor: cycleLogic,
    createCycleActor: createCycleLogic,
    updateCycleActor: updateCycleLogic,
  },
}).createMachine({
  id: 'cycle',
  context: {
    cycleMetadata: null,
    startDate: new Date(),
    endDate: addHours(new Date(), MIN_FASTING_DURATION),
    initialDuration: MIN_FASTING_DURATION,
  },
  initial: CycleState.Idle,
  states: {
    [CycleState.Idle]: {
      on: {
        [Event.LOAD]: CycleState.Loading,
        [Event.CREATE]: CycleState.Creating,
        [Event.INCREMENT_DURATION]: {
          actions: ['onIncrementDuration'],
        },
        [Event.DECREASE_DURATION]: {
          guard: 'isInitialDurationValid',
          actions: ['onDecrementDuration'],
        },
        [Event.UPDATE_START_DATE]: {
          actions: ['onUpdateStartDate'],
        },
        [Event.UPDATE_END_DATE]: {
          actions: ['onUpdateEndDate'],
        },
      },
    },
    [CycleState.Loading]: {
      invoke: {
        id: 'cycleActor',
        src: 'cycleActor',
      },
      on: {
        [Event.ON_SUCCESS]: {
          actions: ['setCycleData'],
          target: CycleState.InProgress,
        },
        [Event.NO_CYCLE_IN_PROGRESS]: {
          target: CycleState.Idle,
        },
        [Event.ON_ERROR]: {
          actions: 'emitCycleError',
          target: CycleState.Idle,
        },
      },
    },
    [CycleState.Creating]: {
      invoke: {
        id: 'createCycleActor',
        src: 'createCycleActor',
        input: ({ context }) => ({
          startDate: context.startDate,
          endDate: context.endDate,
        }),
      },
      on: {
        [Event.ON_SUCCESS]: {
          actions: ['setCycleData'],
          target: CycleState.InProgress,
        },
        [Event.ON_ERROR]: {
          actions: 'emitCycleError',
          target: CycleState.Idle,
        },
      },
    },
    [CycleState.InProgress]: {
      invoke: {
        id: 'timerActor',
        src: 'timerActor',
      },
      on: {
        [Event.TICK]: {
          actions: emit({ type: Emit.TICK }),
        },
        [Event.LOAD]: CycleState.Loading,
        [Event.INCREMENT_DURATION]: CycleState.Updating,
        [Event.DECREASE_DURATION]: {
          guard: 'isInitialDurationValid',
          target: CycleState.Updating,
        },
        [Event.UPDATE_START_DATE]: CycleState.Updating,
        [Event.UPDATE_END_DATE]: CycleState.Updating,
      },
    },
    [CycleState.Updating]: {
      invoke: [
        {
          id: 'timerActor',
          src: 'timerActor',
        },
        {
          id: 'updateCycleActor',
          src: 'updateCycleActor',
          input: ({ context, event }) => buildUpdateCycleInput(context, event),
        },
      ],
      on: {
        [Event.TICK]: {
          actions: emit({ type: Emit.TICK }),
        },
        [Event.ON_SUCCESS]: {
          actions: 'setCycleData',
          target: CycleState.InProgress,
        },
        [Event.ON_ERROR]: {
          actions: 'emitCycleError',
          target: CycleState.InProgress,
        },
      },
    },
    [CycleState.Finishing]: {},
    [CycleState.Completed]: {},
  },
});
