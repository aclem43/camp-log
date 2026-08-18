<script setup lang="ts">
import { mdiAccount, mdiChartLine, mdiCog, mdiPlus } from '@mdi/js'
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { Location } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'
import { getUser } from '@/scripts/user'

const LIST_LIMIT = 5

const locations = ref<Location[]>([])
const locationsLoading = ref(false)
const locationsError = ref(false)

const logs = ref<Log[]>([])
const logsLoading = ref(false)
const logsError = ref(false)

const user = getUser()

async function loadLocations() {
  locationsLoading.value = true
  locationsError.value = false
  try {
    locations.value = await remult.repo(Location).find({ where: { user: user.value! }, limit: LIST_LIMIT })
  }
  catch {
    locationsError.value = true
  }
  finally {
    locationsLoading.value = false
  }
}

async function loadLogs() {
  logsLoading.value = true
  logsError.value = false
  try {
    logs.value = await remult.repo(Log).find({ where: { user: user.value! }, limit: LIST_LIMIT, orderBy: { dateStart: 'desc' } })
  }
  catch {
    logsError.value = true
  }
  finally {
    logsLoading.value = false
  }
}

onMounted(async () => {
  loadLocations()
  loadLogs()
})
</script>

<template>
  <v-container>
    <v-row>
      <v-col class="d-flex flex-column ga-4">
        <v-card>
          <v-card-title class="d-flex ga-4 justify-space-between">
            <div>
              <v-icon size="32" :icon="mdiAccount" />
              Welcome, {{ user?.name || 'No Name Set' }}!
            </div>
            <div>
              <v-btn
                color="primary"
                aria-label="Settings"
                :to="{ name: 'settings' }"
              >
                <v-icon :icon="mdiCog" />
              </v-btn>
            </div>
          </v-card-title>
          <v-card-text>
            Welcome to your personal logbook. Start by adding a new log.
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              :to="{ name: 'stats' }"
              :prepend-icon="mdiChartLine"
            >
              Statistics
            </v-btn>
          </v-card-actions>
        </v-card>
        <v-card>
          <v-card-title>
            Your Campsites
          </v-card-title>
          <v-card-text>
            <template v-if="locationsLoading">
              <v-skeleton-loader v-for="x in 4" :key="x" type="list-item" />
            </template>
            <v-alert v-else-if="locationsError" type="error" variant="tonal" density="compact">
              Couldn't load your campsites. Please try again later.
            </v-alert>
            <v-list v-else-if="locations.length">
              <v-list-item
                v-for="loc in locations"
                :key="loc.id"
                :title="loc.name || 'Unnamed campsite'"
                :subtitle="loc.address || 'No address set'"
              />
            </v-list>
            <p v-else class="text-medium-emphasis">
              You haven't added any campsites yet.
            </p>
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              :to="{ name: 'locations' }"
            >
              View Locations
            </v-btn>
          </v-card-actions>
        </v-card>
        <v-card>
          <v-card-title>
            Recent Logs
          </v-card-title>
          <v-card-text>
            <template v-if="logsLoading">
              <v-skeleton-loader v-for="x in 4" :key="x" type="list-item" />
            </template>
            <v-alert v-else-if="logsError" type="error" variant="tonal" density="compact">
              Couldn't load your logs. Please try again later.
            </v-alert>
            <v-list v-else-if="logs.length">
              <v-list-item
                v-for="log in logs"
                :key="log.id"
                :title="log.name || 'Untitled log'"
                :subtitle="log.dateStart.toLocaleDateString()"
              />
            </v-list>
            <p v-else class="text-medium-emphasis">
              You haven't logged any trips yet.
            </p>
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              :to="{ name: 'logs' }"
            >
              View Logs
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
  <v-fab
    app
    color="primary"
    location="bottom end"
    :icon="mdiPlus"
    aria-label="Add Log"
    :to="{ name: 'addLog' }"
  />
</template>
