<script setup lang="ts">
import { mdiHistory, mdiHome, mdiMagnify, mdiMap, mdiPlus } from '@mdi/js'
</script>

<template>
  <v-bottom-navigation grow>
    <v-btn :to="{ name: 'home' }">
      <v-icon :icon="mdiHome" />
      <span>Home</span>
    </v-btn>
    <v-btn :to="{ name: 'search' }">
      <v-icon :icon="mdiMagnify" />
      <span>Search</span>
    </v-btn>
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props">
          <v-icon :icon="mdiPlus" />
          <span>Add</span>
        </v-btn>
      </template>
      <v-list>
        <v-list-item
          title="Log"
          :to="{ name: 'addLog' }"
        />
        <v-list-item
          title="Location"
          :to="{ name: 'addLocation' }"
        />
      </v-list>
    </v-menu>

    <v-btn :to="{ name: 'map' }">
      <v-icon :icon="mdiMap" />
      <span>Map</span>
    </v-btn>
    <v-btn :to="{ name: 'logs' }">
      <v-icon :icon="mdiHistory" />
      <span>Histoy</span>
    </v-btn>
  </v-bottom-navigation>
</template>
