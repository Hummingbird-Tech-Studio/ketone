import { Event } from '@/views/cycle/actors/cycle.actor';
import { computed, ref, type Ref } from 'vue';
import type { Actor, AnyActorLogic } from 'xstate';

interface UseActionButtonParams {
  cycleActor: Actor<AnyActorLogic>;
  idle: Ref<boolean>;
  completed: Ref<boolean>;
  inProgress: Ref<boolean>;
}

export function useActionButton({ cycleActor, idle, completed, inProgress }: UseActionButtonParams) {
  const isSummaryModalOpen = ref(false);

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
      isSummaryModalOpen.value = true;
    }

    if (completed.value) {
      cycleActor.send({ type: Event.LOAD });
    }
  }

  function closeSummaryModal() {
    isSummaryModalOpen.value = false;
  }

  function handleComplete() {
    closeSummaryModal();
  }

  return {
    buttonText,
    handleButtonClick,
    isSummaryModalOpen,
    closeSummaryModal,
    handleComplete,
  };
}
