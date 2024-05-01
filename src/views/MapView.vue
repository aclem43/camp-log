<script setup lang="ts">
import { mdiMap } from '@mdi/js'
</script>

<template>
  <v-empty-state
    :icon="mdiMap"
    title="Map Not Implemented Yet"
  >
    <template #actions>
      <v-btn color="primary" :to="{ name: 'home' }">
        Go Home
      </v-btn>
    </template>
  </v-empty-state>
</template>
