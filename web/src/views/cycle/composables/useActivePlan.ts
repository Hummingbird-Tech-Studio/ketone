import { activePlanMachine, ActivePlanState, Event } from '@/views/cycle/actors/activePlan.actor';
import { useActor, useSelector } from '@xstate/vue';
import { computed } from 'vue';

/**
 * Composable for accessing active plan state and actions
 *
 * @example
 * ```ts
 * const {
 *   loading,
 *   idle,
 *   inFastingWindow,
 *   inEatingWindow,
 *   periodCompleted,
 *   allPeriodsCompleted,
 *   activePlan,
 *   currentPeriod,
 *   windowPhase,
 *   refresh,
 *   actorRef,
 * } = useActivePlan();
 * ```
 */
export function useActivePlan() {
  const { send, actorRef } = useActor(activePlanMachine);

  // State checks
  const loading = useSelector(actorRef, (state) => state.matches(ActivePlanState.Loading));
  const idle = useSelector(actorRef, (state) => state.matches(ActivePlanState.Idle));
  const inFastingWindow = useSelector(actorRef, (state) => state.matches(ActivePlanState.InFastingWindow));
  const inEatingWindow = useSelector(actorRef, (state) => state.matches(ActivePlanState.InEatingWindow));
  const periodCompleted = useSelector(actorRef, (state) => state.matches(ActivePlanState.PeriodCompleted));
  const allPeriodsCompleted = useSelector(actorRef, (state) => state.matches(ActivePlanState.AllPeriodsCompleted));

  // Context data
  const activePlan = useSelector(actorRef, (state) => state.context.activePlan);
  const currentPeriod = useSelector(actorRef, (state) => state.context.currentPeriod);
  const windowPhase = useSelector(actorRef, (state) => state.context.windowPhase);

  // UI helpers
  const showSkeleton = computed(() => loading.value);
  const isActive = computed(() => inFastingWindow.value || inEatingWindow.value);

  // Computed properties for period info
  const completedPeriodsCount = computed(() => {
    if (!activePlan.value) return 0;
    return activePlan.value.periods.filter((p) => p.status === 'completed').length;
  });

  const totalPeriodsCount = computed(() => {
    if (!activePlan.value) return 0;
    return activePlan.value.periods.length;
  });

  // Actions
  const refresh = () => {
    send({ type: Event.REFRESH });
  };

  return {
    // State checks
    loading,
    idle,
    inFastingWindow,
    inEatingWindow,
    periodCompleted,
    allPeriodsCompleted,

    // Context data
    activePlan,
    currentPeriod,
    windowPhase,

    // UI helpers
    showSkeleton,
    isActive,

    // Computed plan data
    completedPeriodsCount,
    totalPeriodsCount,

    // Actions
    refresh,

    // Actor ref (for advanced usage like listening to emits)
    actorRef,
  };
}
