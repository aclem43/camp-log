<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useDisplay } from 'vuetify'
import BottomBar from './components/BottomBar.vue'
import { setupAlert } from './scripts/alert'
import { darkTheme } from './scripts/theme'
import NavBar from './components/NavBar.vue'

const alert = setupAlert()
const { mobile } = useDisplay()
</script>

<template>
  <v-app :theme="darkTheme ? 'dark' : ''">
    <v-main>
      <RouterView />
    </v-main>
    <BottomBar v-if="mobile" />
    <NavBar v-else />
    <v-snackbar v-model="alert.show" :timeout="alert.duration" variant="flat">
      {{ alert.message }}
      <template #actions>
        <v-btn
          color="red"
          variant="text"
          @click="alert.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style scoped>
</style>
