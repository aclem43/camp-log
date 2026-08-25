<script setup lang="ts">
import { mdiEye, mdiEyeOff, mdiFileUploadOutline, mdiMapMarker } from '@mdi/js'
import { computed, ref } from 'vue'
import { remult } from 'remult'
import { Location } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'
import { showAlert } from '@/scripts/alert'
import { getUser } from '@/scripts/user'

const user = getUser()
const locationRepo = remult.repo(Location)
const logRepo = remult.repo(Log)

interface TerrainEntry {
  id: string
  title: string
  start_date: string
  end_date?: string
  distance_travelled?: number
  achievement_meta?: { stream?: string, branch?: string }
  details?: {
    other_participants?: string
    purpose?: string
    verifier?: { name?: string, contact?: string }
    who_lead?: string
    weather?: string
    location?: string
    your_role?: string
  }
}

interface TerrainExport {
  entries: TerrainEntry[]
}

// 'new' = create a location from locationText, 'none' = leave log unlinked,
// a number = link to that existing location's id.
type LocationChoice = number | 'new' | 'none'

interface ImportRow {
  raw: TerrainEntry
  name: string
  description: string
  weather: string
  dateStart: Date
  dateEnd?: Date
  locationText: string
  locationChoice: LocationChoice
  include: boolean
  status: 'pending' | 'success' | 'error'
  error?: string
}

const BRANCHES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA', 'National']

const file = ref<File | null>(null)
const rows = ref<ImportRow[]>([])
const existingLocations = ref<Location[]>([])
const importing = ref(false)
const loadingLocations = ref(false)

const branch = ref<string | null>(null)
const memberNumber = ref('')
const password = ref('')
const showPassword = ref(false)
const connecting = ref(false)

function onMemberNumberInput(value: string) {
  memberNumber.value = value.replace(/\D/g, '')
}

function normalize(s: string) {
  return s.trim().toLowerCase()
}

function matchesText(candidate: string, needle: string): boolean {
  const name = normalize(candidate)
  if (!name)
    return false
  return name === needle || (needle.length > 3 && (needle.includes(name) || name.includes(needle)))
}

function findMatchingLocation(locationText: string): Location | undefined {
  const needle = normalize(locationText)
  if (!needle)
    return undefined

  return existingLocations.value.find((l) => {
    const nicknames = l.nicknames.split(',').map(n => n.trim()).filter(Boolean)
    return matchesText(l.name, needle) || nicknames.some(n => matchesText(n, needle))
  })
}

function buildDescription(entry: TerrainEntry): string {
  const d = entry.details ?? {}
  const lines: string[] = []
  if (d.purpose)
    lines.push(`Purpose: ${d.purpose}`)
  if (entry.achievement_meta?.stream)
    lines.push(`Activity area: ${entry.achievement_meta.stream}${entry.achievement_meta.branch && entry.achievement_meta.branch !== entry.achievement_meta.stream ? ` / ${entry.achievement_meta.branch}` : ''}`)
  if (d.your_role)
    lines.push(`Role: ${d.your_role}`)
  if (d.who_lead)
    lines.push(`Led by: ${d.who_lead}`)
  if (d.other_participants)
    lines.push(`Other participants: ${d.other_participants}`)
  if (entry.distance_travelled)
    lines.push(`Distance travelled: ${entry.distance_travelled}m`)
  if (d.verifier?.name)
    lines.push(`Verifier: ${d.verifier.name}${d.verifier.contact ? ` (${d.verifier.contact})` : ''}`)
  lines.push('Imported from Scouts Terrain logbook')
  return lines.join('\n')
}

async function loadEntries(entries: TerrainEntry[]) {
  loadingLocations.value = true
  existingLocations.value = await locationRepo.find({ where: { user: user.value! } })
  loadingLocations.value = false

  rows.value = entries.map((entry) => {
    const locationText = entry.details?.location ?? ''
    const match = findMatchingLocation(locationText)
    return {
      raw: entry,
      name: entry.title.trim(),
      description: buildDescription(entry),
      weather: entry.details?.weather ?? '',
      dateStart: new Date(entry.start_date),
      dateEnd: entry.end_date ? new Date(entry.end_date) : undefined,
      locationText,
      locationChoice: match ? match.id : (locationText ? 'new' : 'none'),
      include: true,
      status: 'pending',
    } satisfies ImportRow
  })
}

async function onFileChange() {
  rows.value = []
  if (!file.value)
    return

  const text = await file.value.text()
  let parsed: TerrainExport
  try {
    parsed = JSON.parse(text)
  }
  catch {
    showAlert('Could not parse file as JSON')
    return
  }

  if (!Array.isArray(parsed.entries)) {
    showAlert('Expected a Terrain export with an "entries" array')
    return
  }

  await loadEntries(parsed.entries)
}

async function connectToTerrain() {
  if (!branch.value || !memberNumber.value.trim() || !password.value) {
    showAlert('Branch, member number and password are required')
    return
  }

  connecting.value = true
  rows.value = []
  try {
    const response = await fetch('/api/terrain-import/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch: branch.value,
        memberNumber: memberNumber.value.trim(),
        password: password.value,
      }),
    })
    const body = await response.json()
    if (!response.ok) {
      showAlert(body?.message ?? 'Could not connect to Terrain')
      return
    }
    await loadEntries(body.entries ?? [])
    showAlert(`Fetched ${body.entries?.length ?? 0} entries from Terrain`)
  }
  catch {
    showAlert('Could not reach the server. Please try again.')
  }
  finally {
    // Never keep the password in memory longer than the single request.
    password.value = ''
    connecting.value = false
  }
}

function locationOptions(row: ImportRow) {
  const options: { title: string, value: LocationChoice }[] = []
  if (row.locationText)
    options.push({ title: `+ Create new: "${row.locationText}"`, value: 'new' })
  options.push({ title: 'No location', value: 'none' })
  for (const l of existingLocations.value)
    options.push({ title: l.name, value: l.id })
  return options
}

const includedCount = computed(() => rows.value.filter(r => r.include).length)

async function importRows() {
  importing.value = true
  // Reuse one newly-created location per distinct locationText, so 61 rows
  // that mention the same place don't create 61 duplicate locations.
  const createdByText = new Map<string, Location>()
  let successCount = 0
  let failureCount = 0

  for (const row of rows.value) {
    if (!row.include)
      continue

    try {
      let location: Location | undefined

      if (row.locationChoice === 'new') {
        const key = normalize(row.locationText)
        location = createdByText.get(key)
        if (!location) {
          location = await locationRepo.insert({
            name: row.locationText.slice(0, 200) || row.name,
            notes: '',
            type: 'unknown',
            user: user.value!,
          })
          createdByText.set(key, location)
          existingLocations.value.push(location)
        }
      }
      else if (row.locationChoice !== 'none') {
        location = existingLocations.value.find(l => l.id === row.locationChoice)
      }

      await logRepo.insert({
        name: row.name,
        description: row.description,
        weather: row.weather,
        dateStart: row.dateStart,
        dateEnd: row.dateEnd,
        location,
        user: user.value!,
      })

      row.status = 'success'
      successCount++
    }
    catch (err) {
      row.status = 'error'
      row.error = err instanceof Error ? err.message : 'Failed to import'
      failureCount++
    }
  }

  importing.value = false
  showAlert(
    failureCount === 0
      ? `Imported ${successCount} log${successCount === 1 ? '' : 's'}`
      : `Imported ${successCount} log${successCount === 1 ? '' : 's'}, ${failureCount} failed`,
  )
}
</script>

<template>
  <v-card flat>
    <v-card-text>
      <div class="d-flex flex-column ga-6">
        <p>
          Fetch entries straight from your Scouts Australia Terrain logbook, or upload a previously
          exported JSON file. Review the location match for each entry below — you can link it to an
          existing location, create a new one, or leave it unlinked — before importing.
        </p>

        <v-card variant="tonal">
          <v-card-text>
            <p class="mb-4">
              Connect your Terrain account. Your password is sent directly to this server for a single
              login and is never stored.
            </p>
            <v-form class="d-flex flex-column ga-4" @submit.prevent="connectToTerrain">
              <v-select
                v-model="branch" label="Branch" :items="BRANCHES" variant="solo-filled" hide-details
              />
              <v-text-field
                :model-value="memberNumber" label="Member Number" variant="solo-filled" hide-details
                inputmode="numeric" pattern="[0-9]*" @update:model-value="onMemberNumberInput"
              />
              <v-text-field
                v-model="password" label="Password" :type="showPassword ? 'text' : 'password'"
                variant="solo-filled" hide-details autocomplete="off"
                :append-inner-icon="showPassword ? mdiEyeOff : mdiEye"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-btn type="submit" color="primary" :loading="connecting" :disabled="connecting">
                Connect &amp; Fetch Logbook
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>

        <v-divider>or</v-divider>

        <v-file-input
          v-model="file" hide-details label="Terrain export JSON" accept=".json" variant="solo-filled"
          :prepend-inner-icon="mdiFileUploadOutline" prepend-icon="" :loading="loadingLocations"
          @update:model-value="onFileChange"
        />

        <div v-if="rows.length">
          <p>
            {{ includedCount }} of {{ rows.length }} entries will be imported.
          </p>

          <v-table density="compact">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Start Date</th>
                <th>Weather</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="row.raw.id ?? index">
                <td>
                  <v-checkbox v-model="row.include" hide-details density="compact" />
                </td>
                <td>{{ row.name }}</td>
                <td>{{ row.dateStart.toLocaleDateString() }}</td>
                <td>{{ row.weather }}</td>
                <td style="min-width: 260px;">
                  <v-autocomplete
                    v-model="row.locationChoice"
                    :items="locationOptions(row)"
                    :prepend-inner-icon="mdiMapMarker"
                    density="compact"
                    variant="solo-filled"
                    hide-details
                  />
                </td>
                <td>
                  <span v-if="row.status === 'success'" class="text-success">Imported</span>
                  <span v-else-if="row.status === 'error'" class="text-error">{{ row.error }}</span>
                  <span v-else class="text-medium-emphasis">Pending</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>

        <v-btn
          color="primary" :disabled="includedCount === 0" :loading="importing"
          @click="importRows"
        >
          Import {{ includedCount }} Log{{ includedCount === 1 ? '' : 's' }}
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
