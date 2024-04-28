<script setup lang="ts">
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ref } from 'vue'

const date = ref(new Date())
</script>

<template>
  <VueDatePicker v-model="date" />
</template>
