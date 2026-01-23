import { fromCallback } from 'xstate';

const TIMER_INTERVAL_MS = 100;

export const timerLogic = fromCallback(({ sendBack, receive }) => {
  const intervalId = setInterval(() => {
    sendBack({ type: 'TICK' });
  }, TIMER_INTERVAL_MS);

  receive((event) => {
    if (event.type === 'xstate.stop') {
      clearInterval(intervalId);
    }
  });

  return () => {
    clearInterval(intervalId);
  };
});
