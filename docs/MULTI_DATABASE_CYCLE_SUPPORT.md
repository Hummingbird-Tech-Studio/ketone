# Multi-Database Support for Cycle Feature

This document describes the multi-database architecture implemented for the Cycle feature, allowing performance comparison between different database backends.

## Overview

The Cycle feature now supports multiple database implementations while maintaining a single, consistent interface. This hybrid architecture allows you to:

- **Compare performance** between different databases using the same business logic
- **Switch databases** via environment variable
- **Maintain consistency** through shared interface and tests

### Hybrid Architecture

```
┌─────────────────────────────────────┐
│     Application Layer               │
│  (Services, API Handlers)           │
└─────────────────────────────────────┘
           │              │
           ▼              ▼
    ┌──────────┐   ┌──────────────┐
    │  Users   │   │   Cycles     │
    │  (Auth)  │   │ (Configurable)│
    └──────────┘   └──────────────┘
           │              │
           ▼              ▼
     ┌──────────┐   ┌──────────────┐
     │ Postgres │   │ Postgres OR  │
     │ (Always) │   │ LMDB OR Redis│
     └──────────┘   └──────────────┘
```

- **Users**: Always stored in Postgres (authentication, sessions)
- **Cycles**: Configurable database backend (Postgres, LMDB, or Redis)

## Supported Databases

### 1. Postgres (Default)

**Status**: ✅ Fully Implemented

- Uses Drizzle ORM with Effect-SQL
- Full ACID transactions
- Partial unique index for "one active cycle" constraint
- Production-ready with Neon serverless Postgres

### 2. LMDB (Lightning Memory-Mapped Database)

**Status**: ✅ Fully Implemented

- High-performance key-value store
- ACID transactions with transactionSync
- On-disk persistence with memory-mapped I/O
- Ordered keys for efficient range queries

**Key Design**:
```
cycle:{cycleId}                                    → Full cycle data
user:{userId}:active                               → Active cycle ID
user:{userId}:completed:{reverseTimestamp}:{cycleId} → Completed cycles index
```

### 3. Redis

**Status**: 🚧 Planned (Not Yet Implemented)

## Configuration

### Environment Variable

Set the `CYCLE_DATABASE_PROVIDER` environment variable:

```bash
# Use Postgres (default)
export CYCLE_DATABASE_PROVIDER=postgres

# Use LMDB
export CYCLE_DATABASE_PROVIDER=lmdb

# Use Redis (when implemented)
export CYCLE_DATABASE_PROVIDER=redis
```

### LMDB Configuration

LMDB stores data in the `.lmdb` directory by default. You can customize this:

```bash
# Custom LMDB path
export LMDB_PATH=/path/to/lmdb/data
```

**Default settings**:
- Max database size: 10 GB
- Compression: Enabled
- Encoding: msgpack

## Usage

### Running the Server

```bash
# With Postgres (default)
bun run dev:api

# With LMDB
CYCLE_DATABASE_PROVIDER=lmdb bun run dev:api
```

### Running Tests

All integration tests work with both databases:

```bash
# Test with Postgres
CYCLE_DATABASE_PROVIDER=postgres bun test src/features/cycle-v1/api/__tests__/cycle-v1.integration.test.ts

# Test with LMDB
CYCLE_DATABASE_PROVIDER=lmdb bun test src/features/cycle-v1/api/__tests__/cycle-v1.integration.test.ts
```

**Test Results**:
- ✅ Postgres: 77/77 tests passing
- ✅ LMDB: 77/77 tests passing

### Performance Benchmarking

Use the built-in benchmark scripts to compare performance:

```bash
# Run Postgres benchmark only
bun run benchmark:cycles:postgres

# Run LMDB benchmark only
bun run benchmark:cycles:lmdb

# Run both and compare
bun run benchmark:cycles:compare
```

**Benchmark Test Structure**:
1. **Phase 1**: Create 500 concurrent users (Sign Up)
2. **Phase 2**: Execute cycle operations for all users
   - Create cycle
   - Update cycle dates
   - Complete cycle

**Metrics Tracked**:
- Total execution time
- Requests per second (RPS)
- Success/failure rates
- Time distribution by phase

## Architecture Details

### Repository Interface

All database implementations conform to `ICycleRepository`:

```typescript
interface ICycleRepository {
  getCycleById(userId: string, cycleId: string): Effect<Option<CycleRecord>, Error>;
  getActiveCycle(userId: string): Effect<Option<CycleRecord>, Error>;
  getLastCompletedCycle(userId: string): Effect<Option<CycleRecord>, Error>;
  createCycle(data: CycleData): Effect<CycleRecord, Error>;
  updateCycleDates(userId: string, cycleId: string, startDate: Date, endDate: Date): Effect<CycleRecord, Error>;
  completeCycle(userId: string, cycleId: string, startDate: Date, endDate: Date): Effect<CycleRecord, Error>;
}
```

### Business Rules Enforcement

All implementations enforce the same business rules:

1. **One Active Cycle**: Users can only have ONE cycle with status "InProgress" at a time
2. **No Overlap**: New cycles cannot start before the last completed cycle ended
3. **State Transitions**: Only InProgress cycles can be updated or completed
4. **Data Validation**: All data is validated using Effect Schema

### Error Handling

Consistent error types across all implementations:

- `CycleRepositoryError`: Database/technical errors
- `CycleAlreadyInProgressError`: Attempt to create second active cycle
- `CycleInvalidStateError`: Invalid state transition
- `CycleNotFoundError`: Cycle not found
- `CycleOverlapError`: Cycle overlaps with previous cycle

## Implementation Files

### Core Files

- **Interface**: `api/src/features/cycle-v1/repositories/cycle.repository.interface.ts`
- **Postgres Implementation**: `api/src/features/cycle-v1/repositories/cycle.repository.postgres.ts`
- **LMDB Implementation**: `api/src/features/cycle-v1/repositories/cycle.repository.lmdb.ts`
- **Factory**: `api/src/features/cycle-v1/repositories/index.ts`
- **Configuration**: `api/src/config/database-config.ts`

### Database Providers

- **LMDB Connection**: `api/src/db/providers/lmdb/connection.ts`
- **LMDB Schema**: `api/src/db/providers/lmdb/schema.ts`

### Tests

- **Integration Tests**: `api/src/features/cycle-v1/api/__tests__/cycle-v1.integration.test.ts`
- **Stress Test**: `api/src/tests/cycle-stress-test.ts`

## Adding a New Database Implementation

To add a new database (e.g., Redis):

1. **Create Connection Layer**
   ```
   api/src/db/providers/redis/connection.ts
   api/src/db/providers/redis/schema.ts
   ```

2. **Implement Repository**
   ```typescript
   // api/src/features/cycle-v1/repositories/cycle.repository.redis.ts
   export class CycleRepositoryRedis implements ICycleRepository {
     // Implement all interface methods
   }
   ```

3. **Update Factory**
   ```typescript
   // api/src/features/cycle-v1/repositories/index.ts
   case CycleDatabaseProviders.REDIS:
     return CycleRepositoryRedis.Default;
   ```

4. **Update Configuration**
   ```typescript
   // api/src/config/database-config.ts
   export const CycleDatabaseProviders = {
     POSTGRES: 'postgres',
     LMDB: 'lmdb',
     REDIS: 'redis', // Add new provider
   } as const;
   ```

5. **Update Main Index**
   ```typescript
   // api/src/index.ts
   const DatabaseLayersLive =
     config.cycleDatabaseProvider === CycleDatabaseProviders.LMDB
       ? Layer.mergeAll(DatabaseLive, LmdbLive)
       : config.cycleDatabaseProvider === CycleDatabaseProviders.REDIS
         ? Layer.mergeAll(DatabaseLive, RedisLive) // Add new layer
         : DatabaseLive;
   ```

6. **Run Tests**
   ```bash
   CYCLE_DATABASE_PROVIDER=redis bun test src/features/cycle-v1/api/__tests__/cycle-v1.integration.test.ts
   ```

## Troubleshooting

### LMDB Data Directory

If you encounter LMDB errors:

```bash
# Clear LMDB data
rm -rf api/.lmdb

# Or specify different path
export LMDB_PATH=/tmp/lmdb-test
```

### Database Not Switching

Verify the environment variable is set:

```bash
# Check current configuration
CYCLE_DATABASE_PROVIDER=lmdb bun run dev:api
# Look for: "🗄️ Cycle Database Provider: LMDB"
```

### Integration Test Failures

If tests fail after switching databases:

1. Verify all 77 tests pass with Postgres first
2. Clean up test data: `bun run db:cleanup-test-data`
3. Check database connection logs
4. Review error messages for database-specific issues

## Performance Considerations

### Postgres

**Pros**:
- Mature, battle-tested
- Rich query capabilities
- Strong consistency guarantees
- Excellent for complex queries

**Cons**:
- Network latency (even with connection pooling)
- More resource intensive
- Query planning overhead

### LMDB

**Pros**:
- Extremely fast reads/writes (memory-mapped)
- No network latency
- Low memory footprint
- Ordered keys for range queries

**Cons**:
- Limited to single-server (no distributed setup)
- Manual index management
- Less query flexibility
- Requires careful key design

## Future Enhancements

- [ ] Redis implementation
- [ ] Automated benchmark comparison reports
- [ ] Grafana dashboard for performance metrics
- [ ] Support for Redis Cluster
- [ ] Multi-database read/write strategies
