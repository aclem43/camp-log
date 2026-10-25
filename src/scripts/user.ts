import { remult } from 'remult'
import { readonly, ref, watch } from 'vue'
import { createAuthClient } from 'better-auth/vue'
import { showAlert } from './alert'
import { askConfirm } from './confirm'
import { offline } from './connectivity'
import { clearOutbox, describeFailure, pendingItems } from './outbox'
import type { UnitPreference } from '@/shared/models/auth/User'
import router from '@/router'
import { MIN_PASSWORD_LENGTH, User } from '@/shared/models/auth/User'

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

// The last user confirmed signed in on this device, so the app can still
// open with no signal (when the session can't be checked with the server).
// Cleared on logout.
const CACHED_USER_KEY = 'camp-log-user'

function cacheUser(value: User | null) {
  try {
    if (value)
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userRepo.toJson(value)))
    else
      localStorage.removeItem(CACHED_USER_KEY)
  }
  catch {
    // storage blocked (private mode etc.) - offline start just won't work
  }
}

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY)
    return raw ? userRepo.fromJson(JSON.parse(raw)) : null
  }
  catch {
    return null
  }
}

// The service worker's API and photo caches (see vite.config.ts) hold this
// user's data - don't leave it behind for whoever signs in next.
async function clearCachedData() {
  if (!('caches' in window))
    return
  await Promise.all(['camp-log-api', 'camp-log-photos'].map(name => caches.delete(name))).catch(() => {})
}

// True while running on a session restored from the device cache rather than
// one the server has confirmed.
let sessionUnconfirmed = false

async function hydrateFromSession() {
  try {
    const { data, error } = await authClient.getSession()
    if (error)
      throw error
    // No error and no session means signed out (or the session expired).
    user.value = data?.user ? (await userRepo.findId(data.user.id)) ?? null : null
    loggedIn.value = !!data?.user
    sessionUnconfirmed = false
    cacheUser(loggedIn.value ? user.value : null)
  }
  catch {
    // Couldn't reach the server (no signal at camp, or it's down) - that says
    // nothing about whether the session is still valid, so carry on as the
    // last user signed in on this device until it can be checked.
    if (loggedIn.value)
      return
    const cached = readCachedUser()
    if (cached) {
      user.value = cached
      loggedIn.value = true
      sessionUnconfirmed = true
    }
  }
}

// Check a restored session with the server as soon as it's reachable again,
// in case it expired or was revoked while this device was offline.
async function confirmSession() {
  if (!sessionUnconfirmed)
    return
  await hydrateFromSession()
  if (!loggedIn.value) {
    await clearCachedData()
    router.push({ name: 'login' })
    showAlert('Your session has expired. Please log in again.')
  }
}

watch(offline, (isOffline) => {
  if (!isOffline)
    confirmSession()
})
// navigator.onLine can stay true while the server is unreachable (one bar of
// signal, captive portal), so `offline` above may never flip - retry on the
// same cues the outbox sync uses too.
window.addEventListener('focus', () => confirmSession())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible')
    confirmSession()
})

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
  if (userData.password.length < MIN_PASSWORD_LENGTH) {
    showAlert(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
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

export async function logInWithGoogle() {
  const { error } = await authClient.signIn.social({
    provider: 'google',
    callbackURL: window.location.origin,
  })
  if (error)
    showAlert(error.message ?? 'Google sign-in failed')
}

export async function logOut(message = 'Logged out') {
  try {
    await authClient.signOut()
  }
  catch {
    // Offline - the server-side session will expire on its own; what matters
    // is that this device forgets it.
  }
  loggedIn.value = false
  user.value = null
  sessionUnconfirmed = false
  cacheUser(null)
  await clearCachedData()
  // Left in the outbox, unsynced items would later sync into whichever
  // account signs in next.
  await clearOutbox().catch(() => {})
  router.push({ name: 'login' })
  showAlert(message)
}

// What the Logout buttons call: warns first when logging out would discard
// changes that haven't synced yet.
export async function confirmLogOut() {
  const count = pendingItems.value.length
  if (count) {
    const confirmed = await askConfirm(
      `You have ${count} unsynced ${count === 1 ? 'item' : 'items'} saved on this device. Logging out will delete ${count === 1 ? 'it' : 'them'}. To keep ${count === 1 ? 'it' : 'them'}, stay logged in until you’re back online and ${count === 1 ? 'it has' : 'they have'} synced.`,
      { title: 'Unsynced changes', confirmText: 'Log Out Anyway' },
    )
    if (!confirmed)
      return
  }
  await logOut()
}

export async function updateProfile(data: { name: string, unitPreference: UnitPreference }) {
  let response: Response
  try {
    response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }
  catch (err) {
    showAlert(describeFailure('update profile', err))
    return false
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    showAlert(body?.message ?? 'Failed to update profile')
    return false
  }
  if (user.value) {
    user.value.name = data.name
    user.value.unitPreference = data.unitPreference
  }
  showAlert('Profile updated')
  return true
}

export async function deactivateAccount() {
  let response: Response
  try {
    response = await fetch('/api/deactivate-account', { method: 'POST' })
  }
  catch (err) {
    showAlert(describeFailure('deactivate account', err))
    return false
  }
  if (!response.ok) {
    showAlert('Failed to deactivate account')
    return false
  }
  await logOut('Account deactivated')
  return true
}
