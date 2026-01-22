<template>
  <Plan v-if="hasActivePlan" />
  <Cycle v-else @has-active-plan="onHasActivePlan" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Cycle from './components/Cycle/Cycle.vue';
import Plan from './components/Plan/Plan.vue';

const hasActivePlan = ref(false);

function onHasActivePlan() {
  hasActivePlan.value = true;
}
</script>
