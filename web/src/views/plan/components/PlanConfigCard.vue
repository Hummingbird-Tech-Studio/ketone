<template>
  <div class="plan-config-card">
    <div class="plan-config-card__header">
      <span class="plan-config-card__ratio">{{ ratio }}</span>
      <Button
        type="button"
        icon="pi pi-bookmark"
        rounded
        variant="outlined"
        severity="secondary"
        aria-label="Bookmark"
      />
    </div>

    <div class="plan-config-card__controls">
      <div class="plan-config-card__control">
        <span class="plan-config-card__control-label">Fast Duration</span>
        <div class="plan-config-card__control-input">
          <Button
            type="button"
            icon="pi pi-minus"
            rounded
            outlined
            severity="secondary"
            size="small"
            aria-label="Decrease fasting duration"
            :disabled="fastingDuration <= 1"
            @click="decrementFasting"
          />
          <span class="plan-config-card__control-value">{{ fastingDuration }}h</span>
          <Button
            type="button"
            icon="pi pi-plus"
            rounded
            outlined
            severity="secondary"
            size="small"
            aria-label="Increase fasting duration"
            :disabled="fastingDuration >= 168"
            @click="incrementFasting"
          />
        </div>
      </div>

      <div class="plan-config-card__control">
        <span class="plan-config-card__control-label">Eating Window</span>
        <div class="plan-config-card__control-input">
          <Button
            type="button"
            icon="pi pi-minus"
            rounded
            outlined
            severity="secondary"
            size="small"
            aria-label="Decrease eating window"
            :disabled="eatingWindow <= 0"
            @click="decrementEating"
          />
          <span class="plan-config-card__control-value">{{ eatingWindow }}h</span>
          <Button
            type="button"
            icon="pi pi-plus"
            rounded
            outlined
            severity="secondary"
            size="small"
            aria-label="Increase eating window"
            :disabled="eatingWindow >= 24"
            @click="incrementEating"
          />
        </div>
      </div>
    </div>

    <div class="plan-config-card__start">
      <div class="plan-config-card__start-icon">
        <i class="pi pi-play"></i>
      </div>
      <div class="plan-config-card__start-info">
        <span class="plan-config-card__start-label">Start:</span>
        <span class="plan-config-card__start-value">{{ formattedStartDate }}</span>
      </div>
      <Button
        type="button"
        icon="pi pi-pencil"
        rounded
        variant="outlined"
        severity="secondary"
        aria-label="Edit Start Date"
        @click="showDatePicker = true"
      />
    </div>

    <Dialog v-model:visible="showDatePicker" header="Select Start Date & Time" modal :style="{ width: '320px' }">
      <DatePicker
        v-model="editedStartDate"
        showTime
        hourFormat="12"
        :minDate="minDate"
        inline
        class="plan-config-card__datepicker"
      />
      <template #footer>
        <Button label="Cancel" severity="secondary" variant="text" @click="showDatePicker = false" />
        <Button label="Save" @click="saveStartDate" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import { computed, ref } from 'vue';

const props = defineProps<{
  ratio: string;
  fastingDuration: number;
  eatingWindow: number;
  startDate: Date;
}>();

const emit = defineEmits<{
  'update:fastingDuration': [value: number];
  'update:eatingWindow': [value: number];
  'update:startDate': [value: Date];
}>();

const showDatePicker = ref(false);
const editedStartDate = ref<Date>(new Date(props.startDate));
const minDate = new Date();

const formattedStartDate = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(props.startDate);
});

const incrementFasting = () => {
  if (props.fastingDuration < 168) {
    emit('update:fastingDuration', props.fastingDuration + 1);
  }
};

const decrementFasting = () => {
  if (props.fastingDuration > 1) {
    emit('update:fastingDuration', props.fastingDuration - 1);
  }
};

const incrementEating = () => {
  if (props.eatingWindow < 24) {
    emit('update:eatingWindow', props.eatingWindow + 1);
  }
};

const decrementEating = () => {
  if (props.eatingWindow > 0) {
    emit('update:eatingWindow', props.eatingWindow - 1);
  }
};

const saveStartDate = () => {
  emit('update:startDate', editedStartDate.value);
  showDatePicker.value = false;
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.plan-config-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  background: $color-white;
  border: 1px solid $color-primary-button-outline;
  border-radius: 12px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__ratio {
    font-size: 28px;
    font-weight: 700;
    color: $color-primary-button-text;
  }

  &__controls {
    display: flex;
    gap: 16px;
  }

  &__control {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__control-label {
    font-size: 12px;
    font-weight: 500;
    color: $color-primary-light-text;
    text-align: center;
  }

  &__control-input {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px;
    background: rgba($color-primary-button-outline, 0.5);
    border-radius: 8px;
  }

  &__control-value {
    font-size: 16px;
    font-weight: 600;
    color: $color-primary-button-text;
    min-width: 40px;
    text-align: center;
  }

  &__start {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(#10b981, 0.1);
    border-radius: 8px;
  }

  &__start-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(#10b981, 0.2);
    border-radius: 8px;

    i {
      font-size: 14px;
      color: #10b981;
    }
  }

  &__start-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__start-label {
    font-size: 12px;
    font-weight: 500;
    color: $color-primary-light-text;
  }

  &__start-value {
    font-size: 14px;
    font-weight: 600;
    color: $color-primary-button-text;
  }

  &__datepicker {
    width: 100%;
  }
}
</style>
