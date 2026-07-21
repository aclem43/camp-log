<script setup lang="ts">
import { mdiCampfire, mdiMapMarker } from '@mdi/js'
import { computed, ref } from 'vue'
import { remult } from 'remult'
import { Location, campTypes, campTypesToText, type campTypesType } from '@/shared/models/Location'
import { showAlert } from '@/scripts/alert'
import { getUser } from '@/scripts/user'

const user = getUser()

const location = ref<Omit<Location, 'id'>>({
  name: '',
  notes: '',
  latitude: 0,
  longitude: 0,
  type: '2wdAcess',
  address: '',
  city: '',
  state: '',
  country: '',
  user: user.value!,
})

const campTypesText = campTypes.map((t) => { return { title: campTypesToText(t as campTypesType), value: t } })

async function addLog() {
  const locationRepo = remult.repo(Location)
  if (latLong.value) {
    location.value.latitude = latLong.value.lat
    location.value.longitude = latLong.value.lng
  }
  if (info.value) {
    location.value.city = info.value.city
    location.value.state = info.value.state
    location.value.country = info.value.country
  }
  locationRepo.insert(location.value)
  showAlert('Location added successfully')
}
const findingAddress = ref(false)

const findDisabled = computed(() => {
  if (findingAddress.value) {
    return true
  }
  return location.value.address.length === 0
})

const latLong = ref<{ lat: number, lng: number } | null>(null)
const info = ref<{ city: string, state: string, country: string } | null>(null)

async function findAddress() {
  findingAddress.value = true

  try {
    const resp = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: location.value.address }),
    })
    const result = await resp.json()

    if (!resp.ok) {
      showAlert(result.message ?? 'Failed to find address')
      return
    }

    latLong.value = {
      lat: result.latitude,
      lng: result.longitude,
    }

    info.value = {
      city: result.info.city,
      state: result.info.state,
      country: result.info.country,
    }
  }
  catch {
    showAlert('Failed to find address')
  }
  finally {
    findingAddress.value = false
  }
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
          <div class="d-flex flex-column ga-6">
            <v-text-field v-model="location.name" hide-details label="Name" required variant="solo-filled" />
            <v-textarea v-model="location.notes" hide-details label="Notes" required variant="solo-filled" />
            <v-select v-model="location.type" hide-details label="Type" required :items="campTypesText"
              variant="solo-filled" :prepend-inner-icon="mdiCampfire" />
            <div class="d-flex align-center ga-4">
              <v-text-field v-model="location.address" hide-details label="Address" required variant="solo-filled"
                :prepend-inner-icon="mdiMapMarker" />
              <v-btn size="large" color="primary" :disabled="findDisabled" @click="findAddress">
                Find
              </v-btn>
            </div>
            <div v-if="latLong" class="d-flex flex-column">
              <div>Latitude: {{ latLong.lat }}</div>
              <div>Longitude: {{ latLong.lng }}</div>
              <div v-if="info">
                City: {{ info.city }}, State: {{ info.state }}, Country: {{ info.country }}
              </div>
            </div>

            <v-btn color="primary" @click="addLog">
              Add Location
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
