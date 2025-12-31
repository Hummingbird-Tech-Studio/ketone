import { API_BASE_URL, HttpClientLive } from '@/services/http/http-client.service';
import { createSignInProgram, InvalidCredentialsError, type SignInServiceSuccess } from '@ketone/shared';
import { Effect } from 'effect';

// Re-export types for backward compatibility
export { InvalidCredentialsError };
export type SignInSuccess = SignInServiceSuccess;

// Create web-specific sign-in program with local HTTP client
export const programSignIn = (email: string, password: string) =>
  createSignInProgram(API_BASE_URL)(email, password).pipe(Effect.provide(HttpClientLive));
