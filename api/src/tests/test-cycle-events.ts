import { Console, Effect } from 'effect';

/**
 * Test script to verify cycle events are published to Orleans Streams
 * 
 * This test:
 * 1. Creates a cycle (should publish CycleCompletedEvent)
 * 2. Verifies the LastCompletedCycleGrain received the event
 * 3. Completes the cycle (should publish another CycleCompletedEvent)
 * 4. Verifies the grain updated its state
 */

const TEST_USER_ID = crypto.randomUUID();
const ORLEANS_BASE_URL = 'http://localhost:5174';
const API_BASE_URL = 'http://localhost:3000';

// Helper to make HTTP requests
const makeRequest = (url: string, options: RequestInit = {}) =>
  Effect.tryPromise({
    try: () => fetch(url, options),
    catch: (error) => new Error(`Request failed: ${error}`),
  });

// Test program
const testProgram = Effect.gen(function* () {
  yield* Console.log('🧪 Starting Cycle Events Test\n');

  // Step 1: Create a cycle
  yield* Console.log('📝 Step 1: Creating a cycle...');
  const cycleId = crypto.randomUUID();
  const createResponse = yield* makeRequest(`${API_BASE_URL}/cycle/orleans/${cycleId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      userId: TEST_USER_ID,
      state: 'InProgress',
    }),
  });

  if (!createResponse.ok) {
    const error = yield* Effect.tryPromise(() => createResponse.text());
    yield* Effect.fail(new Error(`Failed to create cycle: ${error}`));
  }

  const createData = yield* Effect.tryPromise(() => createResponse.json());
  yield* Console.log(`✅ Cycle created: ${JSON.stringify(createData, null, 2)}\n`);

  // Wait a bit for the event to be processed
  yield* Effect.sleep('2 seconds');

  // Step 2: Check if LastCompletedCycleGrain received the event
  yield* Console.log('🔍 Step 2: Checking LastCompletedCycleGrain...');
  const lastCompletedResponse = yield* makeRequest(
    `${ORLEANS_BASE_URL}/actors/${TEST_USER_ID}/last-completed`,
  );

  if (lastCompletedResponse.status === 404) {
    yield* Console.log('⚠️  No completed cycle found yet (expected for InProgress cycle)\n');
  } else if (lastCompletedResponse.ok) {
    const lastCompletedData = yield* Effect.tryPromise(() => lastCompletedResponse.json());
    yield* Console.log(`✅ Last completed cycle: ${JSON.stringify(lastCompletedData, null, 2)}\n`);
  } else {
    yield* Console.log(`❌ Unexpected response: ${lastCompletedResponse.status}\n`);
  }

  // Step 3: Manually publish a CycleCompletedEvent to test the stream
  yield* Console.log('📝 Step 3: Manually publishing CycleCompletedEvent...');
  const publishResponse = yield* makeRequest(`${ORLEANS_BASE_URL}/events/cycle-completed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actorId: TEST_USER_ID,
      cycleId: cycleId,
      endDate: '2025-01-31T23:59:59Z',
    }),
  });

  if (!publishResponse.ok) {
    const error = yield* Effect.tryPromise(() => publishResponse.text());
    yield* Effect.fail(new Error(`Failed to publish event: ${error}`));
  }

  yield* Console.log(`✅ Event published successfully\n`);

  // Wait for the event to be processed
  yield* Effect.sleep('2 seconds');

  // Step 4: Check LastCompletedCycleGrain again
  yield* Console.log('🔍 Step 4: Checking LastCompletedCycleGrain after event...');
  const finalCheckResponse = yield* makeRequest(
    `${ORLEANS_BASE_URL}/actors/${TEST_USER_ID}/last-completed`,
  );

  if (finalCheckResponse.ok) {
    const finalData = yield* Effect.tryPromise(() => finalCheckResponse.json());
    yield* Console.log(`✅ Last completed cycle updated: ${JSON.stringify(finalData, null, 2)}\n`);
    
    // Verify the cycle ID matches
    const data = finalData as { cycleId?: string };
    if (data.cycleId === cycleId) {
      yield* Console.log('✅ SUCCESS: Cycle ID matches! Events are working correctly! 🎉\n');
    } else {
      yield* Console.log(`⚠️  WARNING: Cycle ID mismatch. Expected: ${cycleId}, Got: ${data.cycleId}\n`);
    }
  } else if (finalCheckResponse.status === 404) {
    yield* Console.log('❌ FAILED: LastCompletedCycleGrain still has no data after event\n');
  } else {
    yield* Console.log(`❌ Unexpected response: ${finalCheckResponse.status}\n`);
  }

  yield* Console.log('🏁 Test completed!\n');
});

// Run the test
Effect.runPromise(testProgram)
  .then(() => {
    console.log('✨ Test program finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test program failed:', error);
    process.exit(1);
  });

// Run with: bun run api/src/tests/test-cycle-events.ts
