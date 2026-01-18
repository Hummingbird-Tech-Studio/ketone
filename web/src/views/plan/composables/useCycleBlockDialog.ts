import { runWithUi } from '@/utils/effects/helpers';
import { programGetActiveCycle } from '@/views/cycle/services/cycle.service';
import { useActor, useSelector } from '@xstate/vue';
import { Match } from 'effect';
import { useRouter } from 'vue-router';
import {
  cycleBlockDialogMachine,
  Emit,
  Event,
  State,
} from '../actors/cycleBlockDialog.actor';

/**
 * Composable for managing the cycle block dialog state.
 * Shows a dialog when user tries to create a plan while a cycle is in progress.
 *
 * @example
 * ```ts
 * const { showDialog, isChecking, checkAndProceed, dismiss, goToCycle } = useCycleBlockDialog();
 *
 * // Before allowing plan creation
 * checkAndProceed(() => {
 *   // This callback runs only if no cycle is in progress
 *   showPresetConfigDialog();
 * });
 * ```
 */
export function useCycleBlockDialog() {
  const router = useRouter();
  const { send, actorRef } = useActor(cycleBlockDialogMachine);

  const showDialog = useSelector(actorRef, (state) => state.matches(State.Blocked));
  const isChecking = useSelector(actorRef, (state) => state.matches(State.Checking));

  let pendingCallback: (() => void) | null = null;

  // When CHECK_CYCLE is emitted, make the API call
  actorRef.on(Emit.CHECK_CYCLE, () => {
    runWithUi(
      programGetActiveCycle(),
      () => {
        // Success: cycle exists and is in progress
        send({ type: Event.CHECK_RESULT, cycleInProgress: true });
      },
      (error) => {
        Match.value(error).pipe(
          Match.when({ _tag: 'NoCycleInProgressError' }, () => {
            // No cycle in progress - allow to proceed
            send({ type: Event.CHECK_RESULT, cycleInProgress: false });
          }),
          Match.orElse(() => {
            // Network error or other - fail open, allow to proceed
            send({ type: Event.CHECK_RESULT, cycleInProgress: false });
          }),
        );
      },
    );
  });

  actorRef.on(Emit.PROCEED, () => {
    if (pendingCallback) {
      pendingCallback();
      pendingCallback = null;
    }
  });

  actorRef.on(Emit.NAVIGATE_TO_CYCLE, () => {
    router.push('/cycle');
  });

  /**
   * Checks if a cycle is in progress by calling the API.
   * Shows the block dialog if a cycle exists, otherwise executes the callback.
   */
  const checkAndProceed = (onProceed: () => void) => {
    pendingCallback = onProceed;
    send({ type: Event.START_CHECK });
  };

  /**
   * Dismisses the block dialog
   */
  const dismiss = () => {
    pendingCallback = null;
    send({ type: Event.DISMISS });
  };

  /**
   * Handles the "Go to Cycle" action - navigates to the cycle page
   */
  const goToCycle = () => {
    pendingCallback = null;
    send({ type: Event.GO_TO_CYCLE });
  };

  return {
    showDialog,
    isChecking,
    checkAndProceed,
    dismiss,
    goToCycle,
    actorRef,
  };
}
