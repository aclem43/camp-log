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
              density="compact"
              :loading="loading"
              :headers="[
                { title: 'Name', value: 'name', sortable: true },
                { title: 'Nicknames', value: 'nicknames', sortable: false },
                { title: 'Notes', value: 'notes', sortable: true },
                { title: 'Address', value: 'address', sortable: true },
                { title: 'Actions', value: 'actions', sortable: false, width: '100px' },
              ]"
              :items="rows"
              :items-per-page="5"
              :sort-by="[{ key: 'name', order: 'asc' }]"
            >
              <template #[`item.name`]="{ item }">
                {{ item.name }}
                <v-chip
                  v-if="item.pending && item.pendingStatus === 'pending'"
                  size="small" color="info" variant="tonal" class="ml-2"
                >
                  Pending sync
                </v-chip>
                <v-chip
                  v-else-if="item.pending && item.pendingStatus === 'failed'"
                  size="small" color="error" variant="tonal" class="ml-2"
                  :title="item.pendingError"
                >
                  Sync failed
                </v-chip>
              </template>
              <template #[`item.actions`]="{ item }">
                <div v-if="item.pending" class="d-flex ga-2 align-center justify-center">
                  <v-btn
                    v-if="item.pendingStatus === 'failed'"
                    density="compact" color="primary" title="Retry sync"
                    @click="retrySync(item.pendingId)"
                  >
                    <v-icon :icon="mdiSync" />
                  </v-btn>
                  <v-btn density="compact" color="error" title="Discard" @click="discardPending(item.pendingId)">
                    <v-icon :icon="mdiCloseCircle" />
                  </v-btn>
                </div>
                <div v-else class="d-flex ga-2 align-center justify-center">
                  <v-btn density="compact" color="primary" :to="`/location/${item.id}`">
                    <v-icon :icon="mdiEye" />
                  </v-btn>
                  <v-btn density="compact" color="error" :loading="deletingId === item.id" @click="deleteLocation(item)">
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
