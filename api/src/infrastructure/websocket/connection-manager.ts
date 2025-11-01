import type {
  AppWebSocket,
  WebSocketMessage,
  BroadcastOptions,
} from "./types";

/**
 * Gestiona todas las conexiones WebSocket activas organizadas por userId
 */
export class ConnectionManager {
  // Map de userId a Set de WebSockets
  private connections: Map<string, Set<AppWebSocket>> = new Map();

  /**
   * Agrega una nueva conexión para un usuario
   */
  addConnection(userId: string, socket: AppWebSocket): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    const userConnections = this.connections.get(userId)!;
    userConnections.add(socket);

    console.log(
      `[ConnectionManager] User ${userId} connected. Total connections: ${userConnections.size}`
    );
  }

  /**
   * Remueve una conexión de un usuario
   */
  removeConnection(userId: string, socket: AppWebSocket): void {
    const userConnections = this.connections.get(userId);

    if (userConnections) {
      userConnections.delete(socket);

      console.log(
        `[ConnectionManager] User ${userId} disconnected. Remaining connections: ${userConnections.size}`
      );

      // Si no quedan conexiones, eliminar el entry del Map
      if (userConnections.size === 0) {
        this.connections.delete(userId);
        console.log(`[ConnectionManager] User ${userId} has no more connections`);
      }
    }
  }

  /**
   * Obtiene todas las conexiones de un usuario
   */
  getConnections(userId: string): Set<AppWebSocket> | undefined {
    return this.connections.get(userId);
  }

  /**
   * Verifica si un usuario tiene conexiones activas
   */
  hasConnections(userId: string): boolean {
    const connections = this.connections.get(userId);
    return connections !== undefined && connections.size > 0;
  }

  /**
   * Obtiene el número de conexiones activas de un usuario
   */
  getConnectionCount(userId: string): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  /**
   * Obtiene el número total de conexiones activas
   */
  getTotalConnections(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.size;
    }
    return total;
  }

  /**
   * Obtiene el número total de usuarios conectados
   */
  getTotalUsers(): number {
    return this.connections.size;
  }

  /**
   * Envía un mensaje a todas las conexiones de un usuario
   */
  broadcast<T>(
    userId: string,
    message: WebSocketMessage<T>,
    options?: BroadcastOptions
  ): void {
    const userConnections = this.connections.get(userId);

    if (!userConnections || userConnections.size === 0) {
      console.log(
        `[ConnectionManager] No connections found for user ${userId}. Skipping broadcast.`
      );
      return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const socket of userConnections) {
      // Skip si es el socket excluido
      if (options?.excludeSocket && socket === options.excludeSocket) {
        continue;
      }

      try {
        socket.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error(
          `[ConnectionManager] Error sending message to socket:`,
          error
        );
        // Remover socket si hay error
        this.removeConnection(userId, socket);
      }
    }

    console.log(
      `[ConnectionManager] Broadcast to user ${userId}: ${sentCount}/${userConnections.size} connections`
    );
  }

  /**
   * Envía un mensaje a una conexión específica
   */
  send<T>(socket: AppWebSocket, message: WebSocketMessage<T>): void {
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[ConnectionManager] Error sending message:`, error);
      // Obtener userId del socket data y remover
      const userId = socket.data.userId;
      this.removeConnection(userId, socket);
    }
  }

  /**
   * Cierra todas las conexiones de un usuario
   */
  closeUserConnections(userId: string, reason?: string): void {
    const userConnections = this.connections.get(userId);

    if (userConnections) {
      for (const socket of userConnections) {
        socket.close(1000, reason);
      }
      this.connections.delete(userId);
      console.log(`[ConnectionManager] Closed all connections for user ${userId}`);
    }
  }

  /**
   * Cierra todas las conexiones
   */
  closeAll(reason?: string): void {
    for (const [userId, connections] of this.connections.entries()) {
      for (const socket of connections) {
        socket.close(1000, reason);
      }
    }
    this.connections.clear();
    console.log(`[ConnectionManager] All connections closed`);
  }

  /**
   * Obtiene estadísticas de conexiones
   */
  getStats() {
    const stats = {
      totalUsers: this.getTotalUsers(),
      totalConnections: this.getTotalConnections(),
      usersWithMultipleConnections: 0,
      connectionsByUser: {} as Record<string, number>,
    };

    for (const [userId, connections] of this.connections.entries()) {
      const count = connections.size;
      stats.connectionsByUser[userId] = count;
      if (count > 1) {
        stats.usersWithMultipleConnections++;
      }
    }

    return stats;
  }
}

// Instancia singleton del ConnectionManager
export const connectionManager = new ConnectionManager();
