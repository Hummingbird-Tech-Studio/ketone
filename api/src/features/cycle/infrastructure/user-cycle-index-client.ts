import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import { Effect, Layer, Schema as S } from 'effect';
import { OrleansClientError } from './index';

const ORLEANS_BASE_URL = 'http://localhost:5174';

/**
 * Response schemas for UserCycleIndexGrain endpoints
 */
const StartCycleResponseSchema = S.Struct({
  cycleId: S.String,
  userId: S.String,
  status: S.String,
});

const ActiveCycleResponseSchema = S.Struct({
  cycleId: S.String,
  userId: S.String,
});

const RecentCyclesResponseSchema = S.Struct({
  userId: S.String,
  cycles: S.Array(S.String), // Array of cycle IDs
});

/**
 * UserCycleIndexGrain Client Service - Coordinates all cycles for a user
 * One grain per user (keyed by userId) - enforces "1 active cycle" rule
 */
export class UserCycleIndexClient extends Effect.Service<UserCycleIndexClient>()('UserCycleIndexClient', {
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;

    return {
      /**
       * Try to start a new cycle for a user
       * Returns true if cycle was started, false if user already has active cycle
       * Throws error on other failures
       */
      tryStartNewCycle: (userId: string, cycleId: string, startDate: Date, endDate: Date) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[UserCycleIndex Client] POST ${ORLEANS_BASE_URL}/users/${userId}/cycles/start`).pipe(
            Effect.annotateLogs({ userId, cycleId }),
          );

          const request = yield* HttpClientRequest.post(`${ORLEANS_BASE_URL}/users/${userId}/cycles/start`).pipe(
            HttpClientRequest.bodyJson({
              cycleId,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            }),
          );

          const httpResponse = yield* httpClient.execute(request).pipe(
            Effect.tapError((error) =>
              Effect.logError('Connection error').pipe(Effect.annotateLogs({ error: String(error) })),
            ),
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to connect to Orleans sidecar',
                  cause: error,
                }),
            ),
          );

          yield* Effect.logInfo(`[UserCycleIndex Client] Response status: ${httpResponse.status}`);

          // Check for 409 Conflict - user already has active cycle
          if (httpResponse.status === 409) {
            yield* Effect.logWarning(`[UserCycleIndex Client] User ${userId} already has active cycle`);
            return false; // Cannot start new cycle
          }

          // Check for success
          if (httpResponse.status === 200) {
            yield* Effect.logInfo(`✅ Cycle ${cycleId} started successfully for user ${userId}`);
            return true; // Cycle started
          }

          // Other status codes are errors
          yield* Effect.logError(`[UserCycleIndex Client] Unexpected status: ${httpResponse.status}`);
          return yield* Effect.fail(
            new OrleansClientError({
              message: `Failed to start cycle: HTTP ${httpResponse.status}`,
              cause: httpResponse,
            }),
          );
        }),

      /**
       * Get the ID of the user's currently active cycle
       * Returns null if no active cycle exists
       */
      getActiveCycleId: (userId: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[UserCycleIndex Client] GET ${ORLEANS_BASE_URL}/users/${userId}/cycles/active`);

          const request = HttpClientRequest.get(`${ORLEANS_BASE_URL}/users/${userId}/cycles/active`);

          const httpResponse = yield* httpClient.execute(request).pipe(
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to connect to Orleans sidecar',
                  cause: error,
                }),
            ),
          );

          yield* Effect.logInfo(`[UserCycleIndex Client] Response status: ${httpResponse.status}`);

          // Check for 404 - no active cycle
          if (httpResponse.status === 404) {
            yield* Effect.logInfo(`[UserCycleIndex Client] No active cycle for user ${userId}`);
            return null;
          }

          // Check for success
          if (httpResponse.status !== 200) {
            yield* Effect.logError(`[UserCycleIndex Client] Unexpected status: ${httpResponse.status}`);
            return yield* Effect.fail(
              new OrleansClientError({
                message: `Failed to get active cycle: HTTP ${httpResponse.status}`,
                cause: httpResponse,
              }),
            );
          }

          // Parse response
          const response = yield* HttpClientResponse.schemaBodyJson(ActiveCycleResponseSchema)(httpResponse).pipe(
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to decode active cycle response',
                  cause: error,
                }),
            ),
          );

          yield* Effect.logInfo(`✅ Active cycle for user ${userId}: ${response.cycleId}`);
          return response.cycleId;
        }),

      /**
       * Get recent cycle IDs for a user
       * Returns array of cycle IDs (most recent first)
       */
      getRecentCycleIds: (userId: string, limit: number = 10) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `[UserCycleIndex Client] GET ${ORLEANS_BASE_URL}/users/${userId}/cycles/recent?limit=${limit}`,
          );

          const request = HttpClientRequest.get(
            `${ORLEANS_BASE_URL}/users/${userId}/cycles/recent?limit=${limit}`,
          );

          const httpResponse = yield* httpClient.execute(request).pipe(
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to connect to Orleans sidecar',
                  cause: error,
                }),
            ),
          );

          if (httpResponse.status !== 200) {
            yield* Effect.logError(`[UserCycleIndex Client] Unexpected status: ${httpResponse.status}`);
            return yield* Effect.fail(
              new OrleansClientError({
                message: `Failed to get recent cycles: HTTP ${httpResponse.status}`,
                cause: httpResponse,
              }),
            );
          }

          // Parse response
          const response = yield* HttpClientResponse.schemaBodyJson(RecentCyclesResponseSchema)(httpResponse).pipe(
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to decode recent cycles response',
                  cause: error,
                }),
            ),
          );

          yield* Effect.logInfo(`✅ Retrieved ${response.cycles.length} recent cycles for user ${userId}`);
          return response.cycles;
        }),

      /**
       * Mark a cycle as completed
       * Clears the active cycle in the index if it matches
       */
      markCycleComplete: (cycleId: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[UserCycleIndex Client] POST ${ORLEANS_BASE_URL}/cycles/${cycleId}/complete`);

          const request = HttpClientRequest.post(`${ORLEANS_BASE_URL}/cycles/${cycleId}/complete`);

          const httpResponse = yield* httpClient.execute(request).pipe(
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to mark cycle as complete',
                  cause: error,
                }),
            ),
          );

          if (httpResponse.status !== 200) {
            return yield* Effect.fail(
              new OrleansClientError({
                message: `Failed to mark cycle complete: HTTP ${httpResponse.status}`,
                cause: httpResponse,
              }),
            );
          }

          yield* Effect.logInfo(`✅ Cycle ${cycleId} marked as completed`);
        }),
    };
  }),
  accessors: true,
}) {}
