<template>
  <div class="cycle-view">
    <h1>Cycle View</h1>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <p>Loading cycle...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error">
      <h2>Error</h2>
      <p>{{ error }}</p>
    </div>

    <!-- Success State -->
    <div v-else-if="cycleData" class="cycle-data">
      <h2>Cycle Details</h2>
      <div class="cycle-info">
        <p><strong>ID:</strong> {{ cycleData.id }}</p>
        <p><strong>Status:</strong> {{ cycleData.status }}</p>
        <p><strong>Start Date:</strong> {{ formatDate(cycleData.startDate) }}</p>
        <p><strong>End Date:</strong> {{ formatDate(cycleData.endDate) }}</p>
        <p><strong>Created At:</strong> {{ formatDate(cycleData.createdAt) }}</p>
        <p><strong>Updated At:</strong> {{ formatDate(cycleData.updatedAt) }}</p>
      </div>
    </div>

    <!-- No Cycle State -->
    <div v-else class="no-cycle">
      <p>No cycle available.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useCycle } from './composables/useCycle';
import { Emit } from './actors/cycle.actor';

// Use cycle composable
const { loading, cycleData, loadActiveCycle, actorRef } = useCycle();

// Error handling through emitted events
const error = ref<string | null>(null);

// Listen to cycle error events
actorRef.on(Emit.CYCLE_ERROR, (event) => {
  error.value = event.error;
});

// Clear error when cycle is loaded successfully
actorRef.on(Emit.CYCLE_LOADED, () => {
  error.value = null;
});

// Format date for display
const formatDate = (date: Date) => {
  return new Date(date).toLocaleString();
};

// Load active cycle on mount
onMounted(() => {
  loadActiveCycle();
});
</script>

<style scoped lang="scss">
.cycle-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;

  h1 {
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  .loading {
    font-size: 1.2rem;
    color: #666;
  }

  .error {
    color: #d32f2f;
    padding: 1rem;
    border: 1px solid #d32f2f;
    border-radius: 8px;
    background-color: #ffebee;

    h2 {
      margin-bottom: 0.5rem;
    }
  }

  .cycle-data {
    max-width: 600px;
    width: 100%;

    h2 {
      margin-bottom: 1.5rem;
      font-size: 1.5rem;
    }

    .cycle-info {
      background-color: #f5f5f5;
      padding: 1.5rem;
      border-radius: 8px;
      text-align: left;

      p {
        margin: 0.75rem 0;
        font-size: 1rem;

        strong {
          color: #333;
          margin-right: 0.5rem;
        }
      }
    }
  }

  .no-cycle {
    color: #666;
    padding: 2rem;

    p {
      margin: 0.5rem 0;
      font-size: 1.1rem;

      &:last-child {
        font-size: 0.9rem;
        color: #999;
      }
    }
  }
}
</style>
