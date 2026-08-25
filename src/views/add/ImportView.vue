<script setup lang="ts">
import { ref } from 'vue'
import ImportLocationsView from './ImportLocationsView.vue'
import ImportLogsView from './ImportLogsView.vue'

const tab = ref('locations')
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title>
          Import
        </v-card-title>

        <v-tabs v-model="tab" color="primary">
          <v-tab value="locations">
            Locations (CSV)
          </v-tab>
          <v-tab value="logs">
            Logs (Terrain)
          </v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <v-window-item value="locations">
            <ImportLocationsView />
          </v-window-item>
          <v-window-item value="logs">
            <ImportLogsView />
          </v-window-item>
        </v-window>
      </v-card>
    </v-col>
  </v-container>
</template>
