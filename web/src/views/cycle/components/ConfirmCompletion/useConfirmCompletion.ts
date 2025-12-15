import { useFastingTimeCalculation } from '@/composables/useFastingTimeCalculation';
import { useSelector } from '@xstate/vue';
import type { ActorRefFrom } from 'xstate';
import { CycleState, Event, type cycleMachine } from '../../actors/cycle.actor';

interface UseConfirmCompletionParams {
  actorRef: ActorRefFrom<typeof cycleMachine>;
}

export function useConfirmCompletion({ actorRef }: UseConfirmCompletionParams) {
  const pendingStartDate = useSelector(actorRef, (state) => state.context.pendingStartDate);
  const pendingEndDate = useSelector(actorRef, (state) => state.context.pendingEndDate);
  const notes = useSelector(actorRef, (state) => state.context.notes);
  const savingNotes = useSelector(actorRef, (state) => state.matches(CycleState.SavingNotes));

  // Calculate total fasting time using the composable
  const totalFastingTime = useFastingTimeCalculation(pendingStartDate, pendingEndDate);

  const saveNotes = (notesText: string) => {
    actorRef.send({ type: Event.SAVE_NOTES, notes: notesText });
  };

  return {
    // Pending dates for formatting in component
    pendingStartDate,
    pendingEndDate,
    // Fasting time
    totalFastingTime,
    // Notes
    notes,
    savingNotes,
    saveNotes,
    // Actor ref for external use
    actorRef,
  };
}
