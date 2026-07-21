<script setup lang="ts">
import { mdiFileUploadOutline } from '@mdi/js'
import { ref } from 'vue'
import Papa from 'papaparse'
import { remult } from 'remult'
import { Location } from '@/shared/models/Location'
import { showAlert } from '@/scripts/alert'
import { getUser } from '@/scripts/user'

const user = getUser()

interface ParsedRow {
  name: string
  notes: string
  latitude: number | null
  longitude: number | null
  error?: string
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
  let successCount = 0
  let failureCount = 0

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
      successCount++
    }
    catch {
      failureCount++
    }
  }

  importing.value = false
  rows.value = []
  file.value = null

  if (failureCount === 0)
    showAlert(`Imported ${successCount} location${successCount === 1 ? '' : 's'}`)
  else
    showAlert(`Imported ${successCount} location${successCount === 1 ? '' : 's'}, ${failureCount} failed`)
}
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title>
          Import Locations
        </v-card-title>

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

              <v-table density="compact">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in rows" :key="index">
                    <td>{{ row.name }}</td>
                    <td>{{ row.latitude }}</td>
                    <td>{{ row.longitude }}</td>
                    <td>
                      <span v-if="row.error" class="text-error">{{ row.error }}</span>
                      <span v-else class="text-success">OK</span>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>

            <v-btn
              color="primary" :disabled="validRows().length === 0" :loading="importing"
              @click="importRows"
            >
              Import {{ validRows().length }} Location{{ validRows().length === 1 ? '' : 's' }}
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
