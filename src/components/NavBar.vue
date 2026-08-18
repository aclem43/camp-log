<script setup lang="ts">
import { mdiArchive, mdiChartLine, mdiFileUploadOutline, mdiHistory, mdiHome, mdiLogout, mdiMagnify, mdiMap, mdiMapMarker, mdiPlus } from '@mdi/js'
import { logOut } from '@/scripts/user'
</script>

<template>
  <v-navigation-drawer rail expand-on-hover class="d-flex flex-column justify-space-between">
    <v-list density="compact" nav>
      <v-list-item :prepend-icon="mdiHome" title="Home" :to="{ name: 'home' }" />
      <v-list-item :prepend-icon="mdiMagnify" title="Search" :to="{ name: 'search' }" />
      <v-list-group fluid value="Add">
        <template #activator="{ props }">
          <v-list-item v-bind="props" :prepend-icon="mdiPlus" title="Add" />
        </template>
        <v-list-item title="Log" :prepend-icon="mdiArchive" :to="{ name: 'addLog' }" />
        <v-list-item :prepend-icon="mdiMapMarker" title="Location" :to="{ name: 'addLocation' }" />
        <v-list-item :prepend-icon="mdiFileUploadOutline" title="Import" :to="{ name: 'importLocations' }" />
      </v-list-group>

      <v-list-item :prepend-icon="mdiMap" title="Map" :to="{ name: 'map' }" />
      <v-list-item :prepend-icon="mdiHistory" title="History" :to="{ name: 'logs' }" />
      <v-list-item :prepend-icon="mdiChartLine" title="Statistics" :to="{ name: 'stats' }" />
    </v-list>
    <template #append>
      <v-list density="compact" nav>
        <v-list-item :prepend-icon="mdiLogout" title="Logout" @click="() => logOut()" />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>
