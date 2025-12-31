import type { Effect } from 'effect';
import { assertEvent, assign, emit, fromCallback, setup } from 'xstate';
import type { UserResponseSchema } from '../schemas/auth';
import { runWithUi } from '../utils/effects';

export enum AuthState {
  INITIALIZING = 'INITIALIZING',
  AUTHENTICATING = 'AUTHENTICATING',
  AUTHENTICATED = 'AUTHENTICATED',
  DEAUTHENTICATING = 'DEAUTHENTICATING',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  ERROR = 'ERROR',
}

export enum AuthEvent {
  CHECK_AUTH = 'CHECK_AUTH',
  AUTHENTICATE = 'AUTHENTICATE',
  DEAUTHENTICATE = 'DEAUTHENTICATE',
  RETRY = 'RETRY',
  AUTH_CHECK_SUCCESS = 'AUTH_CHECK_SUCCESS',
  AUTH_CHECK_FAILURE = 'AUTH_CHECK_FAILURE',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  DEAUTH_COMPLETE = 'DEAUTH_COMPLETE',
  UPDATE_USER_EMAIL = 'UPDATE_USER_EMAIL',
}

type AuthEventType =
  | { type: AuthEvent.CHECK_AUTH }
  | { type: AuthEvent.AUTHENTICATE; token: string; user: UserResponseSchema }
  | { type: AuthEvent.DEAUTHENTICATE }
  | { type: AuthEvent.RETRY }
  | { type: AuthEvent.AUTH_CHECK_SUCCESS; token: string; user: UserResponseSchema }
  | { type: AuthEvent.AUTH_CHECK_FAILURE }
  | { type: AuthEvent.AUTH_SUCCESS }
  | { type: AuthEvent.AUTH_FAILURE; error: string }
  | { type: AuthEvent.DEAUTH_COMPLETE }
  | { type: AuthEvent.UPDATE_USER_EMAIL; email: string };

export enum AuthEmit {
  AUTHENTICATED = 'AUTHENTICATED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
}

export type AuthEmitType =
  | { type: AuthEmit.AUTHENTICATED; token: string; user: UserResponseSchema }
  | { type: AuthEmit.UNAUTHENTICATED }
  | { type: AuthEmit.AUTHENTICATION_ERROR; error: string };

type AuthContext = {
  token: string | null;
  user: UserResponseSchema | null;
};

/**
 * Auth Session type for storage programs
 */
export type AuthSession = {
  token: string;
  user: UserResponseSchema;
};

/**
 * Storage Programs interface for dependency injection
 */
export type StoragePrograms = {
  programCheckSession: Effect.Effect<AuthSession | null, unknown, never>;
  programStoreSession: (session: AuthSession) => Effect.Effect<void, unknown, never>;
  programRemoveSession: Effect.Effect<void, unknown, never>;
};

/**
 * Factory function to create authentication machine with injected storage
 */
export const createAuthenticationMachine = (storage: StoragePrograms) =>
  setup({
    types: {
      context: {} as AuthContext,
      events: {} as AuthEventType,
      emitted: {} as AuthEmitType,
    },
    actions: {
      storeAuthData: assign({
        token: ({ event }) => {
          assertEvent(event, AuthEvent.AUTHENTICATE);
          return event.token;
        },
        user: ({ event }) => {
          assertEvent(event, AuthEvent.AUTHENTICATE);
          return event.user;
        },
      }),
      storeSessionData: assign({
        token: ({ event }) => {
          assertEvent(event, AuthEvent.AUTH_CHECK_SUCCESS);
          return event.token;
        },
        user: ({ event }) => {
          assertEvent(event, AuthEvent.AUTH_CHECK_SUCCESS);
          return event.user;
        },
      }),
      clearAuthData: assign({
        token: null,
        user: null,
      }),
      emitAuthenticated: emit(
        ({ context }) =>
          ({
            type: AuthEmit.AUTHENTICATED,
            token: context.token!,
            user: context.user!,
          }) as const,
      ),
      emitUnauthenticated: emit(
        () =>
          ({
            type: AuthEmit.UNAUTHENTICATED,
          }) as const,
      ),
      emitAuthenticationError: emit(({ event }) => {
        assertEvent(event, AuthEvent.AUTH_FAILURE);
        return {
          type: AuthEmit.AUTHENTICATION_ERROR,
          error: event.error,
        } as const;
      }),
      updateUserEmail: assign({
        user: ({ context, event }) => {
          assertEvent(event, AuthEvent.UPDATE_USER_EMAIL);
          return context.user ? { ...context.user, email: event.email } : null;
        },
      }),
    },
    actors: {
      checkAuthSession: fromCallback(({ sendBack }) =>
        runWithUi(
          storage.programCheckSession,
          (session) => {
            if (session) {
              sendBack({ type: AuthEvent.AUTH_CHECK_SUCCESS, token: session.token, user: session.user });
            } else {
              sendBack({ type: AuthEvent.AUTH_CHECK_FAILURE });
            }
          },
          () => {
            sendBack({ type: AuthEvent.AUTH_CHECK_FAILURE });
          },
        ),
      ),
      storeAuthSession: fromCallback<AuthEventType, { token: string; user: UserResponseSchema }>(
        ({ sendBack, input }) =>
          runWithUi(
            storage.programStoreSession({ token: input.token, user: input.user }),
            () => {
              sendBack({ type: AuthEvent.AUTH_SUCCESS });
            },
            (error) => {
              const message = error instanceof Error ? error.message : String(error);
              console.error('[Auth Actor] Failed to store session:', message);
              sendBack({
                type: AuthEvent.AUTH_FAILURE,
                error: message,
              });
            },
          ),
      ),
      removeAuthSession: fromCallback(({ sendBack }) =>
        runWithUi(
          storage.programRemoveSession,
          () => {
            sendBack({ type: AuthEvent.DEAUTH_COMPLETE });
          },
          (error) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[Auth Actor] Failed to remove session:', message);
            sendBack({ type: AuthEvent.DEAUTH_COMPLETE });
          },
        ),
      ),
    },
  }).createMachine({
    id: 'authentication',
    context: {
      token: null,
      user: null,
    },
    initial: AuthState.INITIALIZING,
    states: {
      [AuthState.INITIALIZING]: {
        invoke: {
          id: 'checkAuthSession',
          src: 'checkAuthSession',
        },
        on: {
          [AuthEvent.AUTH_CHECK_SUCCESS]: {
            target: AuthState.AUTHENTICATED,
            actions: ['storeSessionData'],
          },
          [AuthEvent.AUTH_CHECK_FAILURE]: {
            target: AuthState.UNAUTHENTICATED,
          },
        },
      },
      [AuthState.AUTHENTICATING]: {
        invoke: {
          id: 'storeAuthSession',
          src: 'storeAuthSession',
          input: ({ context }) => ({
            token: context.token!,
            user: context.user!,
          }),
        },
        on: {
          [AuthEvent.AUTH_SUCCESS]: {
            target: AuthState.AUTHENTICATED,
            actions: ['emitAuthenticated'],
          },
          [AuthEvent.AUTH_FAILURE]: {
            target: AuthState.ERROR,
            actions: ['emitAuthenticationError'],
          },
        },
      },
      [AuthState.AUTHENTICATED]: {
        on: {
          [AuthEvent.AUTHENTICATE]: {
            actions: ['storeAuthData', 'emitAuthenticated'],
          },
          [AuthEvent.DEAUTHENTICATE]: {
            target: AuthState.DEAUTHENTICATING,
          },
          [AuthEvent.UPDATE_USER_EMAIL]: {
            actions: ['updateUserEmail'],
          },
        },
      },
      [AuthState.DEAUTHENTICATING]: {
        entry: ['clearAuthData'],
        invoke: {
          id: 'removeAuthSession',
          src: 'removeAuthSession',
        },
        on: {
          [AuthEvent.DEAUTH_COMPLETE]: {
            target: AuthState.UNAUTHENTICATED,
            actions: ['emitUnauthenticated'],
          },
        },
      },
      [AuthState.UNAUTHENTICATED]: {
        on: {
          [AuthEvent.AUTHENTICATE]: {
            target: AuthState.AUTHENTICATING,
            actions: ['storeAuthData'],
          },
          [AuthEvent.CHECK_AUTH]: {
            target: AuthState.INITIALIZING,
          },
        },
      },
      [AuthState.ERROR]: {
        on: {
          [AuthEvent.RETRY]: {
            target: AuthState.AUTHENTICATING,
          },
          [AuthEvent.AUTHENTICATE]: {
            target: AuthState.AUTHENTICATING,
            actions: ['storeAuthData'],
          },
        },
      },
    },
  });
