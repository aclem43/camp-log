<script setup lang="ts">
import { mdiArchive, mdiHistory, mdiHome, mdiMagnify, mdiMap, mdiMapMarker, mdiPlus } from '@mdi/js'
</script>

<template>
  <v-navigation-drawer
    rail
    expand-on-hover
  >
    <v-list density="compact" nav>
      <v-list-item :prepend-icon="mdiHome" title="Home" :to="{ name: 'home' }" />
      <v-list-item :prepend-icon="mdiMagnify" title="Search" :to="{ name: 'search' }" />
      <v-list-group value="Add">
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            :prepend-icon="mdiPlus"
            title="Add"
          />
        </template>
        <v-list-item

          title="Log"
          :prepend-icon="mdiArchive"
          :to="{ name: 'addLog' }"
        />
        <v-list-item
          :prepend-icon="mdiMapMarker"
          title="Location"
          :to="{ name: 'addLocation' }"
        />
      </v-list-group>

      <v-list-item :prepend-icon="mdiMap" title="Map" :to="{ name: 'map' }" />
      <v-list-item :prepend-icon="mdiHistory" title="Histoy" :to="{ name: 'logs' }" />
    </v-list>
  </v-navigation-drawer>
</template>
