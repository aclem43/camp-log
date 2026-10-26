<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { remult } from 'remult'
import { mdiCloseCircle, mdiDelete, mdiMagnify, mdiMapMarker, mdiSync } from '@mdi/js'
import { Location, campTypesToColor, campTypesToText, type campTypesType } from '@/shared/models/Location'
import { LogLocation } from '@/shared/models/LogLocation'
import LoadError from '@/components/LoadError.vue'
import { getUser } from '@/scripts/user'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { describeFailure, pendingItems, removePending, resolvePendingLocation } from '@/scripts/outbox'
import { useRouteQuery } from '@/scripts/routeQuery'
import { retrySync } from '@/scripts/sync'

// One card: a synced location (`id`) or one still in the outbox (`pending`).
interface LocationRow {
  key: string
  id?: number
  pending?: { id: string, status: 'pending' | 'failed', error?: string }
  name: string
  nicknames: string[]
  notes: string
  type: campTypesType
  address: string
  place: string
  hasPin: boolean
  visits: number
  lastVisit?: Date
}
type SortOrder = 'name' | 'nameDesc' | 'recent' | 'mostVisited' | 'lastVisited'

const itemsPerPage = 10

const sortOptions: { title: string, value: SortOrder }[] = [
  { title: 'Name (A-Z)', value: 'name' },
  { title: 'Name (Z-A)', value: 'nameDesc' },
  { title: 'Recently added', value: 'recent' },
  { title: 'Most visited', value: 'mostVisited' },
  { title: 'Last visited', value: 'lastVisited' },
]

const locations = ref<Location[]>([])
// Per location id: how many logs visited it, and the latest one's start.
const visitsByLocationId = ref<Map<number, { count: number, last?: Date }>>(new Map())
const page = useRouteQuery('page', 1)
const search = useRouteQuery('q', '')
const sortQuery = useRouteQuery<string>('sort', 'name')
// Falls back for an unknown value, e.g. a "name:asc" link from the old table.
const sortOrder = computed<SortOrder>({
  get: () => sortOptions.some(o => o.value === sortQuery.value) ? sortQuery.value as SortOrder : 'name',
  set: (value) => { sortQuery.value = value },
})
const loading = ref(true)
const loadError = ref(false)
const deletingId = ref<number | null>(null)

const locationRepo = remult.repo(Location)
const logLocationRepo = remult.repo(LogLocation)

const user = getUser()

async function load() {
  loading.value = true
  loadError.value = false
  try {
    const [found, links] = await Promise.all([
      locationRepo.find({ where: { user: user.value! } }),
      logLocationRepo.find({ where: { user: user.value! }, include: { log: true, location: true } }),
    ])
    const visits = new Map<number, { count: number, last?: Date }>()
    for (const link of links) {
      if (!link.log || !link.location)
        continue
      const entry = visits.get(link.location.id) ?? { count: 0 }
      entry.count++
      if (link.log.dateStart && (!entry.last || link.log.dateStart > entry.last))
        entry.last = link.log.dateStart
      visits.set(link.location.id, entry)
    }
    locations.value = found
    visitsByLocationId.value = visits
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

function placeOf(fields: { city?: string, state?: string, country?: string, address?: string }) {
  return [fields.city, fields.state].filter(Boolean).join(', ') || fields.country || fields.address || ''
}

function splitNicknames(nicknames: string | undefined) {
  return (nicknames ?? '').split(',').map(n => n.trim()).filter(Boolean)
}

// 0, 0 is how a location without a pin is stored.
function hasPin(latitude: unknown, longitude: unknown) {
  return !!(Number(latitude) || Number(longitude))
}

const pendingRows = computed<LocationRow[]>(() => pendingItems.value
  .filter(item => item.entity === 'location')
  .map((item) => {
    const payload = item.payload as Partial<Location>
    return {
      key: item.id,
      pending: { id: item.id, status: item.status, error: item.error },
      name: payload.name || 'Unnamed campsite',
      nicknames: splitNicknames(payload.nicknames),
      notes: payload.notes ?? '',
      type: payload.type ?? 'unknown',
      address: payload.address ?? '',
      place: placeOf(payload),
      hasPin: hasPin(payload.latitude, payload.longitude),
      visits: 0,
    }
  }))

const syncedRows = computed<LocationRow[]>(() => locations.value.map((location) => {
  const visits = visitsByLocationId.value.get(location.id)
  return {
    key: String(location.id),
    id: location.id,
    name: location.name,
    nicknames: splitNicknames(location.nicknames),
    notes: location.notes,
    type: location.type,
    address: location.address,
    place: placeOf(location),
    hasPin: hasPin(location.latitude, location.longitude),
    visits: visits?.count ?? 0,
    lastVisit: visits?.last,
  }
}))

function compareRows(a: LocationRow, b: LocationRow) {
  switch (sortOrder.value) {
    case 'nameDesc':
      return b.name.localeCompare(a.name)
    case 'recent':
      return (b.id ?? 0) - (a.id ?? 0)
    case 'mostVisited':
      return b.visits - a.visits || a.name.localeCompare(b.name)
    case 'lastVisited':
      return (b.lastVisit?.getTime() ?? 0) - (a.lastVisit?.getTime() ?? 0) || a.name.localeCompare(b.name)
    default:
      return a.name.localeCompare(b.name)
  }
}

const hasRows = computed(() => pendingRows.value.length > 0 || locations.value.length > 0)

// Unsynced locations stay on top, where they're easy to spot and retry.
const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  const matches = (row: LocationRow) => !query || [row.name, ...row.nicknames, row.notes, row.address, row.place]
    .some(text => text.toLowerCase().includes(query))
  return [
    ...pendingRows.value.filter(matches),
    ...syncedRows.value.filter(matches).sort(compareRows),
  ]
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / itemsPerPage)))
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * itemsPerPage, page.value * itemsPerPage))

watch([search, sortOrder], () => {
  page.value = 1
})

watch(pageCount, (count) => {
  // Not while loading, or a page from the URL would be lost before the locations arrive.
  if (!loading.value && page.value > count)
    page.value = count
})

function visitsText(row: LocationRow) {
  if (!row.visits)
    return 'No visits yet'
  const visits = row.visits === 1 ? '1 visit' : `${row.visits} visits`
  return row.lastVisit
    ? `${visits} · last ${row.lastVisit.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
    : visits
}

// Outbox ids this page discarded - their rows vanishing isn't a sync.
const discardedIds = new Set<string>()

async function discardPending(id: string) {
  const confirmed = await askConfirm('Discard this unsynced location? It will be lost, and unsynced logs won’t link to it.', { confirmText: 'Discard' })
  if (!confirmed)
    return
  discardedIds.add(id)
  await resolvePendingLocation(id, null)
  await removePending(id)
}

onMounted(async () => {
  await load()
})

// A pending location leaving the outbox has synced - reload to show it.
watch(() => pendingRows.value.map(row => row.key), (keys, previous) => {
  let synced = false
  for (const key of previous ?? []) {
    if (!keys.includes(key) && !discardedIds.delete(key))
      synced = true
  }
  if (synced)
    load()
})

async function deleteLocation(row: LocationRow) {
  const confirmed = await askConfirm('Are you sure you want to delete this location? Its photos will be deleted too, and logs will no longer link to it. This cannot be undone.', { confirmText: 'Delete' })
  if (!confirmed)
    return
  deletingId.value = row.id!
  try {
    await locationRepo.delete(row.id!)
    showAlert('Location deleted')
    await load()
  }
  catch (err) {
    showAlert(describeFailure('delete location', err))
  }
  finally {
    deletingId.value = null
  }
}
</script>

<template>
  <v-container>
    <v-col>
      <div class="d-flex flex-column ga-4">
        <div class="d-flex align-center flex-wrap ga-4">
          <h1 class="text-headline-small">
            Locations
          </h1>
          <v-spacer />
          <v-btn color="primary" :to="{ name: 'addLocation' }">
            Add Location
          </v-btn>
        </div>

        <div class="d-flex flex-wrap ga-4">
          <v-text-field
            v-model="search"
            label="Filter"
            placeholder="Search name, nickname, place or notes…"
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

        <LoadError v-if="loadError" what="your locations" @retry="load" />
        <template v-else-if="loading && !hasRows">
          <v-skeleton-loader v-for="x in 3" :key="x" type="article" />
        </template>
        <v-alert v-else-if="!hasRows" type="info" variant="tonal">
          No locations yet. Add one to see it here.
        </v-alert>
        <v-alert v-else-if="!filteredRows.length" type="info" variant="tonal">
          No locations match your filter.
        </v-alert>

        <v-card v-for="row in pagedRows" :key="row.key">
          <v-card-title class="d-flex align-center flex-wrap ga-2">
            <router-link v-if="row.id" :to="`/location/${row.id}`" class="location-name text-primary">
              {{ row.name }}
            </router-link>
            <span v-else class="location-name">{{ row.name }}</span>
            <v-chip
              v-if="row.pending?.status === 'pending'"
              size="small" color="info" variant="tonal"
            >
              Pending sync
            </v-chip>
            <v-chip
              v-else-if="row.pending?.status === 'failed'"
              size="small" color="error" variant="tonal"
            >
              Sync failed
            </v-chip>
            <v-spacer />
            <div v-if="row.pending" class="d-flex ga-2">
              <v-btn
                v-if="row.pending.status === 'failed'"
                icon color="primary" title="Retry sync" aria-label="Retry sync"
                @click="retrySync(row.pending.id)"
              >
                <v-icon :icon="mdiSync" />
              </v-btn>
              <v-btn icon color="error" title="Discard" aria-label="Discard" @click="discardPending(row.pending.id)">
                <v-icon :icon="mdiCloseCircle" />
              </v-btn>
            </div>
            <div v-else class="d-flex ga-2">
              <v-btn
                v-if="row.hasPin" icon color="primary" title="Show on map"
                :aria-label="`Show ${row.name} on map`" :to="{ name: 'map', query: { location: row.id } }"
              >
                <v-icon :icon="mdiMapMarker" />
              </v-btn>
              <v-btn
                icon color="error" title="Delete" :aria-label="`Delete ${row.name}`"
                :loading="deletingId === row.id" @click="deleteLocation(row)"
              >
                <v-icon :icon="mdiDelete" />
              </v-btn>
            </div>
          </v-card-title>
          <v-card-text v-if="row.pending?.status === 'failed'" class="text-error pb-0">
            Sync failed: {{ row.pending.error || 'unknown error' }}
          </v-card-text>
          <v-card-subtitle class="text-wrap">
            {{ [row.place, row.pending ? '' : visitsText(row)].filter(Boolean).join(' · ') }}
          </v-card-subtitle>
          <v-card-text class="d-flex flex-column ga-2">
            <div class="d-flex flex-wrap ga-2">
              <v-chip size="small" variant="outlined">
                <span class="type-swatch" :style="{ backgroundColor: campTypesToColor(row.type) }" />
                {{ campTypesToText(row.type) }}
              </v-chip>
              <v-chip v-if="!row.hasPin" size="small" color="warning" variant="tonal">
                No pin
              </v-chip>
              <v-chip v-for="nickname in row.nicknames" :key="nickname" size="small" variant="tonal">
                {{ nickname }}
              </v-chip>
            </div>
            <div v-if="row.notes" class="notes-clamp">
              {{ row.notes }}
            </div>
          </v-card-text>
        </v-card>

        <v-pagination v-if="pageCount > 1" v-model="page" :length="pageCount" />
      </div>
    </v-col>
  </v-container>
</template>

<style scoped>
/* Block-level so a long name truncates; padded to a 44px tap target. */
.location-name {
  display: block;
  min-width: 0;
  max-width: 100%;
  padding-block: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}

a.location-name:hover {
  text-decoration: underline;
}

.type-swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
}

.notes-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  white-space: pre-wrap;
}
</style>
