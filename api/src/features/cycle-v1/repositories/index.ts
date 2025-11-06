import { Layer } from 'effect';
import { CycleRepositoryRedis } from './cycle.repository.redis';
import { RedisLive } from '../../../db/providers/redis/connection';

// Export types and interfaces
export * from './cycle.repository.interface';
export * from './errors';
export * from './schemas';

// Export concrete implementations
export { CycleRepositoryPostgres } from './cycle.repository.postgres';
export { CycleRepositoryRedis } from './cycle.repository.redis';

/**
 * CycleRepository - Fixed Redis implementation
 *
 * The application uses Redis for all cycle business logic.
 * Redis implementation uses Lua scripts for atomic operations to prevent race conditions.
 *
 * All implementations share the same service tag 'CycleRepository' to allow
 * interchangeable use in tests.
 */
export { CycleRepositoryRedis as CycleRepository } from './cycle.repository.redis';

/**
 * CycleRepository Live Layer with all dependencies
 *
 * Provides the Redis-based CycleRepository with its RedisLive dependency already composed.
 * This is the recommended way to use CycleRepository in your application.
 *
 * Dependencies provided:
 * - RedisLive (Redis connection)
 */
export const CycleRepositoryLive = CycleRepositoryRedis.Default.pipe(
  Layer.provide(RedisLive)
);
