import type { Effect } from 'effect';
import { assertEvent, emit, fromCallback, setup, type EventObject } from 'xstate';
import type { LoginResponseSchema } from '../schemas/auth';
import { extractErrorMessage } from '../services/http/errors';
import { runWithUi } from '../utils/effects';

export enum SignInState {
  Idle = 'Idle',
  Submitting = 'Submitting',
}

export enum SignInEvent {
  SUBMIT = 'SUBMIT',
  ON_ERROR = 'ON_ERROR',
  ON_DONE = 'ON_DONE',
}

/**
 * Sign-in success result type
 */
export type SignInSuccess = LoginResponseSchema;

type SignInEventType =
  | { type: SignInEvent.SUBMIT; values: { email: string; password: string } }
  | { type: SignInEvent.ON_ERROR; error: string }
  | { type: SignInEvent.ON_DONE; result: SignInSuccess };

export enum SignInEmit {
  SIGN_IN_SUCCESS = 'SIGN_IN_SUCCESS',
  SIGN_IN_ERROR = 'SIGN_IN_ERROR',
}

export type SignInEmitType =
  | { type: SignInEmit.SIGN_IN_SUCCESS; result: SignInSuccess }
  | { type: SignInEmit.SIGN_IN_ERROR; error: string };

type SignInContext = Record<string, never>;

/**
 * Sign-in program type for dependency injection
 */
export type SignInProgram = (
  email: string,
  password: string,
) => Effect.Effect<SignInSuccess, unknown, never>;

/**
 * Factory function to create sign-in machine with injected sign-in program
 */
export const createSignInMachine = (signInProgram: SignInProgram) => {
  const signInLogic = fromCallback<EventObject, { email: string; password: string }>(({ sendBack, input }) =>
    runWithUi(
      signInProgram(input.email, input.password),
      (result) => {
        sendBack({ type: SignInEvent.ON_DONE, result });
      },
      (error) => {
        sendBack({ type: SignInEvent.ON_ERROR, error: extractErrorMessage(error) });
      },
    ),
  );

  return setup({
    types: {
      context: {} as SignInContext,
      events: {} as SignInEventType,
      emitted: {} as SignInEmitType,
    },
    actions: {
      emitSignInSuccess: emit(({ event }) => {
        assertEvent(event, SignInEvent.ON_DONE);

        return {
          type: SignInEmit.SIGN_IN_SUCCESS,
          result: event.result,
        } as const;
      }),
      emitSignInError: emit(({ event }) => {
        assertEvent(event, SignInEvent.ON_ERROR);

        return {
          type: SignInEmit.SIGN_IN_ERROR,
          error: event.error,
        } as const;
      }),
    },
    actors: {
      signInActor: signInLogic,
    },
  }).createMachine({
    id: 'signIn',
    context: {},
    initial: SignInState.Idle,
    states: {
      [SignInState.Idle]: {
        on: {
          [SignInEvent.SUBMIT]: SignInState.Submitting,
        },
      },
      [SignInState.Submitting]: {
        invoke: {
          id: 'signInActor',
          src: 'signInActor',
          input: ({ event }) => {
            assertEvent(event, SignInEvent.SUBMIT);
            return event.values;
          },
        },
        on: {
          [SignInEvent.ON_DONE]: {
            actions: 'emitSignInSuccess',
            target: SignInState.Idle,
          },
          [SignInEvent.ON_ERROR]: {
            actions: 'emitSignInError',
            target: SignInState.Idle,
          },
        },
      },
    },
  });
};
