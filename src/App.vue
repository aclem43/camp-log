<script setup lang="ts">
import { RouterView } from 'vue-router'
import BottomBar from './components/BottomBar.vue'
import { setupAlert } from './scripts/alert'

const alert = setupAlert()
</script>

<template>
  <v-app>
    <v-main>
      <RouterView />
    </v-main>
    <BottomBar />
    <v-snackbar v-model="alert.show" :timeout="alert.duration">
      {{ alert.message }}
      <v-btn @click="alert.show = false">
        Close
      </v-btn>
    </v-snackbar>
  </v-app>
</template>

<style scoped>
</style>
