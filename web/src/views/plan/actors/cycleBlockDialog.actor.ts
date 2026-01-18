import { assign, emit, setup } from 'xstate';

export enum Event {
  START_CHECK = 'START_CHECK',
  CHECK_RESULT = 'CHECK_RESULT',
  DISMISS = 'DISMISS',
  GO_TO_CYCLE = 'GO_TO_CYCLE',
}

export enum Emit {
  CHECK_CYCLE = 'CHECK_CYCLE',
  PROCEED = 'PROCEED',
  NAVIGATE_TO_CYCLE = 'NAVIGATE_TO_CYCLE',
}

export enum State {
  Idle = 'Idle',
  Checking = 'Checking',
  Blocked = 'Blocked',
}

type Context = {
  cycleInProgress: boolean;
};

type EventType =
  | { type: Event.START_CHECK }
  | { type: Event.CHECK_RESULT; cycleInProgress: boolean }
  | { type: Event.DISMISS }
  | { type: Event.GO_TO_CYCLE };

export type EmitType =
  | { type: Emit.CHECK_CYCLE }
  | { type: Emit.PROCEED }
  | { type: Emit.NAVIGATE_TO_CYCLE };

export const cycleBlockDialogMachine = setup({
  types: {
    context: {} as Context,
    events: {} as EventType,
    emitted: {} as EmitType,
  },
  actions: {
    setCycleInProgress: assign({
      cycleInProgress: ({ event }) => {
        if (event.type === Event.CHECK_RESULT) {
          return event.cycleInProgress;
        }
        return false;
      },
    }),
    resetState: assign({
      cycleInProgress: false,
    }),
    emitCheckCycle: emit({ type: Emit.CHECK_CYCLE }),
    emitProceed: emit({ type: Emit.PROCEED }),
    emitNavigateToCycle: emit({ type: Emit.NAVIGATE_TO_CYCLE }),
  },
  guards: {
    isCycleInProgress: ({ event }) => {
      if (event.type === Event.CHECK_RESULT) {
        return event.cycleInProgress;
      }
      return false;
    },
    isNoCycleInProgress: ({ event }) => {
      if (event.type === Event.CHECK_RESULT) {
        return !event.cycleInProgress;
      }
      return false;
    },
  },
}).createMachine({
  id: 'cycleBlockDialog',
  initial: State.Idle,
  context: {
    cycleInProgress: false,
  },
  states: {
    [State.Idle]: {
      on: {
        [Event.START_CHECK]: {
          target: State.Checking,
          actions: 'emitCheckCycle',
        },
      },
    },
    [State.Checking]: {
      on: {
        [Event.CHECK_RESULT]: [
          {
            guard: 'isCycleInProgress',
            target: State.Blocked,
            actions: 'setCycleInProgress',
          },
          {
            guard: 'isNoCycleInProgress',
            target: State.Idle,
            actions: 'emitProceed',
          },
        ],
      },
    },
    [State.Blocked]: {
      on: {
        [Event.DISMISS]: {
          target: State.Idle,
          actions: 'resetState',
        },
        [Event.GO_TO_CYCLE]: {
          target: State.Idle,
          actions: ['resetState', 'emitNavigateToCycle'],
        },
      },
    },
  },
});
