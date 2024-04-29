<script setup lang="ts">
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ref } from 'vue'
import { mdiCalendar } from '@mdi/js'
import type { DatePickerProps } from './DataPicker'

const props = defineProps<DatePickerProps>()

const date = ref(props.date ?? new Date())
</script>

<template>
  <VueDatePicker v-model="date">
    <template #dp-input="{ value }">
      <v-text-field
        :prepend-inner-icon="mdiCalendar"
        :model-value="value"
        :label="label"
        variant="solo-filled"
        density="compact"
        hide-details
      />
    </template>
  </VueDatePicker>
</template>
