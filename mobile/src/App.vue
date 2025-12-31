<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { Emit as AuthEmit, authenticationActor, State as AuthState, type EmitType } from '@/actors/authenticationActor';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { Match } from 'effect';
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

function handleAuthEmit(emitType: EmitType) {
  Match.value(emitType).pipe(
    Match.when({ type: AuthEmit.AUTHENTICATED }, () => {
      router.push('/home');
    }),
    Match.when({ type: AuthEmit.UNAUTHENTICATED }, () => {
      router.push('/sign-in');
    }),
    Match.when({ type: AuthEmit.AUTHENTICATION_ERROR }, (emit) => {
      console.error('Authentication error:', emit.error);
      router.push('/sign-in');
    }),
    Match.exhaustive,
  );
}

const authSubscription = Object.values(AuthEmit).map((emit) => authenticationActor.on(emit, handleAuthEmit));

onMounted(() => {
  // Check initial auth state after actor has initialized
  const snapshot = authenticationActor.getSnapshot();
  if (snapshot.matches(AuthState.UNAUTHENTICATED)) {
    router.push('/sign-in');
  } else if (snapshot.matches(AuthState.AUTHENTICATED)) {
    router.push('/home');
  }
});

onUnmounted(() => {
  authSubscription.forEach((sub) => sub.unsubscribe());
});
</script>
