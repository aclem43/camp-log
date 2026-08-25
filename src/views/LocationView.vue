<script setup lang="ts">
import { mdiArrowLeft, mdiCampfire, mdiDelete, mdiMapMarker } from '@mdi/js'
import { LIcon, LMap, LMarker, LTileLayer } from '@maxel01/vue-leaflet'
import { computed, onMounted, ref } from 'vue'
import { remult } from 'remult'
import 'leaflet/dist/leaflet.css'
import { Location, campTypes, campTypesToText, type campTypesType } from '@/shared/models/Location'
import PhotoGallery from '@/components/PhotoGallery.vue'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { getUser } from '@/scripts/user'
import router from '@/router'

const props = defineProps<{
  id: number
}>()

const user = getUser()
const locationRepo = remult.repo(Location)

const loading = ref(true)
const location = ref<Location | null>(null)
const saving = ref(false)
const findingAddress = ref(false)

const campTypesText = campTypes.map(t => ({ title: campTypesToText(t as campTypesType), value: t }))

const nicknamesArray = computed<string[]>({
  get: () => location.value?.nicknames.split(',').map(n => n.trim()).filter(Boolean) ?? [],
  set: (value) => {
    if (location.value)
      location.value.nicknames = value.join(', ')
  },
})

type LatLngTuple = [number, number]

const defaultCenter: LatLngTuple = [47.41322, -1.219482]
const mapZoom = ref(14)
const mapCenter = ref<LatLngTuple>(defaultCenter)

const hasPin = computed(() => !!location.value && (location.value.latitude !== 0 || location.value.longitude !== 0))
const markerLatLng = computed<LatLngTuple>(() => [location.value?.latitude ?? 0, location.value?.longitude ?? 0])

function normalizeLatLng(latLng: LatLngTuple | { lat: number, lng: number }): { lat: number, lng: number } {
  if (Array.isArray(latLng))
    return { lat: latLng[0], lng: latLng[1] }
  return latLng
}

function onMarkerMove(latLng: LatLngTuple | { lat: number, lng: number }) {
  if (!location.value)
    return
  const { lat, lng } = normalizeLatLng(latLng)
  location.value.latitude = lat
  location.value.longitude = lng
}

onMounted(async () => {
  location.value = (await locationRepo.findOne({ where: { id: props.id, user: user.value! } })) ?? null
  loading.value = false
  if (hasPin.value)
    mapCenter.value = markerLatLng.value
})

const findDisabled = computed(() => {
  if (!location.value || findingAddress.value)
    return true
  return location.value.address.length === 0
})

async function findAddress() {
  if (!location.value)
    return

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

    location.value.latitude = result.latitude
    location.value.longitude = result.longitude
    location.value.city = result.info.city
    location.value.state = result.info.state
    location.value.country = result.info.country
    mapCenter.value = [result.latitude, result.longitude]
    mapZoom.value = Math.max(mapZoom.value, 13)
  }
  catch {
    showAlert('Failed to find address')
  }
  finally {
    findingAddress.value = false
  }
}

async function save() {
  if (!location.value)
    return

  saving.value = true
  try {
    await locationRepo.update(location.value.id, location.value)
    showAlert('Location updated')
  }
  catch {
    showAlert('Failed to update location')
  }
  finally {
    saving.value = false
  }
}

async function deleteLocation() {
  if (!location.value)
    return

  const confirmed = await askConfirm('Are you sure you want to delete this location? This cannot be undone.', { confirmText: 'Delete' })
  if (!confirmed)
    return

  await locationRepo.delete(location.value)
  showAlert('Location deleted')
  router.push({ name: 'locations' })
}
</script>

<template>
  <v-container>
    <v-col>
      <v-card v-if="loading">
        <v-card-text>
          <v-skeleton-loader type="article" />
        </v-card-text>
      </v-card>

      <v-card v-else-if="!location">
        <v-card-title>
          Location not found
        </v-card-title>
        <v-card-text>
          <v-btn color="primary" :to="{ name: 'locations' }">
            Back to Locations
          </v-btn>
        </v-card-text>
      </v-card>

      <v-card v-else>
        <v-card-title class="d-flex align-center ga-4">
          <v-btn size="small" color="primary" @click="router.back()">
            <v-icon :icon="mdiArrowLeft" />
          </v-btn> {{ location.name }}
        </v-card-title>

        <v-card-text>
          <div class="d-flex flex-column ga-6">
            <v-text-field v-model="location.name" hide-details label="Name" required variant="solo-filled" />
            <v-combobox
              v-model="nicknamesArray" hide-details label="Nicknames" multiple chips closable-chips
              variant="solo-filled" hint="Alternate names to help you find this place later" persistent-hint
            />
            <v-textarea v-model="location.notes" hide-details label="Notes" required variant="solo-filled" />
            <v-select
              v-model="location.type" hide-details label="Type" required :items="campTypesText"
              variant="solo-filled" :prepend-inner-icon="mdiCampfire"
            />
            <div class="d-flex align-center ga-4">
              <v-text-field
                v-model="location.address" hide-details label="Address" required variant="solo-filled"
                :prepend-inner-icon="mdiMapMarker"
              />
              <v-btn size="large" color="primary" :disabled="findDisabled" @click="findAddress">
                Find
              </v-btn>
            </div>
            <div class="d-flex ga-4">
              <v-text-field v-model.number="location.latitude" hide-details label="Latitude" type="number" variant="solo-filled" />
              <v-text-field v-model.number="location.longitude" hide-details label="Longitude" type="number" variant="solo-filled" />
            </div>

            <div v-if="hasPin" class="location-map">
              <LMap v-model:zoom="mapZoom" :center="mapCenter">
                <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" layer-type="base" name="OpenStreetMap" />
                <LMarker :lat-lng="markerLatLng" draggable @update:lat-lng="onMarkerMove">
                  <LIcon class-name="location-marker-icon" :icon-size="[30, 30]" :icon-anchor="[15, 15]">
                    <div class="location-pin">
                      <svg viewBox="0 0 24 24"><path :d="mdiMapMarker" /></svg>
                    </div>
                  </LIcon>
                </LMarker>
              </LMap>
              <div class="map-hint">
                Drag the pin to fine-tune the location
              </div>
            </div>
            <div class="d-flex ga-4">
              <v-text-field v-model="location.city" hide-details label="City" variant="solo-filled" />
              <v-text-field v-model="location.state" hide-details label="State" variant="solo-filled" />
              <v-text-field v-model="location.country" hide-details label="Country" variant="solo-filled" />
            </div>

            <div class="d-flex ga-4">
              <v-btn color="primary" :loading="saving" @click="save">
                Save
              </v-btn>
              <v-btn color="error" :prepend-icon="mdiDelete" @click="deleteLocation">
                Delete
              </v-btn>
            </div>

            <v-divider />
            <PhotoGallery :location-id="location.id" />
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>

<style>
.location-map {
  height: 300px;
  width: 100%;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.map-hint {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.7;
}

.location-marker-icon {
  background: transparent;
  border: none;
}

.location-pin {
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  background-color: #1976d2;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.location-pin svg {
  width: 18px;
  height: 18px;
  fill: white;
}
</style>
