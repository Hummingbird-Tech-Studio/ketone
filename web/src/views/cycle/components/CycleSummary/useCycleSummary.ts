import { computed } from 'vue';
import { useCycle } from '../../composables/useCycle';
import { Event } from '../../actors/cycle.actor';

interface Props {
  visible: boolean;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'complete'): void;
}

export function useCycleSummary(props: Props, emit: Emits) {
  const { startDate, endDate, actorRef, updating } = useCycle();

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
    isSaving,
    handleClose,
    handleSave,
  };
}
