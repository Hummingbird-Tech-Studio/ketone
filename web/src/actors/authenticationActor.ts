import { programCheckSession, programRemoveSession, programStoreSession } from '@/services/auth/auth-session.service';
import {
  createAuthenticationMachine,
  AuthState as State,
  AuthEvent as Event,
  AuthEmit as Emit,
  type AuthEmitType as EmitType,
  type AuthSession,
  type StoragePrograms,
} from '@ketone/shared';
import { createActor } from 'xstate';

// Re-export types for backward compatibility
export { State, Event, Emit };
export type { EmitType, AuthSession, StoragePrograms };

// Create web implementation using localStorage-based storage
export const authenticationMachine = createAuthenticationMachine({
  programCheckSession,
  programStoreSession,
  programRemoveSession,
});

export const authenticationActor = createActor(authenticationMachine);
