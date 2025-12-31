<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Ketone</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleLogout">
            <ion-icon slot="icon-only" :icon="logOutOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Ketone</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="home-content">
        <div class="welcome-section">
          <ion-icon :icon="checkmarkCircleOutline" class="success-icon" />
          <h1>Welcome!</h1>
          <p v-if="user" class="user-email">{{ user.email }}</p>
          <p class="description">You have successfully signed in to Ketone.</p>
        </div>

        <ion-button expand="block" color="danger" @click="handleLogout">
          <ion-icon slot="start" :icon="logOutOutline" />
          Sign Out
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { checkmarkCircleOutline, logOutOutline } from 'ionicons/icons';

const { user, logout } = useAuth();

function handleLogout() {
  logout();
}
</script>

<style scoped>
.home-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
  gap: 32px;
  text-align: center;
}

.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.success-icon {
  font-size: 64px;
  color: var(--ion-color-success);
  margin-bottom: 16px;
}

h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
  color: var(--ion-text-color);
}

.user-email {
  font-size: 16px;
  color: var(--ion-color-primary);
  margin: 0;
  font-weight: 500;
}

.description {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin: 0;
  max-width: 280px;
}

ion-button[expand='block'] {
  width: 100%;
  max-width: 300px;
}
</style>
