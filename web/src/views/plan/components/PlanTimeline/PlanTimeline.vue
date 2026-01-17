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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { usePlanTimelineData } from './composables/usePlanTimelineData';
import { usePlanTimelineChart } from './composables/usePlanTimelineChart';

const props = defineProps<{
  fastingDuration: number;
  eatingWindow: number;
  startDate: Date;
  periods: number;
}>();

const chartContainerRef = ref<HTMLElement | null>(null);

// Data transformation
const timelineData = usePlanTimelineData({
  fastingDuration: toRef(() => props.fastingDuration),
  eatingWindow: toRef(() => props.eatingWindow),
  startDate: toRef(() => props.startDate),
  periods: toRef(() => props.periods),
});

// Chart rendering
const { chartHeight } = usePlanTimelineChart(chartContainerRef, {
  numRows: timelineData.numRows,
  dayLabels: timelineData.dayLabels,
  hourLabels: timelineData.hourLabels,
  hourPositions: timelineData.hourPositions,
  timelineBars: timelineData.timelineBars,
  fastingDuration: toRef(() => props.fastingDuration),
  eatingWindow: toRef(() => props.eatingWindow),
});

// Dynamic height
const chartContainerStyle = computed(() => ({
  height: `${chartHeight.value}px`,
}));
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
