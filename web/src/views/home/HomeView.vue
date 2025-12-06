<template>
  <main class="home">
    <section class="home__hero">
      <div class="home__hero-content">
        <h1 class="home__title">A simple, free, and open-source fasting tracker</h1>
        <p class="home__subtitle">
          Not subscriptions, not cluttered, not intrusive; no cookies, no long questionnaires… Oh! and no AI.
        </p>
        <router-link to="/sign-in" class="home__cta">Start your fast now!</router-link>
      </div>
      <div class="home__hero-image">
        <HomeFasting />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import HomeFasting from './components/HomeFasting.vue';
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.home {
  min-height: 100vh;
  background-color: $color-light-grey;

  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px $horizontal-gap;
    max-width: 1200px;
    margin: 0 auto;
  }

  &__hero-content {
    text-align: center;
    max-width: 400px;
  }

  &__title {
    font-size: 56px;
    font-weight: 700;
    color: $color-primary-button-text;
    margin: 0 0 16px;
  }

  &__subtitle {
    font-size: 1rem;
    line-height: 1.5;
    color: $color-primary-button-text;
    margin: 0 0 32px;
  }

  &__cta {
    display: inline-block;
    padding: 14px 24px;
    background: #e2fae5;
    border-radius: 50px;
    color: $color-primary;
    font-weight: 600;
    font-size: 16px;
    border: 2px solid $color-primary;
    text-decoration: none;
    transition:
      background-color 0.2s,
      transform 0.2s;

    &:hover {
      background-color: #d4f4e8;
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }
  }

  &__hero-image {
    margin-top: 40px;
    max-width: 100%;

    :deep(svg) {
      width: 100%;
      height: auto;
      max-width: 500px;
    }
  }

  @media (min-width: $breakpoint-desktop-min-width) {
    &__hero {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding: 80px $horizontal-gap;
      min-height: 80vh;
    }

    &__hero-content {
      text-align: left;
      max-width: 420px;
      flex-shrink: 0;
    }

    &__title {
      font-size: 2.75rem;
    }

    &__subtitle {
      font-size: 1.125rem;
    }

    &__hero-image {
      margin-top: 0;
      margin-left: 60px;
      flex: 1;
      display: flex;
      justify-content: center;

      :deep(svg) {
        max-width: 600px;
      }
    }
  }
}
</style>
