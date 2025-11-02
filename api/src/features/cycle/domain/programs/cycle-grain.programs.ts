import { Effect, Layer } from 'effect';
import { FetchHttpClient } from '@effect/platform';
import { randomUUID } from 'node:crypto';
import {
  CycleGrainClient,
  UserCycleIndexClient,
  OrleansClientError,
} from '../../infrastructure';
import { CycleRepository } from '../../repositories';
import { DatabaseLive } from '../../../../db';
import { CycleAlreadyInProgressError } from '../errors';

/**
 * Effect Program: Create Cycle with Grain Orchestration
 *
 * Orchestrates:
 * 1. Generate cycleId
 * 2. Try to register in UserCycleIndexGrain (enforces "1 active cycle" rule)
 * 3. Initialize CycleGrain
 * 4. Write to read model (cycles table) - fire-and-forget
 *
 * Note: XState snapshot persistence happens in the service AFTER machine transitions
 *
 * @param userId - User ID
 * @param startDate - Cycle start date
 * @param endDate - Cycle end date
 * @returns Created cycle metadata
 */
export const programCreateCycle = (
  userId: string,
  startDate: Date,
  endDate: Date,
) =>
  Effect.gen(function* () {
    const cycleGrainClient = yield* CycleGrainClient;
    const userCycleIndexClient = yield* UserCycleIndexClient;
    const cycleRepository = yield* CycleRepository;

    // Step 1: Generate cycle ID
    const cycleId = randomUUID();
    yield* Effect.logInfo(
      `[Program CreateCycle] Generating cycle ID: ${cycleId} for user ${userId}`,
    );

    // Step 2: Try to register in UserCycleIndexGrain
    yield* Effect.logInfo(
      `[Program CreateCycle] Attempting to register cycle in UserCycleIndexGrain`,
    );

    const canStart = yield* userCycleIndexClient.tryStartNewCycle(
      userId,
      cycleId,
      startDate,
      endDate,
    );

    if (!canStart) {
      yield* Effect.logWarning(
        `[Program CreateCycle] User ${userId} already has an active cycle`,
      );
      return yield* Effect.fail(
        new CycleAlreadyInProgressError({
          message: 'A cycle is already in progress',
          userId,
        }),
      );
    }

    yield* Effect.logInfo(
      `[Program CreateCycle] ✅ Cycle registered in UserCycleIndexGrain`,
    );

    // Step 3: CycleGrain is already initialized by the sidecar endpoint
    // POST /users/{userId}/cycles/start endpoint calls both:
    // - UserCycleIndexGrain.TryStartNewCycle (done above)
    // - CycleGrain.Initialize (handled by sidecar)

    // Note: Snapshot persistence happens in the service after machine transitions to InProgress

    // Step 4: Write to read model (fire-and-forget)
    yield* Effect.fork(
      cycleRepository
        .createCycle({
          id: cycleId,
          userId,
          status: 'InProgress',
          startDate,
          endDate,
        })
        .pipe(
          Effect.tap(() =>
            Effect.logInfo(
              `[Program CreateCycle] [Read Model] ✅ Cycle ${cycleId} written to cycles table`,
            ),
          ),
          Effect.catchAll((error) =>
            Effect.logError(
              `[Program CreateCycle] [Read Model] ⚠️ Failed to write cycle (non-blocking)`,
              error,
            ),
          ),
        ),
    );

    yield* Effect.logInfo(`[Program CreateCycle] ✅ Cycle ${cycleId} created successfully`);

    return {
      id: cycleId,
      userId,
      status: 'InProgress',
      startDate,
      endDate,
    };
  }).pipe(Effect.provide(GrainProgramsLayer));

/**
 * Effect Program: Update Cycle Dates with Grain Orchestration
 *
 * Orchestrates:
 * 1. Update metadata in CycleGrain
 * 2. Update read model (cycles table) - fire-and-forget
 *
 * Note: XState snapshot persistence happens in the service AFTER machine transitions
 *
 * @param cycleId - Cycle ID
 * @param startDate - Updated start date
 * @param endDate - Updated end date
 * @returns Updated cycle metadata
 */
export const programUpdateCycleDates = (
  cycleId: string,
  startDate: Date,
  endDate: Date,
) =>
  Effect.gen(function* () {
    const cycleGrainClient = yield* CycleGrainClient;
    const cycleRepository = yield* CycleRepository;

    yield* Effect.logInfo(`[Program UpdateDates] Updating dates for cycle ${cycleId}`);

    // Step 1: Update metadata in CycleGrain
    yield* cycleGrainClient.updateCycleMetadata(cycleId, startDate, endDate, 'InProgress');
    yield* Effect.logInfo(`[Program UpdateDates] ✅ Metadata updated in CycleGrain`);

    // Note: Snapshot persistence happens in the service after machine transitions

    // Step 2: Update read model (fire-and-forget)
    yield* Effect.fork(
      cycleRepository.updateCycleDates(cycleId, startDate, endDate).pipe(
        Effect.tap(() =>
          Effect.logInfo(
            `[Program UpdateDates] [Read Model] ✅ Cycle ${cycleId} dates updated in cycles table`,
          ),
        ),
        Effect.catchAll((error) =>
          Effect.logError(
            `[Program UpdateDates] [Read Model] ⚠️ Failed to update dates (non-blocking)`,
            error,
          ),
        ),
      ),
    );

    yield* Effect.logInfo(`[Program UpdateDates] ✅ Cycle ${cycleId} dates updated successfully`);

    return {
      id: cycleId,
      startDate,
      endDate,
    };
  }).pipe(Effect.provide(GrainProgramsLayer));

/**
 * Effect Program: Complete Cycle with Grain Orchestration
 *
 * Orchestrates:
 * 1. Call completeCycle on CycleGrainClient (updates both CycleGrain + UserCycleIndexGrain)
 * 2. Update read model to Completed status - fire-and-forget
 *
 * Note: XState snapshot persistence happens in the service AFTER machine transitions
 *
 * @param cycleId - Cycle ID
 * @param startDate - Final start date
 * @param endDate - Final end date
 * @returns Completed cycle metadata
 */
export const programCompleteCycle = (
  cycleId: string,
  startDate: Date,
  endDate: Date,
) =>
  Effect.gen(function* () {
    const cycleGrainClient = yield* CycleGrainClient;
    const cycleRepository = yield* CycleRepository;

    yield* Effect.logInfo(`[Program CompleteCycle] Completing cycle ${cycleId}`);

    // Step 1: Complete cycle (updates both CycleGrain and UserCycleIndexGrain)
    yield* cycleGrainClient.completeCycle(cycleId);
    yield* Effect.logInfo(
      `[Program CompleteCycle] ✅ Cycle marked as completed in both grains`,
    );

    // Note: Snapshot persistence happens in the service after machine transitions to Completed

    // Step 2: Update read model (fire-and-forget)
    yield* Effect.fork(
      cycleRepository.updateCycleStatus(cycleId, 'Completed', startDate, endDate).pipe(
        Effect.tap(() =>
          Effect.logInfo(
            `[Program CompleteCycle] [Read Model] ✅ Cycle ${cycleId} marked as Completed in cycles table`,
          ),
        ),
        Effect.catchAll((error) =>
          Effect.logError(
            `[Program CompleteCycle] [Read Model] ⚠️ Failed to update status (non-blocking)`,
            error,
          ),
        ),
      ),
    );

    yield* Effect.logInfo(`[Program CompleteCycle] ✅ Cycle ${cycleId} completed successfully`);

    return {
      id: cycleId,
      status: 'Completed' as const,
      startDate,
      endDate,
    };
  }).pipe(Effect.provide(GrainProgramsLayer));

/**
 * Effect Program: Get Cycle Snapshot from Grain
 *
 * Fetches the persisted XState snapshot from CycleGrain
 * Used to restore machine state when resuming operations
 *
 * @param cycleId - Cycle ID
 * @returns XState snapshot
 */
export const programGetCycleSnapshot = (cycleId: string) =>
  Effect.gen(function* () {
    const cycleGrainClient = yield* CycleGrainClient;

    yield* Effect.logInfo(`[Program GetSnapshot] Fetching snapshot for cycle ${cycleId}`);

    const snapshot = yield* cycleGrainClient.getCycleSnapshot(cycleId);

    yield* Effect.logInfo(`[Program GetSnapshot] ✅ Snapshot retrieved for cycle ${cycleId}`);

    return snapshot;
  }).pipe(Effect.provide(GrainProgramsLayer));

/**
 * Layer that provides all dependencies for grain programs
 *
 * Structure:
 * - CycleGrainClient + UserCycleIndexClient require HttpClient (provided by FetchHttpClient.layer)
 * - CycleRepository requires PgDrizzle (provided by DatabaseLive)
 */
export const GrainProgramsLayer = Layer.mergeAll(
  CycleGrainClient.Default.pipe(Layer.provide(FetchHttpClient.layer)),
  UserCycleIndexClient.Default.pipe(Layer.provide(FetchHttpClient.layer)),
  CycleRepository.Default.pipe(Layer.provide(DatabaseLive)),
);
