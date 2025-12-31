import {
  createSignInMachine,
  SignInState,
  SignInEvent as Event,
  SignInEmit as Emit,
  type SignInEmitType as EmitType,
  type SignInSuccess,
} from '@ketone/shared';
import { programSignIn } from '../services/signIn.service';

// Re-export types for backward compatibility
export { SignInState, Event, Emit };
export type { EmitType, SignInSuccess };

// Create sign-in machine with mobile-specific program
export const signInMachine = createSignInMachine(programSignIn);
