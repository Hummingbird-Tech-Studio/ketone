<template>
  <div class="date-picker-dialog">
    <Button
      type="button"
      icon="pi pi-calendar"
      rounded
      variant="outlined"
      severity="secondary"
      aria-label="Select Date"
      :disabled="disabled"
      @click="handleClick"
    />

    <!-- DatePicker Dialog -->
    <Dialog
      :visible="open"
      modal
      :header="view.name"
      :style="{ width: `${CALENDAR_DIALOG_WIDTH}px` }"
      :draggable="false"
      @update:visible="handleDialogVisibilityChange"
    >
      <DatePicker
        :modelValue="localDate"
        @update:modelValue="handleDateChange"
        inline
        showButtonBar
        placeholder="Basic"
      >
        <template #buttonbar>
          <div class="date-picker-dialog__buttonbar">
            <div class="date-picker-dialog__time">
              <button class="date-picker-dialog__time-display" aria-label="Set time" @click="openTimePickerDialog">
                <span class="date-picker-dialog__time-value"> {{ hours }}:{{ minutes }} {{ meridian }} </span>
                <span class="date-picker-dialog__time-edit-hint">Click to edit</span>
              </button>
            </div>
            <Divider class="date-picker-dialog__divider" />
            <div class="date-picker-dialog__actions">
              <Button
                class="date-picker-dialog__button"
                size="small"
                label="Now"
                variant="outlined"
                @click="handleNow"
              />
              <Button
                class="date-picker-dialog__button"
                size="small"
                label="Save"
                variant="outlined"
                :loading="updating"
                :disabled="updating"
                @click="handleSave"
              />
            </div>
          </div>
        </template>
      </DatePicker>
    </Dialog>

    <!-- TimePicker Dialog -->
    <Dialog
      v-model:visible="isTimePickerOpen"
      header="Set Time"
      :modal="true"
      :draggable="false"
      :style="{ width: '320px' }"
    >
      <TimePicker :initialTime="currentTimeValue" @change="handleTimeChange" />
      <Divider class="date-picker-dialog__divider" />
      <template #footer>
        <Button @click="closeTimePickerDialog" outlined severity="secondary">Cancel</Button>
        <Button @click="saveTimeSelection" outlined severity="help">Done</Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import TimePicker from '@/components/TimePicker/TimePicker.vue';
import type { SchedulerView } from '@/views/cycle/domain/domain';
import { useCycle } from '@/views/cycle/composables/useCycle';
import { useDatePickerDialog } from './useDatePickerDialog';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import Divider from 'primevue/divider';
import { toRefs } from 'vue';

const CALENDAR_DIALOG_WIDTH = 350;

interface Props {
  view: SchedulerView;
  date: Date;
  disabled?: boolean;
  updating?: boolean;
}

const props = defineProps<Props>();
const { view, date, disabled, updating } = toRefs(props);

const { actorRef } = useCycle();

const {
  open,
  localDate,
  isTimePickerOpen,
  hours,
  minutes,
  meridian,
  currentTimeValue,
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
} = useDatePickerDialog({
  cycleActor: actorRef,
  view,
  date,
  disabled,
  updating,
});

defineExpose({
  close,
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.date-picker-dialog {
  &__buttonbar {
    width: 100%;
  }

  &__time {
    display: flex;
    align-items: center;
    justify-content: center;
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

  &__actions {
    display: flex;
    justify-content: space-between;
  }

  &__button {
    margin-top: 8px;
    min-width: 70px;
    min-height: 24px;
  }

  &__divider {
    margin: 8px 0 0 0;
  }
}
</style>
