<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Sign In</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Sign In</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="sign-in-form">
        <div class="logo-section">
          <ion-icon :icon="flashOutline" class="logo-icon" />
          <h1>Ketone</h1>
          <p>Intermittent Fasting Tracker</p>
        </div>

        <ion-text v-if="serviceError" color="danger" class="service-error">
          <p>{{ serviceError }}</p>
        </ion-text>

        <form @submit.prevent="onSubmit">
          <ion-item :class="{ 'ion-invalid': emailError }">
            <ion-input
              v-model="email"
              type="email"
              label="Email"
              label-placement="floating"
              placeholder="Enter your email"
              @ion-blur="validateEmail"
            />
          </ion-item>
          <ion-text v-if="emailError" color="danger" class="field-error">
            <p>{{ emailError }}</p>
          </ion-text>

          <ion-item :class="{ 'ion-invalid': passwordError }">
            <ion-input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              label-placement="floating"
              placeholder="Enter your password"
              @ion-blur="validatePassword"
            />
            <ion-button fill="clear" slot="end" @click="showPassword = !showPassword">
              <ion-icon slot="icon-only" :icon="showPassword ? eyeOffOutline : eyeOutline" />
            </ion-button>
          </ion-item>
          <ion-text v-if="passwordError" color="danger" class="field-error">
            <p>{{ passwordError }}</p>
          </ion-text>

          <ion-button expand="block" type="submit" class="submit-button" :disabled="submitting">
            <ion-spinner v-if="submitting" name="crescent" />
            <span v-else>Sign In</span>
          </ion-button>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { authenticationActor, Event as AuthEvent } from '@/actors/authenticationActor';
import { Emit, Event, signInMachine, SignInState, type EmitType } from '@/views/auth/actors/signIn.actor';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { EmailSchema } from '@ketone/shared';
import { useActor, useSelector } from '@xstate/vue';
import { Match, Schema } from 'effect';
import { eyeOffOutline, eyeOutline, flashOutline } from 'ionicons/icons';
import { onUnmounted, ref, watch } from 'vue';

// Form state
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const emailError = ref<string | null>(null);
const passwordError = ref<string | null>(null);
const serviceError = ref<string | null>(null);

// Sign-in actor
const { send, actorRef } = useActor(signInMachine);
const submitting = useSelector(actorRef, (state) => state.matches(SignInState.Submitting));

// Validation
const validateEmail = () => {
  const result = Schema.decodeUnknownEither(EmailSchema)(email.value);
  if (result._tag === 'Left') {
    emailError.value = 'Please enter a valid email address';
    return false;
  }
  emailError.value = null;
  return true;
};

const validatePassword = () => {
  if (!password.value || password.value.length === 0) {
    passwordError.value = 'Please enter your password';
    return false;
  }
  passwordError.value = null;
  return true;
};

const onSubmit = () => {
  const isEmailValid = validateEmail();
  const isPasswordValid = validatePassword();

  if (!isEmailValid || !isPasswordValid) {
    return;
  }

  send({
    type: Event.SUBMIT,
    values: { email: email.value, password: password.value },
  });
};

// Handle sign-in results
function handleSignInEmit(emitType: EmitType) {
  Match.value(emitType).pipe(
    Match.when({ type: Emit.SIGN_IN_SUCCESS }, (emit) => {
      serviceError.value = null;

      authenticationActor.send({
        type: AuthEvent.AUTHENTICATE,
        token: emit.result.token,
        user: emit.result.user,
      });
    }),
    Match.when({ type: Emit.SIGN_IN_ERROR }, (emit) => {
      serviceError.value = emit.error;
    }),
    Match.exhaustive,
  );
}

const signInSubscription = Object.values(Emit).map((emit) => actorRef.on(emit, handleSignInEmit));

watch(submitting, (isSubmitting) => {
  if (isSubmitting) {
    serviceError.value = null;
  }
});

onUnmounted(() => {
  signInSubscription.forEach((sub) => sub.unsubscribe());
});
</script>

<style scoped>
.sign-in-form {
  display: flex;
  flex-direction: column;
  max-width: 400px;
  margin: 0 auto;
  padding-top: 32px;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}

.logo-icon {
  font-size: 48px;
  color: var(--ion-color-primary);
  margin-bottom: 8px;
}

.logo-section h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: var(--ion-text-color);
}

.logo-section p {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin: 4px 0 0 0;
}

.service-error {
  margin-bottom: 16px;
}

.service-error p {
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  border: 1px solid var(--ion-color-danger);
  border-radius: 8px;
  padding: 12px;
  margin: 0;
  font-size: 14px;
}

ion-item {
  --background: transparent;
  --border-radius: 8px;
  margin-bottom: 4px;
}

ion-item.ion-invalid {
  --border-color: var(--ion-color-danger);
}

.field-error {
  margin-bottom: 12px;
}

.field-error p {
  font-size: 12px;
  margin: 4px 0 0 16px;
}

.submit-button {
  margin-top: 24px;
  --border-radius: 8px;
  height: 48px;
}

ion-spinner {
  width: 24px;
  height: 24px;
}
</style>
