<script setup lang="ts">
import { mdiCampfire, mdiMagnify, mdiMapMarker } from '@mdi/js'
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Log } from '@/shared/models/Log'
import { Location } from '@/shared/models/Location'

const search = ref<string>('')

interface SearchResult {
  title: string
  subtitle: string
  icon?: string
}

const searchResults = ref<SearchResult[]>([])
const loading = ref<boolean>(false)

const logRepo = remult.repo(Log)
const locationRepo = remult.repo(Location)

function logToSearchResult(log: Log): SearchResult {
  return {
    title: log.name,
    subtitle: log.dateStart.toLocaleDateString(),
    icon: mdiCampfire,
  }
}
function locationToSearchResult(location: Location): SearchResult {
  return {
    title: location.name,
    subtitle: location.address,
    icon: mdiMapMarker,
  }
}

import { getUser } from '@/scripts/user'
const user = getUser()

async function searchQuery() {
  const query = search.value
  loading.value = true
  searchResults.value = []
  if (query === '') {
    const logResults = await logRepo.find({ limit: 10, where:{user:user.value!} })
    const locationResults = await locationRepo.find({ limit: 10, where:{user:user.value!} })
    searchResults.value.push(...logResults.map(log => logToSearchResult(log)))
    searchResults.value.push(...locationResults.map(location => locationToSearchResult(location)))
    searchResults.value.sort((a, b) => a.title.localeCompare(b.title))
    loading.value = false
    return
  }
  const logs = await logRepo.find({ where: { name: { $contains: query }, user:user.value! } })
  const locations = await locationRepo.find({ where: { name: { $contains: query }, user:user.value! } })
  const results = logs.map((log) => { return { title: log.name, subtitle: log.dateStart.toLocaleDateString() } })
  results.push(...locations.map((location) => { return { title: location.name, subtitle: location.address } }))
  results.sort((a, b) => a.title.localeCompare(b.title))
  searchResults.value.push(...results)
  loading.value = false
}

const debouncedSearchQuery = useDebounceFn(searchQuery, 500)

onMounted(() => {
  debouncedSearchQuery()
})
</script>

<template>
  <v-container>
    <v-col>
      <v-text-field
        v-model="search"
        label="Search" :prepend-inner-icon="mdiMagnify" variant="solo-filled"
        hide-details
        @input="debouncedSearchQuery"
      />
      <v-chip-group
        multiple
      >
        <v-chip
          text="To be Implemented"
          variant="outlined"
          filter
        />
      </v-chip-group>
      <v-divider class="mb-2" />
      <v-card>
        <v-list :loading="loading">
          <template v-if="loading">
            <v-skeleton-loader v-for="x in 4" :key="x" type="list-item" />
          </template>
          <template v-else>
            <v-list-item v-for="result in searchResults" :key="result.title" :prepend-icon="result.icon" :title="result.title" :subtitle="result.subtitle" />
            <v-list-item v-if="searchResults.length === 0" title="No results found" />
          </template>
        </v-list>
      </v-card>
    </v-col>
  </v-container>
</template>
