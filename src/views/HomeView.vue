<script setup lang="ts">
import { mdiAccount, mdiCog } from '@mdi/js'
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { Location } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'

const locations = ref<Location[]>([])
const logs = ref<Log[]>([])
onMounted(async () => {
  locations.value = await remult.repo(Location).find({ limit: 5 })
  logs.value = await remult.repo(Log).find({ limit: 5, orderBy: { dateStart: 'desc' }, include: { location: true } })
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
        </v-card>
        <v-card>
          <v-card-title>
            Popular Campsites
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="loc in locations"
                :key="loc.id"
                :title="loc.name"
                :subtitle="loc.address"
              />
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
          <v-list>
            <v-list-item
              v-for="log in logs"
              :key="log.id"
              :title="log.name"
              :subtitle=" log.dateStart.toLocaleDateString()"
            />
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
