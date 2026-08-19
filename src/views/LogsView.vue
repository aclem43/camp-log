<script setup lang="ts">
import { remult } from 'remult'
import { computed, onMounted, ref, watch } from 'vue'
import { mdiCloseCircle, mdiDelete, mdiEye, mdiSync } from '@mdi/js'
import { Log } from '@/shared/models/Log'
import { getUser } from '@/scripts/user'
import { askConfirm } from '@/scripts/confirm'
import { pendingItems, removePending, retryPending } from '@/scripts/outbox'
import { syncOutbox } from '@/scripts/sync'

interface PendingLogRow {
  pending: true
  pendingId: string
  pendingStatus: 'pending' | 'failed'
  pendingError?: string
  id: string
  name: string
  description: string
  location?: { name: string }
  dateStart?: Date
  dateEnd?: Date
}
type LogRow = (Log & { pending?: undefined }) | PendingLogRow

const logs = ref<Log[]>([])

const logRepo = remult.repo(Log)

const user = getUser()

async function load() {
  logs.value = await logRepo.find({where: { user: user.value! }, include: { location: true } })
}

async function deleteLog(log: Log) {
  const confirmed = await askConfirm('Are you sure you want to delete this log?', { confirmText: 'Delete' })
  if (!confirmed)
    return
  await logRepo.delete(log)
  await load()
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
    location: undefined,
    dateStart: item.payload.dateStart as Date | undefined,
  })))

const rows = computed<LogRow[]>(() => [...pendingLogRows.value, ...logs.value])

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
      <v-card>
        <v-card-title>
          Logs
        </v-card-title>
        <v-card-text>
          <v-data-table
            density="compact"
            :headers="[
              { title: 'Name', value: 'name', sortable: true },
              { title: 'Description', value: 'description', sortable: true, width: '200px' },
              { title: 'Location', value: 'location', sortable: true },
              { title: 'Start Date', value: 'dateStart', sortable: true },
              { title: 'Actions', value: 'actions', sortable: false, width: '90px' },
            ]"
            :items="rows"
            :items-per-page="5"
            :sort-by="[{ key: 'dateStart', order: 'desc' }]"
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
            <template #[`item.location`]="{ item }">
              {{ item.pending ? '—' : item.location?.name }}
            </template>
            <template #[`item.dateStart`]="{ item }">
              {{ item.dateStart?.toLocaleDateString() }}
            </template>
            <template #[`item.dateEnd`]="{ item }">
              {{ item.dateEnd?.toLocaleDateString() }}
            </template>
            <template #[`item.actions`]="{ item }">
              <div v-if="item.pending" class="d-flex ga-2 align-center justify-center">
                <v-btn
                  v-if="item.pendingStatus === 'failed'"
                  density="compact" color="primary" :title="'Retry sync'"
                  @click="retryPending(item.pendingId); syncOutbox()"
                >
                  <v-icon :icon="mdiSync" />
                </v-btn>
                <v-btn density="compact" color="error" title="Discard" @click="discardPending(item.pendingId)">
                  <v-icon :icon="mdiCloseCircle" />
                </v-btn>
              </div>
              <div v-else class="d-flex ga-2 align-center justify-center">
                <v-btn density="compact" color="primary" :to="`/log/${item.id}`">
                  <v-icon :icon="mdiEye" />
                </v-btn>
                <v-btn density="compact" color="error" @click="deleteLog(item)">
                  <v-icon :icon="mdiDelete" />
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
