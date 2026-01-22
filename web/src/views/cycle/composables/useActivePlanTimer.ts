import { formatTime } from '@/utils';
import type { PeriodResponse } from '@ketone/shared';
import { addHours } from 'date-fns';
import { computed, onUnmounted, ref, type Ref } from 'vue';
import type { Actor, AnyActorLogic } from 'xstate';
import { ActivePlanState, Emit } from '../actors/activePlan.actor';
import { useSelector } from '@xstate/vue';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;
const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;

interface UseActivePlanTimerParams {
  activePlanActor: Actor<AnyActorLogic>;
  currentPeriod: Ref<PeriodResponse | null>;
  windowPhase: Ref<'fasting' | 'eating' | null>;
}

/**
 * Composable for calculating timer values for active plan view.
 * Calculates elapsed and remaining time based on the current window phase.
 *
 * For fasting window: tracks time from startDate to startDate + fastingDuration
 * For eating window: tracks time from startDate + fastingDuration to endDate
 */
export function useActivePlanTimer({ activePlanActor, currentPeriod, windowPhase }: UseActivePlanTimerParams) {
  const now = ref(new Date());

  const shouldUpdateRealTime = useSelector(
    activePlanActor,
    (state) =>
      state.matches(ActivePlanState.InFastingWindow) ||
      state.matches(ActivePlanState.InEatingWindow),
  );

  const tickSubscription = activePlanActor.on(Emit.TICK, () => {
    now.value = new Date();
  });

  onUnmounted(() => {
    tickSubscription.unsubscribe();
  });

  function calculateTime(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((totalSeconds / SECONDS_PER_MINUTE) % SECONDS_PER_MINUTE);
    const seconds = totalSeconds % SECONDS_PER_MINUTE;
    return formatTime(hours, minutes, seconds);
  }

  /**
   * Get the start and end dates for the current window
   */
  const windowBounds = computed(() => {
    if (!currentPeriod.value || !windowPhase.value) {
      return { start: new Date(), end: new Date() };
    }

    const period = currentPeriod.value;
    const fastingEnd = addHours(period.startDate, period.fastingDuration);

    if (windowPhase.value === 'fasting') {
      return {
        start: period.startDate,
        end: fastingEnd,
      };
    }

    // Eating window
    return {
      start: fastingEnd,
      end: period.endDate,
    };
  });

  /**
   * Fasting start date (start of the period)
   */
  const fastingStartDate = computed(() => {
    if (!currentPeriod.value) return new Date();
    return currentPeriod.value.startDate;
  });

  /**
   * Fasting end date (start + fastingDuration hours)
   */
  const fastingEndDate = computed(() => {
    if (!currentPeriod.value) return new Date();
    return addHours(currentPeriod.value.startDate, currentPeriod.value.fastingDuration);
  });

  /**
   * Elapsed time within the current window
   */
  const elapsedTime = computed(() => {
    if (!currentPeriod.value || !windowPhase.value) {
      return formatTime(0, 0, 0);
    }

    const { start } = windowBounds.value;
    const referenceTime = shouldUpdateRealTime.value ? now.value : windowBounds.value.end;
    const elapsedSeconds = Math.max(0, Math.floor((referenceTime.getTime() - start.getTime()) / 1000));
    return calculateTime(elapsedSeconds);
  });

  /**
   * Remaining time within the current window
   */
  const remainingTime = computed(() => {
    if (!currentPeriod.value || !windowPhase.value) {
      return formatTime(0, 0, 0);
    }

    if (!shouldUpdateRealTime.value) {
      return formatTime(0, 0, 0);
    }

    const { end } = windowBounds.value;
    const remainingSeconds = Math.max(0, Math.floor((end.getTime() - now.value.getTime()) / 1000));
    return calculateTime(remainingSeconds);
  });

  /**
   * Progress percentage within the current window (0-100)
   */
  const progressPercentage = computed(() => {
    if (!currentPeriod.value || !windowPhase.value) {
      return MIN_PERCENTAGE;
    }

    const { start, end } = windowBounds.value;
    const totalDuration = end.getTime() - start.getTime();

    if (totalDuration <= 0) {
      return MIN_PERCENTAGE;
    }

    const referenceTime = shouldUpdateRealTime.value ? now.value : end;
    const elapsed = referenceTime.getTime() - start.getTime();
    const percentage = (elapsed / totalDuration) * MAX_PERCENTAGE;

    return Math.max(MIN_PERCENTAGE, Math.min(percentage, MAX_PERCENTAGE));
  });

  return {
    elapsedTime,
    remainingTime,
    progressPercentage,
    fastingStartDate,
    fastingEndDate,
    windowBounds,
  };
}
