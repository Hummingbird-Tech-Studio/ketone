domain<template>
  <div class="spinner">
    <div
      v-for="n in 3"
      :key="n"
      :class="['spinner__bounce', `spinner__bounce--${severity}`, `spinner__bounce--delay${n}`]"
      aria-label="Loading..."
      role="status"
    ></div>
  </div>
</template>

<script setup lang="ts">
import type { BaseColor } from '@/components/domain/';

interface Props {
  severity: BaseColor;
}

defineProps<Props>();
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.spinner {
  display: flex;
  align-items: center;
  justify-content: center;

  &__bounce {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin: 0 1px;
    animation: spinner__bounce-delay 1.4s infinite ease-in-out both;

    &--primary {
      background-color: $color-purple;
    }

    &--secondary {
      background-color: $color-primary-light-text;
    }

    &--delay1 {
      animation-delay: -0.32s;
    }

    &--delay2 {
      animation-delay: -0.16s;
    }

    &--delay3 {
      animation-delay: 0s;
    }
  }
}

@keyframes spinner__bounce-delay {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
