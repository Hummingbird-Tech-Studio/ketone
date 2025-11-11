import { authenticationActor, State } from '@/actors/authenticationActor';
import Home from '@/views/Home.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/sign-up',
      name: 'sign-up',
      component: () => import('@/views/signUp/SignUpView.vue'),
    },
    {
      path: '/cycle',
      name: 'cycle',
      component: () => import('@/views/cycle/CycleView.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, from, next) => {
  const snapshot = authenticationActor.getSnapshot();
  const isAuthenticated = snapshot.matches(State.AUTHENTICATED);
  const isInitializing = snapshot.matches(State.INITIALIZING);
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

  if (isInitializing) {
    next();
    return;
  }

  if (requiresAuth && !isAuthenticated) {
    next({ name: 'sign-up' });
    return;
  }

  next();
});

export default router;
