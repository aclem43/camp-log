<script setup lang="ts">
import { mdiCampfire, mdiMapMarker } from '@mdi/js'
import { ref } from 'vue'
import { remult } from 'remult'
import { Location, campTypes, campTypesToText, type campTypesType } from '@/shared/models/Location'
import { showAlert } from '@/scripts/alert'

const location = ref<Omit<Location, 'id'>>({
  name: '',
  notes: '',
  latitude: 0,
  longitude: 0,
  type: '2wdAcess',
  address: '',
})

const campTypesText = campTypes.map((t) => { return { title: campTypesToText(t as campTypesType), value: t } })

async function addLog() {
  const locationRepo = remult.repo(Location)
  locationRepo.insert(location.value)
  showAlert('Location added successfully')
}
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title>
          Add New Location
        </v-card-title>

        <v-card-text>
          <v-text-field
            v-model="location.name"
            label="Name"
            required
            variant="solo-filled"
          />
          <v-textarea
            v-model="location.notes"
            label="Notes"
            required
            variant="solo-filled"
          />
          <v-select
            v-model="location.type" label="Type" required :items="campTypesText" variant="solo-filled"
            :prepend-inner-icon="mdiCampfire"
          />

          <v-text-field
            v-model="location.address"
            label="Address"
            required
            variant="solo-filled"
            :prepend-inner-icon="mdiMapMarker"
          />

          <v-btn
            color="primary"
            @click="addLog"
          >
            Add Location
          </v-btn>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
