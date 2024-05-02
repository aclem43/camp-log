<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { remult } from 'remult'
import { Activity } from '@/shared/models/Activity'
import type { ActivityTemplate } from '@/shared/models/ActivityTemplate'

const activities = ref<Activity[]>([])

interface Stat {
  template: ActivityTemplate
  value: number
}

const stats = ref<Stat[]>([])

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

onMounted(async () => {
  activities.value = await remult.repo(Activity).find({ include: { template: true } })
  laodStats()
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
              { title: 'Activity', value: 'activity' },
              { title: 'Value', value: 'value' },
            ]"
            :items="stats"
            :items-per-page="5"
          >
            <template #[`item.activity`]="{ item }">
              {{ item.template.name }}
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
