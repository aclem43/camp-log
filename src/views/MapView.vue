<script setup>
import { ref } from 'vue'

const center = ref([40, 40])
const projection = ref('EPSG:3857')
const zoom = ref(8)
const rotation = ref(0)
</script>

<template>
  <ol-map style="height: 100%">
    <ol-view
      :center="center"
      :rotation="rotation"
      :zoom="zoom"
      :projection="projection"
      @change:rotation="rotationChanged"
    />

    <ol-tile-layer>
      <ol-source-xyz url="https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png" />
    </ol-tile-layer>

    <ol-rotate-control />
    <ol-interaction-link />
  </ol-map>
</template>

<style scoped>
.ol-map {
  position: relative;
}
.ol-map-loading:after {
  content: "";
  box-sizing: border-box;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80px;
  height: 80px;
  margin-top: -40px;
  margin-left: -40px;
  border-radius: 50%;
  border: 5px solid rgba(180, 180, 180, 0.6);
  border-top-color: var(--vp-c-brand-1);
  animation: spinner 0.6s linear infinite;
}

@keyframes spinner {
  to {
    transform: rotate(360deg);
  }
}
</style>

<!--
<template>
   <v-empty-state
    :icon="mdiMap"
    title="Map Not Implemented Yet"
  >
    <template #actions>
      <v-btn color="primary" :to="{ name: 'home' }">
        Go Home
      </v-btn>
    </template>
  </v-empty-state>
  </template> -->
