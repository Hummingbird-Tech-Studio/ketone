export type BarType = 'fasting' | 'eating';

export interface TimelineBar {
  periodIndex: number;
  dayIndex: number;
  startHour: number;
  endHour: number;
  duration: string;
  type: BarType;
}

/**
 * Configuration for a single period in the timeline.
 * Each period has its own fasting duration, eating window, and fixed start time.
 */
export interface PeriodConfig {
  startTime: Date;
  fastingDuration: number;
  eatingWindow: number;
  deleted: boolean;
}
