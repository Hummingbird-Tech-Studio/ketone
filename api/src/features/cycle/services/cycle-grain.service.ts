import { Deferred, Effect, Match, Queue } from 'effect';
import { createActor, type Snapshot } from 'xstate';
import {
  cycleActor,
  CycleActorError,
  CycleAlreadyInProgressError,
  CycleInvalidStateError,
  CycleIdMismatchError,
  CycleEvent,
  CycleState,
  Emit,
  type EmitType,
} from '../domain';
import { CycleGrainClient, UserCycleIndexClient, OrleansClientError } from '../infrastructure';

type CycleActorSnapshot = Snapshot<unknown>;

/**
 * Cycle Grain Service - XState + Effect Programs Architecture
 *
 * Architecture:
 * - XState machine manages state transitions and orchestrates grain operations
 * - fromCallback actors invoke Effect programs that handle all grain communication
 * - Programs handle: grain coordination, snapshot persistence, read model writes
 * - Service only manages: machine lifecycle, emit listeners, result tracking
 *
 * Flow:
 * 1. Service creates machine and sends event (CREATE_CYCLE, UPDATE_DATES, etc.)
 * 2. Machine invokes actor (createCycle, updateCycleDates, etc.)
 * 3. Actor calls Effect program via runWithUi
 * 4. Program orchestrates grains, persists snapshot, writes to read model
 * 5. Program sends SUCCESS/ERROR back to machine via sendBack
 * 6. Machine transitions and emits PERSIST_STATE
 * 7. Service listens to emit and resolves deferred
 */
export class CycleGrainService extends Effect.Service<CycleGrainService>()('CycleGrainService', {
  effect: Effect.gen(function* () {
    const cycleGrainClient = yield* CycleGrainClient;
    const userCycleIndexClient = yield* UserCycleIndexClient;

    /**
     * Cleanup function - stops machine and unsubscribes listeners
     */
    const createCleanup = (
      machine: ReturnType<typeof createActor>,
      emitSubscriptions: Array<{ unsubscribe: () => void }>,
    ) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(`[Cycle Grain Service] Cleaning up machine and listeners...`);
        emitSubscriptions.forEach((sub) => sub.unsubscribe());
        machine.stop();
        yield* Effect.logInfo(`[Cycle Grain Service] ✅ Cleanup complete`);
      });

    /**
     * Orchestration infrastructure for tracking machine completion
     */
    type MachinePersistence = {
      persistConfirmQueue: Queue.Queue<CycleState>;
      resultDeferred: Deferred.Deferred<Snapshot<unknown>, CycleActorError | OrleansClientError | CycleAlreadyInProgressError | CycleIdMismatchError | CycleInvalidStateError>;
      handleEmit: (event: EmitType) => void;
    };

    /**
     * Setup emit listeners for machine events
     * - PERSIST_STATE: Confirms that machine transitioned and programs persisted successfully
     * - ERROR_CREATE_CYCLE: Indicates that program failed
     */
    const setupMachinePersistence = (operationContext: { actorErrorMessage: string }) =>
      Effect.gen(function* () {
        const persistConfirmQueue = yield* Queue.unbounded<CycleState>();
        const resultDeferred = yield* Deferred.make<
          Snapshot<unknown>,
          CycleActorError | OrleansClientError | CycleAlreadyInProgressError | CycleIdMismatchError | CycleInvalidStateError
        >();

        const handleEmit = (event: EmitType) => {
          Match.value(event).pipe(
            Match.when({ type: Emit.ERROR_CREATE_CYCLE }, (emit) => {
              Effect.runFork(
                Effect.logError('[Cycle Grain Service] ❌ Actor error - completing deferred'),
              );

              // Check if we have a specific error type to preserve
              const originalError = emit.originalError as any;
              let failureError: CycleActorError | OrleansClientError | CycleAlreadyInProgressError | CycleIdMismatchError | CycleInvalidStateError;

              if (originalError && originalError._tag === 'CycleAlreadyInProgressError') {
                failureError = new CycleAlreadyInProgressError({
                  message: originalError.message,
                  userId: originalError.userId,
                });
              } else if (originalError && originalError._tag === 'CycleIdMismatchError') {
                failureError = new CycleIdMismatchError({
                  message: originalError.message,
                  requestedCycleId: originalError.requestedCycleId,
                  activeCycleId: originalError.activeCycleId,
                });
              } else if (originalError && originalError._tag === 'CycleInvalidStateError') {
                failureError = new CycleInvalidStateError({
                  message: originalError.message,
                  currentState: originalError.currentState,
                  expectedState: originalError.expectedState,
                });
              } else if (originalError && originalError._tag === 'OrleansClientError') {
                failureError = new OrleansClientError({
                  message: originalError.message,
                  cause: originalError.cause,
                });
              } else {
                // Default to generic error
                failureError = new CycleActorError({
                  message: operationContext.actorErrorMessage,
                  cause: emit.error,
                });
              }

              Effect.runFork(Deferred.fail(resultDeferred, failureError));
            }),
            Match.when({ type: Emit.PERSIST_STATE }, (emit) => {
              Effect.runFork(
                Effect.logInfo(
                  `[Cycle Grain Service] ✅ PERSIST_STATE emitted: ${emit.state}`,
                ),
              );
              Effect.runFork(Queue.offer(persistConfirmQueue, emit.state));
            }),
            Match.exhaustive,
          );
        };

        return { persistConfirmQueue, resultDeferred, handleEmit };
      });

    /**
     * Wait for machine to complete and return snapshot
     * Listens for PERSIST_STATE emit which indicates program succeeded
     */
    const awaitMachineCompletion = (
      machine: ReturnType<typeof createActor>,
      machinePersistence: MachinePersistence,
      emitSubscriptions: Array<{ unsubscribe: () => void }>,
    ) =>
      Effect.gen(function* () {
        const { persistConfirmQueue, resultDeferred } = machinePersistence;

        // Wait for PERSIST_STATE emit (indicates success)
        const successEffect = Effect.gen(function* () {
          const confirmedState = yield* Queue.take(persistConfirmQueue);
          yield* Effect.logInfo(
            `[Cycle Grain Service] ✅ Persistence confirmed: ${confirmedState}`,
          );

          // Get the snapshot and cycle ID from machine
          const persistedSnapshot = machine.getPersistedSnapshot();
          const cycleId = (persistedSnapshot as any).context?.id;

          if (cycleId) {
            // Persist the snapshot to the grain
            yield* Effect.logInfo(
              `[Cycle Grain Service] Persisting snapshot for cycle ${cycleId}`,
            );
            yield* cycleGrainClient.persistCycleSnapshot(cycleId, persistedSnapshot);
            yield* Effect.logInfo(
              `[Cycle Grain Service] ✅ Snapshot persisted to CycleGrain`,
            );
          } else {
            yield* Effect.logWarning(
              `[Cycle Grain Service] ⚠️  No cycle ID in snapshot context, skipping persistence`,
            );
          }

          yield* Deferred.succeed(resultDeferred, persistedSnapshot);
        });

        const cleanup = createCleanup(machine, emitSubscriptions);

        return yield* Effect.scoped(
          Effect.gen(function* () {
            yield* Effect.forkScoped(successEffect);
            return yield* Deferred.await(resultDeferred);
          }),
        ).pipe(Effect.ensuring(cleanup));
      });

    return {
      /**
       * Create a new cycle
       *
       * Machine orchestrates everything via Effect programs:
       * 1. Machine invokes createCycle actor
       * 2. Actor calls programCreateCycle which:
       *    - Registers in UserCycleIndexGrain
       *    - Initializes CycleGrain
       *    - Persists snapshot
       *    - Writes to read model
       * 3. Actor sends SUCCESS back to machine
       * 4. Machine transitions to InProgress and emits PERSIST_STATE
       * 5. Service waits for emit and returns snapshot
       */
      createCycle: (userId: string, startDate: Date, endDate: Date) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[Cycle Grain Service] Starting cycle creation for user ${userId}`);

          // Step 1: Create machine
          const machine = yield* Effect.sync(() => createActor(cycleActor));

          // Step 2: Setup persistence tracking
          const machinePersistence = yield* setupMachinePersistence({
            actorErrorMessage: 'Failed to create cycle',
          });

          // Step 3: Register emit listeners
          const emitSubscriptions = Object.values(Emit).map((emit) =>
            machine.on(emit, machinePersistence.handleEmit),
          );

          // Step 4: Start machine
          machine.start();

          // Step 5: Send CREATE_CYCLE event
          // Machine will invoke createCycle actor → programCreateCycle → grains
          machine.send({
            type: CycleEvent.CREATE_CYCLE,
            userId,
            startDate,
            endDate,
          });

          // Step 6: Wait for completion (PERSIST_STATE emit)
          const result = yield* awaitMachineCompletion(machine, machinePersistence, emitSubscriptions);

          yield* Effect.logInfo(`[Cycle Grain Service] ✅ Cycle created successfully`);

          return result;
        }),

      /**
       * Get cycle state from grain
       * Returns active cycle if exists, otherwise most recent cycle
       */
      getCycleState: (userId: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[Cycle Grain Service] Getting cycle state for user ${userId}`);

          // Try to get active cycle ID
          const activeCycleId = yield* userCycleIndexClient.getActiveCycleId(userId);

          if (activeCycleId) {
            yield* Effect.logInfo(`[Cycle Grain Service] Active cycle ID: ${activeCycleId}`);
            // Get snapshot from CycleGrain
            const snapshot = yield* cycleGrainClient.getCycleSnapshot(activeCycleId);
            return snapshot;
          }

          // No active cycle - try to get most recent cycle
          yield* Effect.logInfo(`[Cycle Grain Service] No active cycle, checking for recent cycles`);
          const recentCycles = yield* userCycleIndexClient.getRecentCycleIds(userId, 1);

          if (recentCycles.length === 0) {
            yield* Effect.logInfo(`[Cycle Grain Service] No cycles found for user ${userId}`);
            return yield* Effect.fail(
              new CycleActorError({
                message: `User ${userId} has no cycles`,
              }),
            );
          }

          const mostRecentCycleId = recentCycles[0]!; // Safe: we checked length > 0
          yield* Effect.logInfo(`[Cycle Grain Service] Most recent cycle ID: ${mostRecentCycleId}`);

          // Get snapshot from CycleGrain
          const snapshot = yield* cycleGrainClient.getCycleSnapshot(mostRecentCycleId);

          return snapshot;
        }),

      /**
       * Update cycle dates
       *
       * Flow:
       * 1. Get snapshot from CycleGrain
       * 2. Validate cycle ID and state
       * 3. Restore machine with snapshot
       * 4. Send UPDATE_DATES event
       * 5. Machine invokes updateCycleDates actor → programUpdateCycleDates
       * 6. Program handles grain updates, snapshot persistence, read model
       * 7. Actor sends PERSIST_SUCCESS back to machine
       * 8. Machine emits PERSIST_STATE
       * 9. Service returns snapshot
       */
      updateCycleDates: (userId: string, cycleId: string, startDate: Date, endDate: Date) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[Cycle Grain Service] Updating cycle dates for cycle ${cycleId}`);

          // Step 1: Validate requested cycle ID matches user's active cycle
          const activeCycleId = yield* userCycleIndexClient.getActiveCycleId(userId);

          if (!activeCycleId) {
            return yield* Effect.fail(
              new CycleActorError({
                message: `User ${userId} has no active cycle`,
              }),
            );
          }

          if (activeCycleId !== cycleId) {
            return yield* Effect.fail(
              new CycleIdMismatchError({
                message: 'The requested cycle ID does not match the active cycle ID',
                requestedCycleId: cycleId,
                activeCycleId: activeCycleId,
              }),
            );
          }

          // Step 2: Get current snapshot from CycleGrain
          const persistedSnapshot = yield* cycleGrainClient.getCycleSnapshot(cycleId);

          // Step 3: Validate snapshot integrity
          const contextCycleId = (persistedSnapshot as any).context?.id;
          if (contextCycleId && contextCycleId !== cycleId) {
            return yield* Effect.fail(
              new CycleIdMismatchError({
                message: 'The cycle ID does not match the snapshot cycle ID',
                requestedCycleId: cycleId,
                activeCycleId: contextCycleId,
              }),
            );
          }

          // Step 4: Restore machine with persisted snapshot
          const machine = yield* Effect.sync(() =>
            createActor(cycleActor, { snapshot: persistedSnapshot as CycleActorSnapshot }),
          );

          machine.start();

          const currentState = machine.getSnapshot().value;
          yield* Effect.logInfo(`[Cycle Grain Service] Machine restored with state: ${currentState}`);

          // Step 5: Verify cycle is in InProgress state
          if (currentState !== CycleState.InProgress) {
            machine.stop();
            return yield* Effect.fail(
              new CycleInvalidStateError({
                message: 'Can only update dates for cycles in InProgress state',
                currentState: String(currentState),
                expectedState: CycleState.InProgress,
              }),
            );
          }

          // Step 6: Setup persistence tracking
          const machinePersistence = yield* setupMachinePersistence({
            actorErrorMessage: 'Failed to update cycle dates',
          });

          const emitSubscriptions = Object.values(Emit).map((emit) =>
            machine.on(emit, machinePersistence.handleEmit),
          );

          // Step 7: Send UPDATE_DATES event
          // Machine will invoke updateCycleDates actor → programUpdateCycleDates
          machine.send({
            type: CycleEvent.UPDATE_DATES,
            startDate,
            endDate,
          });

          // Step 8: Wait for completion
          const result = yield* awaitMachineCompletion(machine, machinePersistence, emitSubscriptions);

          yield* Effect.logInfo(`[Cycle Grain Service] ✅ Cycle dates updated successfully`);

          return result;
        }),

      /**
       * Complete a cycle
       *
       * Flow:
       * 1. Get snapshot from CycleGrain
       * 2. Validate cycle ID
       * 3. Restore machine
       * 4. Send COMPLETE event
       * 5. Machine invokes completeCycle actor → programCompleteCycle
       * 6. Program handles completion in both grains, snapshot persistence, read model
       * 7. Actor sends PERSIST_SUCCESS back to machine
       * 8. Machine transitions to Completed and emits PERSIST_STATE
       * 9. Service returns snapshot
       */
      completeCycle: (userId: string, cycleId: string, startDate: Date, endDate: Date) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`[Cycle Grain Service] Completing cycle ${cycleId} for user ${userId}`);

          // Step 1: Validate requested cycle ID matches user's active cycle
          const activeCycleId = yield* userCycleIndexClient.getActiveCycleId(userId);

          // Allow completing even if no active cycle (might be completing a completed cycle)
          // But if there is an active cycle, it must match
          if (activeCycleId && activeCycleId !== cycleId) {
            return yield* Effect.fail(
              new CycleIdMismatchError({
                message: 'The requested cycle ID does not match the active cycle ID',
                requestedCycleId: cycleId,
                activeCycleId: activeCycleId,
              }),
            );
          }

          // Step 2: Get current snapshot from CycleGrain
          const persistedSnapshot = yield* cycleGrainClient.getCycleSnapshot(cycleId);

          // Step 3: Validate snapshot integrity
          const contextCycleId = (persistedSnapshot as any).context?.id;
          if (contextCycleId && contextCycleId !== cycleId) {
            return yield* Effect.fail(
              new CycleIdMismatchError({
                message: 'The cycle ID does not match the snapshot cycle ID',
                requestedCycleId: cycleId,
                activeCycleId: contextCycleId,
              }),
            );
          }

          // Step 4: Restore machine
          const machine = yield* Effect.sync(() =>
            createActor(cycleActor, { snapshot: persistedSnapshot as CycleActorSnapshot }),
          );

          machine.start();

          const currentState = machine.getSnapshot().value;
          yield* Effect.logInfo(`[Cycle Grain Service] Machine restored with state: ${currentState}`);

          // Check if already completed
          if (currentState === CycleState.Completed) {
            yield* Effect.logInfo(`[Cycle Grain Service] Cycle already completed, returning current snapshot`);
            machine.stop();
            return persistedSnapshot;
          }

          // Step 5: Setup persistence tracking
          const machinePersistence = yield* setupMachinePersistence({
            actorErrorMessage: 'Failed to complete cycle',
          });

          const emitSubscriptions = Object.values(Emit).map((emit) =>
            machine.on(emit, machinePersistence.handleEmit),
          );

          // Step 6: Send COMPLETE event
          // Machine will invoke completeCycle actor → programCompleteCycle
          machine.send({
            type: CycleEvent.COMPLETE,
            startDate,
            endDate,
          });

          // Step 7: Wait for completion
          const result = yield* awaitMachineCompletion(machine, machinePersistence, emitSubscriptions);

          yield* Effect.logInfo(`[Cycle Grain Service] ✅ Cycle ${cycleId} completed successfully`);

          return result;
        }),
    };
  }),
  accessors: true,
}) {}
