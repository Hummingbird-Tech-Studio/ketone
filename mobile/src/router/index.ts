import { authenticationActor, State } from '@/actors/authenticationActor';
import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/sign-in',
    name: 'SignIn',
    component: () => import('@/views/auth/SignInPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/home/HomePage.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, _from, next) => {
  const snapshot = authenticationActor.getSnapshot();
  const isAuthenticated = snapshot.matches(State.AUTHENTICATED);
  const isInitializing = snapshot.matches(State.INITIALIZING);
  const requiresAuth = to.meta.requiresAuth === true;

  // If still initializing, allow navigation (will be handled after init)
  if (isInitializing) {
    next();
    return;
  }

  // If route requires auth and user is not authenticated
  if (requiresAuth && !isAuthenticated) {
    next({ path: '/sign-in' });
    return;
  }

  // If user is authenticated and trying to access sign-in
  if (isAuthenticated && to.path === '/sign-in') {
    next({ path: '/home' });
    return;
  }

  next();
});

export default router;
