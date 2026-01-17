import { computed, type Ref } from 'vue';
import type { TimelineBar } from '../types';

interface UsePlanTimelineDataOptions {
  fastingDuration: Ref<number>;
  eatingWindow: Ref<number>;
  startDate: Ref<Date>;
  periods: Ref<number>;
}

export function usePlanTimelineData(options: UsePlanTimelineDataOptions) {
  // Calculate the end time of the last complete period
  const lastPeriodEndTime = computed(() => {
    const periodDurationHours = options.fastingDuration.value + options.eatingWindow.value;
    const endTime = new Date(options.startDate.value);
    endTime.setHours(endTime.getHours() + options.periods.value * periodDurationHours);
    return endTime;
  });

  // Calculate number of days needed to show all complete periods
  const numRows = computed(() => {
    const startDay = new Date(options.startDate.value);
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date(lastPeriodEndTime.value);
    endDay.setHours(0, 0, 0, 0);

    const daysDiff = Math.ceil((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff + 1;
  });

  const dayLabels = computed(() => {
    const labels: string[] = [];
    const startTime = new Date(options.startDate.value);

    for (let i = 0; i < numRows.value; i++) {
      const currentDate = new Date(startTime);
      currentDate.setDate(startTime.getDate() + i);

      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = currentDate.getDate().toString();
      labels.push(`${dayName}\n${dayNum}`);
    }

    return labels;
  });

  const hourLabels = computed(() => ['12AM', '6AM', '12PM', '6PM']);

  const hourPositions = computed(() => [0, 6, 12, 18]);

  const timelineBars = computed<TimelineBar[]>(() => {
    const bars: TimelineBar[] = [];
    const startTime = new Date(options.startDate.value);
    const endTimeLimit = lastPeriodEndTime.value.getTime();

    // Generate bars for exactly the specified number of periods
    for (let periodIndex = 0; periodIndex < options.periods.value; periodIndex++) {
      const periodDurationHours = options.fastingDuration.value + options.eatingWindow.value;
      const periodStart = new Date(startTime);
      periodStart.setHours(periodStart.getHours() + periodIndex * periodDurationHours);

      const fastingEnd = new Date(periodStart);
      fastingEnd.setHours(fastingEnd.getHours() + options.fastingDuration.value);

      const eatingEnd = new Date(fastingEnd);
      eatingEnd.setHours(eatingEnd.getHours() + options.eatingWindow.value);

      // Split fasting period across days
      addBarsForTimeRange(
        bars,
        periodIndex,
        periodStart,
        fastingEnd,
        'fasting',
        startTime,
        endTimeLimit,
      );

      // Split eating period across days
      if (options.eatingWindow.value > 0) {
        addBarsForTimeRange(
          bars,
          periodIndex,
          fastingEnd,
          eatingEnd,
          'eating',
          startTime,
          endTimeLimit,
        );
      }
    }

    return bars;
  });

  // Helper function to add bars for a time range, splitting across days
  function addBarsForTimeRange(
    bars: TimelineBar[],
    periodIndex: number,
    rangeStart: Date,
    rangeEnd: Date,
    type: 'fasting' | 'eating',
    timelineStart: Date,
    endTimeLimit: number,
  ) {
    const timelineStartDay = new Date(timelineStart);
    timelineStartDay.setHours(0, 0, 0, 0);

    let currentStart = new Date(rangeStart);

    while (currentStart < rangeEnd && currentStart.getTime() < endTimeLimit) {
      const dayStart = new Date(currentStart);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const barStart = currentStart;
      const barEnd = new Date(Math.min(rangeEnd.getTime(), dayEnd.getTime(), endTimeLimit));

      const dayIndex = Math.floor((dayStart.getTime() - timelineStartDay.getTime()) / (1000 * 60 * 60 * 24));

      const startHour = (barStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
      const endHour = (barEnd.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
      const durationHours = Math.round(endHour - startHour);

      if (durationHours > 0 && dayIndex >= 0) {
        bars.push({
          periodIndex,
          dayIndex,
          startHour,
          endHour,
          duration: `${durationHours}h`,
          type,
        });
      }

      // Move to next day
      currentStart = dayEnd;
    }
  }

  return {
    numRows,
    dayLabels,
    hourLabels,
    hourPositions,
    timelineBars,
  };
}
