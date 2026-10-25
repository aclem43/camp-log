<script setup lang="ts">
import { offline } from '@/scripts/connectivity'

// `what` completes "Couldn’t load …", e.g. "your logs".
defineProps<{
  what: string
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <v-alert type="error" variant="tonal" density="compact">
    Couldn’t load {{ what }}.
    <!-- Online, the usual culprit is an ad blocker or privacy extension
         blocking the request. -->
    {{ offline
      ? 'You’re offline, and this hasn’t been loaded on this device before. Retry once you have a connection.'
      : 'Check your connection and retry. If you use an ad blocker or privacy extension, try allowing this site.' }}
    <template #append>
      <v-btn variant="text" @click="$emit('retry')">
        Retry
      </v-btn>
    </template>
  </v-alert>
</template>
