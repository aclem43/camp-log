<script setup lang="ts">
import { mdiAccount } from '@mdi/js'
</script>

<template>
  <v-container>
    <v-row>
      <v-col class="d-flex flex-column ga-4">
        <v-card
          :prepend-icon="mdiAccount"
          title="Hi Alexi"
        >
          <v-card-text>
            Welcome to your personal logbook. Start by adding a new log.
          </v-card-text>
        </v-card>
        <v-card>
          <v-card-title>
            Popular Campsites
          </v-card-title>
          <v-list>
            <v-list-item
              v-for="i in 2"
              :key="i"
              :title="`Locations ${i}`"
              subtitle="Locations"
            />
          </v-list>
          <v-card-actions>
            <v-btn
              color="primary"
            >
              View Locations
            </v-btn>
          </v-card-actions>
        </v-card>
        <v-card>
          <v-card-title>
            Recent Logs
          </v-card-title>
          <v-list>
            <v-list-item
              v-for="i in 3"
              :key="i"
              :title="`Log Title ${i}`"
              subtitle="Log Description"
            />
          </v-list>
          <v-card-actions>
            <v-btn
              color="primary"
            >
              View Logs
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
