<script setup lang="ts">
import { mdiMapMarker } from '@mdi/js'
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { Location } from '@/shared/models/Location'

const log = ref({
  title: '',
  description: '',
  weather: '',
  location: '',
})

const locations = ref<Location[]>([])

onMounted(async () => {
  locations.value = await remult.repo(Location).find({ limit: 5 })
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
              variant="solo-filled"
            />

            <v-textarea
              v-model="log.description"
              label="Description"
              variant="solo-filled"
              required
            />

            <v-autocomplete
              v-model="log.location"
              label="Location"
              variant="solo-filled"
              :items="locations"
              :prepend-inner-icon="mdiMapMarker"
              item-title="name"
              item-value="id"
            />

            <v-text-field
              v-model="log.weather"
              label="Weather"
              variant="solo-filled"
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
