export type BarType = 'fasting' | 'eating';

export interface TimelineBar {
  dayIndex: number;
  startHour: number;
  endHour: number;
  duration: string;
  type: BarType;
}
