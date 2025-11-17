import { Event } from '@/views/cycle/actors/cycle.actor';
import { computed, type Ref } from 'vue';
import type { Actor, AnyActorLogic } from 'xstate';

interface UseActionButtonParams {
  cycleActor: Actor<AnyActorLogic>;
  idle: Ref<boolean>;
  completed: Ref<boolean>;
  inProgress: Ref<boolean>;
  confirmingCompletion: Ref<boolean>;
}

export function useActionButton({
  cycleActor,
  idle,
  completed,
  inProgress,
  confirmingCompletion,
}: UseActionButtonParams) {
  const buttonText = computed(() => {
    if (idle.value) {
      return 'Start Fasting';
    }

    if (completed.value) {
      return 'Start New Fast';
    }

    return 'Finish Fasting';
  });

  function handleButtonClick() {
    if (idle.value) {
      cycleActor.send({ type: Event.CREATE });
    }

    if (inProgress.value) {
      cycleActor.send({ type: Event.CONFIRM_COMPLETION });
    }

    if (completed.value) {
      cycleActor.send({ type: Event.LOAD });
    }
  }

  function closeSummaryModal() {
    cycleActor.send({ type: Event.CANCEL_COMPLETION });
  }

  function handleComplete() {
    // Modal will close automatically when state transitions
  }

  return {
    buttonText,
    handleButtonClick,
    confirmingCompletion,
    closeSummaryModal,
    handleComplete,
  };
}
