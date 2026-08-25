<script setup lang="ts">
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { mdiArrowLeft } from '@mdi/js'
import { Log } from '@/shared/models/Log'
import { Activity } from '@/shared/models/Activity'
import type { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { getUser } from '@/scripts/user'
import router from '@/router'

const props = defineProps<{
  id: number
}>()

const user = getUser()
const logRepo = remult.repo(Log)
const activityRepo = remult.repo(Activity)

const loading = ref(true)
const loadError = ref(false)
const log = ref<Log | null>(null)
const activities = ref<(Activity & { template: ActivityTemplate })[]>([])

async function load() {
  loading.value = true
  loadError.value = false
  try {
    log.value = (await logRepo.findOne({ where: { id: props.id, user: user.value! }, include: { location: true } })) ?? null

    const found = log.value
      ? await activityRepo.find({ where: { log: log.value, user: user.value! }, include: { template: true } })
      : []
    // template can resolve to null if its ActivityTemplate was since deleted
    // (Settings has no cascade cleanup) - drop those rather than crash the render.
    activities.value = found.filter((a): a is Activity & { template: ActivityTemplate } => !!a.template)
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <v-container>
    <v-col>
      <v-card v-if="loading">
        <v-card-text>
          <v-skeleton-loader type="article" />
        </v-card-text>
      </v-card>

      <v-card v-else-if="loadError">
        <v-card-title>
          Failed to load log
        </v-card-title>
        <v-card-text>
          <p class="mb-4">
            The request didn't go through. If you're using an ad blocker or privacy extension, try allowing this site, then retry.
          </p>
          <v-btn color="primary" @click="load">
            Retry
          </v-btn>
        </v-card-text>
      </v-card>

      <v-card v-else-if="!log">
        <v-card-title>
          Log not found
        </v-card-title>
        <v-card-text>
          <v-btn color="primary" :to="{ name: 'logs' }">
            Back to Logs
          </v-btn>
        </v-card-text>
      </v-card>

      <v-card v-else>
        <v-card-title class="d-flex align-center ga-4">
          <v-btn size="small" color="primary" @click="router.back()">
            <v-icon :icon="mdiArrowLeft" />
          </v-btn> {{ log.name }}
        </v-card-title>
        <v-card-subtitle>
          {{ log.dateStart?.toLocaleDateString() }} {{ log.dateEnd ? `to ${log.dateEnd.toLocaleDateString()}` : '' }}
        </v-card-subtitle>
        <v-card-text>
          <v-list density="compact">
            <v-list-subheader v-if="log.description">
              Log Details
            </v-list-subheader>
            <v-list-item v-if="log.description">
              <v-list-item-title style="white-space: pre-wrap;">
                {{ log.description }}
              </v-list-item-title>
            </v-list-item>

            <v-list-subheader v-if="log.weather">
              Weather
            </v-list-subheader>
            <v-list-item v-if="log.weather">
              <v-list-item-title>
                {{ log.weather }}
              </v-list-item-title>
            </v-list-item>

            <v-list-subheader>
              Location
            </v-list-subheader>
            <v-list-item>
              <v-list-item-title>
                {{ log.location?.name }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ log.location?.address }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-subheader>
              Activities
            </v-list-subheader>
            <v-list-item
              v-for="activity in activities"
              :key="activity.id"
            >
              <v-list-item-title>
                <div class="d-flex justify-space-between">
                  {{ activity.template.name }}
                  <div>
                    {{ activity.value }} {{ activity.template.unit }}
                  </div>
                </div>
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ activity.template.description }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
