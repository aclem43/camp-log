<script setup lang="ts">
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { mdiCalendar } from '@mdi/js'
import type { DatePickerProps } from './DataPicker'
import { startOfDay } from '@/scripts/dates'

defineProps<DatePickerProps>()

// No default: a default would be displayed while the bound value stays
// undefined, so the date shown wouldn't be the one saved.
const date = defineModel<Date>()

function formatDate(value: Date) {
  return value.toLocaleDateString()
}
</script>

<template>
  <VueDatePicker
    :model-value="date"
    teleport="body"
    :clearable="false"
    :enable-time-picker="false"
    :format="formatDate"
    :readonly="readonly"
    @update:model-value="(value: Date | null) => date = value ? startOfDay(value) : undefined"
  >
    <template #dp-input="{ value }">
      <v-text-field
        :prepend-inner-icon="mdiCalendar"
        :model-value="value"
        :label="label"
        :rules="rules"
        variant="solo-filled"
        hide-details="auto"
        readonly
      />
    </template>
  </VueDatePicker>
</template>
