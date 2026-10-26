<script setup lang="ts">
import { mdiCampfire, mdiMagnify, mdiMapMarker } from '@mdi/js'
import { remult } from 'remult'
import type { WritableComputedRef } from 'vue'
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Log } from '@/shared/models/Log'
import { Location, campTypes, campTypesToColor, campTypesToText, type campTypesType } from '@/shared/models/Location'
import LoadError from '@/components/LoadError.vue'
import { formatDateRange } from '@/scripts/dates'
import { useRouteQuery } from '@/scripts/routeQuery'
import { getUser } from '@/scripts/user'

const DEFAULT_LIMIT = 10
const SEARCH_LIMIT = 25
const LOG_COLOR = '#f57c00'

// In the URL, so going back from a result returns to the same search.
const search = useRouteQuery('q', '')
const selectedTypes = useRouteQuery('types', ['log', 'location']) as WritableComputedRef<Array<'log' | 'location'>>

interface SearchResult {
  title: string
  subtitle: string
  icon: string
  color?: string
  id: number
  type: 'log' | 'location'
}

const searchResults = ref<SearchResult[]>([])
const loading = ref<boolean>(false)
const loadError = ref(false)

const logRepo = remult.repo(Log)
const locationRepo = remult.repo(Location)
const user = getUser()

function logToSearchResult(log: Log): SearchResult {
  return {
    title: log.name,
    subtitle: `Log · ${formatDateRange(log.dateStart, log.dateEnd)}`,
    icon: mdiCampfire,
    color: LOG_COLOR,
    id: log.id,
    type: 'log',
  }
}
function locationToSearchResult(location: Location): SearchResult {
  const place = location.address
    || [location.city, location.state, location.country].filter(Boolean).join(', ')
  // The type is in words as well as the icon colour.
  const subtitle = [campTypesToText(location.type), place].filter(Boolean).join(' · ')
  return {
    title: location.name,
    subtitle,
    icon: mdiMapMarker,
    color: campTypesToColor(location.type),
    id: location.id,
    type: 'location',
  }
}

function logWhere(query: string) {
  if (!query)
    return { user: user.value! }
  return {
    user: user.value!,
    $or: [
      { name: { $contains: query } },
      { description: { $contains: query } },
      { weather: { $contains: query } },
    ],
  }
}
function locationWhere(query: string) {
  if (!query)
    return { user: user.value! }
  return {
    user: user.value!,
    $or: [
      { name: { $contains: query } },
      { nicknames: { $contains: query } },
      { notes: { $contains: query } },
      { address: { $contains: query } },
      { city: { $contains: query } },
      { state: { $contains: query } },
      { country: { $contains: query } },
    ],
  }
}

let requestId = 0

async function searchQuery() {
  const requestToken = ++requestId
  loading.value = true
  const query = search.value.trim()
  const limit = query ? SEARCH_LIMIT : DEFAULT_LIMIT
  const includeLogs = selectedTypes.value.includes('log')
  const includeLocations = selectedTypes.value.includes('location')

  let logs: Log[]
  let locations: Location[]
  try {
    [logs, locations] = await Promise.all([
      includeLogs ? logRepo.find({ limit, where: logWhere(query) }) : Promise.resolve([]),
      includeLocations ? locationRepo.find({ limit, where: locationWhere(query) }) : Promise.resolve([]),
    ])
  }
  catch {
    if (requestToken === requestId) {
      loadError.value = true
      loading.value = false
    }
    return
  }

  if (requestToken !== requestId)
    return // a newer search superseded this one

  loadError.value = false
  const results = [...logs.map(logToSearchResult), ...locations.map(locationToSearchResult)]
  results.sort((a, b) => a.title.localeCompare(b.title))
  searchResults.value = results
  loading.value = false
}

const debouncedSearchQuery = useDebounceFn(searchQuery, 500)

watch(search, () => debouncedSearchQuery())
// Joined, because any query change (typing a search) rebuilds the array.
watch(() => selectedTypes.value.join(','), () => searchQuery(), { immediate: true })
</script>

<template>
  <v-container>
    <v-col>
      <v-text-field
        v-model="search"
        label="Search"
        :prepend-inner-icon="mdiMagnify"
        variant="solo-filled"
        hide-details
        clearable
      />
      <v-chip-group
        v-model="selectedTypes"
        multiple
        mandatory
        column
      >
        <v-chip value="log" :prepend-icon="mdiCampfire" variant="outlined" filter>
          Logs
        </v-chip>
        <v-chip value="location" :prepend-icon="mdiMapMarker" variant="outlined" filter>
          Locations
        </v-chip>
      </v-chip-group>
      <div class="search-legend">
        <span class="search-legend-item">
          <span class="search-legend-swatch" :style="{ backgroundColor: LOG_COLOR }" />
          Log
        </span>
        <span v-for="type in campTypes" :key="type" class="search-legend-item">
          <span class="search-legend-swatch" :style="{ backgroundColor: campTypesToColor(type as campTypesType) }" />
          {{ campTypesToText(type as campTypesType) }}
        </span>
      </div>
      <v-divider class="mb-2" />
      <v-card>
        <v-list :loading="loading">
          <v-list-item v-if="loadError && !loading">
            <LoadError what="search results" @retry="searchQuery" />
          </v-list-item>
          <template v-else-if="loading">
            <v-skeleton-loader v-for="x in 4" :key="x" type="list-item" />
          </template>
          <template v-else>
            <v-list-item
              v-for="result in searchResults"
              :key="`${result.type}-${result.id}`"
              :title="result.title"
              :subtitle="result.subtitle"
              :to="result.type === 'location'
                ? { name: 'map', query: { location: result.id } }
                : { name: result.type, params: { id: result.id } }"
            >
              <template #prepend>
                <v-icon :icon="result.icon" :color="result.color" />
              </template>
            </v-list-item>
            <v-list-item
              v-if="searchResults.length === 0"
              :title="search ? `No results found for “${search}”` : 'No logs or locations found'"
            />
          </template>
        </v-list>
      </v-card>
    </v-col>
  </v-container>
</template>

<style scoped>
.search-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  margin: 4px 0 12px;
  font-size: 14px;
  opacity: 0.87;
}

.search-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
