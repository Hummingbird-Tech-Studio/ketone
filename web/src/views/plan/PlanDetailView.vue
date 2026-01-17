<template>
  <div class="plan-detail">
    <div class="plan-detail__header">
      <div class="plan-detail__back">
        <Button icon="pi pi-chevron-left" label="Plans" variant="text" severity="secondary" @click="handleBack" />
      </div>
      <h1 class="plan-detail__title">Settings</h1>
    </div>

    <div class="plan-detail__content">
      <div class="plan-detail__cards">
        <PlanSettingsCard v-model:name="planName" v-model:description="planDescription" />
        <PlanConfigCard
          :ratio="currentPreset.ratio"
          v-model:fasting-duration="baseFastingDuration"
          v-model:eating-window="baseEatingWindow"
          v-model:start-date="startDate"
        />
      </div>

      <PlanTimeline
        :period-configs="periodConfigs"
        @update:period-configs="handlePeriodConfigsUpdate"
        @delete-period="handleDeletePeriod"
      />
    </div>

    <div class="plan-detail__footer">
      <Button label="Reset" severity="secondary" variant="outlined" @click="handleReset" />
      <div class="plan-detail__footer-right">
        <Button label="Cancel" severity="secondary" variant="outlined" @click="handleCancel" />
        <Button label="Start Plan" @click="handleStartPlan" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PlanConfigCard from './components/PlanConfigCard.vue';
import PlanSettingsCard from './components/PlanSettingsCard.vue';
import PlanTimeline from './components/PlanTimeline/PlanTimeline.vue';
import type { PeriodConfig } from './components/PlanTimeline/types';
import { DEFAULT_PERIODS_TO_SHOW, DEFAULT_START_OFFSET_MINUTES } from './constants';
import { findPresetById, getDefaultCustomPreset } from './presets';

const route = useRoute();
const router = useRouter();

const presetId = computed(() => route.params.presetId as string);
const currentPreset = computed(() => {
  if (presetId.value === 'custom') {
    return getDefaultCustomPreset();
  }
  return findPresetById(presetId.value) ?? getDefaultCustomPreset();
});

// Base settings for new periods (from PlanConfigCard)
const planName = ref(currentPreset.value.ratio);
const planDescription = ref('');
const baseFastingDuration = ref(currentPreset.value.fastingDuration);
const baseEatingWindow = ref(currentPreset.value.eatingWindow);

const getDefaultStartDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + DEFAULT_START_OFFSET_MINUTES);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
};

const startDate = ref(getDefaultStartDate());

// Initialize period configs with fixed start times
const createInitialPeriodConfigs = (
  numPeriods: number,
  firstStartTime: Date,
  fastingDuration: number,
  eatingWindow: number,
): PeriodConfig[] => {
  const configs: PeriodConfig[] = [];
  let currentStartTime = new Date(firstStartTime);

  for (let i = 0; i < numPeriods; i++) {
    configs.push({
      startTime: new Date(currentStartTime),
      fastingDuration,
      eatingWindow,
      deleted: false,
    });

    // Calculate next period's start time (end of current period)
    const periodDuration = fastingDuration + eatingWindow;
    currentStartTime = new Date(currentStartTime.getTime() + periodDuration * 60 * 60 * 1000);
  }

  return configs;
};

const periodConfigs = ref<PeriodConfig[]>(
  createInitialPeriodConfigs(
    DEFAULT_PERIODS_TO_SHOW,
    startDate.value,
    currentPreset.value.fastingDuration,
    currentPreset.value.eatingWindow,
  ),
);

// When start date changes, reinitialize all periods with new start times
// This keeps the same durations but shifts all periods
watch(startDate, (newStartDate) => {
  const configs: PeriodConfig[] = [];
  let currentStartTime = new Date(newStartDate);

  for (const config of periodConfigs.value) {
    configs.push({
      ...config,
      startTime: new Date(currentStartTime),
    });

    // Calculate next period's start time based on current config's duration
    const periodDuration = config.fastingDuration + config.eatingWindow;
    currentStartTime = new Date(currentStartTime.getTime() + periodDuration * 60 * 60 * 1000);
  }

  periodConfigs.value = configs;
});

// When base settings change from PlanConfigCard, only apply to periods that haven't been edited
// For simplicity, we'll skip this behavior - periods are now independent once created
// The PlanConfigCard only affects newly created periods or reset

const handlePeriodConfigsUpdate = (newConfigs: PeriodConfig[]) => {
  periodConfigs.value = newConfigs;
};

const handleReset = () => {
  planName.value = currentPreset.value.ratio;
  planDescription.value = '';
  baseFastingDuration.value = currentPreset.value.fastingDuration;
  baseEatingWindow.value = currentPreset.value.eatingWindow;
  startDate.value = getDefaultStartDate();
  periodConfigs.value = createInitialPeriodConfigs(
    DEFAULT_PERIODS_TO_SHOW,
    startDate.value,
    currentPreset.value.fastingDuration,
    currentPreset.value.eatingWindow,
  );
};

const handleBack = () => {
  router.push('/plans');
};

const handleCancel = () => {
  router.push('/plans');
};

const handleStartPlan = () => {
  // TODO: Create plan via API
  console.log('Start plan:', {
    name: planName.value,
    description: planDescription.value,
    periodConfigs: periodConfigs.value,
  });
};

const handleDeletePeriod = (periodIndex: number) => {
  console.log('Delete period:', periodIndex);
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.plan-detail {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 312px;
  margin: auto;
  gap: 24px;
  padding-bottom: 24px;

  @media only screen and (min-width: $breakpoint-tablet-min-width) {
    max-width: 680px;
  }

  &__header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__back {
    margin-left: -12px;
  }

  &__title {
    font-size: 20px;
    font-weight: 600;
    color: $color-primary-button-text;
    margin: 0;
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  &__cards {
    display: flex;
    flex-direction: column;
    gap: 16px;

    @media only screen and (min-width: $breakpoint-tablet-min-width) {
      flex-direction: row;

      > * {
        flex: 1;
      }
    }
  }

  &__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px solid $color-primary-button-outline;
  }

  &__footer-right {
    display: flex;
    gap: 12px;
  }
}
</style>
