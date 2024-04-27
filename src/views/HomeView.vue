<script setup lang="ts">
import { mdiAccount } from '@mdi/js'
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card
          :prepend-icon="mdiAccount"
          title="Hi Alexi"
        >
          <v-card-text>
            Welcome to your personal logbook. Start by adding a new log.
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
