import { readonly, ref } from 'vue'
import { remult } from 'remult'
import { createAuthClient } from 'better-auth/vue'
import { showAlert } from './alert'
import router from '@/router'
import { User } from '@/shared/models/auth/User'

const authClient = createAuthClient()

const loggedIn = ref(false)
const user = ref<User | null>(null)
const userRepo = remult.repo(User)
export function getUser() {
  return user
}
export function getLoggedIn() {
  return readonly(loggedIn)
}
export function checkLogin() {
  return loggedIn.value
}

async function hydrateFromSession() {
  const { data } = await authClient.getSession()
  if (data?.user) {
    user.value = (await userRepo.findId(data.user.id)) ?? null
    loggedIn.value = true
  }
}

let readyPromise: Promise<void> | null = null

export function initialize() {
  loggedIn.value = false
  readyPromise = hydrateFromSession()
  return readyPromise
}

// Router guards run their first check independently of when main.ts's
// initialize() call settles, so they must explicitly wait on this.
export function whenReady() {
  return readyPromise ?? Promise.resolve()
}

export async function logIn(userData: {
  email: string
  password: string
}) {
  const { error } = await authClient.signIn.email(userData)
  if (error) {
    showAlert(error.message ?? 'Login failed')
    return
  }
  await hydrateFromSession()
  router.push({ name: 'home' })
  showAlert('Logged in')
}

export async function register(userData: {
  email: string
  password: string
  name: string
}) {
  if (userData.password.length < 6) {
    showAlert('Password must be at least 6 characters')
    return
  }
  const { error } = await authClient.signUp.email(userData)
  if (error) {
    showAlert(error.message ?? 'Registration failed')
    return
  }
  await hydrateFromSession()
  router.push({ name: 'home' })
  showAlert('Registered')
}

export async function logOut() {
  await authClient.signOut()
  loggedIn.value = false
  user.value = null
  router.push({ name: 'login' })
  showAlert('Logged out')
}
