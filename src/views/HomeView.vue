<script setup lang="ts">
import { mdiAccount, mdiChartLine, mdiCog, mdiPlus } from '@mdi/js'
import { remult } from 'remult'
import { computed, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { Location } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'
import LoadError from '@/components/LoadError.vue'
import { pendingItems } from '@/scripts/outbox'
import { getUser } from '@/scripts/user'

const { mobile } = useDisplay()

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
    locations.value = await remult.repo(Location).find({ where: { user: user.value! }, limit: LIST_LIMIT, orderBy: { id: 'desc' } })
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

// Logs saved offline come first - they're the most recent.
const recentLogs = computed(() => [
  ...pendingItems.value
    .filter(item => item.entity === 'log')
    .map(item => ({
      key: item.id,
      title: (item.payload.name as string) || 'Untitled log',
      subtitle: `${(item.payload.dateStart as Date | undefined)?.toLocaleDateString() ?? ''} · ${item.status === 'failed' ? 'Sync failed' : 'Waiting to sync'}`,
    })),
  ...logs.value.map(log => ({
    key: String(log.id),
    title: log.name || 'Untitled log',
    subtitle: log.dateStart.toLocaleDateString(),
  })),
].slice(0, LIST_LIMIT))

onMounted(async () => {
  loadLocations()
  loadLogs()
})

// A queued log or location just synced - show it as a real one.
watch(() => pendingItems.value.length, (count, previous) => {
  if (count < previous) {
    loadLocations()
    loadLogs()
  }
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
            <LoadError v-else-if="locationsError" what="your campsites" @retry="loadLocations" />
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
            <LoadError v-else-if="logsError && !recentLogs.length" what="your logs" @retry="loadLogs" />
            <v-list v-else-if="recentLogs.length">
              <v-list-item
                v-for="log in recentLogs"
                :key="log.key"
                :title="log.title"
                :subtitle="log.subtitle"
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
    :style="mobile ? { bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)' } : undefined"
    :icon="mdiPlus"
    aria-label="Add Log"
    :to="{ name: 'addLog' }"
  />
</template>
