<template>
  <Dialog
    :visible="visible"
    modal
    header="Confirm Completion"
    :style="{ width: '350px' }"
    :draggable="false"
    @update:visible="handleClose"
  >
    <div class="cycle-summary">
      <div class="cycle-summary__section">
        <div class="cycle-summary__label">Total Fasting Time:</div>
        <div class="cycle-summary__time">{{ totalFastingTime }}</div>
      </div>

      <div class="cycle-summary__section">
        <div class="cycle-summary__scheduler cycle-summary__scheduler--start">
          <div class="cycle-summary__scheduler-icon">
            <StartTimeIcon />
          </div>
          <div class="cycle-summary__scheduler-content">
            <div class="cycle-summary__scheduler-title">Start:</div>
            <div class="cycle-summary__scheduler-datetime">
              {{ formatDate(pendingStartDate!) }}, {{ formatHour(pendingStartDate!) }}
            </div>
          </div>
          <Button
            type="button"
            icon="pi pi-calendar"
            rounded
            variant="outlined"
            severity="secondary"
            aria-label="Start Date"
            @click="handleStartCalendarClick"
          />
        </div>
      </div>

      <Divider class="cycle-summary__divider" />

      <div class="cycle-summary__section">
        <div class="cycle-summary__scheduler cycle-summary__scheduler--end">
          <div class="cycle-summary__scheduler-icon">
            <EndTimeIcon />
          </div>
          <div class="cycle-summary__scheduler-content">
            <div class="cycle-summary__scheduler-title">End:</div>
            <div class="cycle-summary__scheduler-datetime">
              {{ formatDate(pendingEndDate!) }}, {{ formatHour(pendingEndDate!) }}
            </div>
          </div>
          <Button
            type="button"
            icon="pi pi-calendar"
            rounded
            variant="outlined"
            severity="secondary"
            aria-label="End Date"
            @click="handleEndCalendarClick"
          />
        </div>
      </div>

      <div class="cycle-summary__notes">
        <div class="cycle-summary__notes-header">Notes</div>
        <Textarea
          v-model="localNotes"
          placeholder="Add a note about this fast"
          rows="4"
          :class="['cycle-summary__notes-textarea', { 'cycle-summary__notes-textarea--error': notesError }]"
          :maxlength="NOTES_MAX_LENGTH"
        />
        <div class="cycle-summary__notes-footer">
          <span class="cycle-summary__notes-counter">{{ localNotes.length }}/{{ NOTES_MAX_LENGTH }}</span>
        </div>
        <Message v-if="notesError" severity="error" variant="simple" size="small">
          {{ notesError }}
        </Message>
        <div class="cycle-summary__notes-actions">
          <Button label="Save Notes" outlined :loading="savingNotes" :disabled="!canSaveNotes" @click="handleSaveNotes" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="cycle-summary__footer">
        <Button label="Close" outlined @click="handleClose" />
        <Button label="Finish Fast" :loading="loading" @click="handleComplete" />
      </div>
    </template>
  </Dialog>

  <DateTimePickerDialog
    :visible="dialogVisible"
    :title="dialogTitle"
    :dateTime="dialogDate || new Date()"
    @update:visible="handleDatePickerVisibilityChange"
    @update:dateTime="handleDateTimeUpdate"
  />
</template>

<script setup lang="ts">
import DateTimePickerDialog from '@/components/DateTimePickerDialog/DateTimePickerDialog.vue';
import EndTimeIcon from '@/components/Icons/EndTime.vue';
import StartTimeIcon from '@/components/Icons/StartTime.vue';
import { formatDate, formatHour } from '@/utils/formatting';
import { NOTES_MAX_LENGTH, NotesSchema } from '@ketone/shared';
import { Schema } from 'effect';
import { computed, ref, watch } from 'vue';
import type { ActorRefFrom } from 'xstate';
import { type cycleMachine } from '../../actors/cycle.actor';
import { useSchedulerDialog } from '../../composables/useSchedulerDialog';
import { useConfirmCompletion } from './useConfirmCompletion';

const props = defineProps<{ visible: boolean; loading: boolean; actorRef: ActorRefFrom<typeof cycleMachine> }>();

const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'complete'): void }>();

const { pendingStartDate, pendingEndDate, totalFastingTime, notes, savingNotes, saveNotes, actorRef } =
  useConfirmCompletion({
    actorRef: props.actorRef,
  });

// Local state for notes textarea
const localNotes = ref(notes.value ?? '');

// Validation error state
const notesError = ref<string | null>(null);

// Validate notes using shared schema
function validateNotes(value: string): boolean {
  const result = Schema.decodeUnknownEither(NotesSchema)(value);
  if (result._tag === 'Left') {
    notesError.value = `Notes must be at most ${NOTES_MAX_LENGTH} characters`;
    return false;
  }
  notesError.value = null;
  return true;
}

// Sync local notes when notes from server change
watch(notes, (newVal) => {
  localNotes.value = newVal ?? '';
  validateNotes(localNotes.value);
});

// Validate on input change
watch(localNotes, (newVal) => {
  validateNotes(newVal);
});

// Detect if notes have changed and are valid
const hasNotesChanged = computed(() => {
  return localNotes.value !== (notes.value ?? '');
});

const canSaveNotes = computed(() => {
  return hasNotesChanged.value && notesError.value === null;
});

function handleSaveNotes() {
  if (validateNotes(localNotes.value)) {
    saveNotes(localNotes.value);
  }
}

const { dialogVisible, dialogTitle, dialogDate, openStartDialog, openEndDialog, closeDialog, submitDialog } =
  useSchedulerDialog(actorRef);

function handleStartCalendarClick() {
  openStartDialog();
}

function handleEndCalendarClick() {
  openEndDialog();
}

function handleDateTimeUpdate(newDate: Date) {
  submitDialog(newDate);
}

function handleDatePickerVisibilityChange(value: boolean) {
  if (!value) {
    closeDialog();
  }
}

function handleClose() {
  emit('update:visible', false);
}

function handleComplete() {
  emit('complete');
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.cycle-summary {
  display: flex;
  flex-direction: column;
  padding-top: 8px;

  &__section {
    display: flex;
    flex-direction: column;
  }

  &__label {
    align-self: center;
    font-size: 16px;
    color: $color-primary-button-text;
  }

  &__time {
    font-size: 24px;
    font-weight: 700;
    color: $color-primary-button-text;
    text-align: center;
    padding: 8px 0;
  }

  &__scheduler {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 0;
  }

  &__scheduler-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  &__scheduler--start &__scheduler-icon {
    background: rgba(45, 179, 94, 0.1);
  }

  &__scheduler--end &__scheduler-icon {
    background: rgba(171, 67, 234, 0.1);
  }

  &__scheduler-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__scheduler-title {
    font-weight: 600;
    font-size: 16px;
    color: $color-primary-button-text;
  }

  &__scheduler-datetime {
    font-weight: 400;
    font-size: 14px;
    color: $color-primary-button-text;
  }

  &__footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  &__divider {
    --p-divider-border-color: #{$color-purple};
  }

  &__notes {
    margin-top: 1.5rem;

    &-header {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    &-textarea {
      width: 100%;
      resize: none;

      &--error {
        border-color: var(--p-red-500);
      }
    }

    &-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.25rem;
    }

    &-counter {
      font-size: 12px;
      color: var(--p-text-muted-color);
    }

    &-actions {
      display: flex;
      justify-content: center;
      margin-top: 1rem;
    }
  }
}
</style>
