<template>
  <div class="plan-timeline">
    <div class="plan-timeline__header">
      <h3 class="plan-timeline__title">Timeline</h3>
    </div>

    <div
      ref="chartContainerRef"
      class="plan-timeline__chart"
      :style="chartContainerStyle"
    ></div>

    <div class="plan-timeline__legend">
      <div class="plan-timeline__legend-item">
        <span class="plan-timeline__legend-color plan-timeline__legend-color--fasting"></span>
        <span class="plan-timeline__legend-text">Planned fast</span>
      </div>
      <div class="plan-timeline__legend-item">
        <span class="plan-timeline__legend-color plan-timeline__legend-color--eating"></span>
        <span class="plan-timeline__legend-text">Eating Window</span>
      </div>
    </div>

    <PeriodEditDialog
      v-model:visible="isDialogVisible"
      :period-index="selectedPeriodIndex"
      :fasting-duration="props.fastingDuration"
      :eating-window="props.eatingWindow"
      :max-expandable-hours="null"
      @save="handlePeriodSave"
      @delete="handlePeriodDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { usePlanTimelineData } from './composables/usePlanTimelineData';
import { usePlanTimelineChart } from './composables/usePlanTimelineChart';
import PeriodEditDialog from './PeriodEditDialog.vue';

const props = defineProps<{
  fastingDuration: number;
  eatingWindow: number;
  startDate: Date;
  periods: number;
}>();

const emit = defineEmits<{
  (e: 'update:fastingDuration', value: number): void;
  (e: 'update:eatingWindow', value: number): void;
  (e: 'deletePeriod', periodIndex: number): void;
}>();

const chartContainerRef = ref<HTMLElement | null>(null);

// Dialog state
const isDialogVisible = ref(false);
const selectedPeriodIndex = ref(0);

// Data transformation
const timelineData = usePlanTimelineData({
  fastingDuration: toRef(() => props.fastingDuration),
  eatingWindow: toRef(() => props.eatingWindow),
  startDate: toRef(() => props.startDate),
  periods: toRef(() => props.periods),
});

// Handle period click
function handlePeriodClick(periodIndex: number) {
  selectedPeriodIndex.value = periodIndex;
  isDialogVisible.value = true;
}

// Chart rendering
const { chartHeight } = usePlanTimelineChart(chartContainerRef, {
  numRows: timelineData.numRows,
  dayLabels: timelineData.dayLabels,
  hourLabels: timelineData.hourLabels,
  hourPositions: timelineData.hourPositions,
  timelineBars: timelineData.timelineBars,
  fastingDuration: toRef(() => props.fastingDuration),
  eatingWindow: toRef(() => props.eatingWindow),
  onPeriodClick: handlePeriodClick,
});

// Dynamic height
const chartContainerStyle = computed(() => ({
  height: `${chartHeight.value}px`,
}));

// Dialog handlers
function handlePeriodSave(data: { periodIndex: number; fastingDuration: number; eatingWindow: number }) {
  emit('update:fastingDuration', data.fastingDuration);
  emit('update:eatingWindow', data.eatingWindow);
  isDialogVisible.value = false;
}

function handlePeriodDelete(periodIndex: number) {
  emit('deletePeriod', periodIndex);
  isDialogVisible.value = false;
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

$color-fasting: #5b9bd5;
$color-eating: #f4b183;

.plan-timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: $color-white;
  border: 1px solid $color-primary-button-outline;
  border-radius: 12px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: $color-primary-button-text;
    margin: 0;
  }

  &__chart {
    width: 100%;
  }

  &__legend {
    display: flex;
    gap: 24px;
    padding-top: 8px;
  }

  &__legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;

    &--fasting {
      background: $color-fasting;
    }

    &--eating {
      background: $color-eating;
    }
  }

  &__legend-text {
    font-size: 12px;
    color: $color-primary-light-text;
  }
}
</style>
