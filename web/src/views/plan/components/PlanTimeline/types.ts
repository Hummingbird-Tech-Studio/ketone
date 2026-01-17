export type BarType = 'fasting' | 'eating';

export interface TimelineBar {
  periodIndex: number;
  dayIndex: number;
  startHour: number;
  endHour: number;
  duration: string;
  type: BarType;
}
