<template>
  <div class="timer">
    <div class="timer__header">
      <div class="timer__title">
        {{ title }}
      </div>

      <Button
        type="button"
        icon="pi pi-sync"
        rounded
        variant="outlined"
        severity="secondary"
        aria-label="Toggle timer view"
        @click="toggleTimer"
      />
    </div>

    <div class="timer__time">
      {{ time }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatTime } from '@/utils';
import { Emit } from '@/views/cycle/actors/cycle.actor';
import { useActor, useSelector } from '@xstate/vue';
import { computed, ref } from 'vue';
import { Actor, type AnyActorLogic, assign, setup } from 'xstate';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;

interface Props {
  cycleActor: Actor<AnyActorLogic>;
  startDate: Date;
  endDate: Date;
}

const props = defineProps<Props>();

const TIMER_TITLE = {
  ELAPSED: 'Elapsed Time:',
  REMAINING: 'Remaining Time:',
};

enum State {
  Elapsed = 'Elapsed',
  Remaining = 'Remaining',
}

enum Event {
  TOGGLE = 'TOGGLE',
}

type EventType = { type: Event.TOGGLE };
type Context = { title: string };

const timerMachine = setup({
  types: {
    context: {} as Context,
    events: {} as EventType,
  },
  actions: {
    onElapsed: assign({
      title: TIMER_TITLE.ELAPSED,
    }),
    onRemaining: assign({
      title: TIMER_TITLE.REMAINING,
    }),
  },
}).createMachine({
  id: 'timerCard',
  context: {
    title: TIMER_TITLE.ELAPSED,
  },
  initial: State.Elapsed,
  states: {
    [State.Elapsed]: {
      on: {
        [Event.TOGGLE]: {
          target: State.Remaining,
          actions: 'onRemaining',
        },
      },
    },
    [State.Remaining]: {
      on: {
        [Event.TOGGLE]: {
          target: State.Elapsed,
          actions: 'onElapsed',
        },
      },
    },
  },
});

const { send, actorRef } = useActor(timerMachine);

const timerState = useSelector(actorRef, (state) => state.matches(State.Elapsed));
const title = useSelector(actorRef, (state) => state.context.title);

const elapsedTime = ref(formatTime(0, 0, 0));
const remainingTime = ref(formatTime(0, 0, 0));

const time = computed(() => (timerState.value ? elapsedTime.value : remainingTime.value));

function calculateTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds / SECONDS_PER_MINUTE) % SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return formatTime(hours, minutes, seconds);
}

function updateElapsedTime() {
  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - props.startDate.getTime()) / 1000);
  elapsedTime.value = calculateTime(elapsedSeconds);
}

function updateRemainingTime() {
  const now = new Date();
  const remainingSeconds = Math.max(0, Math.floor((props.endDate.getTime() - now.getTime()) / 1000));
  remainingTime.value = calculateTime(remainingSeconds);
}

props.cycleActor.on(Emit.TICK, () => {
  updateElapsedTime();
  updateRemainingTime();
});

function toggleTimer() {
  send({ type: Event.TOGGLE });
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.timer {
  width: 268px;
  height: 110px;
  background: $color-light-grey;
  box-shadow:
    -2px 3px 4px 1px rgba(170, 170, 170, 0.25),
    inset 2px 2px 4.5px rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  padding: 8px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__title {
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    color: $color-primary-button-text;
  }

  &__time {
    display: flex;
    justify-content: center;
    margin-top: 12px;
    font-style: normal;
    font-weight: 400;
    font-size: 26px;
    color: $color-primary-button-text;
    font-variant-numeric: tabular-nums;
  }
}
</style>
