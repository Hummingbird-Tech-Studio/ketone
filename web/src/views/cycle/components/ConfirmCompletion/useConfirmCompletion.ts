import { formatDate, formatHour, formatTime } from '@/utils/formatting';
import { useSelector } from '@xstate/vue';
import { startOfMinute } from 'date-fns';
import { computed, ref, watch, type Ref } from 'vue';
import type { ActorRefFrom } from 'xstate';
import { Event, type cycleMachine } from '../../actors/cycle.actor';
import { goal, start, type SchedulerView } from '../../domain/domain';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;

interface UseConfirmCompletionParams {
  actorRef: ActorRefFrom<typeof cycleMachine>;
  visible: Ref<boolean>;
}

export function useConfirmCompletion({ actorRef, visible }: UseConfirmCompletionParams) {
  const startDate = useSelector(actorRef, (state) => state.context.startDate);
  const endDate = useSelector(actorRef, (state) => state.context.endDate);
  const pendingStartDate = useSelector(actorRef, (state) => state.context.pendingStartDate);
  const pendingEndDate = useSelector(actorRef, (state) => state.context.pendingEndDate);

  // Use pending dates if available, otherwise use regular dates
  const effectiveStartDate = computed(() => pendingStartDate.value ?? startDate.value);
  const effectiveEndDate = computed(() => pendingEndDate.value ?? endDate.value);

  // DateTimePicker state
  const editingField = ref<SchedulerView | null>(null);
  const datePickerVisible = ref(false);

  // Calculate total fasting time (from start date to moment modal was opened)
  const totalFastingTime = ref(formatTime(0, 0, 0));
  const acceptTime = ref<Date>(new Date());

  function updateTotalFastingTime() {
    // Calculate from effective start date to the captured accept time (NOW when modal opened)
    const start = effectiveStartDate.value;
    const end = acceptTime.value;

    const elapsedSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

    const hours = Math.floor(elapsedSeconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((elapsedSeconds / SECONDS_PER_MINUTE) % SECONDS_PER_MINUTE);
    const seconds = elapsedSeconds % SECONDS_PER_MINUTE;

    totalFastingTime.value = formatTime(hours, minutes, seconds);
  }

  // Watch for modal opening to capture accept time, and recalculate when start date changes
  watch(
    visible,
    (newVisible, oldVisible) => {
      // Capture accept time when modal opens
      if (newVisible && !oldVisible) {
        acceptTime.value = new Date();
        updateTotalFastingTime();
      }
    },
    { immediate: true },
  );

  // Recalculate when pending start date changes (user editing start date)
  watch(pendingStartDate, () => {
    if (visible.value) {
      updateTotalFastingTime();
    }
  });

  // Format start date and time
  const startHour = computed(() => formatHour(effectiveStartDate.value));
  const startDateFormatted = computed(() => formatDate(effectiveStartDate.value));

  // Format end date and time
  const endHour = computed(() => formatHour(effectiveEndDate.value));
  const endDateFormatted = computed(() => formatDate(effectiveEndDate.value));

  // DateTimePicker computed values
  const datePickerTitle = computed(() => editingField.value?.name ?? '');
  const datePickerValue = computed(() =>
    editingField.value?._tag === 'Start' ? effectiveStartDate.value : effectiveEndDate.value,
  );

  // Actions
  function handleStartCalendarClick() {
    editingField.value = start;
    datePickerVisible.value = true;
  }

  function handleEndCalendarClick() {
    editingField.value = goal;
    datePickerVisible.value = true;
  }

  function handleDateTimeUpdate(newDate: Date) {
    const event = editingField.value?._tag === 'Start' ? Event.EDIT_START_DATE : Event.EDIT_END_DATE;

    actorRef.send({ type: event, date: startOfMinute(newDate) });
  }

  function handleDatePickerVisibilityChange(value: boolean) {
    if (!value) {
      datePickerVisible.value = false;
      editingField.value = null;
    }
  }

  function handleSave() {
    actorRef.send({ type: Event.SAVE_EDITED_DATES });
  }

  // When editing succeeds, close the date picker
  watch([pendingStartDate, pendingEndDate], () => {
    // If we were editing and the pending date was updated, close the picker
    if (datePickerVisible.value) {
      datePickerVisible.value = false;
      editingField.value = null;
    }
  });

  return {
    // Formatted dates
    startHour,
    startDateFormatted,
    endHour,
    endDateFormatted,
    // Fasting time
    totalFastingTime,
    // DatePicker state
    datePickerVisible,
    datePickerTitle,
    datePickerValue,
    // Actions
    handleStartCalendarClick,
    handleEndCalendarClick,
    handleDateTimeUpdate,
    handleDatePickerVisibilityChange,
    handleSave,
  };
}
