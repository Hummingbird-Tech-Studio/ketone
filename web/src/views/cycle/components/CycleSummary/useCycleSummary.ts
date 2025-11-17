import { ref, computed } from 'vue';
import { useCycle } from '../../composables/useCycle';
import { Event } from '../../actors/cycle.actor';
import { formatFullDateTime } from '@/utils/formatting/helpers';

interface Props {
  visible: boolean;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'complete'): void;
}

export function useCycleSummary(props: Props, emit: Emits) {
  const { startDate, endDate, actorRef, updating } = useCycle();

  const isStartSchedulerOpen = ref(false);
  const isEndSchedulerOpen = ref(false);
  const isSaving = computed(() => updating.value);

  // Calculate total fasting time in HH:MM:SS format
  const totalFastingTime = computed(() => {
    if (!startDate.value || !endDate.value) return '00:00:00';

    const now = new Date();
    const currentTime = now > endDate.value ? endDate.value : now;
    const totalSeconds = Math.max(
      0,
      Math.floor((currentTime.getTime() - startDate.value.getTime()) / 1000)
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  });

  // Format dates for display
  const formattedStartDate = computed(() => {
    if (!startDate.value) return '';
    return formatFullDateTime(startDate.value);
  });

  const formattedEndDate = computed(() => {
    if (!endDate.value) return '';
    return formatFullDateTime(endDate.value);
  });

  function openStartScheduler() {
    isStartSchedulerOpen.value = true;
  }

  function openEndScheduler() {
    isEndSchedulerOpen.value = true;
  }

  function closeStartScheduler() {
    isStartSchedulerOpen.value = false;
  }

  function closeEndScheduler() {
    isEndSchedulerOpen.value = false;
  }

  function handleClose() {
    emit('update:visible', false);
  }

  function handleSave() {
    // Send COMPLETE event to cycle actor
    actorRef.send({ type: Event.COMPLETE });
    emit('complete');
  }

  return {
    startDate,
    endDate,
    totalFastingTime,
    formattedStartDate,
    formattedEndDate,
    isStartSchedulerOpen,
    isEndSchedulerOpen,
    isSaving,
    openStartScheduler,
    openEndScheduler,
    closeStartScheduler,
    closeEndScheduler,
    handleClose,
    handleSave,
  };
}
