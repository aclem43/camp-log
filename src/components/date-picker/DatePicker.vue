<script setup lang="ts">
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { mdiCalendar } from '@mdi/js'
import type { DatePickerProps } from './DataPicker'

defineProps<DatePickerProps>()

// No default: a default would be displayed while the bound value stays
// undefined, so the date shown wouldn't be the one saved.
const date = defineModel<Date>()
</script>

<template>
  <VueDatePicker v-model="date" teleport="body" :clearable="false">
    <template #dp-input="{ value }">
      <v-text-field
        :prepend-inner-icon="mdiCalendar"
        :model-value="value"
        :label="label"
        variant="solo-filled"
        density="compact"
        hide-details
        readonly
      />
    </template>
  </VueDatePicker>
</template>
