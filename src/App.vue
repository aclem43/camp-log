<script setup lang="ts">
import { RouterView } from 'vue-router'
import BottomBar from './components/BottomBar.vue'
</script>

<template>
  <v-app>
    <v-main>
      <RouterView />
    </v-main>
    <BottomBar />
  </v-app>
</template>

<style scoped>
</style>
