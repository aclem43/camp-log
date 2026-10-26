<script setup lang="ts">
import { remult } from 'remult'
import { computed, onMounted, ref, watch } from 'vue'
import { mdiCloseCircle, mdiDelete, mdiEye, mdiMagnify, mdiSync } from '@mdi/js'
import { Log } from '@/shared/models/Log'
import { LogLocation } from '@/shared/models/LogLocation'
import type { Location } from '@/shared/models/Location'
import LoadError from '@/components/LoadError.vue'
import { formatDateRange } from '@/scripts/dates'
import { getUser } from '@/scripts/user'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { describeFailure, pendingItems, removePending } from '@/scripts/outbox'
import { useRouteQuery } from '@/scripts/routeQuery'
import { retrySync } from '@/scripts/sync'

interface PendingLogRow {
  pending: true
  pendingId: string
  pendingStatus: 'pending' | 'failed'
  pendingError?: string
  id: string
  name: string
  description: string
  dateStart?: Date
  dateEnd?: Date
}
type LogRow = (Log & { pending?: undefined }) | PendingLogRow
type SortOrder = 'dateDesc' | 'dateAsc' | 'name'

const itemsPerPage = 5

const sortOptions: { title: string, value: SortOrder }[] = [
  { title: 'Newest first', value: 'dateDesc' },
  { title: 'Oldest first', value: 'dateAsc' },
  { title: 'Name (A-Z)', value: 'name' },
]

const logs = ref<Log[]>([])
const locationsByLogId = ref<Map<number, Location[]>>(new Map())
const page = useRouteQuery('page', 1)
const search = useRouteQuery('q', '')
const sortOrder = useRouteQuery<SortOrder>('sort', 'dateDesc')
const loading = ref(true)
const loadError = ref(false)
const deletingId = ref<number | null>(null)

const logRepo = remult.repo(Log)
const logLocationRepo = remult.repo(LogLocation)

const user = getUser()

function locationsFor(id: number | string) {
  return locationsByLogId.value.get(Number(id)) ?? []
}

async function load() {
  loading.value = true
  loadError.value = false
  try {
    const [found, links] = await Promise.all([
      logRepo.find({ where: { user: user.value! } }),
      logLocationRepo.find({ where: { user: user.value! }, include: { log: true, location: true } }),
    ])
    const map = new Map<number, Location[]>()
    for (const link of links) {
      if (!link.log || !link.location)
        continue
      const existing = map.get(link.log.id) ?? []
      existing.push(link.location)
      map.set(link.log.id, existing)
    }
    logs.value = found
    locationsByLogId.value = map
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

async function deleteLog(log: Log) {
  const confirmed = await askConfirm('Are you sure you want to delete this log? Its activities and photos will be deleted too.', { confirmText: 'Delete' })
  if (!confirmed)
    return
  deletingId.value = log.id
  try {
    await logRepo.delete(log)
    showAlert('Log deleted')
    await load()
  }
  catch (err) {
    showAlert(describeFailure('delete log', err))
  }
  finally {
    deletingId.value = null
  }
}

const pendingLogRows = computed<PendingLogRow[]>(() => pendingItems.value
  .filter(item => item.entity === 'log')
  .map(item => ({
    pending: true,
    pendingId: item.id,
    pendingStatus: item.status,
    pendingError: item.error,
    id: item.id,
    name: (item.payload.name as string) || 'Untitled log',
    description: (item.payload.description as string) || '',
    dateStart: item.payload.dateStart as Date | undefined,
    dateEnd: item.payload.dateEnd as Date | undefined,
  })))

const allRows = computed<LogRow[]>(() => [...pendingLogRows.value, ...logs.value])

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  const matching = query
    ? allRows.value.filter(row =>
        row.name.toLowerCase().includes(query)
        || row.description.toLowerCase().includes(query)
        || (!row.pending && locationsFor(row.id).some(l => l.name.toLowerCase().includes(query))),
      )
    : allRows.value

  return [...matching].sort((a, b) => {
    if (sortOrder.value === 'name')
      return a.name.localeCompare(b.name)
    const diff = (a.dateStart?.getTime() ?? 0) - (b.dateStart?.getTime() ?? 0)
    return sortOrder.value === 'dateAsc' ? diff : -diff
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / itemsPerPage)))
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * itemsPerPage, page.value * itemsPerPage))

watch([search, sortOrder], () => {
  page.value = 1
})

watch(pageCount, (count) => {
  // Not while loading, or a page from the URL would be lost before the logs arrive.
  if (!loading.value && page.value > count)
    page.value = count
})

async function discardPending(id: string) {
  const confirmed = await askConfirm('Discard this unsynced log? It will be lost.', { confirmText: 'Discard' })
  if (!confirmed)
    return
  await removePending(id)
}

onMounted(async () => {
  await load()
})

watch(() => pendingLogRows.value.length, (_, previous) => {
  if (previous !== undefined)
    load()
})
</script>

<template>
  <v-container>
    <v-col>
      <div class="d-flex flex-column ga-4">
        <h1 class="text-headline-small">
          Logs
        </h1>

        <div class="d-flex flex-wrap ga-4">
          <v-text-field
            v-model="search"
            label="Filter"
            placeholder="Search name, description, or location…"
            variant="solo-filled"
            hide-details
            clearable
            :prepend-inner-icon="mdiMagnify"
            style="min-width: 240px; flex: 2 1 240px;"
          />
          <v-select
            v-model="sortOrder"
            label="Sort by"
            variant="solo-filled"
            hide-details
            :items="sortOptions"
            style="min-width: 180px; flex: 1 1 180px;"
          />
        </div>

        <LoadError v-if="loadError" what="your logs" @retry="load" />
        <template v-else-if="loading && !logs.length">
          <v-skeleton-loader v-for="x in 3" :key="x" type="article" />
        </template>
        <v-alert v-else-if="!allRows.length" type="info" variant="tonal">
          No logs yet.
        </v-alert>
        <v-alert v-else-if="!filteredRows.length" type="info" variant="tonal">
          No logs match your filter.
        </v-alert>

        <v-card v-for="item in pagedRows" :key="item.pending ? item.pendingId : item.id">
          <v-card-title class="d-flex align-center flex-wrap ga-2">
            <span class="text-truncate" style="min-width: 0;">{{ item.name }}</span>
            <v-chip
              v-if="item.pending && item.pendingStatus === 'pending'"
              size="small" color="info" variant="tonal"
            >
              Pending sync
            </v-chip>
            <v-chip
              v-else-if="item.pending && item.pendingStatus === 'failed'"
              size="small" color="error" variant="tonal"
            >
              Sync failed
            </v-chip>
            <v-spacer />
            <div v-if="item.pending" class="d-flex ga-2">
              <v-btn
                v-if="item.pendingStatus === 'failed'"
                icon color="primary" title="Retry sync" aria-label="Retry sync"
                @click="retrySync(item.pendingId)"
              >
                <v-icon :icon="mdiSync" />
              </v-btn>
              <v-btn icon color="error" title="Discard" aria-label="Discard" @click="discardPending(item.pendingId)">
                <v-icon :icon="mdiCloseCircle" />
              </v-btn>
            </div>
            <div v-else class="d-flex ga-2">
              <v-btn icon color="primary" title="View" :aria-label="`View ${item.name}`" :to="`/log/${item.id}`">
                <v-icon :icon="mdiEye" />
              </v-btn>
              <v-btn
                icon color="error" title="Delete" :aria-label="`Delete ${item.name}`" :loading="deletingId === item.id"
                @click="deleteLog(item)"
              >
                <v-icon :icon="mdiDelete" />
              </v-btn>
            </div>
          </v-card-title>
          <v-card-text v-if="item.pending && item.pendingStatus === 'failed'" class="text-error pb-0">
            Sync failed: {{ item.pendingError || 'unknown error' }}
          </v-card-text>
          <!-- Wraps: dates plus several locations don't fit one line on a phone. -->
          <v-card-subtitle class="text-wrap">
            {{ formatDateRange(item.dateStart, item.dateEnd) }}
            <template v-if="!item.pending && locationsFor(item.id).length">
              ·
              <span v-for="loc in locationsFor(item.id)" :key="loc.id" class="log-location">
                <router-link :to="{ name: 'map', query: { location: loc.id } }" class="text-primary">{{ loc.name }}</router-link>
              </span>
            </template>
          </v-card-subtitle>
          <v-card-text v-if="item.description" style="white-space: pre-wrap;">
            {{ item.description }}
          </v-card-text>
        </v-card>

        <v-pagination v-if="pageCount > 1" v-model="page" :length="pageCount" />
      </div>
    </v-col>
  </v-container>
</template>

<style scoped>
/* The separator is CSS, so template whitespace can't put a space before it. */
.log-location:not(:last-child)::after {
  content: ', ';
}
</style>
