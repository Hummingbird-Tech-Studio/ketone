import { Preferences } from '@capacitor/preferences';
import type { UserResponseSchema } from '@ketone/shared';
import { Data, Effect } from 'effect';

/**
 * Authentication Session Type
 */
export type AuthSession = {
  token: string;
  user: UserResponseSchema;
};

/**
 * Authentication Session Error
 */
export class AuthSessionError extends Data.TaggedError('AuthSessionError')<{
  message: string;
  cause?: unknown;
}> {}

const SESSION_STORAGE_KEY = 'auth_session';

/**
 * Capacitor Storage Service for Authentication Sessions
 * Uses Capacitor Preferences for persistent storage across native platforms
 */
export class CapacitorAuthSessionService extends Effect.Service<CapacitorAuthSessionService>()(
  'CapacitorAuthSessionService',
  {
    effect: Effect.gen(function* () {
      return {
        /**
         * Store authentication session in Capacitor Preferences
         * @param session - Auth session (token + user) to store
         */
        setSession: (session: AuthSession): Effect.Effect<void, AuthSessionError> =>
          Effect.tryPromise({
            try: () => Preferences.set({ key: SESSION_STORAGE_KEY, value: JSON.stringify(session) }),
            catch: (error) =>
              new AuthSessionError({
                message: 'Failed to store authentication session',
                cause: error,
              }),
          }),

        /**
         * Retrieve authentication session from Capacitor Preferences
         * @returns Auth session or null if not found
         */
        getSession: (): Effect.Effect<AuthSession | null, AuthSessionError> =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () => Preferences.get({ key: SESSION_STORAGE_KEY }),
              catch: (error) =>
                new AuthSessionError({
                  message: 'Failed to retrieve authentication session',
                  cause: error,
                }),
            });

            if (!result.value) {
              return null;
            }

            return yield* Effect.try({
              try: () => JSON.parse(result.value!) as AuthSession,
              catch: (error) =>
                new AuthSessionError({
                  message: 'Failed to parse authentication session',
                  cause: error,
                }),
            });
          }),

        /**
         * Remove authentication session from Capacitor Preferences
         */
        removeSession: (): Effect.Effect<void, AuthSessionError> =>
          Effect.tryPromise({
            try: () => Preferences.remove({ key: SESSION_STORAGE_KEY }),
            catch: (error) =>
              new AuthSessionError({
                message: 'Failed to remove authentication session',
                cause: error,
              }),
          }),

        /**
         * Check if user is authenticated (has valid session)
         * @returns true if session exists, false otherwise
         */
        isAuthenticated: (): Effect.Effect<boolean, AuthSessionError> =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () => Preferences.get({ key: SESSION_STORAGE_KEY }),
              catch: (error) =>
                new AuthSessionError({
                  message: 'Failed to check authentication status',
                  cause: error,
                }),
            });
            return result.value !== null;
          }),

        /**
         * Update user email in the stored session
         * @param email - New email address
         */
        updateSessionEmail: (email: string): Effect.Effect<void, AuthSessionError> =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () => Preferences.get({ key: SESSION_STORAGE_KEY }),
              catch: (error) =>
                new AuthSessionError({
                  message: 'Failed to retrieve authentication session',
                  cause: error,
                }),
            });

            if (!result.value) {
              return;
            }

            const session = yield* Effect.try({
              try: () => JSON.parse(result.value!) as AuthSession,
              catch: (error) =>
                new AuthSessionError({
                  message: 'Failed to parse authentication session',
                  cause: error,
                }),
            });

            const updatedSession = {
              ...session,
              user: { ...session.user, email },
            };

            yield* Effect.tryPromise({
              try: () => Preferences.set({ key: SESSION_STORAGE_KEY, value: JSON.stringify(updatedSession) }),
              catch: (error) =>
                new AuthSessionError({
                  message: 'Failed to update authentication session',
                  cause: error,
                }),
            });
          }),
      };
    }),
    accessors: true,
  },
) {}

/**
 * Program to check if authentication session exists
 * @returns The session if it exists, null otherwise
 */
export const programCheckSession = Effect.gen(function* () {
  const authSessionService = yield* CapacitorAuthSessionService;
  return yield* authSessionService.getSession();
}).pipe(Effect.provide(CapacitorAuthSessionService.Default));

/**
 * Program to store authentication session
 * @param session - The auth session (token + user) to store
 */
export const programStoreSession = (session: AuthSession) =>
  Effect.gen(function* () {
    const authSessionService = yield* CapacitorAuthSessionService;
    yield* authSessionService.setSession(session);
  }).pipe(Effect.provide(CapacitorAuthSessionService.Default));

/**
 * Program to remove authentication session
 */
export const programRemoveSession = Effect.gen(function* () {
  const authSessionService = yield* CapacitorAuthSessionService;
  yield* authSessionService.removeSession();
}).pipe(Effect.provide(CapacitorAuthSessionService.Default));

/**
 * Program to update user email in the stored session
 * @param email - New email address
 */
export const programUpdateSessionEmail = (email: string) =>
  Effect.gen(function* () {
    const authSessionService = yield* CapacitorAuthSessionService;
    yield* authSessionService.updateSessionEmail(email);
  }).pipe(Effect.provide(CapacitorAuthSessionService.Default));
