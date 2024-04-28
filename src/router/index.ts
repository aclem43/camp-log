import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/locations',
      name: 'locations',
      component: () => import('../views/LocationsView.vue'),
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
      path: '/search',
      name: 'search',
      component: () => import('../views/SearchView.vue'),
    },
  ],
})

export default router
