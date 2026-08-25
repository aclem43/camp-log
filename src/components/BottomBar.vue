<script setup lang="ts">
import { mdiArchive, mdiChartLine, mdiCog, mdiDotsHorizontal, mdiFileUploadOutline, mdiHistory, mdiHome, mdiLogout, mdiMagnify, mdiMap, mdiMapMarker, mdiPlus } from '@mdi/js'
import { logOut } from '@/scripts/user'
</script>

<template>
  <v-bottom-navigation
    grow
    :style="{
      height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }"
  >
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
        <v-list-item :prepend-icon="mdiArchive" title="Log" :to="{ name: 'addLog' }" />
        <v-list-item :prepend-icon="mdiMapMarker" title="Location" :to="{ name: 'addLocation' }" />
        <v-list-item :prepend-icon="mdiFileUploadOutline" title="Import" :to="{ name: 'import' }" />
      </v-list>
    </v-menu>

    <v-btn :to="{ name: 'map' }">
      <v-icon :icon="mdiMap" />
      <span>Map</span>
    </v-btn>

    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props">
          <v-icon :icon="mdiDotsHorizontal" />
          <span>More</span>
        </v-btn>
      </template>
      <v-list>
        <v-list-item :prepend-icon="mdiHistory" title="History" :to="{ name: 'logs' }" />
        <v-list-item :prepend-icon="mdiChartLine" title="Statistics" :to="{ name: 'stats' }" />
        <v-list-item :prepend-icon="mdiCog" title="Settings" :to="{ name: 'settings' }" />
        <v-divider />
        <v-list-item :prepend-icon="mdiLogout" title="Logout" @click="() => logOut()" />
      </v-list>
    </v-menu>
  </v-bottom-navigation>
</template>
