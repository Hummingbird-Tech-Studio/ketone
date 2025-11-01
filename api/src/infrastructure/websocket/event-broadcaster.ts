import { Context, Effect, Layer } from "effect";
import { connectionManager } from "./connection-manager";
import type {
  CycleEventType,
  CycleEventPayload,
  WebSocketMessage,
} from "./types";

/**
 * Interfaz del servicio EventBroadcaster
 */
export interface EventBroadcasterService {
  broadcastCycleEvent: (
    userId: string,
    eventType: CycleEventType,
    payload: CycleEventPayload
  ) => Effect.Effect<void>;
}

/**
 * Tag para el servicio EventBroadcaster
 */
export class EventBroadcaster extends Context.Tag("EventBroadcaster")<
  EventBroadcaster,
  EventBroadcasterService
>() {
  /**
   * Layer que proporciona la implementación del EventBroadcaster
   */
  static readonly Live = Layer.succeed(
    EventBroadcaster,
    EventBroadcaster.of({
      broadcastCycleEvent: (userId, eventType, payload) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `[EventBroadcaster] Broadcasting ${eventType} to user ${userId}`
          );

          // Verificar si el usuario tiene conexiones activas
          const hasConnections = connectionManager.hasConnections(userId);

          if (!hasConnections) {
            yield* Effect.logInfo(
              `[EventBroadcaster] User ${userId} has no active connections, skipping broadcast`
            );
            return;
          }

          // Crear mensaje WebSocket
          const message: WebSocketMessage<CycleEventPayload> = {
            type: eventType,
            payload,
            timestamp: new Date().toISOString(),
          };

          // Broadcast a través del ConnectionManager
          yield* Effect.sync(() => {
            connectionManager.broadcast(userId, message);
          });

          const connectionCount = connectionManager.getConnectionCount(userId);
          yield* Effect.logInfo(
            `[EventBroadcaster] ✅ Event ${eventType} broadcasted to ${connectionCount} connections`
          );
        }),
    })
  );
}
