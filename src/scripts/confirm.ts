import { ref } from 'vue'

interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  color?: string
}

const state = ref({
  message: '',
  title: 'Confirm',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  color: 'error',
  show: false,
})

let resolvePromise: ((value: boolean) => void) | null = null

export function askConfirm(message: string, options: ConfirmOptions = {}) {
  state.value.message = message
  state.value.title = options.title ?? 'Confirm'
  state.value.confirmText = options.confirmText ?? 'Confirm'
  state.value.cancelText = options.cancelText ?? 'Cancel'
  state.value.color = options.color ?? 'error'
  state.value.show = true

  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve
  })
}

export function resolveConfirm(value: boolean) {
  state.value.show = false
  resolvePromise?.(value)
  resolvePromise = null
}

export function setupConfirm() {
  return state
}
