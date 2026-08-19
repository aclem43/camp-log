<script setup lang="ts">
import { mdiWifiOff } from '@mdi/js'
import { useOnline } from '@vueuse/core'

const online = useOnline()
</script>

<template>
  <v-slide-y-transition>
    <v-banner
      v-if="!online"
      color="warning"
      density="compact"
      :icon="mdiWifiOff"
      lines="one"
      text="You're offline — showing previously loaded data."
    />
  </v-slide-y-transition>
</template>
