<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useDisplay } from 'vuetify'
import BottomBar from './components/BottomBar.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import OnlineStatusBanner from './components/OnlineStatusBanner.vue'
import { setupAlert } from './scripts/alert'
import { darkTheme } from './scripts/theme'
import NavBar from './components/NavBar.vue'
import { getLoggedIn } from './scripts/user'

const alert = setupAlert()
const { mobile } = useDisplay()

const loggedIn = getLoggedIn()
</script>

<template>
  <v-app :theme="darkTheme ? 'dark' : ''">
    <v-main :class="{ 'main--bottom-bar': mobile && loggedIn }">
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
    <v-snackbar :key="alert.id" v-model="alert.show" :timeout="alert.duration" variant="flat">
      {{ alert.message }}
      <template #actions>
        <v-btn
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
/* The layout only reserves the bottom bar's 56px; its safe-area padding
   (BottomBar.vue) sits on top of that on notched phones. */
.main--bottom-bar {
  padding-bottom: calc(var(--v-layout-bottom) + env(safe-area-inset-bottom, 0px));
}
</style>
