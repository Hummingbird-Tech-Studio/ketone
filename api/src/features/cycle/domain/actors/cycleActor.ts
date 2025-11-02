import { assertEvent, assign, emit, fromCallback, setup } from 'xstate';
import { Effect, Match } from 'effect';
import { runWithUi } from '../../repositories';
import {
  programCreateCycle,
  programUpdateCycleDates,
  programCompleteCycle,
} from '../programs/cycle-grain.programs';

export enum CycleState {
  Idle = 'Idle',
  Creating = 'Creating',
  InProgress = 'InProgress',
  Updating = 'Updating',
  Completing = 'Completing',
  Completed = 'Completed',
}

export enum CycleEvent {
  CREATE_CYCLE = 'CREATE_CYCLE',
  SUCCESS = 'SUCCESS',
  PERSIST_SUCCESS = 'PERSIST_SUCCESS',
  ERROR = 'ERROR',
  REPOSITORY_ERROR = 'REPOSITORY_ERROR',
  RESET = 'RESET',
  UPDATE_DATES = 'UPDATE_DATES',
  COMPLETE = 'COMPLETE',
}

export enum Emit {
  ERROR_CREATE_CYCLE = 'ERROR_CREATE_CYCLE',
  PERSIST_STATE = 'PERSIST_STATE',
}

type CycleEventType =
  | { type: CycleEvent.CREATE_CYCLE; userId: string; startDate: Date; endDate: Date }
  | { type: CycleEvent.SUCCESS; id: string; userId: string; startDate: Date; endDate: Date }
  | { type: CycleEvent.PERSIST_SUCCESS }
  | { type: CycleEvent.ERROR; summary: string; detail: string; originalError?: unknown }
  | { type: CycleEvent.REPOSITORY_ERROR; summary: string; detail: string }
  | { type: CycleEvent.RESET }
  | { type: CycleEvent.UPDATE_DATES; startDate: Date; endDate: Date }
  | { type: CycleEvent.COMPLETE; startDate: Date; endDate: Date };

type Context = {
  id: string | null;
  userId: string | null;
  startDate: Date | null;
  endDate: Date | null;
};

export type EmitType =
  | { type: Emit.ERROR_CREATE_CYCLE; error: Error; originalError?: unknown }
  | { type: Emit.PERSIST_STATE; state: CycleState };

/**
 * Cycle Actor with Effect Programs + Grain Orchestration
 *
 * This state machine manages cycle state transitions and orchestrates grain operations.
 * - Uses fromCallback actors that invoke Effect programs
 * - Programs handle all grain communication and persistence
 * - Machine emits PERSIST_STATE events for service to track
 */
export const cycleActor = setup({
  types: {
    context: {} as Context,
    events: {} as CycleEventType,
    emitted: {} as EmitType,
  },
  actors: {
    /**
     * Actor: Create Cycle
     *
     * Invokes programCreateCycle which orchestrates:
     * - Register in UserCycleIndexGrain
     * - Initialize CycleGrain
     * - Persist snapshot
     * - Write to read model
     *
     * Sends back SUCCESS with cycle ID or ERROR
     */
    createCycle: fromCallback<
      CycleEventType,
      { userId: string; startDate: Date; endDate: Date }
    >(({ sendBack, input }) => {
      const { userId, startDate, endDate } = input;

      runWithUi(
        programCreateCycle(userId, startDate, endDate),
        (cycle) => {
          console.log('✅ [Cycle Actor] Cycle created successfully:', cycle.id);
          sendBack({
            type: CycleEvent.SUCCESS,
            id: cycle.id,
            userId: cycle.userId,
            startDate: cycle.startDate,
            endDate: cycle.endDate,
          });
        },
        (error: any) => {
          console.error('❌ [Cycle Actor] Failed to create cycle:', error);
          Match.value(error).pipe(
            Match.when({ _tag: 'CycleAlreadyInProgressError' }, (err: any) => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Cycle Already In Progress',
                detail: String(err),
                originalError: err,
              });
            }),
            Match.when({ _tag: 'OrleansClientError' }, (err: any) => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Orleans Error',
                detail: String(err),
                originalError: err,
              });
            }),
            Match.when({ _tag: 'CycleRepositoryError' }, (err: any) => {
              sendBack({
                type: CycleEvent.REPOSITORY_ERROR,
                summary: 'Repository Error',
                detail: String(err),
              });
            }),
            Match.orElse(() => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Unexpected Error',
                detail: 'An unexpected error occurred while creating cycle',
              });
            }),
          );
        },
      );

      return () => {
        // Cleanup function (if needed)
      };
    }),

    /**
     * Actor: Update Cycle Dates
     *
     * Invokes programUpdateCycleDates which orchestrates:
     * - Update metadata in CycleGrain
     * - Persist updated snapshot
     * - Update read model
     *
     * Sends back PERSIST_SUCCESS or ERROR
     */
    updateCycleDates: fromCallback<
      CycleEventType,
      { cycleId: string; startDate: Date; endDate: Date }
    >(({ sendBack, input }) => {
      const { cycleId, startDate, endDate } = input;

      runWithUi(
        programUpdateCycleDates(cycleId, startDate, endDate),
        (cycle) => {
          console.log('✅ [Cycle Actor] Cycle dates updated successfully:', cycle.id);
          sendBack({
            type: CycleEvent.PERSIST_SUCCESS,
          });
        },
        (error: any) => {
          console.error('❌ [Cycle Actor] Failed to update cycle dates:', error);
          Match.value(error).pipe(
            Match.when({ _tag: 'CycleIdMismatchError' }, (err: any) => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Cycle ID Mismatch',
                detail: String(err),
                originalError: err,
              });
            }),
            Match.when({ _tag: 'CycleInvalidStateError' }, (err: any) => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Invalid State',
                detail: String(err),
                originalError: err,
              });
            }),
            Match.when({ _tag: 'OrleansClientError' }, (err: any) => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Orleans Error',
                detail: String(err),
                originalError: err,
              });
            }),
            Match.when({ _tag: 'CycleRepositoryError' }, (err: any) => {
              sendBack({
                type: CycleEvent.REPOSITORY_ERROR,
                summary: 'Repository Error',
                detail: String(err),
              });
            }),
            Match.orElse(() => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Unexpected Error',
                detail: 'An unexpected error occurred while updating cycle dates',
              });
            }),
          );
        },
      );

      return () => {
        // Cleanup function (if needed)
      };
    }),

    /**
     * Actor: Complete Cycle
     *
     * Invokes programCompleteCycle which orchestrates:
     * - Mark cycle as completed in both grains
     * - Persist final snapshot
     * - Update read model to Completed
     *
     * Sends back PERSIST_SUCCESS or ERROR
     */
    completeCycle: fromCallback<
      CycleEventType,
      { cycleId: string; startDate: Date; endDate: Date }
    >(({ sendBack, input }) => {
      const { cycleId, startDate, endDate } = input;

      runWithUi(
        programCompleteCycle(cycleId, startDate, endDate),
        (cycle) => {
          console.log('✅ [Cycle Actor] Cycle completed successfully:', cycle.id);
          sendBack({
            type: CycleEvent.PERSIST_SUCCESS,
          });
        },
        (error: any) => {
          console.error('❌ [Cycle Actor] Failed to complete cycle:', error);
          Match.value(error).pipe(
            Match.when({ _tag: 'CycleIdMismatchError' }, (err: any) => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Cycle ID Mismatch',
                detail: String(err),
                originalError: err,
              });
            }),
            Match.when({ _tag: 'OrleansClientError' }, (err: any) => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Orleans Error',
                detail: String(err),
                originalError: err,
              });
            }),
            Match.when({ _tag: 'CycleRepositoryError' }, (err: any) => {
              sendBack({
                type: CycleEvent.REPOSITORY_ERROR,
                summary: 'Repository Error',
                detail: String(err),
              });
            }),
            Match.orElse(() => {
              sendBack({
                type: CycleEvent.ERROR,
                summary: 'Unexpected Error',
                detail: 'An unexpected error occurred while completing cycle',
              });
            }),
          );
        },
      );

      return () => {
        // Cleanup function (if needed)
      };
    }),
  },
  actions: {
    resetContext: assign({
      id: null,
      userId: null,
      startDate: null,
      endDate: null,
    }),
    onCreateCycle: assign({
      userId: ({ event }) => {
        assertEvent(event, CycleEvent.CREATE_CYCLE);
        return event.userId;
      },
      startDate: ({ event }) => {
        assertEvent(event, CycleEvent.CREATE_CYCLE);
        return event.startDate;
      },
      endDate: ({ event }) => {
        assertEvent(event, CycleEvent.CREATE_CYCLE);
        return event.endDate;
      },
    }),
    onSuccess: assign({
      id: ({ event }) => {
        assertEvent(event, CycleEvent.SUCCESS);
        console.log('✅ [Cycle Actor] Cycle created with ID:', event.id);
        return event.id;
      },
    }),
    onUpdateDates: assign({
      startDate: ({ event }) => {
        assertEvent(event, CycleEvent.UPDATE_DATES);
        console.log('✅ [Cycle Actor] Updating cycle dates');
        return event.startDate;
      },
      endDate: ({ event }) => {
        assertEvent(event, CycleEvent.UPDATE_DATES);
        return event.endDate;
      },
    }),
    onComplete: assign({
      startDate: ({ event }) => {
        assertEvent(event, CycleEvent.COMPLETE);
        console.log('✅ [Cycle Actor] Completing cycle');
        return event.startDate;
      },
      endDate: ({ event }) => {
        assertEvent(event, CycleEvent.COMPLETE);
        return event.endDate;
      },
    }),
    emitError: emit(({ event }) => {
      assertEvent(event, [CycleEvent.ERROR, CycleEvent.REPOSITORY_ERROR]);
      return {
        type: Emit.ERROR_CREATE_CYCLE,
        error: new Error(`${event.summary}: ${event.detail}`),
        originalError: event.type === CycleEvent.ERROR ? event.originalError : undefined,
      } as const;
    }),
    emitPersistInProgress: emit(
      () =>
        ({
          type: Emit.PERSIST_STATE,
          state: CycleState.InProgress,
        }) as const,
    ),
    emitPersistCompleted: emit(
      () =>
        ({
          type: Emit.PERSIST_STATE,
          state: CycleState.Completed,
        }) as const,
    ),
  },
}).createMachine({
  id: 'cycle',
  initial: CycleState.Idle,
  context: {
    id: null,
    userId: null,
    startDate: null,
    endDate: null,
  },
  states: {
    [CycleState.Idle]: {
      entry: ['resetContext'],
      on: {
        [CycleEvent.CREATE_CYCLE]: {
          target: CycleState.Creating,
          actions: ['onCreateCycle'],
        },
      },
    },
    [CycleState.Creating]: {
      invoke: {
        src: 'createCycle',
        input: ({ context }) => ({
          userId: context.userId!,
          startDate: context.startDate!,
          endDate: context.endDate!,
        }),
      },
      on: {
        [CycleEvent.SUCCESS]: {
          target: CycleState.InProgress,
          actions: ['onSuccess'],
        },
        [CycleEvent.ERROR]: {
          target: CycleState.Idle,
          actions: ['emitError'],
        },
        [CycleEvent.REPOSITORY_ERROR]: {
          target: CycleState.Idle,
          actions: ['emitError'],
        },
      },
    },
    [CycleState.InProgress]: {
      entry: ['emitPersistInProgress'],
      on: {
        [CycleEvent.RESET]: {
          target: CycleState.Idle,
        },
        [CycleEvent.UPDATE_DATES]: {
          target: CycleState.Updating,
          actions: ['onUpdateDates'],
        },
        [CycleEvent.COMPLETE]: {
          target: CycleState.Completing,
          actions: ['onComplete'],
        },
      },
    },
    [CycleState.Updating]: {
      invoke: {
        src: 'updateCycleDates',
        input: ({ context }) => ({
          cycleId: context.id!,
          startDate: context.startDate!,
          endDate: context.endDate!,
        }),
      },
      on: {
        [CycleEvent.PERSIST_SUCCESS]: {
          target: CycleState.InProgress,
        },
        [CycleEvent.ERROR]: {
          target: CycleState.InProgress,
          actions: ['emitError'],
        },
        [CycleEvent.REPOSITORY_ERROR]: {
          target: CycleState.InProgress,
          actions: ['emitError'],
        },
      },
    },
    [CycleState.Completing]: {
      invoke: {
        src: 'completeCycle',
        input: ({ context }) => ({
          cycleId: context.id!,
          startDate: context.startDate!,
          endDate: context.endDate!,
        }),
      },
      on: {
        [CycleEvent.PERSIST_SUCCESS]: {
          target: CycleState.Completed,
        },
        [CycleEvent.ERROR]: {
          target: CycleState.InProgress,
          actions: ['emitError'],
        },
        [CycleEvent.REPOSITORY_ERROR]: {
          target: CycleState.InProgress,
          actions: ['emitError'],
        },
      },
    },
    [CycleState.Completed]: {
      entry: ['emitPersistCompleted'],
      on: {
        [CycleEvent.RESET]: {
          target: CycleState.Idle,
        },
      },
    },
  },
});
