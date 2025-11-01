import type { ServerWebSocket } from "bun";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "@effect/platform";
import { connectionManager } from "./connection-manager";
import {
  authenticateWebSocketToken,
  extractTokenFromUrl,
  WebSocketAuthError,
} from "./auth";
import { JwtService } from '../../features/auth/services';
import { UserAuthClient } from "../../features/auth/infrastructure/user-auth-client";
import type {
  AppWebSocket,
  IncomingWebSocketMessage,
  WebSocketMessage,
  WebSocketConnectionData,
} from "./types";

/**
 * Layer de autenticación para WebSocket
 */
const AuthLayer = Layer.mergeAll(
  JwtService.Default,
  UserAuthClient.Default.pipe(Layer.provide(FetchHttpClient.layer))
);

/**
 * Handlers para WebSocket usando Bun
 */
export const createWebSocketHandlers = () => {
  return {
    /**
     * Handler cuando se abre una nueva conexión WebSocket
     */
    open: (ws: ServerWebSocket<WebSocketConnectionData>) => {
      const appWs = ws as AppWebSocket;
      const { userId } = appWs.data;

      console.log(`[WebSocket] Connection opened for user ${userId}`);

      // Registrar conexión en el ConnectionManager
      connectionManager.addConnection(userId, appWs);

      // Enviar mensaje de confirmación de conexión
      const welcomeMessage: WebSocketMessage = {
        type: "connected",
        payload: {
          userId,
          message: "WebSocket connection established",
        },
        timestamp: new Date().toISOString(),
      };

      connectionManager.send(appWs, welcomeMessage);

      console.log(
        `[WebSocket] User ${userId} connected. Total connections: ${connectionManager.getConnectionCount(
          userId
        )}`
      );
    },

    /**
     * Handler cuando se recibe un mensaje del cliente
     */
    message: (
      ws: ServerWebSocket<WebSocketConnectionData>,
      message: string | Buffer
    ) => {
      const appWs = ws as AppWebSocket;
      const { userId } = appWs.data;

      try {
        const messageStr =
          typeof message === "string" ? message : message.toString();
        const parsed = JSON.parse(messageStr) as IncomingWebSocketMessage;

        console.log(`[WebSocket] Message from user ${userId}:`, parsed.type);

        // Manejar diferentes tipos de mensajes
        switch (parsed.type) {
          case "ping":
            // Responder con pong
            const pongMessage: WebSocketMessage = {
              type: "pong",
              timestamp: new Date().toISOString(),
            };
            connectionManager.send(appWs, pongMessage);
            // Actualizar lastPing
            appWs.data.lastPing = new Date();
            break;

          default:
            console.log(
              `[WebSocket] Unknown message type from user ${userId}: ${parsed.type}`
            );
        }
      } catch (error) {
        console.error(
          `[WebSocket] Error parsing message from user ${userId}:`,
          error
        );
        const errorMessage: WebSocketMessage = {
          type: "error",
          error: "Invalid message format",
          timestamp: new Date().toISOString(),
        };
        connectionManager.send(appWs, errorMessage);
      }
    },

    /**
     * Handler cuando se cierra una conexión
     */
    close: (
      ws: ServerWebSocket<WebSocketConnectionData>,
      code: number,
      reason: string
    ) => {
      const appWs = ws as AppWebSocket;
      const { userId } = appWs.data;

      console.log(
        `[WebSocket] Connection closed for user ${userId}. Code: ${code}, Reason: ${reason}`
      );

      // Remover conexión del ConnectionManager
      connectionManager.removeConnection(userId, appWs);

      console.log(
        `[WebSocket] User ${userId} disconnected. Remaining connections: ${connectionManager.getConnectionCount(
          userId
        )}`
      );
    },


    /**
     * Handler para el upgrade inicial de HTTP a WebSocket
     * Aquí se realiza la autenticación
     */
    upgrade: async (req: Request, server: any): Promise<boolean> => {
      const url = req.url;

      console.log(`[WebSocket] Upgrade request from ${url}`);

      // Extraer token de query params
      const token = extractTokenFromUrl(url);

      if (!token) {
        console.warn("[WebSocket] No token provided in upgrade request");
        return false;
      }

      // Autenticar token usando Effect
      const authResult = await Effect.runPromise(
        authenticateWebSocketToken(token).pipe(
          Effect.provide(AuthLayer),
          Effect.either
        )
      );

      if (authResult._tag === "Left") {
        const error = authResult.left as WebSocketAuthError;
        console.warn(`[WebSocket] Authentication failed: ${error.message}`);
        return false;
      }

      const user = authResult.right;

      console.log(
        `[WebSocket] Authentication successful for user ${user.userId}`
      );

      // Upgrade a WebSocket con data del usuario
      const success = server.upgrade(req, {
        data: {
          userId: user.userId,
          connectedAt: new Date(),
        } as WebSocketConnectionData,
      });

      if (success) {
        console.log(`[WebSocket] Successfully upgraded connection for user ${user.userId}`);
      } else {
        console.warn(`[WebSocket] Failed to upgrade connection for user ${user.userId}`);
      }

      return success;
    },
  };
};

/**
 * Verifica si una request es un upgrade request de WebSocket
 */
export const isWebSocketUpgrade = (req: Request): boolean => {
  const upgrade = req.headers.get("upgrade");
  return upgrade?.toLowerCase() === "websocket";
};

/**
 * Inicia heartbeat para mantener conexiones vivas
 * Envía ping periódicamente y cierra conexiones inactivas
 */
export const startHeartbeat = (intervalMs: number = 30000) => {
  return setInterval(() => {
    const stats = connectionManager.getStats();
    console.log(
      `[WebSocket Heartbeat] Active users: ${stats.totalUsers}, Active connections: ${stats.totalConnections}`
    );

    // TODO: Implementar lógica de timeout para conexiones inactivas
    // Por ahora solo logeamos las estadísticas
  }, intervalMs);
};
