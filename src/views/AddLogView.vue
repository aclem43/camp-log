<script setup lang="ts">
import { mdiMapMarker } from '@mdi/js'
import { ref } from 'vue'

const log = ref({
  title: '',
  description: '',
  weather: '',
  location: '',
})

function addLog() {
  console.log(log.value)
}
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title>
          Add New Log
        </v-card-title>

        <v-card-text>
          <v-form>
            <v-text-field
              v-model="log.title"
              label="Title"
              required
            />

            <v-textarea
              v-model="log.description"
              label="Description"

              required
            />

            <v-autocomplete
              v-model="log.location"
              label="Location"
              :append-inner-icon="mdiMapMarker"
            />

            <v-text-field
              v-model="log.weather"
              label="Weather"
              required
            />

            <v-btn
              color="primary"
              @click="addLog"
            >
              Add Log
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
