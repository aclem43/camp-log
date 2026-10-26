import type { ValidationRule } from 'vuetify'

export interface DatePickerProps {
  label?: string
  rules?: ValidationRule[]
  readonly?: boolean
}
