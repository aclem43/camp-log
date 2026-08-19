<script setup lang="ts">
import { mdiSync, mdiWifiOff } from '@mdi/js'
import { useOnline } from '@vueuse/core'
import { computed } from 'vue'
import { pendingItems } from '@/scripts/outbox'
import { syncOutbox } from '@/scripts/sync'

const online = useOnline()

const pendingCount = computed(() => pendingItems.value.filter(item => item.status === 'pending').length)
const failedCount = computed(() => pendingItems.value.filter(item => item.status === 'failed').length)

const messages = computed(() => {
  const parts: string[] = []
  if (!online.value)
    parts.push('You\'re offline — showing previously loaded data.')
  if (pendingCount.value > 0)
    parts.push(`${pendingCount.value} saved ${pendingCount.value === 1 ? 'item' : 'items'} waiting to sync.`)
  if (failedCount.value > 0)
    parts.push(`${failedCount.value} saved ${failedCount.value === 1 ? 'item' : 'items'} failed to sync.`)
  return parts
})

const color = computed(() => {
  if (failedCount.value > 0)
    return 'error'
  return online.value ? 'info' : 'warning'
})
</script>

<template>
  <v-slide-y-transition>
    <v-banner
      v-if="messages.length"
      :color="color"
      density="compact"
      :icon="online ? mdiSync : mdiWifiOff"
      lines="one"
      :text="messages.join(' ')"
    >
      <template v-if="online && (pendingCount > 0 || failedCount > 0)" #actions>
        <v-btn size="small" variant="text" @click="syncOutbox()">
          Sync now
        </v-btn>
      </template>
    </v-banner>
  </v-slide-y-transition>
</template>
