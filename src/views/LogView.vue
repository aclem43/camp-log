<script setup lang="ts">
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { mdiArrowLeft } from '@mdi/js'
import { Log } from '@/shared/models/Log'
import { Activity } from '@/shared/models/Activity'
import { getUser } from '@/scripts/user'

const props = defineProps<{
  id: number
}>()

const log = ref<Log | null>(null)
const activities = ref<Activity[]>([])

const user = getUser()

onMounted(async () => {
  log.value = await remult.repo(Log).findOne({ where: { id: props.id , user: user.value! }, include: { location: true } })
  activities.value = await remult.repo(Activity).find({ where: { log: log.value, user: user.value! }, include: { template: true } })
})
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title class="d-flex align-center ga-4">
          <v-btn :to="{ name: 'logs' }" size="small" color="primary">
            <v-icon :icon="mdiArrowLeft" />
          </v-btn> {{ log?.name }}
        </v-card-title>
        <v-card-subtitle>
          {{ log?.dateStart?.toLocaleDateString() }} {{ log?.dateEnd ? `to ${log.dateEnd.toLocaleDateString()}` : '' }}
        </v-card-subtitle>
        <v-card-text>
          <v-list density="compact">
            <v-list-subheader v-if="log?.description">
              Log Details
            </v-list-subheader>
            <v-list-item v-if="log?.description">
              <v-list-item-title>
                {{ log?.description }}
              </v-list-item-title>
            </v-list-item>
            <v-list-subheader>
              Location
            </v-list-subheader>
            <v-list-item>
              <v-list-item-title>
                {{ log?.location?.name }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ log?.location?.address }}
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
                  {{ activity.template?.name }}
                  <div>
                    {{ activity.value }} {{ activity.template?.unit }}
                  </div>
                </div>
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ activity.template?.description }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
