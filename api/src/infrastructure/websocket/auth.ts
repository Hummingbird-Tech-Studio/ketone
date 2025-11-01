import { Effect } from "effect";
import { JwtService } from '../../features/auth/services';
import { UserAuthClient } from "../../features/auth/infrastructure/user-auth-client";

/**
 * Error cuando la autenticación WebSocket falla
 */
export class WebSocketAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebSocketAuthError";
  }
}

/**
 * Payload de usuario autenticado para WebSocket
 */
export interface AuthenticatedWebSocketUser {
  userId: string;
  email: string;
}

/**
 * Verifica y valida un token JWT para conexiones WebSocket
 */
export const authenticateWebSocketToken = (
  token: string
): Effect.Effect<
  AuthenticatedWebSocketUser,
  WebSocketAuthError,
  JwtService | UserAuthClient
> =>
  Effect.gen(function* () {
    const jwtService = yield* JwtService;
    const userAuthClient = yield* UserAuthClient;

    // Step 1: Verify JWT token
    const payload = yield* jwtService.verifyToken(token).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning(
            "[WebSocket Auth] Token verification failed",
            error
          );
          return yield* Effect.fail(
            new WebSocketAuthError("Invalid or expired token")
          );
        })
      )
    );

    yield* Effect.logInfo(
      `[WebSocket Auth] Token verified for user ${payload.userId}`
    );

    // Step 2: Validate token hasn't been invalidated (e.g., password change)
    const isTokenValid = yield* userAuthClient
      .validateToken(payload.userId, payload.iat)
      .pipe(
        Effect.catchAll((error) =>
          // If Orleans is unavailable, log warning but allow the connection
          Effect.logWarning(
            `[WebSocket Auth] Failed to validate token via Orleans, allowing connection: ${error}`
          ).pipe(Effect.as(true))
        )
      );

    if (!isTokenValid) {
      yield* Effect.logWarning(
        `[WebSocket Auth] Token invalidated due to password change for user ${payload.userId}`
      );
      return yield* Effect.fail(
        new WebSocketAuthError("Token invalidated due to password change")
      );
    }

    yield* Effect.logInfo(
      `[WebSocket Auth] ✅ Authentication successful for user ${payload.userId}`
    );

    return {
      userId: payload.userId,
      email: payload.email,
    };
  });

/**
 * Extrae el token JWT de los query params de la URL del WebSocket
 * Formato esperado: ws://host/path?token=<jwt>
 */
export const extractTokenFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url, "http://localhost"); // Base URL no importa para parsing
    return urlObj.searchParams.get("token");
  } catch {
    return null;
  }
};
