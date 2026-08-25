<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useDisplay } from 'vuetify'
import { onMounted } from 'vue'
import BottomBar from './components/BottomBar.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import OnlineStatusBanner from './components/OnlineStatusBanner.vue'
import { setupAlert } from './scripts/alert'
import { darkTheme } from './scripts/theme'
import NavBar from './components/NavBar.vue'
import { getLoggedIn, initialize } from './scripts/user'

const alert = setupAlert()
const { mobile } = useDisplay()

const loggedIn = getLoggedIn()
</script>

<template>
  <v-app :theme="darkTheme ? 'dark' : ''">
    <v-main>
      <OnlineStatusBanner />
      <RouterView v-slot="{ Component }">
        <KeepAlive include="MapView">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </v-main>
    <BottomBar v-if="mobile && loggedIn" />
    <NavBar v-else-if="loggedIn" />
    <ConfirmDialog />
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
