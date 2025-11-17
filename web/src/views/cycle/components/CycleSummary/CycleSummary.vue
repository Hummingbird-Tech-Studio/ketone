<template>
  <Dialog
    :visible="visible"
    modal
    header="Confirm Completion"
    :style="{ width: '380px' }"
    :draggable="false"
    @update:visible="handleClose"
  >
    <div class="cycle-summary">
      <div class="cycle-summary__section">
        <div class="cycle-summary__label">Total Fasting Time:</div>
        <div class="cycle-summary__time">{{ totalFastingTime }}</div>
      </div>

      <div class="cycle-summary__section">
        <div class="cycle-summary__field">
          <div class="cycle-summary__field-label">Start:</div>
          <button class="cycle-summary__edit-button" @click="openStartScheduler">
            <div class="cycle-summary__field-value">{{ formattedStartDate }}</div>
            <i class="pi pi-pencil cycle-summary__edit-icon" />
          </button>
        </div>
      </div>

      <div class="cycle-summary__section">
        <div class="cycle-summary__field">
          <div class="cycle-summary__field-label">End:</div>
          <button class="cycle-summary__edit-button" @click="openEndScheduler">
            <div class="cycle-summary__field-value">{{ formattedEndDate }}</div>
            <i class="pi pi-pencil cycle-summary__edit-icon" />
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="cycle-summary__footer">
        <Button label="Close" outlined @click="handleClose" />
        <Button label="Save" :loading="isSaving" @click="handleSave" />
      </div>
    </template>
  </Dialog>

  <!-- Start Date Scheduler Dialog -->
  <Scheduler
    v-if="isStartSchedulerOpen"
    :view="start"
    :date="startDate"
    :updating="isSaving"
    @close="closeStartScheduler"
  />

  <!-- End Date Scheduler Dialog -->
  <Scheduler v-if="isEndSchedulerOpen" :view="goal" :date="endDate" :updating="isSaving" @close="closeEndScheduler" />
</template>

<script setup lang="ts">
import { goal, start } from '@/views/cycle/domain/domain';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Scheduler from '../Scheduler/Scheduler.vue';
import { useCycleSummary } from './useCycleSummary';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'complete'): void;
}>();

const {
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
} = useCycleSummary(props, emit);
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.cycle-summary {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 8px 0;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__label {
    font-size: 14px;
    font-weight: 500;
    color: $color-primary-button-text;
  }

  &__time {
    font-size: 32px;
    font-weight: 700;
    color: $color-primary-button-text;
    text-align: center;
    padding: 8px 0;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__field-label {
    font-size: 16px;
    font-weight: 600;
    color: $color-primary-button-text;
  }

  &__edit-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    width: 100%;
    text-align: left;

    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }

    &:active {
      background-color: rgba(0, 0, 0, 0.08);
    }
  }

  &__field-value {
    font-size: 14px;
    color: $color-primary-button-text;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__edit-icon {
    color: $color-primary-button-text;
    font-size: 16px;
    flex-shrink: 0;
  }

  &__footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
}
</style>
