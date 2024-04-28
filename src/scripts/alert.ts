import { ref } from 'vue'

const alert = ref({
  message: '',
  duration: 3000,
  show: false,
})

export function showAlert(message: string, duration: number = 3000) {
  alert.value.message = message
  alert.value.duration = duration
  alert.value.show = true
  setTimeout(() => {
    alert.value.show = false
  }, duration)
}

export function setupAlert() {
  return alert
}
