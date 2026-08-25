<script setup lang="ts">
import { mdiTent } from '@mdi/js'

import 'leaflet/dist/leaflet.css'
import { LControlLayers, LIcon, LLayerGroup, LMap, LMarker, LPopup, LTileLayer } from '@maxel01/vue-leaflet'
import { computed, onActivated, ref } from 'vue'
import { remult } from 'remult'
import { useRoute } from 'vue-router'
import { getUser } from '@/scripts/user'
import { Location, campTypes, campTypesToColor, campTypesToText, type campTypesType } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'

defineOptions({ name: 'MapView' })

const route = useRoute()

const zoom = ref(6)
const center = ref<[number, number]>([47.41322, -1.219482])
const focusedLocationId = ref<number | null>(null)

const locations = ref<Location[]>([])
const locationIdsWithLogs = ref<Set<number>>(new Set())
const onlyWithLogs = ref(false)
const onlyCampgrounds = ref(false)
const locationRepo = remult.repo(Location)
const logRepo = remult.repo(Log)
const user = getUser()

const visibleLocations = computed(() => {
  let result = locations.value
  if (onlyWithLogs.value)
    result = result.filter(l => locationIdsWithLogs.value.has(l.id))
  if (onlyCampgrounds.value)
    result = result.filter(l => l.type !== 'nonCampground')
  return result
})

onActivated(async () => {
  const [locs, logs] = await Promise.all([
    locationRepo.find({ where: { user: user.value! } }),
    logRepo.find({ where: { user: user.value! }, include: { location: true } }),
  ])
  locations.value = locs.filter(l => l.latitude !== 0 && l.longitude !== 0)
  locationIdsWithLogs.value = new Set(logs.filter(log => log.location).map(log => log.location!.id))

  const focusId = Number(route.query.location)
  const focusedLocation = Number.isFinite(focusId) ? locations.value.find(l => l.id === focusId) : undefined
  if (focusedLocation) {
    onlyWithLogs.value = false
    onlyCampgrounds.value = false
    focusedLocationId.value = focusedLocation.id
    center.value = [focusedLocation.latitude!, focusedLocation.longitude!]
    zoom.value = 15
  }
  else {
    focusedLocationId.value = null
    center.value = [locations.value[0].latitude!, locations.value[0].longitude!]
  }
})
</script>

<template>
  <div style="height: 100%; width: 100%; position: relative;">
    <LMap v-model:zoom="zoom" :center="center">
      <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" layer-type="base" name="OpenStreetMap" />
      <LLayerGroup name="Locations" layer-type="overlay">
        <LMarker v-for="loc in visibleLocations" :key="loc.id" :lat-lng="[loc.latitude, loc.longitude]" :title="loc.name">
          <LIcon class-name="location-marker-icon" :icon-size="[30, 30]" :icon-anchor="[15, 15]" :popup-anchor="[0, -15]">
            <div
              class="location-pin"
              :class="{ 'location-pin-focused': loc.id === focusedLocationId }"
              :style="{ backgroundColor: campTypesToColor(loc.type) }"
            >
              <svg viewBox="0 0 24 24"><path :d="mdiTent" /></svg>
            </div>
          </LIcon>
          <LPopup>
            <strong>{{ loc.name }}</strong><br>{{ loc.address }}<br>
            <router-link :to="{ name: 'location', params: { id: loc.id } }">
              View / Edit
            </router-link>
          </LPopup>
        </LMarker>
        <LControlLayers />
      </LLayerGroup>
    </LMap>

    <div class="map-legend">
      <v-switch
        v-model="onlyWithLogs"
        label="Only show locations with logs"
        color="primary"
        density="compact"
        hide-details
        class="map-legend-filter"
      />
      <v-switch
        v-model="onlyCampgrounds"
        label="Only show campgrounds"
        color="primary"
        density="compact"
        hide-details
        class="map-legend-filter"
      />
      <div v-for="type in campTypes" :key="type" class="map-legend-item">
        <span class="map-legend-swatch" :style="{ backgroundColor: campTypesToColor(type as campTypesType) }" />
        {{ campTypesToText(type as campTypesType) }}
      </div>
    </div>
  </div>
  <!-- <v-empty-state
    :icon="mdiMap"
    title="Map Not Implemented Yet"
  >
    <template #actions>
      <v-btn color="primary" :to="{ name: 'home' }">
        Go Home
      </v-btn>
    </template>
</v-empty-state> -->
</template>

<style>
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

.location-pin-focused {
  border-color: #ffeb3b;
  box-shadow: 0 0 0 4px rgba(255, 235, 59, 0.5), 0 1px 4px rgba(0, 0, 0, 0.5);
}

.map-legend {
  position: absolute;
  bottom: 24px;
  left: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.map-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-legend-filter {
  margin-bottom: 4px;
}

.map-legend-filter :deep(.v-label) {
  font-size: 13px;
  color: inherit;
  opacity: 1;
}

.map-legend-swatch {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid white;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}

.leaflet-control-layers,
.leaflet-bar a {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.leaflet-bar a:hover {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
}

.leaflet-control-layers-toggle {
  background-color: rgb(var(--v-theme-surface));
}

.leaflet-control-layers-expanded {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.leaflet-control-layers-separator {
  border-color: rgba(var(--v-theme-on-surface), 0.2);
}

.v-theme--dark .leaflet-control-layers-toggle {
  filter: invert(1);
}
</style>
