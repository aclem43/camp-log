<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { remult } from 'remult'
import { mdiCloseCircle, mdiDelete, mdiEye, mdiSync } from '@mdi/js'
import { Location } from '@/shared/models/Location'
import LoadError from '@/components/LoadError.vue'
import { getUser } from '@/scripts/user'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { describeFailure, pendingItems, removePending, resolvePendingLocation } from '@/scripts/outbox'
import { useRouteQuery } from '@/scripts/routeQuery'
import { retrySync } from '@/scripts/sync'

interface PendingLocationRow {
  pending: true
  pendingId: string
  pendingStatus: 'pending' | 'failed'
  pendingError?: string
  id: string
  name: string
  notes: string
  address: string
}
type LocationRow = (Location & { pending?: undefined }) | PendingLocationRow

const locations = ref<Location[]>([])
const loading = ref(true)
const loadError = ref(false)
const deletingId = ref<number | null>(null)
const user = getUser()
async function loadLocations() {
  loading.value = true
  loadError.value = false
  try {
    locations.value = await remult.repo(Location).find({ where: { user: user.value! }, orderBy: { name: 'asc' } })
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

const pendingLocationRows = computed<PendingLocationRow[]>(() => pendingItems.value
  .filter(item => item.entity === 'location')
  .map(item => ({
    pending: true,
    pendingId: item.id,
    pendingStatus: item.status,
    pendingError: item.error,
    id: item.id,
    name: (item.payload.name as string) || 'Unnamed campsite',
    notes: (item.payload.notes as string) || '',
    address: (item.payload.address as string) || '',
  })))

const rows = computed<LocationRow[]>(() => [...pendingLocationRows.value, ...locations.value])

const page = useRouteQuery('page', 1)
// e.g. "name:asc"; empty when the user turns sorting off
const sortQuery = useRouteQuery('sort', 'name:asc')
const sortBy = computed({
  get: () => sortQuery.value
    ? [{ key: sortQuery.value.split(':')[0], order: sortQuery.value.endsWith(':desc') ? 'desc' as const : 'asc' as const }]
    : [],
  set: (value: { key: string, order?: boolean | 'asc' | 'desc' }[]) => {
    sortQuery.value = value[0] ? `${value[0].key}:${value[0].order === 'desc' ? 'desc' : 'asc'}` : ''
  },
})

async function discardPending(id: string) {
  const confirmed = await askConfirm('Discard this unsynced location? It will be lost, and unsynced logs won’t link to it.', { confirmText: 'Discard' })
  if (!confirmed)
    return
  await resolvePendingLocation(id, null)
  await removePending(id)
}

onMounted(async () => {
  await loadLocations()
})

watch(() => pendingLocationRows.value.length, (_, previous) => {
  if (previous !== undefined)
    loadLocations()
})

async function deleteLocation(location: Location) {
  const confirmed = await askConfirm('Are you sure you want to delete this location? Its photos will be deleted too, and logs will no longer link to it.', { confirmText: 'Delete' })
  if (!confirmed)
    return
  deletingId.value = location.id
  try {
    await remult.repo(Location).delete(location)
    showAlert('Location deleted')
    await loadLocations()
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
    <v-row>
      <v-col>
        <v-card>
          <v-card-title>
            Locations
          </v-card-title>
          <v-card-text>
            <v-btn
              color="primary"
              :to="{ name: 'addLocation' }"
            >
              Add Location
            </v-btn>
            <LoadError v-if="loadError" what="your locations" class="mt-4" @retry="loadLocations" />
            <v-data-table
              v-model:page="page"
              v-model:sort-by="sortBy"
              :loading="loading"
              :headers="[
                { title: 'Name', value: 'name', sortable: true },
                { title: 'Nicknames', value: 'nicknames', sortable: false },
                { title: 'Notes', value: 'notes', sortable: true },
                { title: 'Address', value: 'address', sortable: true },
                { title: 'Actions', value: 'actions', sortable: false, width: '128px' },
              ]"
              :items="rows"
              :items-per-page="5"
              :no-data-text="loadError ? 'Locations couldn’t be loaded.' : 'No locations yet. Add one to see it here.'"
            >
              <template #[`item.notes`]="{ item }">
                <div class="notes-clamp" :title="item.notes">
                  {{ item.notes }}
                </div>
              </template>
              <template #[`item.name`]="{ item }">
                {{ item.name }}
                <v-chip
                  v-if="item.pending && item.pendingStatus === 'pending'"
                  size="small" color="info" variant="tonal" class="ml-2"
                >
                  Pending sync
                </v-chip>
                <template v-else-if="item.pending && item.pendingStatus === 'failed'">
                  <v-chip size="small" color="error" variant="tonal" class="ml-2">
                    Sync failed
                  </v-chip>
                  <div class="text-error text-body-small">
                    {{ item.pendingError || 'Unknown error' }}
                  </div>
                </template>
              </template>
              <template #[`item.actions`]="{ item }">
                <div v-if="item.pending" class="d-flex ga-2 align-center justify-center">
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
                <div v-else class="d-flex ga-2 align-center justify-center">
                  <v-btn icon color="primary" title="View" :aria-label="`View ${item.name}`" :to="`/location/${item.id}`">
                    <v-icon :icon="mdiEye" />
                  </v-btn>
                  <v-btn
                    icon color="error" title="Delete" :aria-label="`Delete ${item.name}`" :loading="deletingId === item.id"
                    @click="deleteLocation(item)"
                  >
                    <v-icon :icon="mdiDelete" />
                  </v-btn>
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.notes-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  max-width: 320px;
}
</style>
