import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import { Effect, Layer, Schema as S } from 'effect';
import { OrleansClientError } from './index';

const ORLEANS_BASE_URL = 'http://localhost:5174';

/**
 * Cycle Metadata Schema - Lightweight metadata for querying
 */
export const CycleMetadataSchema = S.Struct({
  cycleId: S.String,
  userId: S.String,
  startDate: S.Unknown, // Can be Date or string
  endDate: S.Unknown,
  status: S.String,
  createdAt: S.Unknown,
  updatedAt: S.Unknown,
});

export type CycleMetadata = S.Schema.Type<typeof CycleMetadataSchema>;

/**
 * Base Actor State Schema - Shared structure (same as OrleansClient)
 */
const BaseActorStateSchema = {
  value: S.String,
  status: S.optional(S.String),
  output: S.optional(S.Unknown),
  error: S.optional(S.Unknown),
  children: S.optional(S.Unknown),
  historyValue: S.optional(S.Unknown),
};

/**
 * Context Schema for Cycle
 */
const CycleContextSchema = S.Struct({
  id: S.NullOr(S.String),
  userId: S.NullOr(S.String),
  startDate: S.Unknown,
  endDate: S.Unknown,
});

/**
 * Cycle Actor State Schema - For Reading from CycleGrain
 */
export const CycleActorStateSchema = S.Struct({
  ...BaseActorStateSchema,
  context: CycleContextSchema,
});

export type CycleActorState = S.Schema.Type<typeof CycleActorStateSchema>;

/**
 * CycleGrain Client Service - HTTP client for CycleGrain communication
 * Each cycle is a separate grain keyed by cycleId (UUID)
 */
export class CycleGrainClient extends Effect.Service<CycleGrainClient>()('CycleGrainClient', {
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;

    return {
      /**
       * Get cycle snapshot from CycleGrain
       * Returns the XState snapshot if found, throws error if 404
       */
      getCycleSnapshot: (cycleId: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[CycleGrain Client] GET ${ORLEANS_BASE_URL}/cycles/${cycleId}`);

          const request = HttpClientRequest.get(`${ORLEANS_BASE_URL}/cycles/${cycleId}`);

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

          yield* Effect.logInfo(`[CycleGrain Client] Response status: ${httpResponse.status}`);

          // Check for 404 - cycle not found
          if (httpResponse.status === 404) {
            yield* Effect.logInfo(`[CycleGrain Client] Cycle ${cycleId} not found (404)`);
            return yield* Effect.fail(
              new OrleansClientError({
                message: `Cycle ${cycleId} not found`,
              }),
            );
          }

          // Check for other non-200 status codes
          if (httpResponse.status !== 200) {
            yield* Effect.logError(`[CycleGrain Client] Unexpected status: ${httpResponse.status}`);
            return yield* Effect.fail(
              new OrleansClientError({
                message: `Failed to get cycle from Orleans: HTTP ${httpResponse.status}`,
                cause: httpResponse,
              }),
            );
          }

          // Parse and validate response body
          const state = yield* HttpClientResponse.schemaBodyJson(CycleActorStateSchema)(httpResponse).pipe(
            Effect.tapError((error) =>
              Effect.logError('Failed to decode response').pipe(Effect.annotateLogs({ error: String(error) })),
            ),
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to decode cycle state from Orleans',
                  cause: error,
                }),
            ),
          );

          yield* Effect.logInfo('✅ Cycle state retrieved successfully').pipe(
            Effect.annotateLogs({ cycleId }),
          );

          return state;
        }),

      /**
       * Persist cycle snapshot to CycleGrain
       * Updates the cycle with the given XState snapshot
       */
      persistCycleSnapshot: (cycleId: string, state: unknown) =>
        Effect.gen(function* () {
          // Validate structure (basic validation)
          const serializedState = JSON.parse(JSON.stringify(state));

          yield* Effect.logInfo(`POST ${ORLEANS_BASE_URL}/cycles/${cycleId}`).pipe(
            Effect.annotateLogs({
              cycleId,
              requestBodyLength: JSON.stringify(serializedState).length,
            }),
          );

          const request = yield* HttpClientRequest.post(`${ORLEANS_BASE_URL}/cycles/${cycleId}`).pipe(
            HttpClientRequest.bodyJson(serializedState),
          );

          const httpResponse = yield* httpClient.execute(request).pipe(
            Effect.tapError((error) =>
              Effect.logError('Connection error').pipe(
                Effect.annotateLogs({
                  error: String(error),
                  cycleId,
                }),
              ),
            ),
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to connect to Orleans sidecar',
                  cause: error,
                }),
            ),
          );

          yield* Effect.logInfo(`Response status: ${httpResponse.status}`);

          // Check for success status codes
          if (httpResponse.status !== 200 && httpResponse.status !== 201) {
            yield* Effect.logError(`Failed to persist: HTTP ${httpResponse.status}`).pipe(
              Effect.annotateLogs({ cycleId }),
            );

            return yield* Effect.fail(
              new OrleansClientError({
                message: `Failed to persist cycle to Orleans: HTTP ${httpResponse.status}`,
                cause: httpResponse,
              }),
            );
          }

          yield* Effect.logInfo(`✅ Cycle state persisted to Orleans`).pipe(Effect.annotateLogs({ cycleId }));
        }),

      /**
       * Update cycle metadata (dates and status)
       * Used when XState transitions or dates are updated
       */
      updateCycleMetadata: (cycleId: string, startDate: Date, endDate: Date, status: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`PATCH ${ORLEANS_BASE_URL}/cycles/${cycleId}/metadata`).pipe(
            Effect.annotateLogs({ cycleId, status }),
          );

          const request = yield* HttpClientRequest.patch(`${ORLEANS_BASE_URL}/cycles/${cycleId}/metadata`).pipe(
            HttpClientRequest.bodyJson({
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              status,
            }),
          );

          const httpResponse = yield* httpClient.execute(request).pipe(
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to update cycle metadata',
                  cause: error,
                }),
            ),
          );

          if (httpResponse.status !== 200) {
            return yield* Effect.fail(
              new OrleansClientError({
                message: `Failed to update cycle metadata: HTTP ${httpResponse.status}`,
                cause: httpResponse,
              }),
            );
          }

          yield* Effect.logInfo(`✅ Cycle metadata updated`).pipe(Effect.annotateLogs({ cycleId }));
        }),

      /**
       * Mark cycle as completed
       * Updates both CycleGrain and UserCycleIndexGrain
       */
      completeCycle: (cycleId: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`POST ${ORLEANS_BASE_URL}/cycles/${cycleId}/complete`);

          const request = HttpClientRequest.post(`${ORLEANS_BASE_URL}/cycles/${cycleId}/complete`);

          const httpResponse = yield* httpClient.execute(request).pipe(
            Effect.mapError(
              (error) =>
                new OrleansClientError({
                  message: 'Failed to complete cycle',
                  cause: error,
                }),
            ),
          );

          if (httpResponse.status !== 200) {
            return yield* Effect.fail(
              new OrleansClientError({
                message: `Failed to complete cycle: HTTP ${httpResponse.status}`,
                cause: httpResponse,
              }),
            );
          }

          yield* Effect.logInfo(`✅ Cycle marked as completed`).pipe(Effect.annotateLogs({ cycleId }));
        }),
    };
  }),
  accessors: true,
}) {}

/**
 * Effect program to persist cycle snapshot to CycleGrain
 */
export const programPersistCycleToOrleans = (cycleId: string, state: unknown) =>
  Effect.gen(function* () {
    const client = yield* CycleGrainClient;
    yield* client.persistCycleSnapshot(cycleId, state);
  }).pipe(Effect.provide(CycleGrainClient.Default.pipe(Layer.provide(FetchHttpClient.layer))));
