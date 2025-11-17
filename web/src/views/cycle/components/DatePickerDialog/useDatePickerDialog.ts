import { Emit, Event, type cycleMachine } from '@/views/cycle/actors/cycle.actor';
import type { SchedulerView } from '@/views/cycle/domain/domain';
import { MERIDIAN, type Meridian, type TimeValue } from '@/shared/types/time';
import { startOfMinute } from 'date-fns';
import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import type { ActorRefFrom } from 'xstate';

const HOURS_IN_12H_FORMAT = 12;

type DatePickerValue = Date | Date[] | (Date | null)[] | null | undefined;

interface UseDatePickerDialogParams {
  cycleActor: ActorRefFrom<typeof cycleMachine>;
  view: Ref<SchedulerView>;
  date: Ref<Date>;
  disabled?: Ref<boolean>;
  updating?: Ref<boolean>;
  onSave?: (date: Date) => void;
}

export function useDatePickerDialog({
  cycleActor,
  view,
  date,
  disabled,
  updating,
  onSave,
}: UseDatePickerDialogParams) {
  const open = ref(false);
  const localDate = ref(new Date(date.value));
  const isTimePickerOpen = ref(false);
  const selectedTimeValue = ref<TimeValue | null>(null);

  // Watch for date prop changes to sync localDate
  watch(date, (newDate) => {
    localDate.value = new Date(newDate);
  });

  // Watch for open state changes to reset local date when dialog opens
  watch(open, (isOpen) => {
    if (isOpen) {
      localDate.value = new Date(date.value);
    }
  });

  // Computed values
  const hours = computed(() => localDate.value.getHours() % HOURS_IN_12H_FORMAT || HOURS_IN_12H_FORMAT);
  const minutes = computed(() => localDate.value.getMinutes().toString().padStart(2, '0'));
  const meridian = computed<Meridian>(() => {
    return localDate.value.getHours() >= HOURS_IN_12H_FORMAT ? MERIDIAN.PM : MERIDIAN.AM;
  });
  const currentTimeValue = computed<TimeValue>(() => ({
    hours: hours.value,
    minutes: parseInt(minutes.value),
    period: meridian.value,
  }));

  // Utility function
  function normalizeHourValue(hours: number, period: Meridian): number {
    if (period === MERIDIAN.AM && hours === HOURS_IN_12H_FORMAT) return 0;
    if (period === MERIDIAN.PM && hours !== HOURS_IN_12H_FORMAT) return hours + HOURS_IN_12H_FORMAT;
    return hours;
  }

  // Dialog handlers
  function handleClick() {
    if (disabled?.value) {
      return;
    }
    open.value = true;
  }

  function handleDialogVisibilityChange(visible: boolean) {
    if (!visible) {
      open.value = false;
    }
  }

  function handleDateChange(newDate: DatePickerValue) {
    if (!newDate || Array.isArray(newDate)) return;

    const hours = localDate.value.getHours();
    const minutes = localDate.value.getMinutes();
    const seconds = localDate.value.getSeconds();
    const milliseconds = localDate.value.getMilliseconds();
    const date = new Date(newDate);

    date.setHours(hours, minutes, seconds, milliseconds);
    localDate.value = date;
  }

  // Time picker handlers
  function openTimePickerDialog() {
    isTimePickerOpen.value = true;
    selectedTimeValue.value = null;
  }

  function closeTimePickerDialog() {
    isTimePickerOpen.value = false;
    selectedTimeValue.value = null;
  }

  function handleTimeChange(timeValue: TimeValue) {
    selectedTimeValue.value = timeValue;
  }

  function saveTimeSelection() {
    if (!selectedTimeValue.value) {
      closeTimePickerDialog();
      return;
    }

    // Convert 12-hour to 24-hour format
    const { hours, minutes, period } = selectedTimeValue.value;
    const hour = normalizeHourValue(hours, period);
    const newDate = new Date(localDate.value);

    newDate.setHours(hour, minutes, 0, 0);
    localDate.value = newDate;

    closeTimePickerDialog();
  }

  // Action handlers
  function handleNow() {
    localDate.value = new Date();
  }

  function handleSave() {
    const savedDate = startOfMinute(localDate.value);

    if (onSave) {
      // Controlled mode: call the callback instead of sending event to actor
      onSave(savedDate);
      close();
    } else {
      // Default mode: send event to actor
      const event = view.value._tag === 'Start' ? Event.UPDATE_START_DATE : Event.UPDATE_END_DATE;
      cycleActor.send({ type: event, date: savedDate });
    }
  }

  function close() {
    open.value = false;
  }

  // Listen for UPDATE_COMPLETE event to close the dialog (only in default mode)
  const subscription = onSave
    ? { unsubscribe: () => {} }
    : cycleActor.on(Emit.UPDATE_COMPLETE, () => {
        close();
      });

  onUnmounted(() => {
    subscription.unsubscribe();
  });

  return {
    // State
    open,
    localDate,
    isTimePickerOpen,
    // Computed
    hours,
    minutes,
    meridian,
    currentTimeValue,
    // Handlers
    handleClick,
    handleDialogVisibilityChange,
    handleDateChange,
    openTimePickerDialog,
    closeTimePickerDialog,
    handleTimeChange,
    saveTimeSelection,
    handleNow,
    handleSave,
    close,
  };
}
