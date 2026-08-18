<script setup lang="ts">
import { mdiTent } from '@mdi/js'

import 'leaflet/dist/leaflet.css'
import { LControlLayers, LIcon, LLayerGroup, LMap, LMarker, LPopup, LTileLayer } from '@maxel01/vue-leaflet'
import { computed, onMounted, ref } from 'vue'
import { remult } from 'remult'
import { getUser } from '@/scripts/user'
import { Location, campTypes, campTypesToColor, campTypesToText, type campTypesType } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'

const zoom = ref(6)
const center = ref<[number, number]>([47.41322, -1.219482])

const locations = ref<Location[]>([])
const locationIdsWithLogs = ref<Set<number>>(new Set())
const onlyWithLogs = ref(false)
const locationRepo = remult.repo(Location)
const logRepo = remult.repo(Log)
const user = getUser()

const visibleLocations = computed(() => {
  if (!onlyWithLogs.value)
    return locations.value
  return locations.value.filter(l => locationIdsWithLogs.value.has(l.id))
})

onMounted(async () => {
  const [locs, logs] = await Promise.all([
    locationRepo.find({ where: { user: user.value! } }),
    logRepo.find({ where: { user: user.value! }, include: { location: true } }),
  ])
  locations.value = locs.filter(l => l.latitude !== 0 && l.longitude !== 0)
  locationIdsWithLogs.value = new Set(logs.filter(log => log.location).map(log => log.location!.id))
  center.value = [locations.value[0].latitude!, locations.value[0].longitude!]
})
</script>

<template>
  <div style="height: 100%; width: 100%; position: relative;">
    <LMap v-model:zoom="zoom" :center="center">
      <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" layer-type="base" name="OpenStreetMap" />
      <LLayerGroup name="Locations" layer-type="overlay">
        <LMarker v-for="loc in visibleLocations" :key="loc.id" :lat-lng="[loc.latitude, loc.longitude]" :title="loc.name">
          <LIcon class-name="location-marker-icon" :icon-size="[30, 30]" :icon-anchor="[15, 15]" :popup-anchor="[0, -15]">
            <div class="location-pin" :style="{ backgroundColor: campTypesToColor(loc.type) }">
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
        label="Only show campsites with logs"
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
  background: white;
  color: #333;
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
  color: #333;
}

.map-legend-swatch {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid white;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}
</style>
