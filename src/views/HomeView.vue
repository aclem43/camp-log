<script setup lang="ts">
import { mdiAccount, mdiChartLine, mdiCog } from '@mdi/js'
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { Location } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'

const locations = ref<Location[]>([])
const locationsLoading = ref(false)
const logs = ref<Log[]>([])
const logsLoading = ref(false)

async function loadLocations() {
  locationsLoading.value = true
  locations.value = await remult.repo(Location).find({ limit: 5 })
  locationsLoading.value = false
}

async function loadLogs() {
  logsLoading.value = true
  logs.value = await remult.repo(Log).find({ limit: 5, orderBy: { dateStart: 'desc' }, include: { location: true } })
  logsLoading.value = false
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
              Welcome, User
            </div>
            <div>
              <v-btn
                color="primary"
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
            Popular Campsites
          </v-card-title>
          <v-card-text>
            <v-list :loading="locationsLoading">
              <template v-if="locationsLoading">
                <v-skeleton-loader v-for="x in 4" :key="x" type="list-item" />
              </template>
              <template v-else>
                <v-list-item
                  v-for="loc in locations"
                  :key="loc.id"
                  :title="loc.name"
                  :subtitle="loc.address"
                />
              </template>
            </v-list>
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
          <v-list :loading="logsLoading">
            <template v-if="logsLoading">
              <v-skeleton-loader v-for="x in 4" :key="x" type="list-item" />
            </template>
            <template v-else>
              <v-list-item
                v-for="log in logs"
                :key="log.id"
                :title="log.name"
                :subtitle=" log.dateStart.toLocaleDateString()"
              />
            </template>
          </v-list>
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
</template>
