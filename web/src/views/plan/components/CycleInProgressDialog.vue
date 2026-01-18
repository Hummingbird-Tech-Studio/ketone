<template>
  <Dialog
    :visible="visible"
    modal
    header="Cycle In Progress"
    :style="{ width: '350px' }"
    :draggable="false"
    @update:visible="handleVisibilityChange"
  >
    <div class="cycle-in-progress-dialog">
      <div class="cycle-in-progress-dialog__icon">
        <i class="pi pi-exclamation-circle"></i>
      </div>
      <p class="cycle-in-progress-dialog__message">
        You have an active fasting cycle. To start a new plan, you need to finish your current cycle first.
      </p>
    </div>

    <template #footer>
      <div class="cycle-in-progress-dialog__actions">
        <Button label="Cancel" severity="secondary" outlined @click="handleCancel" />
        <Button label="Go to Cycle" @click="handleGoToCycle" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'goToCycle'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function handleVisibilityChange(value: boolean) {
  emit('update:visible', value);
}

function handleCancel() {
  emit('update:visible', false);
}

function handleGoToCycle() {
  emit('goToCycle');
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.cycle-in-progress-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background-color: var(--p-orange-50);

    i {
      font-size: 28px;
      color: var(--p-orange-500);
    }
  }

  &__message {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: $color-primary-light-text;
  }

  &__actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
}
</style>
