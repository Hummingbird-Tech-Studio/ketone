import { HttpApiBuilder } from '@effect/platform';
import { Effect, Schema as S } from 'effect';
import { Api } from '../../../api';
import { XStateSnapshotWithDatesSchema, OrleansActorStateSchema } from '../infrastructure/orleans-client';
import { CycleGrainService } from '../services/cycle-grain.service';
import { ensureDate } from '../utils/date-helpers';
import {
  CycleActorErrorSchema,
  OrleansClientErrorSchema,
  CycleAlreadyInProgressErrorSchema,
  CycleIdMismatchErrorSchema,
  CycleInvalidStateErrorSchema,
} from './schemas';
import { CurrentUser } from '../../auth/api/middleware';

// ============================================================================
// API Handler. This is the implementation of the API contract
// ============================================================================

export const CycleApiLive = HttpApiBuilder.group(Api, 'cycle', (handlers) =>
  Effect.gen(function* () {
    const cycleService = yield* CycleGrainService;

    return handlers
      .handle('createCycleOrleans', ({ payload }) =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const userId = currentUser.userId;

          yield* Effect.logInfo(`[Handler] POST /cycle/orleans - Request received for user ${userId}`);
          yield* Effect.logInfo(`[Handler] Payload:`, payload);

          const startDate = payload.startDate;
          const endDate = payload.endDate;

          yield* Effect.logInfo(`[Handler] Calling Cycle Grain service to create cycle`);

          const actorState = yield* cycleService.createCycle(userId, startDate, endDate).pipe(
            Effect.mapError((error) => {
              if (error._tag === 'CycleActorError') {
                return new CycleActorErrorSchema({ message: error.message, cause: error.cause });
              }
              if (error._tag === 'OrleansClientError') {
                return new OrleansClientErrorSchema({ message: error.message, cause: error.cause });
              }
              if (error._tag === 'CycleAlreadyInProgressError') {
                return new CycleAlreadyInProgressErrorSchema({ message: error.message, userId });
              }
              // Handle unexpected errors (including HttpBodyError)
              return new CycleActorErrorSchema({ message: 'Unexpected error', cause: error });
            }),
          );

          yield* Effect.logInfo(`[Handler] Cycle created successfully, preparing response`);
          yield* Effect.logInfo(`[Handler] Persisted snapshot:`, actorState);

          const snapshot = yield* S.decodeUnknown(XStateSnapshotWithDatesSchema)(actorState).pipe(
            Effect.mapError(
              (error) =>
                new CycleActorErrorSchema({
                  message: 'Failed to decode XState snapshot from service',
                  cause: error,
                }),
            ),
          );

          const response = {
            userId: userId,
            state: snapshot.value,
            cycle: {
              id: snapshot.context.id,
              startDate: ensureDate(snapshot.context.startDate),
              endDate: ensureDate(snapshot.context.endDate),
            },
          };

          yield* Effect.logInfo(`[Handler] Returning response:`, response);

          return response;
        }),
      )
      .handle('getCycleStateOrleans', () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const userId = currentUser.userId;

          yield* Effect.logInfo(`[Handler] GET /cycle - Request received for user ${userId}`);

          const actorState = yield* cycleService.getCycleState(userId).pipe(
            Effect.mapError((error) => {
              if (error._tag === 'CycleActorError') {
                return new CycleActorErrorSchema({ message: error.message, cause: error.cause });
              }
              if (error._tag === 'OrleansClientError') {
                return new OrleansClientErrorSchema({ message: error.message, cause: error.cause });
              }
              // Handle unexpected errors
              return new CycleActorErrorSchema({ message: 'Unexpected error', cause: error });
            }),
          );

          const snapshot = yield* S.decodeUnknown(OrleansActorStateSchema)(actorState).pipe(
            Effect.mapError(
              (error) =>
                new CycleActorErrorSchema({
                  message: 'Failed to decode actor state',
                  cause: error,
                }),
            ),
          );

          return {
            userId: userId,
            state: snapshot.value,
            cycle: {
              id: snapshot.context.id,
              startDate: ensureDate(snapshot.context.startDate),
              endDate: ensureDate(snapshot.context.endDate),
            },
          };
        }),
      )
      .handle('updateCycleDates', ({ payload }) =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const userId = currentUser.userId;

          yield* Effect.logInfo(`[Handler] PATCH /cycle - Request received for user ${userId}`);
          yield* Effect.logInfo(`[Handler] Payload:`, payload);

          const cycleId = payload.cycleId;
          const startDate = payload.startDate;
          const endDate = payload.endDate;

          yield* Effect.logInfo(`[Handler] Calling Cycle Grain service to update cycle dates ${cycleId}`);

          const actorState = yield* cycleService.updateCycleDates(userId, cycleId, startDate, endDate).pipe(
            Effect.mapError((error) => {
              if (error._tag === 'CycleActorError') {
                return new CycleActorErrorSchema({ message: error.message, cause: error.cause });
              }
              if (error._tag === 'OrleansClientError') {
                return new OrleansClientErrorSchema({ message: error.message, cause: error.cause });
              }
              if (error._tag === 'CycleIdMismatchError') {
                return new CycleIdMismatchErrorSchema({
                  message: error.message,
                  requestedCycleId: error.requestedCycleId,
                  activeCycleId: error.activeCycleId,
                });
              }
              if (error._tag === 'CycleInvalidStateError') {
                return new CycleInvalidStateErrorSchema({
                  message: error.message,
                  currentState: error.currentState,
                  expectedState: error.expectedState,
                });
              }
              // Handle unexpected errors
              return new CycleActorErrorSchema({ message: 'Unexpected error', cause: error });
            }),
          );

          yield* Effect.logInfo(`[Handler] Cycle dates updated successfully, preparing response`);
          yield* Effect.logInfo(`[Handler] Persisted snapshot:`, actorState);

          const snapshot = yield* S.decodeUnknown(OrleansActorStateSchema)(actorState).pipe(
            Effect.mapError(
              (error) =>
                new CycleActorErrorSchema({
                  message: 'Failed to decode actor state',
                  cause: error,
                }),
            ),
          );

          const response = {
            userId: userId,
            state: snapshot.value,
            cycle: {
              id: snapshot.context.id,
              startDate: ensureDate(snapshot.context.startDate),
              endDate: ensureDate(snapshot.context.endDate),
            },
          };

          yield* Effect.logInfo(`[Handler] Returning response:`, response);

          return response;
        }),
      )
      .handle('updateCycleOrleans', ({ payload }) =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const userId = currentUser.userId;

          yield* Effect.logInfo(`[Handler] POST /cycle/complete - Request received for user ${userId}`);
          yield* Effect.logInfo(`[Handler] Payload:`, payload);

          const cycleId = payload.cycleId;
          const startDate = payload.startDate;
          const endDate = payload.endDate;

          yield* Effect.logInfo(`[Handler] Calling Cycle Grain service to complete cycle ${cycleId}`);

          const actorState = yield* cycleService.completeCycle(userId, cycleId, startDate, endDate).pipe(
            Effect.mapError((error) => {
              if (error._tag === 'CycleActorError') {
                return new CycleActorErrorSchema({ message: error.message, cause: error.cause });
              }
              if (error._tag === 'OrleansClientError') {
                return new OrleansClientErrorSchema({ message: error.message, cause: error.cause });
              }
              if (error._tag === 'CycleIdMismatchError') {
                return new CycleIdMismatchErrorSchema({
                  message: error.message,
                  requestedCycleId: error.requestedCycleId,
                  activeCycleId: error.activeCycleId,
                });
              }
              // Handle unexpected errors
              return new CycleActorErrorSchema({ message: 'Unexpected error', cause: error });
            }),
          );

          yield* Effect.logInfo(`[Handler] Cycle completed successfully, preparing response`);
          yield* Effect.logInfo(`[Handler] Persisted snapshot:`, actorState);

          const snapshot = yield* S.decodeUnknown(OrleansActorStateSchema)(actorState).pipe(
            Effect.mapError(
              (error) =>
                new CycleActorErrorSchema({
                  message: 'Failed to decode actor state',
                  cause: error,
                }),
            ),
          );

          const response = {
            userId: userId,
            state: snapshot.value,
            cycle: {
              id: snapshot.context.id,
              startDate: ensureDate(snapshot.context.startDate),
              endDate: ensureDate(snapshot.context.endDate),
            },
          };

          yield* Effect.logInfo(`[Handler] Returning response:`, response);

          return response;
        }),
      );
  }),
);
