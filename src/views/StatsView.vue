<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { remult } from 'remult'
import { Activity } from '@/shared/models/Activity'
import type { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { Log } from '@/shared/models/Log'
import LoadError from '@/components/LoadError.vue'
import { getUser } from '@/scripts/user'

const MS_PER_DAY = 1000 * 60 * 60 * 24

// Summing decimals gives float noise (0.1 + 0.2), so round for display.
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

const activities = ref<Activity[]>([])
const logs = ref<Log[]>([])
const loading = ref(true)
const loadError = ref(false)
const user = getUser()
interface Stat {
  template: ActivityTemplate
  value: number
}

const stats = computed(() => {
  const byTemplateId = new Map<number, Stat>()
  for (const activity of activities.value) {
    if (!activity.template)
      continue

    const stat = byTemplateId.get(activity.template.id)
    if (stat)
      stat.value += activity.value
    else
      byTemplateId.set(activity.template.id, { template: activity.template, value: activity.value })
  }
  return [...byTemplateId.values()]
})

function nightsForLog(log: Log) {
  if (!log.dateEnd)
    return 0

  return Math.max(0, Math.round((log.dateEnd.getTime() - log.dateStart.getTime()) / MS_PER_DAY))
}

const nightsCamped = computed(() => logs.value.reduce((total, log) => total + nightsForLog(log), 0))

function formatValue(value: number, unit = '') {
  const formatted = numberFormat.format(value)
  return unit ? `${formatted}\u00A0${unit}` : formatted
}

const rows = computed(() => [
  { label: 'Nights Camped', value: formatValue(nightsCamped.value) },
  ...stats.value.map(stat => ({ label: stat.template.name, value: formatValue(stat.value, stat.template.unit) })),
])

async function load() {
  loading.value = true
  loadError.value = false
  try {
    [activities.value, logs.value] = await Promise.all([
      remult.repo(Activity).find({ where: { user: user.value! }, include: { template: true } }),
      remult.repo(Log).find({ where: { user: user.value! } }),
    ])
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
      <v-card>
        <v-card-title>
          Statistics
        </v-card-title>
        <v-card-text>
          <LoadError v-if="loadError" what="your statistics" @retry="load" />
          <v-data-table
            v-else
            density="compact"
            :loading="loading"
            :headers="[
              { title: 'Statistic', value: 'label' },
              { title: 'Value', value: 'value', align: 'end' },
            ]"
            :items="loading ? [] : rows"
            :items-per-page="-1"
            hide-default-footer
          >
            <template #[`item.label`]="{ item }">
              {{ item.label }}
            </template>
            <template #[`item.value`]="{ item }">
              <span class="tabular-nums">{{ item.value }}</span>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
