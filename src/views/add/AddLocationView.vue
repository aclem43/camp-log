<script setup lang="ts">
import { mdiCampfire, mdiCrosshairsGps, mdiMapMarker } from '@mdi/js'
import { LIcon, LMap, LMarker, LTileLayer } from '@maxel01/vue-leaflet'
import { remult } from 'remult'
import { computed, ref, toRaw, watch } from 'vue'
import 'leaflet/dist/leaflet.css'
import router from '@/router'
import { showAlert } from '@/scripts/alert'
import { isNetworkError, queueMutation } from '@/scripts/outbox'
import { getUser } from '@/scripts/user'
import { Location, campTypes, campTypesToText, type campTypesType } from '@/shared/models/Location'

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

const campTypesText = campTypes.map(t => ({ title: campTypesToText(t as campTypesType), value: t }))

const saving = ref(false)
const findingAddress = ref(false)
const findingCurrentLocation = ref(false)
const showMapPicker = ref(false)

type LatLngTuple = [number, number]

const hasPin = computed(() => location.value.latitude !== 0 || location.value.longitude !== 0)
const markerLatLng = computed<LatLngTuple>(() => [location.value.latitude ?? 0, location.value.longitude ?? 0])

const findDisabled = computed(() => {
  if (findingAddress.value)
    return true
  return location.value.address.length === 0
})

const defaultCenter: LatLngTuple = [47.41322, -1.219482]
const mapZoom = ref(6)
const mapCenter = ref<LatLngTuple>(defaultCenter)

function applyCoordinates(lat: number, lng: number) {
  location.value.latitude = lat
  location.value.longitude = lng
  mapCenter.value = [lat, lng]
  mapZoom.value = Math.max(mapZoom.value, 13)
}

function applyGeocodeInfo(info: { city?: string, state?: string, country?: string }) {
  if (info.city)
    location.value.city = info.city
  if (info.state)
    location.value.state = info.state
  if (info.country)
    location.value.country = info.country
}

function normalizeLatLng(latLng: LatLngTuple | { lat: number, lng: number }): { lat: number, lng: number } {
  if (Array.isArray(latLng))
    return { lat: latLng[0], lng: latLng[1] }
  return latLng
}

async function findAddress() {
  if (findDisabled.value)
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

    applyCoordinates(result.latitude, result.longitude)
    applyGeocodeInfo(result.info)
  }
  catch {
    showAlert('Failed to find address')
  }
  finally {
    findingAddress.value = false
  }
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const resp = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    })
    const result = await resp.json()

    if (!resp.ok)
      return

    if (!location.value.address)
      location.value.address = result.address
    applyGeocodeInfo(result.info)
  }
  catch {
    // best-effort: the pin is already placed, filling in address details is a bonus
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showAlert('Geolocation is not supported by this browser')
    return
  }

  findingCurrentLocation.value = true
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      applyCoordinates(position.coords.latitude, position.coords.longitude)
      await reverseGeocode(position.coords.latitude, position.coords.longitude)
      findingCurrentLocation.value = false
    },
    () => {
      showAlert('Unable to retrieve your location')
      findingCurrentLocation.value = false
    },
  )
}

interface ToggleableHandler {
  enable: () => void
  disable: () => void
}

interface InteractiveMap {
  dragging: ToggleableHandler
  touchZoom: ToggleableHandler
  doubleClickZoom: ToggleableHandler
  scrollWheelZoom: ToggleableHandler
  boxZoom: ToggleableHandler
  keyboard: ToggleableHandler
  tap?: ToggleableHandler
  on: (event: 'click', handler: (e: { latlng: { lat: number, lng: number } }) => void) => void
}

const leafletMap = ref<InteractiveMap | null>(null)

function setMapInteractive(map: InteractiveMap, interactive: boolean) {
  const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard, map.tap]
  for (const handler of handlers) {
    if (!handler)
      continue
    if (interactive)
      handler.enable()
    else
      handler.disable()
  }
}

function onMapReady(map: InteractiveMap) {
  leafletMap.value = map
  setMapInteractive(map, showMapPicker.value)
  map.on('click', (e) => {
    if (!showMapPicker.value)
      return
    applyCoordinates(e.latlng.lat, e.latlng.lng)
    reverseGeocode(e.latlng.lat, e.latlng.lng)
  })
}

watch(showMapPicker, (interactive) => {
  if (leafletMap.value)
    setMapInteractive(leafletMap.value, interactive)
})

function onMarkerMove(latLng: LatLngTuple | { lat: number, lng: number }) {
  const { lat, lng } = normalizeLatLng(latLng)
  applyCoordinates(lat, lng)
  reverseGeocode(lat, lng)
}

async function addLog() {
  if (!location.value.name.trim()) {
    showAlert('Please enter a name for the location')
    return
  }

  saving.value = true
  try {
    if (!navigator.onLine) {
      await queueLocationOffline()
      return
    }

    const locationRepo = remult.repo(Location)
    await locationRepo.insert(location.value)
    showAlert('Location added successfully')
    router.push({ name: 'locations' })
  }
  catch (err) {
    if (isNetworkError(err)) {
      await queueLocationOffline()
      return
    }
    showAlert('Failed to add location')
  }
  finally {
    saving.value = false
  }
}

async function queueLocationOffline() {
  await queueMutation('location', toRaw(location.value))
  showAlert('Saved offline — will sync when you\'re back online.')
  router.push({ name: 'locations' })
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
            <v-select
              v-model="location.type" hide-details label="Type" required :items="campTypesText"
              variant="solo-filled" :prepend-inner-icon="mdiCampfire"
            />

            <v-btn
              size="large" color="primary" variant="tonal" :prepend-icon="mdiCrosshairsGps"
              :loading="findingCurrentLocation" @click="useCurrentLocation"
            >
              Use My Current Location
            </v-btn>

            <div class="d-flex align-center ga-4">
              <v-text-field
                v-model="location.address" hide-details label="Address" required variant="solo-filled"
                autocomplete="street-address" :prepend-inner-icon="mdiMapMarker" @keyup.enter="findAddress"
              />
              <v-btn size="large" color="primary" :loading="findingAddress" :disabled="findDisabled" @click="findAddress">
                Find
              </v-btn>
            </div>

            <v-switch
              v-model="showMapPicker" hide-details label="Edit location on map" color="primary"
              density="compact"
            />

            <div class="location-map" :class="{ 'location-map--readonly': !showMapPicker }">
              <LMap v-model:zoom="mapZoom" :center="mapCenter" @ready="onMapReady">
                <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" layer-type="base" name="OpenStreetMap" />
                <LMarker v-if="hasPin" :lat-lng="markerLatLng" :draggable="showMapPicker" @update:lat-lng="onMarkerMove">
                  <LIcon class-name="location-marker-icon" :icon-size="[30, 30]" :icon-anchor="[15, 15]">
                    <div class="location-pin">
                      <svg viewBox="0 0 24 24"><path :d="mdiMapMarker" /></svg>
                    </div>
                  </LIcon>
                </LMarker>
              </LMap>
              <div class="map-hint">
                {{ showMapPicker ? 'Click the map or drag the pin to fine-tune the location' : 'View only — enable editing to place or move the pin' }}
              </div>
            </div>

            <div v-if="hasPin" class="d-flex flex-column">
              <div>Latitude: {{ location.latitude?.toFixed(5) }}</div>
              <div>Longitude: {{ location.longitude?.toFixed(5) }}</div>
              <div v-if="location.city || location.state || location.country">
                City: {{ location.city }}, State: {{ location.state }}, Country: {{ location.country }}
              </div>
            </div>

            <v-btn color="primary" :loading="saving" @click="addLog">
              Add Location
            </v-btn>
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

.location-map--readonly .leaflet-container {
  cursor: default;
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
