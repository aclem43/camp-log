import { nextTick } from 'vue'
import type { VForm } from 'vuetify/components'

// Validates a v-form, showing each field's error inline, and moves focus to
// the first invalid field so keyboard and screen reader users land on it.
export async function validateForm(form: VForm | null | undefined) {
  if (!form)
    return true
  const { valid, errors } = await form.validate()
  if (!valid && errors.length) {
    await nextTick()
    document.getElementById(String(errors[0].id))?.focus()
  }
  return valid
}

export function required(message: string) {
  return (value: unknown) =>
    (Array.isArray(value) ? value.length > 0 : !!String(value ?? '').trim()) || message
}
