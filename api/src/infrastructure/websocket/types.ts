import type { ServerWebSocket } from "bun";

/**
 * Tipos de eventos que se pueden enviar a través de WebSocket
 */
export type CycleEventType =
  | "cycle:created"
  | "cycle:updated"
  | "cycle:completed";

/**
 * Tipos de mensajes del sistema
 */
export type SystemEventType =
  | "ping"
  | "pong"
  | "connected"
  | "error";

/**
 * Todos los tipos de eventos posibles
 */
export type WebSocketEventType = CycleEventType | SystemEventType;

/**
 * Payload de eventos de ciclo
 */
export interface CycleEventPayload {
  userId: string;
  state: string;
  cycle: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    createdAt?: string;
    completedAt?: string | null;
  };
}

/**
 * Estructura de mensaje WebSocket (Servidor → Cliente)
 */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  payload?: T;
  timestamp: string;
  error?: string;
}

/**
 * Estructura de mensaje entrante (Cliente → Servidor)
 */
export interface IncomingWebSocketMessage {
  type: SystemEventType;
  payload?: unknown;
}

/**
 * Metadata de la conexión WebSocket
 */
export interface WebSocketConnectionData {
  userId: string;
  connectedAt: Date;
  lastPing?: Date;
}

/**
 * Tipo extendido de ServerWebSocket con data personalizada
 */
export type AppWebSocket = ServerWebSocket<WebSocketConnectionData>;

/**
 * Opciones para broadcasting de eventos
 */
export interface BroadcastOptions {
  excludeSocket?: AppWebSocket;
}
