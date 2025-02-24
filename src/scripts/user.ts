import { readonly, ref } from 'vue'
import { showAlert } from './alert'
import router from '@/router'

const loggedIn = ref(false)

export function getLoggedIn() {
  return readonly(loggedIn)
}
export function checkLogin() {
  return loggedIn.value
}
export function logIn(userData: {
  email: string
  password: string
}) {
  showAlert('Logged in')
  loggedIn.value = true
  router.push({ name: 'home' })
}

export function register(userData: {
  email: string
  password: string
}) {
  showAlert('Registered')
  loggedIn.value = true
  router.push({ name: 'home' })
}
