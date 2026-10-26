<script setup lang="ts">
import { mdiCampfire, mdiCrosshairsGps, mdiMapMarker } from '@mdi/js'
import { LIcon, LMap, LMarker, LTileLayer } from '@maxel01/vue-leaflet'
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import 'leaflet/dist/leaflet.css'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { offline } from '@/scripts/connectivity'
import { required } from '@/scripts/forms'
import { describeFailure } from '@/scripts/outbox'
import { campTypes, campTypesToColor, campTypesToText, type campTypesType } from '@/shared/models/Location'

// The fields shared by the add and edit location pages. Sits inside the
// page's <v-form>, so its rules take part in the page's validation.
const props = defineProps<{
  // Editable latitude/longitude and city/state/country fields, rather than
  // a read-only summary of them.
  detailFields?: boolean
}>()

const location = defineModel<{
  name: string
  notes: string
  nicknames: string
  type: campTypesType
  address: string
  city: string
  state: string
  country: string
  latitude?: number
  longitude?: number
}>({ required: true })

const nicknamesArray = computed<string[]>({
  get: () => location.value.nicknames.split(',').map(n => n.trim()).filter(Boolean),
  set: (value) => { location.value.nicknames = value.join(', ') },
})

const campTypesText = campTypes.map(t => ({ title: campTypesToText(t as campTypesType), value: t }))

const findingAddress = ref(false)
const findingCurrentLocation = ref(false)
const showMapPicker = ref(false)

type LatLngTuple = [number, number]

// A cleared number field holds '' rather than a number.
function isBlank(value: unknown) {
  return value === undefined || value === null || value === ''
}

function isCoordinate(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max
}

// 0, 0 is how a location without a pin is stored.
const hasPin = computed(() => {
  const { latitude, longitude } = location.value
  return isCoordinate(latitude, 90) && isCoordinate(longitude, 180) && (latitude !== 0 || longitude !== 0)
})
const markerLatLng = computed<LatLngTuple>(() => [location.value.latitude ?? 0, location.value.longitude ?? 0])
const place = computed(() => [location.value.city, location.value.state, location.value.country].filter(Boolean).join(', '))

function coordinateRule(label: string, max: number, other: () => unknown) {
  return (value: unknown) => {
    if (isBlank(value))
      return isBlank(other()) || `Enter a ${label} too, or clear both`
    return isCoordinate(value, max) || `Enter a ${label} between −${max} and ${max}`
  }
}
const latitudeRules = [coordinateRule('latitude', 90, () => location.value.longitude)]
const longitudeRules = [coordinateRule('longitude', 180, () => location.value.latitude)]

const findDisabled = computed(() => {
  if (findingAddress.value || offline.value)
    return true
  return location.value.address.length === 0
})

const defaultCenter: LatLngTuple = [47.41322, -1.219482]
const mapZoom = ref(hasPin.value ? 14 : 6)
const mapCenter = ref<LatLngTuple>(hasPin.value ? markerLatLng.value : defaultCenter)

// Whether the pin is where the last Find put it, so a second Find can move
// it freely. A pin placed any other way - including one loaded from a saved
// location - may have been fine-tuned by hand, so Find asks first.
let pinFromFind = false

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
  let result
  try {
    const resp = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: location.value.address }),
    })
    result = await resp.json()

    if (!resp.ok) {
      showAlert(result.message ?? 'Failed to find address')
      return
    }
  }
  catch (err) {
    showAlert(describeFailure('find address', err))
    return
  }
  finally {
    findingAddress.value = false
  }

  if (hasPin.value && !pinFromFind) {
    const confirmed = await askConfirm('Move the pin to this address? Its current position will be replaced.', {
      title: 'Move pin',
      confirmText: 'Move Pin',
      cancelText: 'Keep Pin',
      color: 'primary',
    })
    if (!confirmed)
      return
  }

  applyCoordinates(result.latitude, result.longitude)
  applyGeocodeInfo(result.info)
  pinFromFind = true
}

let reverseGeocodeId = 0

async function reverseGeocode(lat: number, lng: number) {
  const requestToken = ++reverseGeocodeId
  try {
    const resp = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    })
    const result = await resp.json()

    if (requestToken !== reverseGeocodeId)
      return // the pin has moved since - a newer lookup will fill this in
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

// Places the pin by hand (map, GPS) and fills in the address details for it.
function placePin(lat: number, lng: number) {
  pinFromFind = false
  applyCoordinates(lat, lng)
  return reverseGeocode(lat, lng)
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showAlert('Geolocation is not supported by this browser')
    return
  }

  findingCurrentLocation.value = true
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      await placePin(position.coords.latitude, position.coords.longitude)
      findingCurrentLocation.value = false
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED)
        showAlert('Location access is blocked. Allow it for this site in your browser settings, or place the pin on the map.')
      else if (err.code === err.TIMEOUT)
        showAlert('Couldn’t get a GPS fix in time. Try again with a clearer view of the sky, or place the pin on the map.')
      else
        showAlert('Couldn’t get a GPS fix. Try again, or place the pin on the map.')
      findingCurrentLocation.value = false
    },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
  )
}

// Typed coordinates move the map once typing pauses, so the pin doesn't end
// up out of view - without jumping around on every keystroke.
const recenterOnPin = useDebounceFn(() => {
  if (hasPin.value)
    mapCenter.value = markerLatLng.value
}, 600)

function onCoordinateInput() {
  pinFromFind = false
  recenterOnPin()
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

// The map only responds to touch once editing is switched on - otherwise a
// swipe over it pans the map instead of scrolling the page.
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
    placePin(e.latlng.lat, e.latlng.lng)
  })
}

watch(showMapPicker, (interactive) => {
  if (leafletMap.value)
    setMapInteractive(leafletMap.value, interactive)
})

function onMarkerMove(latLng: LatLngTuple | { lat: number, lng: number }) {
  const { lat, lng } = normalizeLatLng(latLng)
  // The marker also reports moves made in code (Find, GPS, typed
  // coordinates), which land exactly where the form put them - only a drag
  // puts the pin somewhere new.
  if (lat === location.value.latitude && lng === location.value.longitude)
    return
  placePin(lat, lng)
}
</script>

<template>
  <v-text-field
    v-model="location.name" hide-details="auto" label="Name" required variant="solo-filled" autocomplete="off"
    :rules="[required('Please enter a name for the location')]"
  />
  <v-combobox
    v-model="nicknamesArray" label="Nicknames" multiple chips closable-chips
    variant="solo-filled" hint="Alternate names to help you find this place later" persistent-hint
  />
  <v-textarea v-model="location.notes" hide-details label="Notes" variant="solo-filled" />
  <v-select
    v-model="location.type" hide-details label="Type" :items="campTypesText"
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
      v-model="location.address" hide-details label="Address" variant="solo-filled"
      autocomplete="street-address" :prepend-inner-icon="mdiMapMarker" @keydown.enter.prevent="findAddress"
    />
    <v-btn size="large" color="primary" :loading="findingAddress" :disabled="findDisabled" @click="findAddress">
      Find
    </v-btn>
  </div>

  <v-switch
    v-model="showMapPicker" hide-details label="Edit location on map" color="primary"
  />

  <div>
    <div class="location-map" :class="{ 'location-map--readonly': !showMapPicker }">
      <LMap v-model:zoom="mapZoom" :center="mapCenter" @ready="onMapReady">
        <LTileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" :options="{ crossOrigin: true }" layer-type="base" name="OpenStreetMap" />
        <LMarker v-if="hasPin" :lat-lng="markerLatLng" :draggable="showMapPicker" @update:lat-lng="onMarkerMove">
          <LIcon class-name="location-marker-icon" :icon-size="[30, 30]" :icon-anchor="[15, 15]">
            <div class="location-pin" :style="{ backgroundColor: campTypesToColor(location.type) }">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="mdiMapMarker" /></svg>
            </div>
          </LIcon>
        </LMarker>
      </LMap>
    </div>
    <div class="map-hint">
      {{ showMapPicker ? 'Tap the map or drag the pin to fine-tune the location' : 'View only — enable editing to place or move the pin' }}
    </div>
  </div>

  <template v-if="props.detailFields">
    <div class="d-flex ga-4">
      <v-text-field
        v-model.number="location.latitude" hide-details="auto" label="Latitude" type="number" step="any"
        variant="solo-filled" :rules="latitudeRules" @update:model-value="onCoordinateInput"
      />
      <v-text-field
        v-model.number="location.longitude" hide-details="auto" label="Longitude" type="number" step="any"
        variant="solo-filled" :rules="longitudeRules" @update:model-value="onCoordinateInput"
      />
    </div>
    <!-- Wraps on phones, where three in a row would be ~95px each. -->
    <div class="d-flex flex-wrap ga-4">
      <v-text-field v-model="location.city" hide-details label="City" variant="solo-filled" class="place-field" />
      <v-text-field v-model="location.state" hide-details label="State" variant="solo-filled" class="place-field" />
      <v-text-field v-model="location.country" hide-details label="Country" variant="solo-filled" class="place-field" />
    </div>
  </template>

  <div v-else-if="hasPin" class="d-flex flex-column">
    <div>Latitude: {{ location.latitude?.toFixed(5) }}</div>
    <div>Longitude: {{ location.longitude?.toFixed(5) }}</div>
    <div v-if="place">
      {{ place }}
    </div>
  </div>
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
  font-size: 14px;
  opacity: 0.87;
}

.place-field {
  flex: 1 1 160px;
  min-width: 160px;
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.location-pin svg {
  width: 18px;
  height: 18px;
  fill: white;
}
</style>
