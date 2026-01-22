<template>
  <Plan v-if="showActivePlan" @no-active-plan="onNoActivePlan" />
  <Cycle v-else @has-active-plan="onHasActivePlan" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Cycle from './components/Cycle/Cycle.vue';
import Plan from './components/Plan/Plan.vue';

const showActivePlan = ref(false);

function onHasActivePlan() {
  showActivePlan.value = true;
}

function onNoActivePlan() {
  showActivePlan.value = false;
}
</script>
