import { FetchHttpClient, HttpApiBuilder, HttpServer } from '@effect/platform';
import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { Layer } from 'effect';
import { Api } from './api';
import { DatabaseLive } from './db';
import { AuthServiceLive } from './features/auth/services';
import { AuthenticationLive } from './features/auth/api/middleware';
import { OrleansClient } from './features/cycle/infrastructure';
import { CycleOrleansService } from './features/cycle/services/cycle-orleans.service';
import { CycleApiLive } from './features/cycle/api/cycle-api-handler';
import { AuthApiLive } from './features/auth/api/auth-api-handler';
import { EventBroadcaster } from './infrastructure/websocket';
import { createWebSocketHandlers, startHeartbeat } from './infrastructure/websocket';

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
const HandlersLive = Layer.mergeAll(CycleApiLive, AuthApiLive);

// Combine API with handlers
const ApiLive = HttpApiBuilder.api(Api).pipe(Layer.provide(HandlersLive));

// Provide EventBroadcaster to CycleOrleansService
const CycleOrleansServiceLive = CycleOrleansService.Default.pipe(
  Layer.provide(EventBroadcaster.Live)
);

const HttpLive = HttpApiBuilder.serve().pipe(
  // Add CORS middleware
  Layer.provide(HttpApiBuilder.middlewareCors()),
  // Provide unified API
  Layer.provide(ApiLive),
  // Provide middleware and services
  Layer.provide(AuthenticationLive),
  Layer.provide(CycleOrleansServiceLive),
  Layer.provide(OrleansClient.Default),
  Layer.provide(AuthServiceLive),
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
// WebSocket Server (Parallel)
// ============================================================================

/**
 * Start WebSocket server on a different port
 * This runs in parallel with the HTTP server
 */
const startWebSocketServer = () => {
  const wsHandlers = createWebSocketHandlers();

  const wsServer = Bun.serve({
    port: 3001, // Different port for WebSocket

    fetch: async (req, server) => {
      const upgrade = req.headers.get('upgrade');
      if (upgrade?.toLowerCase() === 'websocket') {
        const upgraded = await wsHandlers.upgrade(req, server);
        if (upgraded) {
          return undefined;
        }
        return new Response('WebSocket authentication failed', { status: 401 });
      }

      return new Response('WebSocket endpoint only', { status: 400 });
    },

    websocket: {
      open: wsHandlers.open,
      message: wsHandlers.message,
      close: wsHandlers.close,
    },
  });

  console.log(`✅ WebSocket server running on ws://localhost:${wsServer.port}`);
  console.log(`   Connect with: ws://localhost:${wsServer.port}?token=<JWT>`);

  // Start heartbeat
  startHeartbeat(30000);

  return wsServer;
};

// ============================================================================
// Application Startup
// ============================================================================

// Start WebSocket server first
startWebSocketServer();

// Start Effect HTTP Server (port 3000)
console.log('🚀 Starting Effect HTTP Server...');
Layer.launch(HttpLive).pipe(BunRuntime.runMain);
