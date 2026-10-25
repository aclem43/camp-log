import { ref } from 'vue'

const alert = ref({
  // App.vue keys the snackbar on this, so each alert gets a fresh snackbar
  // with its own timeout - otherwise a second alert shown while the first is
  // still up keeps the first one's countdown and disappears early.
  id: 0,
  message: '',
  duration: 3000,
  show: false,
})

export function showAlert(message: string, duration: number = 3000) {
  alert.value.id++
  alert.value.message = message
  alert.value.duration = duration
  alert.value.show = true
}

export function setupAlert() {
  return alert
}
