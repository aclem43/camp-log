<script setup lang="ts">
import { mdiTent } from '@mdi/js'

import 'leaflet/dist/leaflet.css'
import { LControlLayers, LIcon, LLayerGroup, LMap, LMarker, LPopup, LTileLayer } from '@maxel01/vue-leaflet'
import { onMounted, ref } from 'vue'
import { remult } from 'remult'
import { getUser } from '@/scripts/user'
import { Location, campTypesToColor } from '@/shared/models/Location'

const zoom = ref(6)
const center = ref<[number, number]>([47.41322, -1.219482])

const locations = ref<Location[]>([])
const locationRepo = remult.repo(Location)
const user = getUser()


onMounted(async () => {
  const locs = await locationRepo.find({ where: { user: user.value! } })
  locations.value = locs.filter((l) => l.latitude !== 0 && l.longitude !== 0)
  center.value = [locations.value[0].latitude! , locations.value[0].longitude! ]
})
</script>

<template>
  <div style="height: 100%; width: 100%;" >
    <LMap v-model:zoom="zoom" :center="center">
      <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" layer-type="base" name="OpenStreetMap" />
      <LLayerGroup name="Locations" layer-type="overlay">
        <LMarker v-for="loc in locations" :key="loc.id" :lat-lng="[loc.latitude, loc.longitude]" :title="loc.name">
          <LIcon class-name="location-marker-icon" :icon-size="[30, 30]" :icon-anchor="[15, 15]" :popup-anchor="[0, -15]">
            <div class="location-pin" :style="{ backgroundColor: campTypesToColor(loc.type) }">
              <svg viewBox="0 0 24 24"><path :d="mdiTent" /></svg>
            </div>
          </LIcon>
          <LPopup ><strong>{{ loc.name }} </strong><br />{{ loc.address }}</LPopup>
        </LMarker>
        <LControlLayers />
      </LLayerGroup>
    </LMap>
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
</style>
