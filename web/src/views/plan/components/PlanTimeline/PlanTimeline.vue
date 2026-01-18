<template>
  <div class="plan-timeline">
    <div class="plan-timeline__header">
      <h3 class="plan-timeline__title">Timeline</h3>
    </div>

    <div ref="chartContainerRef" class="plan-timeline__chart" :style="chartContainerStyle"></div>

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
      :visible-period-number="selectedPeriodVisibleNumber"
      :fasting-duration="selectedPeriodConfig?.fastingDuration ?? 0"
      :eating-window="selectedPeriodConfig?.eatingWindow ?? 0"
      :start-time="selectedPeriodConfig?.startTime ?? new Date()"
      :min-start-time="selectedPeriodMinStartTime"
      :next-period-start-time="nextPeriodStartTime"
      @save="handlePeriodSave"
      @delete="handlePeriodDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { usePlanTimelineChart } from './composables/usePlanTimelineChart';
import { usePlanTimelineData } from './composables/usePlanTimelineData';
import PeriodEditDialog from './PeriodEditDialog.vue';
import type { PeriodConfig } from './types';

const props = defineProps<{
  periodConfigs: PeriodConfig[];
}>();

const emit = defineEmits<{
  (e: 'update:periodConfigs', value: PeriodConfig[]): void;
  (e: 'deletePeriod', periodIndex: number): void;
}>();

const chartContainerRef = ref<HTMLElement | null>(null);

// Dialog state
const isDialogVisible = ref(false);
const selectedPeriodIndex = ref(0);

// Get the selected period's config
const selectedPeriodConfig = computed(() => {
  return props.periodConfigs[selectedPeriodIndex.value];
});

// Calculate the visible period number (counting only non-deleted periods)
const selectedPeriodVisibleNumber = computed(() => {
  let visibleNumber = 0;
  for (let i = 0; i <= selectedPeriodIndex.value; i++) {
    const config = props.periodConfigs[i];
    if (config && !config.deleted) {
      visibleNumber++;
    }
  }
  return visibleNumber;
});

// Calculate min start time for the selected period
// This is the end time of the previous non-deleted period
const selectedPeriodMinStartTime = computed<Date | null>(() => {
  const configs = props.periodConfigs;
  const currentIndex = selectedPeriodIndex.value;

  // Find the previous non-deleted period
  let prevPeriodConfig: PeriodConfig | null = null;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!configs[i]!.deleted) {
      prevPeriodConfig = configs[i]!;
      break;
    }
  }

  // If no previous period found, no minimum constraint
  if (!prevPeriodConfig) return null;

  // Calculate previous period's end time
  const prevEndTime = new Date(prevPeriodConfig.startTime);
  prevEndTime.setHours(prevEndTime.getHours() + prevPeriodConfig.fastingDuration + prevPeriodConfig.eatingWindow);

  return prevEndTime;
});

// Get the next period's start time for collision validation
const nextPeriodStartTime = computed<Date | null>(() => {
  const configs = props.periodConfigs;
  const currentIndex = selectedPeriodIndex.value;

  // Find the next non-deleted period
  for (let i = currentIndex + 1; i < configs.length; i++) {
    if (!configs[i]!.deleted) {
      return configs[i]!.startTime;
    }
  }

  return null; // No next period
});

// Data transformation
const timelineData = usePlanTimelineData({
  periodConfigs: toRef(() => props.periodConfigs),
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
  periodConfigs: toRef(() => props.periodConfigs),
  onPeriodClick: handlePeriodClick,
});

// Dynamic height
const chartContainerStyle = computed(() => ({
  height: `${chartHeight.value}px`,
}));

// Dialog handlers
function handlePeriodSave(data: { periodIndex: number; fastingDuration: number; eatingWindow: number; startTime: Date }) {
  const newConfigs = [...props.periodConfigs];
  newConfigs[data.periodIndex] = {
    ...newConfigs[data.periodIndex]!,
    fastingDuration: data.fastingDuration,
    eatingWindow: data.eatingWindow,
    startTime: data.startTime,
  };
  emit('update:periodConfigs', newConfigs);
  isDialogVisible.value = false;
}

function handlePeriodDelete(periodIndex: number) {
  const newConfigs = [...props.periodConfigs];
  newConfigs[periodIndex] = {
    ...newConfigs[periodIndex]!,
    deleted: true,
  };
  emit('update:periodConfigs', newConfigs);
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
