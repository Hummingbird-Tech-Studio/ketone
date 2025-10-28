import { Schema as S } from 'effect';
import type { Snapshot } from 'xstate';
import { CycleState } from './actors/cycleOrleansActor';

/**
 * Domain Types and Enums
 *
 * Core domain concepts that are shared across layers.
 */

export const CycleStateSchema = S.Enums(CycleState);

/**
 * Type-safe snapshot for CycleActor
 */
export type CycleActorSnapshot = Snapshot<unknown>;
