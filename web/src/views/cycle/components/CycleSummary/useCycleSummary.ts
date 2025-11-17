import { computed, ref, watch, type Ref } from 'vue';
import { useSelector } from '@xstate/vue';
import { Event, CycleState } from '../../actors/cycle.actor';
import type { ActorRefFrom } from 'xstate';
import type { cycleMachine } from '../../actors/cycle.actor';

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'complete'): void;
}

export function useCycleSummary(
  emit: Emits,
  actorRef: ActorRefFrom<typeof cycleMachine>,
  visible: Ref<boolean>
) {
  // Get state and context from the passed actorRef
  const startDate = useSelector(actorRef, (state) => state.context.startDate);
  const endDate = useSelector(actorRef, (state) => state.context.endDate);
  const updating = useSelector(actorRef, (state) => state.matches(CycleState.Updating));
  const finishing = useSelector(actorRef, (state) => state.matches(CycleState.Finishing));

  const isSaving = computed(() => updating.value || finishing.value);

  // Local state for edited dates (only saved when user clicks "Save")
  const localStartDate = ref(new Date());
  const localEndDate = ref(new Date());

  // Track current time - updates when modal opens
  const currentTime = ref(new Date());

  // Initialize local dates when modal opens
  watch(visible, (isVisible) => {
    if (isVisible) {
      currentTime.value = new Date();
      localStartDate.value = new Date(startDate.value);
      localEndDate.value = new Date(endDate.value);
    }
  });

  // Calculate total fasting time in HH:MM:SS format (using local start date)
  const totalFastingTime = computed(() => {
    if (!localStartDate.value) return '00:00:00';

    const totalSeconds = Math.max(
      0,
      Math.floor((currentTime.value.getTime() - localStartDate.value.getTime()) / 1000)
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  });

  // Functions to update local dates
  function updateLocalStartDate(date: Date) {
    localStartDate.value = date;
  }

  function updateLocalEndDate(date: Date) {
    localEndDate.value = date;
  }

  function handleClose() {
    emit('update:visible', false);
  }

  function handleSave() {
    // First update the actor context with local dates
    actorRef.send({ type: Event.UPDATE_START_DATE, date: localStartDate.value });
    actorRef.send({ type: Event.UPDATE_END_DATE, date: localEndDate.value });
    // Then complete the cycle (this will use the updated dates)
    actorRef.send({ type: Event.COMPLETE });
    emit('complete');
  }

  return {
    localStartDate,
    localEndDate,
    totalFastingTime,
    isSaving,
    updateLocalStartDate,
    updateLocalEndDate,
    handleClose,
    handleSave,
  };
}
