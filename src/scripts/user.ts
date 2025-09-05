import { readonly, ref } from 'vue'
import { remult } from 'remult'
import { showAlert } from './alert'
import router from '@/router'
import { User } from '@/shared/models/User'

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

export async function initialize() {
  loggedIn.value = false
  const resp = await fetch('/api/login')
  const result = await resp.json()
  if (result.loggedIn) {
    user.value = await userRepo.findId(result.user.id)
    loggedIn.value = true
  }
}

export async function logIn(userData: {
  email: string
  password: string
}) {
  const resp = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  })
  const result = await resp.json()
  if (!result.success) {
    showAlert(result.message ?? 'Login failed')
    return
  }
  user.value = await userRepo.findId(result.user.id)
  loggedIn.value = true
  router.push({ name: 'home' })
  showAlert('Logged in')

  // }
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
  const resp = await fetch('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  })
  const result = await resp.json()
  if (!result.success) {
    showAlert(result.message ?? 'Registration failed')
    return
  }
  user.value = await userRepo.findId(result.user.id)
  loggedIn.value = true
  router.push({ name: 'home' })
  showAlert('Registered')
}
