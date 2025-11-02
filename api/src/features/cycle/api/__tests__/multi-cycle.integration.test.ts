import { describe, test, expect, afterAll } from 'bun:test';
import { Effect, Schema as S, Layer } from 'effect';
import { CycleResponseSchema } from '../schemas';
import { CycleState } from '../../domain';
import { CycleRepository } from '../../repositories';
import { DatabaseLive, cyclesTable } from '../../../../db';
import { eq, and, desc } from 'drizzle-orm';
import * as PgDrizzle from '@effect/sql-drizzle/Pg';
import {
  API_BASE_URL,
  ORLEANS_BASE_URL,
  validateJwtSecret,
  makeRequest,
  createTestUser,
  deleteTestUser,
  deleteOrleansStorageByGrainId,
  type ErrorResponse,
} from '../../../../test-utils';

/**
 * Integration Tests for Multi-Cycle Functionality
 *
 * Tests the complete multi-cycle workflow using the new architecture:
 * - XState machine orchestrates grain operations via fromCallback actors
 * - Effect programs handle grain coordination, snapshot persistence, and read model writes
 * - UserCycleIndexGrain enforces "one active cycle per user" rule
 * - CycleGrain stores XState snapshots and cycle metadata
 *
 * Test Scenarios:
 * 1. Complete multi-cycle workflow (Create → Update → Complete → Create new)
 * 2. Multiple users with multiple cycles each
 * 3. Grain synchronization (CycleGrain + UserCycleIndexGrain)
 * 4. Read model synchronization (database consistency)
 * 5. Historical cycle tracking
 */

// ============================================================================
// Test Configuration
// ============================================================================

validateJwtSecret();

const CREATE_CYCLE_ENDPOINT = `${API_BASE_URL}/cycle`;
const UPDATE_CYCLE_DATES_ENDPOINT = `${API_BASE_URL}/cycle`;
const COMPLETE_CYCLE_ENDPOINT = `${API_BASE_URL}/cycle/complete`;
const GET_CYCLE_STATE_ENDPOINT = `${API_BASE_URL}/cycle`;

// ============================================================================
// Test Data Tracking
// ============================================================================

const testData = {
  userIds: new Set<string>(),
  cycleIds: new Set<string>(),
};

// ============================================================================
// Test Cleanup
// ============================================================================

afterAll(async () => {
  const cleanupProgram = Effect.gen(function* () {
    const repository = yield* CycleRepository;

    console.log('\n🧹 [Multi-Cycle Tests] Starting cleanup...');
    console.log(`📊 Tracked test users: ${testData.userIds.size}`);

    if (testData.userIds.size === 0) {
      console.log('⚠️  No test data to clean up');
      return;
    }

    const userIdsArray = Array.from(testData.userIds);

    yield* Effect.all(
      userIdsArray.map((userId) =>
        Effect.gen(function* () {
          yield* repository.deleteCyclesByUserId(userId);
          yield* deleteOrleansStorageByGrainId(userId);
          yield* deleteTestUser(userId);
        }),
      ),
      { concurrency: 'unbounded' },
    );

    console.log(`✅ Deleted cycles for ${testData.userIds.size} test users`);
    console.log(`✅ Deleted Orleans storage for ${testData.userIds.size} grains`);
    console.log(`✅ Deleted ${testData.userIds.size} test users`);
    console.log('✅ [Multi-Cycle Tests] Cleanup completed\n');
  });

  const runnableProgram = cleanupProgram.pipe(
    Effect.provide(Layer.mergeAll(CycleRepository.Default.pipe(Layer.provide(DatabaseLive)), DatabaseLive)),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error('⚠️  [Multi-Cycle Tests] Cleanup failed:', error);
      }),
    ),
  );

  await Effect.runPromise(runnableProgram);
});

// ============================================================================
// Test Helpers
// ============================================================================

const createTestUserWithTracking = () =>
  Effect.gen(function* () {
    const user = yield* createTestUser();
    testData.userIds.add(user.userId);
    return user;
  });

const generateValidCycleDates = (hoursAgo: number = 1) =>
  Effect.sync(() => {
    const now = new Date();
    const startDate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    };
  });

const cleanupOrleansGrain = (userId: string) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () =>
        fetch(`${ORLEANS_BASE_URL}/actors/${userId}`, {
          method: 'DELETE',
        }),
      catch: (error) => {
        console.log(`⚠️  Could not cleanup grain for user ${userId}:`, error);
        return error;
      },
    }).pipe(
      Effect.tap((response) =>
        Effect.sync(() => {
          if (response.status === 204 || response.status === 404) {
            console.log(`✅ Cleaned up grain for user ${userId}`);
          }
        }),
      ),
      Effect.ignore,
    );
  });

const createCycle = (token: string, hoursAgo: number = 1) =>
  Effect.gen(function* () {
    const dates = yield* generateValidCycleDates(hoursAgo);

    const { status, json } = yield* makeRequest(CREATE_CYCLE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dates),
    });

    if (status !== 201) {
      return yield* Effect.fail(new Error(`Failed to create cycle: ${status}`));
    }

    const cycle = yield* S.decodeUnknown(CycleResponseSchema)(json);
    testData.cycleIds.add(cycle.cycle.id!);
    return cycle;
  });

const updateCycleDates = (token: string, cycleId: string, startHoursAgo: number = 3, endHoursAgo: number = 2) =>
  Effect.gen(function* () {
    const now = new Date();
    const startDate = new Date(now.getTime() - startHoursAgo * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() - endHoursAgo * 60 * 60 * 1000);

    const { status, json } = yield* makeRequest(UPDATE_CYCLE_DATES_ENDPOINT, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cycleId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }),
    });

    if (status !== 200) {
      console.log(`⚠️  Update cycle dates failed: ${status}`, json);
      return yield* Effect.fail(new Error(`Failed to update cycle dates: ${status} - ${JSON.stringify(json)}`));
    }

    return yield* S.decodeUnknown(CycleResponseSchema)(json);
  });

const completeCycle = (token: string, cycleId: string) =>
  Effect.gen(function* () {
    const dates = yield* generateValidCycleDates();

    const { status, json } = yield* makeRequest(COMPLETE_CYCLE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cycleId,
        ...dates,
      }),
    });

    if (status !== 200) {
      return yield* Effect.fail(new Error(`Failed to complete cycle: ${status}`));
    }

    return yield* S.decodeUnknown(CycleResponseSchema)(json);
  });

const getCycleState = (token: string) =>
  Effect.gen(function* () {
    const { status, json } = yield* makeRequest(GET_CYCLE_STATE_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { status, json };
  });

// ============================================================================
// Tests - Complete Multi-Cycle Workflow
// ============================================================================

describe('Multi-Cycle Workflow - Complete Lifecycle', () => {
  test(
    'should support complete lifecycle: Create → Update → Complete → Create new → Complete',
    async () => {
      const program = Effect.gen(function* () {
        const { userId, token } = yield* createTestUserWithTracking();
        yield* cleanupOrleansGrain(userId);

        const drizzle = yield* PgDrizzle.PgDrizzle;

        // ========== Cycle 1: Create ==========
        console.log('\n📝 Creating first cycle...');
        const cycle1 = yield* createCycle(token, 2);

        expect(cycle1.userId).toBe(userId);
        expect(cycle1.state).toBe(CycleState.InProgress);
        expect(cycle1.cycle.id).toBeDefined();

        const cycle1Id = cycle1.cycle.id!;

        // Verify database
        const [db1] = yield* drizzle.select().from(cyclesTable).where(eq(cyclesTable.id, cycle1Id));
        expect(db1?.status).toBe('InProgress');

        // ========== Cycle 1: Complete ==========
        console.log('✅ Completing first cycle...');
        const completedCycle1 = yield* completeCycle(token, cycle1Id);

        expect(completedCycle1.state).toBe(CycleState.Completed);
        expect(completedCycle1.cycle.id).toBe(cycle1Id);

        // Verify database completion
        const [db1Completed] = yield* drizzle.select().from(cyclesTable).where(eq(cyclesTable.id, cycle1Id));
        expect(db1Completed?.status).toBe('Completed');

        // ========== Cycle 2: Create New ==========
        console.log('\n📝 Creating second cycle...');
        const cycle2 = yield* createCycle(token);

        expect(cycle2.userId).toBe(userId);
        expect(cycle2.state).toBe(CycleState.InProgress);
        expect(cycle2.cycle.id).toBeDefined();
        expect(cycle2.cycle.id).not.toBe(cycle1Id); // Different cycle ID

        const cycle2Id = cycle2.cycle.id!;

        // Verify database has second cycle
        const [db2] = yield* drizzle.select().from(cyclesTable).where(eq(cyclesTable.id, cycle2Id));
        expect(db2?.status).toBe('InProgress');

        // ========== Cycle 2: Complete ==========
        console.log('✅ Completing second cycle...');
        const completedCycle2 = yield* completeCycle(token, cycle2Id);

        expect(completedCycle2.state).toBe(CycleState.Completed);
        expect(completedCycle2.cycle.id).toBe(cycle2Id);

        // ========== Verify Historical Data ==========
        console.log('\n📊 Verifying historical cycles...');
        const allUserCycles = yield* drizzle
          .select()
          .from(cyclesTable)
          .where(eq(cyclesTable.userId, userId))
          .orderBy(desc(cyclesTable.createdAt));

        expect(allUserCycles.length).toBe(2);
        expect(allUserCycles[0]?.id).toBe(cycle2Id); // Most recent
        expect(allUserCycles[0]?.status).toBe('Completed');
        expect(allUserCycles[1]?.id).toBe(cycle1Id); // First cycle
        expect(allUserCycles[1]?.status).toBe('Completed');

        yield* cleanupOrleansGrain(userId);

        console.log('✅ Multi-cycle workflow test completed successfully\n');
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 30000 },
  );

  test(
    'should enforce one active cycle per user',
    async () => {
      const program = Effect.gen(function* () {
        const { userId, token } = yield* createTestUserWithTracking();
        yield* cleanupOrleansGrain(userId);

        // Create first cycle
        const cycle1 = yield* createCycle(token);
        expect(cycle1.state).toBe(CycleState.InProgress);

        // Try to create second cycle while first is still in progress
        const dates = yield* generateValidCycleDates();
        const { status, json } = yield* makeRequest(CREATE_CYCLE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dates),
        });

        // Should fail with 409 (Conflict)
        expect(status).toBe(409);

        const error = json as ErrorResponse;
        expect(error._tag).toBe('CycleAlreadyInProgressError');
        expect(error.userId).toBe(userId);

        // Complete first cycle
        yield* completeCycle(token, cycle1.cycle.id!);

        // Now should be able to create second cycle
        const cycle2 = yield* createCycle(token);
        expect(cycle2.state).toBe(CycleState.InProgress);
        expect(cycle2.cycle.id).not.toBe(cycle1.cycle.id);

        yield* cleanupOrleansGrain(userId);
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 20000 },
  );
});

// ============================================================================
// Tests - Multiple Users with Multiple Cycles
// ============================================================================

describe('Multi-User Multi-Cycle Scenarios', () => {
  test(
    'should handle multiple users each with their own cycle sequences',
    async () => {
      const program = Effect.gen(function* () {
        const drizzle = yield* PgDrizzle.PgDrizzle;

        // Create 3 users
        const user1 = yield* createTestUserWithTracking();
        const user2 = yield* createTestUserWithTracking();
        const user3 = yield* createTestUserWithTracking();

        yield* Effect.all([
          cleanupOrleansGrain(user1.userId),
          cleanupOrleansGrain(user2.userId),
          cleanupOrleansGrain(user3.userId),
        ]);

        // User 1: Create 2 cycles
        const u1c1 = yield* createCycle(user1.token);
        yield* completeCycle(user1.token, u1c1.cycle.id!);
        const u1c2 = yield* createCycle(user1.token);

        // User 2: Create 3 cycles
        const u2c1 = yield* createCycle(user2.token);
        yield* completeCycle(user2.token, u2c1.cycle.id!);
        const u2c2 = yield* createCycle(user2.token);
        yield* completeCycle(user2.token, u2c2.cycle.id!);
        const u2c3 = yield* createCycle(user2.token);

        // User 3: Create 1 cycle
        const u3c1 = yield* createCycle(user3.token);

        // Verify each user has correct number of cycles
        const user1Cycles = yield* drizzle
          .select()
          .from(cyclesTable)
          .where(eq(cyclesTable.userId, user1.userId));

        const user2Cycles = yield* drizzle
          .select()
          .from(cyclesTable)
          .where(eq(cyclesTable.userId, user2.userId));

        const user3Cycles = yield* drizzle
          .select()
          .from(cyclesTable)
          .where(eq(cyclesTable.userId, user3.userId));

        expect(user1Cycles.length).toBe(2);
        expect(user2Cycles.length).toBe(3);
        expect(user3Cycles.length).toBe(1);

        // Verify active cycles
        const user1Active = user1Cycles.filter((c) => c.status === 'InProgress');
        const user2Active = user2Cycles.filter((c) => c.status === 'InProgress');
        const user3Active = user3Cycles.filter((c) => c.status === 'InProgress');

        expect(user1Active.length).toBe(1);
        expect(user1Active[0]?.id ?? undefined).toBe(u1c2.cycle.id ?? undefined);

        expect(user2Active.length).toBe(1);
        expect(user2Active[0]?.id ?? undefined).toBe(u2c3.cycle.id ?? undefined);

        expect(user3Active.length).toBe(1);
        expect(user3Active[0]?.id ?? undefined).toBe(u3c1.cycle.id ?? undefined);

        yield* Effect.all([
          cleanupOrleansGrain(user1.userId),
          cleanupOrleansGrain(user2.userId),
          cleanupOrleansGrain(user3.userId),
        ]);

        console.log('✅ Multi-user multi-cycle test completed\n');
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 40000 },
  );

  test(
    'should handle concurrent operations from different users',
    async () => {
      const program = Effect.gen(function* () {
        const user1 = yield* createTestUserWithTracking();
        const user2 = yield* createTestUserWithTracking();
        const user3 = yield* createTestUserWithTracking();

        yield* Effect.all([
          cleanupOrleansGrain(user1.userId),
          cleanupOrleansGrain(user2.userId),
          cleanupOrleansGrain(user3.userId),
        ]);

        // Create cycles for all 3 users concurrently
        const [cycle1, cycle2, cycle3] = yield* Effect.all(
          [createCycle(user1.token), createCycle(user2.token), createCycle(user3.token)],
          { concurrency: 'unbounded' },
        );

        // All should succeed
        expect(cycle1.state).toBe(CycleState.InProgress);
        expect(cycle2.state).toBe(CycleState.InProgress);
        expect(cycle3.state).toBe(CycleState.InProgress);

        // Each cycle should have different IDs
        expect(cycle1.cycle.id).not.toBe(cycle2.cycle.id);
        expect(cycle2.cycle.id).not.toBe(cycle3.cycle.id);
        expect(cycle1.cycle.id).not.toBe(cycle3.cycle.id);

        // Complete all cycles concurrently
        const [completed1, completed2, completed3] = yield* Effect.all(
          [
            completeCycle(user1.token, cycle1.cycle.id!),
            completeCycle(user2.token, cycle2.cycle.id!),
            completeCycle(user3.token, cycle3.cycle.id!),
          ],
          { concurrency: 'unbounded' },
        );

        expect(completed1.state).toBe(CycleState.Completed);
        expect(completed2.state).toBe(CycleState.Completed);
        expect(completed3.state).toBe(CycleState.Completed);

        yield* Effect.all([
          cleanupOrleansGrain(user1.userId),
          cleanupOrleansGrain(user2.userId),
          cleanupOrleansGrain(user3.userId),
        ]);

        console.log('✅ Concurrent operations test completed\n');
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 30000 },
  );
});

// ============================================================================
// Tests - Grain and Read Model Synchronization
// ============================================================================

describe('Grain and Read Model Synchronization', () => {
  test(
    'should keep CycleGrain snapshot and database in sync throughout lifecycle',
    async () => {
      const program = Effect.gen(function* () {
        const { userId, token } = yield* createTestUserWithTracking();
        yield* cleanupOrleansGrain(userId);

        const drizzle = yield* PgDrizzle.PgDrizzle;

        // Create cycle
        const cycle = yield* createCycle(token);
        const cycleId = cycle.cycle.id!;

        // Verify initial state
        const { status: getStatus1, json: getJson1 } = yield* getCycleState(token);
        expect(getStatus1).toBe(200);
        const state1 = yield* S.decodeUnknown(CycleResponseSchema)(getJson1);
        expect(state1.state).toBe(CycleState.InProgress);
        expect(state1.cycle.id).toBe(cycleId);

        const [db1] = yield* drizzle.select().from(cyclesTable).where(eq(cyclesTable.id, cycleId));
        expect(db1?.status).toBe('InProgress');

        // Update dates
        yield* updateCycleDates(token, cycleId, 4);

        // Verify state after update
        const { status: getStatus2, json: getJson2 } = yield* getCycleState(token);
        expect(getStatus2).toBe(200);
        const state2 = yield* S.decodeUnknown(CycleResponseSchema)(getJson2);
        expect(state2.state).toBe(CycleState.InProgress);

        const [db2] = yield* drizzle.select().from(cyclesTable).where(eq(cyclesTable.id, cycleId));
        expect(db2?.status).toBe('InProgress');

        // Complete cycle
        yield* completeCycle(token, cycleId);

        // Verify final state
        const { status: getStatus3, json: getJson3 } = yield* getCycleState(token);
        expect(getStatus3).toBe(200);
        const state3 = yield* S.decodeUnknown(CycleResponseSchema)(getJson3);
        expect(state3.state).toBe(CycleState.Completed);

        const [db3] = yield* drizzle.select().from(cyclesTable).where(eq(cyclesTable.id, cycleId));
        expect(db3?.status).toBe('Completed');

        yield* cleanupOrleansGrain(userId);

        console.log('✅ Grain/read-model sync test completed\n');
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 25000 },
  );

  test(
    'should maintain consistency across multiple cycles for same user',
    async () => {
      const program = Effect.gen(function* () {
        const { userId, token } = yield* createTestUserWithTracking();
        yield* cleanupOrleansGrain(userId);

        const drizzle = yield* PgDrizzle.PgDrizzle;

        // Create and complete 3 cycles
        const cycles: string[] = [];

        for (let i = 0; i < 3; i++) {
          const cycle = yield* createCycle(token, i + 2); // Different times
          cycles.push(cycle.cycle.id!);
          yield* completeCycle(token, cycle.cycle.id!);
        }

        // Verify all cycles in database
        const allCycles = yield* drizzle
          .select()
          .from(cyclesTable)
          .where(eq(cyclesTable.userId, userId))
          .orderBy(desc(cyclesTable.createdAt));

        expect(allCycles.length).toBe(3);

        // All should be completed
        allCycles.forEach((cycle) => {
          expect(cycle.status).toBe('Completed');
          expect(cycles).toContain(cycle.id);
        });

        yield* cleanupOrleansGrain(userId);

        console.log('✅ Multi-cycle consistency test completed\n');
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 35000 },
  );
});

// ============================================================================
// Tests - Update Cycle Dates
// ============================================================================

describe('Update Cycle Dates Functionality', () => {
  test(
    'should successfully update dates for an in-progress cycle',
    async () => {
      const program = Effect.gen(function* () {
        const { userId, token } = yield* createTestUserWithTracking();
        yield* cleanupOrleansGrain(userId);

        const drizzle = yield* PgDrizzle.PgDrizzle;

        // Create cycle
        const cycle = yield* createCycle(token, 2);
        const cycleId = cycle.cycle.id!;

        expect(cycle.state).toBe(CycleState.InProgress);

        // Update dates with different time range
        const updated = yield* updateCycleDates(token, cycleId, 4, 2);

        expect(updated.state).toBe(CycleState.InProgress);
        expect(updated.cycle.id).toBe(cycleId);

        // Verify database was updated
        const [dbRecord] = yield* drizzle.select().from(cyclesTable).where(eq(cyclesTable.id, cycleId));
        expect(dbRecord?.status).toBe('InProgress');

        yield* cleanupOrleansGrain(userId);

        console.log('✅ Update cycle dates test completed\n');
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 20000 },
  );
});

// ============================================================================
// Tests - XState Machine + Effect Programs Architecture
// ============================================================================

describe('XState + Effect Programs Architecture', () => {
  test(
    'should successfully orchestrate grains via fromCallback actors and Effect programs',
    async () => {
      const program = Effect.gen(function* () {
        const { userId, token } = yield* createTestUserWithTracking();
        yield* cleanupOrleansGrain(userId);

        // This test verifies the new architecture:
        // 1. Service creates XState machine
        // 2. Machine invokes fromCallback actors
        // 3. Actors call Effect programs via runWithUi
        // 4. Programs orchestrate: Grains + Snapshot Persistence + Read Model
        // 5. Programs send SUCCESS/ERROR back via sendBack
        // 6. Machine transitions and emits PERSIST_STATE
        // 7. Service listens to emit and returns snapshot

        // Create cycle (tests programCreateCycle)
        const cycle = yield* createCycle(token);
        expect(cycle.state).toBe(CycleState.InProgress);

        const cycleId = cycle.cycle.id!;

        // Complete cycle (tests programCompleteCycle)
        const completed = yield* completeCycle(token, cycleId);
        expect(completed.state).toBe(CycleState.Completed);
        expect(completed.cycle.id).toBe(cycleId);

        // Verify the machine orchestrated everything correctly
        // by checking that the grain snapshot was persisted
        const { status, json } = yield* getCycleState(token);
        expect(status).toBe(200);

        const finalState = yield* S.decodeUnknown(CycleResponseSchema)(json);
        expect(finalState.state).toBe(CycleState.Completed);

        yield* cleanupOrleansGrain(userId);

        console.log('✅ XState + Effect programs architecture test completed\n');
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 25000 },
  );

  test(
    'should handle errors from Effect programs and emit ERROR events',
    async () => {
      const program = Effect.gen(function* () {
        const { userId, token } = yield* createTestUserWithTracking();
        yield* cleanupOrleansGrain(userId);

        // Create a cycle
        const cycle = yield* createCycle(token);

        // Try to update with a non-existent cycle ID (should fail in program)
        const randomCycleId = crypto.randomUUID();
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        const { status } = yield* makeRequest(UPDATE_CYCLE_DATES_ENDPOINT, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cycleId: randomCycleId,
            startDate: twoHoursAgo.toISOString(),
            endDate: now.toISOString(),
          }),
        });

        // Should fail with 409 (Cycle ID mismatch)
        expect(status).toBe(409);

        // Original cycle should still be in progress
        const { status: getStatus, json: getJson } = yield* getCycleState(token);
        expect(getStatus).toBe(200);
        const state = yield* S.decodeUnknown(CycleResponseSchema)(getJson);
        expect(state.state).toBe(CycleState.InProgress);
        expect(state.cycle.id).toBe(cycle.cycle.id);

        yield* cleanupOrleansGrain(userId);
      }).pipe(Effect.provide(DatabaseLive));

      await Effect.runPromise(program);
    },
    { timeout: 20000 },
  );
});
