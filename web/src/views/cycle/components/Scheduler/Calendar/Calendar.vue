<template>
  <div class="calendar" data-test-name="Cycle.Scheduler.calendar">
    <div class="calendar__header">
      <CalendarButton
        :dataTestName="'Cycle.Scheduler.calendar.backButton'"
        :icon="icon.ChevronBack"
        :onClick="handlePrevMonth"
        ariaLabel="Previous month"
      />

      <div class="calendar__monthAndYear" data-test-name="Cycle.Scheduler.calendar.monthAndYear">
        {{ month.toLocaleString('default', { month: 'long' }) }}
        {{ month.getFullYear() }}
      </div>

      <CalendarButton
        :dataTestName="'Cycle.Scheduler.calendar.nextButton'"
        :icon="icon.ChevronNext"
        :onClick="handleNextMonth"
        ariaLabel="Next month"
      />
    </div>

    <div class="calendar__body">
      <div class="calendar__daysOfWeek">
        <div v-for="day in DAYS_OF_WEEK" :key="day" class="calendar__daysOfWeek__day">
          {{ day }}
        </div>
      </div>

      <div class="calendar__dates">
        <div
          role="button"
          v-for="calendarDate in calendar"
          :key="createDayKey(calendarDate)"
          class="calendar__date"
          :class="{
            'calendar__date--selected': areDatesEqual(calendarDate, date),
            'calendar__date--disabled': !calendarDate.isCurrentMonth,
          }"
          @click="handleDayClick(calendarDate)"
          @keydown="handleCalendarDateKeyDown($event, calendarDate)"
          tabindex="0"
          :data-test-name="`Cycle.Scheduler.calendar.date-${createDayKey(calendarDate)}`"
        >
          {{ calendarDate.day }}
        </div>
      </div>
    </div>

    <div class="calendar__time">
      <button
        class="calendar__time-display"
        @click="openTimePickerDialog"
        data-test-name="Cycle.Scheduler.calendar.timeButton"
        aria-label="Set time"
      >
        <span class="calendar__time-value"> {{ hours }}:{{ minutes }} {{ meridian }} </span>
        <span class="calendar__time-edit-hint">Click to edit</span>
      </button>
    </div>

    <Dialog
      v-model:visible="isTimePickerOpen"
      header="Set Time"
      :modal="true"
      :draggable="false"
      :style="{ width: '320px' }"
    >
      <TimePicker :initialTime="currentTimeValue" @change="handleTimeChange" />
      <Divider class="calendar__divider" />
      <template #footer>
        <ButtonPrime @click="closeTimePickerDialog" outlined severity="secondary"> Cancel </ButtonPrime>
        <ButtonPrime @click="saveTimeSelection" outlined severity="help">Done</ButtonPrime>
      </template>
    </Dialog>

    <div class="calendar__actions">
      <ButtonPrime
        class="calendar__button"
        outlined
        severity="help"
        size="small"
        label="Now"
        data-test-name="Cycle.Scheduler.calendar.nowButton"
        @click="handleNowClick"
        aria-label="Set current date and time"
      />

      <ButtonPrime
        class="calendar__button"
        outlined
        type="button"
        severity="help"
        size="small"
        label="Save"
        data-test-name="Cycle.Scheduler.calendar.saveButton"
        :loading="loading"
        @click="handleSaveCalendar"
        aria-label="Save"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import CalendarButton from '@/components/IconButton/IconButton.vue';
import { icon } from '@/components/IconButton/types';
import type { Meridian, TimeValue } from '@/components/TimePicker/domain';
import TimePicker from '@/components/TimePicker/TimePicker.vue';
import type { Day } from '@/views/cycle/components/Scheduler/Calendar/types';
import { TimeUnit, TimeUnitAction } from '@/views/cycle/components/Scheduler/Calendar/types';
import { CalendarEvent, calendarLogic, generateCalendar } from '@/views/cycle/machines/calendarMachine';
import { CycleEvent } from '@/views/cycle/machines/cycleMachine';
import { useActor, useSelector } from '@xstate/vue';
import { computed, onUnmounted, ref } from 'vue';
import { type AnyActorRef } from 'xstate';

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const KEY_EVENT = {
  Enter: 'Enter',
  Space: ' ',
};

const props = defineProps<{
  currentDate: Date;
  actor?: AnyActorRef;
  loading?: boolean;
}>();

const emit = defineEmits<{
  saveDate: [date: Date];
}>();

const { send, actorRef } = useActor(calendarLogic, {
  input: {
    date: props.currentDate,
    calendar: generateCalendar(props.currentDate.getFullYear(), props.currentDate.getMonth() + 1),
    month: new Date(props.currentDate.getFullYear(), props.currentDate.getMonth()),
  },
});

const date = useSelector(actorRef, (state) => state.context.date);
const hours = useSelector(actorRef, (state) => state.context.date.getHours() % 12 || 12);
const minutes = useSelector(actorRef, (state) => (state.context.date.getMinutes() % 60).toString().padStart(2, '0'));
const meridian = useSelector(actorRef, (state) => getMeridian(state.context.date));
const month = useSelector(actorRef, (state) => state.context.month);
const calendar = useSelector(actorRef, (state) => state.context.calendar);
const autoRepeatTimer = ref<number | null>(null);
const autoRepeatAction = ref<{ action: TimeUnitAction; type: TimeUnit } | null>(null);
const isTimePickerOpen = ref(false);
const selectedTimeValue = ref<TimeValue | null>(null);

const currentTimeValue = computed((): TimeValue => {
  const currentDate = date.value;
  const hour12 = currentDate.getHours() % 12 || 12;
  const period = currentDate.getHours() < 12 ? 'AM' : 'PM';

  return {
    hours: hour12,
    minutes: currentDate.getMinutes(),
    period: period as 'AM' | 'PM',
  };
});

function getMeridian(date: Date): Meridian {
  return date.getHours() < 12 ? 'AM' : 'PM';
}

function handleSaveCalendar() {
  // Send to actor if provided (backward compatibility)
  if (props.actor) {
    props.actor.send({ type: CycleEvent.SAVE_DATE, date: date.value });
  }

  // Always emit Vue event (new pattern)
  emit('saveDate', date.value);
}

function stopAutoRepeat() {
  if (autoRepeatTimer.value) {
    clearTimeout(autoRepeatTimer.value);
    autoRepeatTimer.value = null;
  }
  autoRepeatAction.value = null;
}

function handleCalendarDateKeyDown(event: KeyboardEvent, day: Day) {
  if (event.key === KEY_EVENT.Enter || event.key === KEY_EVENT.Space) {
    event.preventDefault();
    handleDayClick(day);
  }
}

onUnmounted(() => {
  stopAutoRepeat();
});

function handlePrevMonth() {
  send({ type: CalendarEvent.PREVIOUS_MONTH });
}

function handleNextMonth() {
  send({ type: CalendarEvent.NEXT_MONTH });
}

function handleDayClick(day: Day) {
  if (day.isCurrentMonth) {
    send({ type: CalendarEvent.SELECT_DAY, date: day.date });
  }
}

function handleNowClick() {
  send({ type: CalendarEvent.NOW });
}

function areDatesEqual(day1: Day, date: Date) {
  return (
    day1.date.getFullYear() === date.getFullYear() &&
    day1.date.getMonth() === date.getMonth() &&
    day1.date.getDate() === date.getDate() &&
    day1.date.getDay() === date.getDay() &&
    day1.isCurrentMonth
  );
}

function createDayKey(day: Day): string {
  return `${day.day}-${day.date.getMonth()}-${day.date.getFullYear()}-${day.isCurrentMonth ? 'current' : 'other'}`;
}

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
  if (selectedTimeValue.value) {
    const currentDate = new Date(date.value);
    const { hours, minutes, period } = selectedTimeValue.value;

    // Convert 12-hour format to 24-hour format
    let hour24 = hours;
    if (period === 'AM' && hours === 12) {
      hour24 = 0;
    } else if (period === 'PM' && hours !== 12) {
      hour24 = hours + 12;
    }

    currentDate.setHours(hour24, minutes, 0, 0);
    send({ type: CalendarEvent.SET_DATE, date: currentDate });
  }
  closeTimePickerDialog();
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.calendar {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-style: normal;
  font-weight: 400;
  font-size: 14px;
  color: $color-primary-button-text;

  &__header {
    width: 100%;
    height: 34px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__body {
    width: 100%;
    border-top: 1px solid $color-primary-button-outline;
    border-bottom: 1px solid $color-primary-button-outline;
    margin: 5px 0;
    padding: 5px 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-gap: 4px;
  }

  &__daysOfWeek {
    display: contents;

    &__day {
      text-align: center;
      font-style: normal;
      font-weight: 500;
      font-size: 14px;
      color: $color-primary-button-text;
    }
  }

  &__dates {
    display: contents;
  }

  &__date {
    height: 28px;
    width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 50%;
    user-select: none;
    transition:
      background-color,
      color,
      0.1s ease;

    &--selected {
      background-color: $color-light-purple;
      color: $color-dark-purple;

      &:hover {
        background-color: $color-light-purple !important;
      }
    }

    &:hover {
      background-color: $color-primary-button-outline;
    }

    &--disabled {
      cursor: default;
      color: $color-primary-light-text;

      &:hover {
        background-color: transparent;
      }
    }
  }

  &__monthAndYear {
    font-style: normal;
    font-weight: 400;
    font-size: 14px;
    color: $color-primary-button-text;
  }

  &__time {
    display: flex;
    gap: 8px;
    margin-top: 5px;
  }

  &__hours {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }

  &__minutes {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }

  &__meridian {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }

  &__separator {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  &__actions {
    width: 100%;
    border-top: 1px solid $color-primary-button-outline;
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
  }

  &__button {
    margin-top: 8px;
    min-width: 70px;
    min-height: 24px;
  }

  &__time-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
    background: $color-light-grey;
    border: 1px solid $color-primary-button-outline;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;

    &:hover {
      background: $color-ultra-light-purple;
      border-color: $color-light-purple;
    }

    &:active {
      background: $color-light-purple;
    }

    &:focus-visible {
      outline: 2px solid $color-outline-focus;
    }
  }

  &__time-value {
    font-size: 18px;
    font-weight: 500;
    color: $color-primary-button-text;
    font-variant-numeric: tabular-nums;
  }

  &__time-edit-hint {
    font-size: 12px;
    color: $color-primary-light-text;
    font-weight: 400;
  }

  &__divider {
    margin: 8px 0 0 0;
  }
}
</style>
