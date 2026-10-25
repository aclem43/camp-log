<script setup lang="ts">
import { mdiFileUploadOutline } from '@mdi/js'
import { ref } from 'vue'
import Papa from 'papaparse'
import { remult } from 'remult'
import { Location } from '@/shared/models/Location'
import { showAlert } from '@/scripts/alert'
import { offline } from '@/scripts/connectivity'
import { isNetworkError, serverErrorMessage } from '@/scripts/outbox'
import { getUser } from '@/scripts/user'

const user = getUser()

interface ParsedRow {
  name: string
  notes: string
  latitude: number | null
  longitude: number | null
  error?: string
  importError?: string
}

const rows = ref<ParsedRow[]>([])
const importing = ref(false)
const file = ref<File | null>(null)

const wktPointPattern = /^point\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i

function parseWkt(wkt: string): { latitude: number, longitude: number } | null {
  const match = wktPointPattern.exec(wkt.trim())
  if (!match)
    return null

  return {
    longitude: Number(match[1]),
    latitude: Number(match[2]),
  }
}

function onFileChange() {
  rows.value = []
  if (!file.value)
    return

  Papa.parse<Record<string, string>>(file.value, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      rows.value = results.data.map((row) => {
        const point = parseWkt(row.WKT ?? '')
        return {
          name: row.name ?? '',
          notes: row.description ?? '',
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
          error: point ? undefined : 'Could not parse location (WKT)',
        }
      })
    },
    error: (err) => {
      showAlert(`Failed to read CSV: ${err.message}`)
    },
  })
}

const validRows = () => rows.value.filter(r => !r.error)

async function importRows() {
  importing.value = true
  const locationRepo = remult.repo(Location)
  const imported = new Set<ParsedRow>()
  let failureCount = 0
  let lostConnection = false

  for (const row of validRows()) {
    try {
      await locationRepo.insert({
        name: row.name,
        notes: row.notes,
        type: 'unknown',
        latitude: row.latitude!,
        longitude: row.longitude!,
        user: user.value!,
      })
      imported.add(row)
      row.importError = undefined
    }
    catch (err) {
      if (isNetworkError(err)) {
        lostConnection = true
        break
      }
      failureCount++
      row.importError = serverErrorMessage(err) ?? 'Failed to import'
    }
  }

  importing.value = false
  // Keep whatever didn't make it in, so it can be retried without picking the
  // file again.
  rows.value = rows.value.filter(r => !r.error && !imported.has(r))
  if (!rows.value.length)
    file.value = null

  const successCount = imported.size
  if (lostConnection)
    showAlert(`Imported ${successCount} location${successCount === 1 ? '' : 's'}. Lost connection, so the rest are kept here to import when you’re back online.`)
  else if (failureCount === 0)
    showAlert(`Imported ${successCount} location${successCount === 1 ? '' : 's'}`)
  else
    showAlert(`Imported ${successCount} location${successCount === 1 ? '' : 's'}, ${failureCount} failed`)
}
</script>

<template>
  <v-card flat>
    <v-card-text>
      <div class="d-flex flex-column ga-6">
        <p>
          Import a CSV exported from Google My Maps (columns: <code>WKT</code>, <code>name</code>, <code>description</code>).
          Imported locations are given the type "Unknown" — you can edit them individually afterwards.
        </p>

        <v-file-input
          v-model="file" hide-details label="CSV file" accept=".csv" variant="solo-filled"
          :prepend-inner-icon="mdiFileUploadOutline" prepend-icon="" @update:model-value="onFileChange"
        />

        <div v-if="rows.length">
          <p>
            {{ validRows().length }} of {{ rows.length }} rows ready to import.
          </p>

          <!-- Paginated - a My Maps export can have thousands of rows. -->
          <v-data-table
            :headers="[
              { title: 'Name', key: 'name' },
              { title: 'Latitude', key: 'latitude' },
              { title: 'Longitude', key: 'longitude' },
              { title: 'Status', key: 'status', sortable: false },
            ]"
            :items="rows"
            :items-per-page="10"
          >
            <template #[`item.status`]="{ item }">
              <span v-if="item.error" class="text-error">{{ item.error }}</span>
              <span v-else-if="item.importError" class="text-error">{{ item.importError }}</span>
              <span v-else class="text-success">OK</span>
            </template>
          </v-data-table>
        </div>

        <p v-if="offline && rows.length" class="text-medium-emphasis">
          You’re offline. Importing needs a connection, so these rows are kept until you’re back online.
        </p>
        <v-btn
          color="primary" :disabled="validRows().length === 0 || offline" :loading="importing"
          @click="importRows"
        >
          Import {{ validRows().length }} Location{{ validRows().length === 1 ? '' : 's' }}
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
