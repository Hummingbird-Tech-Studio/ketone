import { FetchHttpClient, HttpApiBuilder, HttpServer } from '@effect/platform';
import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { Effect, Layer } from 'effect';
import { Api } from './api';
import { DatabaseLive } from './db';
import { AuthServiceLive } from './features/auth/services';
import { AuthenticationLive } from './features/auth/api/middleware';
import { UserAuthCacheLive } from './features/auth/services';
import { CycleApiLive as CycleV2ApiLive } from './features/cycle-v1/api/cycle-api-handler';
import { CycleService, CycleCompletionCache } from './features/cycle-v1';
import { CycleRepository } from './features/cycle-v1/repositories';
import { RedisLive } from './db/providers/redis/connection';
import { AuthApiLive } from './features/auth/api/auth-api-handler';

// ============================================================================
// Effect HTTP Server (Public API)
// ============================================================================

/**
 * HTTP Server Layer Configuration
 *
 * Combine all API groups into a single unified API, then provide handlers.
 * This ensures proper error metadata preservation for all endpoints.
 */

// Combine handlers
const HandlersLive = Layer.mergeAll(CycleV2ApiLive, AuthApiLive);

// Combine API with handlers
const ApiLive = HttpApiBuilder.api(Api).pipe(Layer.provide(HandlersLive));

const HttpLive = HttpApiBuilder.serve().pipe(
  // Add CORS middleware
  Layer.provide(HttpApiBuilder.middlewareCors()),
  // Provide unified API
  Layer.provide(ApiLive),
  // Provide middleware and services
  Layer.provide(AuthenticationLive),
  Layer.provide(AuthServiceLive),
  Layer.provide(UserAuthCacheLive),
  // Cycle services: must provide in dependency order (services -> repository -> connection)
  Layer.provide(CycleService.Default),
  Layer.provide(CycleCompletionCache.Default),
  Layer.provide(CycleRepository.Default),
  Layer.provide(RedisLive),
  // Database layer: Postgres for auth
  Layer.provide(DatabaseLive),
  Layer.provide(FetchHttpClient.layer),
  HttpServer.withLogAddress,
  Layer.provide(
    BunHttpServer.layer({
      port: 3000,
    }),
  ),
);

// ============================================================================
// Application Startup
// ============================================================================

// Start Effect HTTP Server (port 3000)
console.log('🚀 Starting Effect HTTP Server...');
BunRuntime.runMain(Effect.scoped(Layer.launch(HttpLive)));
