import { Match } from 'effect';
import { onUnmounted } from 'vue';
import type { Actor } from 'xstate';
import { Emit, type EmitType, type cycleMachine } from '../actors/cycle.actor';

export interface CycleEmissionsOptions {
  onCycleError?: (error: string) => void;
  onValidationInfo?: (summary: string, detail: string) => void;
  onHasActivePlan?: () => void;
  onUpdateComplete?: () => void;
  onNotesSaved?: () => void;
  onFeelingsSaved?: () => void;
}

export function useCycleEmissions(cycleActor: Actor<typeof cycleMachine>, options: CycleEmissionsOptions = {}) {
  function handleEmit(emitType: EmitType) {
    Match.value(emitType).pipe(
      Match.when({ type: Emit.CYCLE_ERROR }, (emit) => {
        options.onCycleError?.(emit.error);
      }),
      Match.when({ type: Emit.VALIDATION_INFO }, (emit) => {
        options.onValidationInfo?.(emit.summary, emit.detail);
      }),
      Match.when({ type: Emit.HAS_ACTIVE_PLAN }, () => {
        options.onHasActivePlan?.();
      }),
      Match.when({ type: Emit.UPDATE_COMPLETE }, () => {
        options.onUpdateComplete?.();
      }),
      Match.when({ type: Emit.NOTES_SAVED }, () => {
        options.onNotesSaved?.();
      }),
      Match.when({ type: Emit.FEELINGS_SAVED }, () => {
        options.onFeelingsSaved?.();
      }),
      Match.orElse(() => {
        // Ignore TICK
      }),
    );
  }

  const subscriptions = Object.values(Emit).map((emit) => cycleActor.on(emit, handleEmit));

  onUnmounted(() => {
    subscriptions.forEach((sub) => sub.unsubscribe());
  });
}
