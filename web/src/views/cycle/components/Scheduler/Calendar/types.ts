export type Day = {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
};

export enum TimeUnit {
  Hour = 'hour',
  Minute = 'minute'
}

export enum TimeUnitAction {
  Increment = 'increment',
  Decrement = 'decrement'
}

