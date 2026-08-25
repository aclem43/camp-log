import { createRouter, createWebHistory } from 'vue-router'
import { checkLogin, getLoggedIn, whenReady } from '@/scripts/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/user/LoginView.vue'),
      meta: {
        authNotRequired: true,
      },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/user/RegisterView.vue'),
      meta: {
        authNotRequired: true,
      },
    },
    {
      path: '/locations',
      name: 'locations',
      component: () => import('../views/LocationsView.vue'),
    },
    {
      path: '/location/:id',
      name: 'location',
      props: (route) => { return { id: Number(route.params.id) } },
      component: () => import('../views/LocationView.vue'),
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('../views/LogsView.vue'),
    },
    {
      path: '/log/:id',
      name: 'log',
      props: (route) => { return { id: Number(route.params.id) } },
      component: () => import('../views/LogView.vue'),
    },
    {
      path: '/add/log',
      name: 'addLog',
      component: () => import('../views/add/AddLogView.vue'),
    },
    {
      path: '/add/location',
      name: 'addLocation',
      component: () => import('../views/add/AddLocationView.vue'),
    },
    {
      path: '/add/import',
      name: 'import',
      component: () => import('../views/add/ImportView.vue'),
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('../views/SearchView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../views/MapView.vue'),
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../views/StatsView.vue'),
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  await whenReady()
  if (to.meta.authNotRequired) {
    next()
  }
  else if (checkLogin()) {
    next()
  }
  else {
    next({ name: 'login' })
  }
})
export default router
