<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { remult } from 'remult'
import { Activity } from '@/shared/models/Activity'
import type { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { Log } from '@/shared/models/Log'
import { getUser } from '@/scripts/user'

const MS_PER_DAY = 1000 * 60 * 60 * 24

const activities = ref<Activity[]>([])
const logs = ref<Log[]>([])
const user = getUser()
interface Stat {
  template: ActivityTemplate
  value: number
}

const stats = ref<Stat[]>([])
const nightsCamped = ref(0)

function laodStats() {
  for (const activity of activities.value) {
    if (!activity.template)
      continue

    const stat = stats.value.find(s => s.template.id === activity.template?.id)
    if (stat)
      stat.value += activity.value
    else
      stats.value.push({ template: activity.template, value: activity.value })
  }
}

function nightsForLog(log: Log) {
  if (!log.dateEnd)
    return 0

  return Math.max(0, Math.round((log.dateEnd.getTime() - log.dateStart.getTime()) / MS_PER_DAY))
}

function loadNightsCamped() {
  nightsCamped.value = logs.value.reduce((total, log) => total + nightsForLog(log), 0)
}

const rows = computed(() => [
  { label: 'Nights Camped', value: nightsCamped.value },
  ...stats.value.map(stat => ({ label: stat.template.name, value: stat.value })),
])

onMounted(async () => {
  activities.value = await remult.repo(Activity).find({where: { user: user.value! }, include: { template: true } })
  laodStats()

  logs.value = await remult.repo(Log).find({ where: { user: user.value! } })
  loadNightsCamped()
})
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title>
          Statistics
        </v-card-title>
        <v-card-text>
          <v-data-table
            density="compact"
            :headers="[
              { title: 'Statistic', value: 'label' },
              { title: 'Value', value: 'value' },
            ]"
            :items="rows"
            :items-per-page="5"
          >
            <template #[`item.label`]="{ item }">
              {{ item.label }}
            </template>
            <template #[`item.value`]="{ item }">
              {{ item.value }}
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
