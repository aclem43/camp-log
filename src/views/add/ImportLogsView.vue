<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight, mdiEye, mdiEyeOff, mdiFileUploadOutline, mdiMapMarker, mdiSkipNext } from '@mdi/js'
import { computed, ref } from 'vue'
import { remult } from 'remult'
import DatePicker from '@/components/date-picker/DatePicker.vue'
import { Location, campTypes, campTypesToText, type campTypesType } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'
import { LogLocation } from '@/shared/models/LogLocation'
import { showAlert } from '@/scripts/alert'
import { getUser } from '@/scripts/user'

const user = getUser()
const locationRepo = remult.repo(Location)
const logRepo = remult.repo(Log)
const logLocationRepo = remult.repo(LogLocation)

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

interface NewLocationDraft {
  name: string
  nicknames: string[]
  type: campTypesType
  address: string
  city: string
  state: string
  country: string
  latitude?: number
  longitude?: number
}

interface ImportRow {
  raw: TerrainEntry
  name: string
  description: string
  weather: string
  dateStart: Date
  dateEnd?: Date
  locationText: string
  selectedLocationIds: number[]
  addNewLocation: boolean
  newLocationDraft: NewLocationDraft
  status: 'pending' | 'success' | 'skipped' | 'error'
  error?: string
}

const BRANCHES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA', 'National']
const campTypesText = campTypes.map(t => ({ title: campTypesToText(t as campTypesType), value: t }))

const file = ref<File | null>(null)
const rows = ref<ImportRow[]>([])
const currentIndex = ref(0)
const existingLocations = ref<Location[]>([])
const loadingEntries = ref(false)
const saving = ref(false)
const findingAddress = ref(false)

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

function buildRow(entry: TerrainEntry): ImportRow {
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
    selectedLocationIds: match ? [match.id] : [],
    addNewLocation: !match && !!locationText,
    newLocationDraft: {
      name: locationText || entry.title.trim(),
      nicknames: [],
      type: 'unknown',
      address: '',
      city: '',
      state: '',
      country: '',
    },
    status: 'pending',
  }
}

async function loadEntries(entries: TerrainEntry[]) {
  loadingEntries.value = true
  const [locations, alreadyImported] = await Promise.all([
    locationRepo.find({ where: { user: user.value! } }),
    entries.length
      ? logRepo.find({ where: { user: user.value!, terrainId: entries.map(e => e.id) } })
      : Promise.resolve([]),
  ])
  existingLocations.value = locations
  loadingEntries.value = false

  const importedIds = new Set(alreadyImported.map(l => l.terrainId))
  rows.value = entries.map((entry) => {
    const row = buildRow(entry)
    if (importedIds.has(entry.id))
      row.status = 'success'
    return row
  })

  const firstPending = rows.value.findIndex(r => r.status === 'pending')
  currentIndex.value = firstPending === -1 ? 0 : firstPending

  if (importedIds.size > 0) {
    showAlert(`${importedIds.size} entr${importedIds.size === 1 ? 'y was' : 'ies were'} already imported previously — picking up where you left off`)
  }
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

function startOver() {
  rows.value = []
  currentIndex.value = 0
}

const currentRow = computed(() => rows.value[currentIndex.value] as ImportRow | undefined)
const totalCount = computed(() => rows.value.length)
const importedCount = computed(() => rows.value.filter(r => r.status === 'success').length)
const skippedCount = computed(() => rows.value.filter(r => r.status === 'skipped').length)
const remainingCount = computed(() => rows.value.filter(r => r.status === 'pending').length)
const allDone = computed(() => rows.value.length > 0 && remainingCount.value === 0)
const progressPercent = computed(() => totalCount.value === 0 ? 0 : ((importedCount.value + skippedCount.value) / totalCount.value) * 100)

function goPrevious() {
  if (currentIndex.value > 0)
    currentIndex.value--
}

function goNext() {
  if (currentIndex.value < rows.value.length - 1)
    currentIndex.value++
}

// After a new location is created, re-check any still-pending rows that were
// also proposing "create new" - if their text now matches the just-created
// location, link them to it instead of creating a near-duplicate later.
function rematchPendingRows() {
  for (const row of rows.value) {
    if (row.status !== 'pending' || !row.addNewLocation)
      continue
    const match = findMatchingLocation(row.locationText)
    if (match) {
      row.addNewLocation = false
      if (!row.selectedLocationIds.includes(match.id))
        row.selectedLocationIds.push(match.id)
    }
  }
}

const findAddressDisabled = computed(() => {
  if (!currentRow.value || findingAddress.value)
    return true
  return currentRow.value.newLocationDraft.address.length === 0
})

async function findDraftAddress() {
  const row = currentRow.value
  if (!row || findAddressDisabled.value)
    return

  findingAddress.value = true
  try {
    const resp = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: row.newLocationDraft.address }),
    })
    const result = await resp.json()
    if (!resp.ok) {
      showAlert(result.message ?? 'Failed to find address')
      return
    }
    row.newLocationDraft.latitude = result.latitude
    row.newLocationDraft.longitude = result.longitude
    row.newLocationDraft.city = result.info?.city ?? row.newLocationDraft.city
    row.newLocationDraft.state = result.info?.state ?? row.newLocationDraft.state
    row.newLocationDraft.country = result.info?.country ?? row.newLocationDraft.country
  }
  catch {
    showAlert('Failed to find address')
  }
  finally {
    findingAddress.value = false
  }
}

async function resolveLocations(row: ImportRow): Promise<Location[]> {
  const locations = row.selectedLocationIds
    .map(id => existingLocations.value.find(l => l.id === id))
    .filter((l): l is Location => !!l)

  if (row.addNewLocation) {
    const draft = row.newLocationDraft
    const location = await locationRepo.insert({
      name: draft.name.trim() || row.locationText || row.name,
      nicknames: draft.nicknames.join(', '),
      notes: '',
      type: draft.type,
      address: draft.address,
      city: draft.city,
      state: draft.state,
      country: draft.country,
      latitude: draft.latitude,
      longitude: draft.longitude,
      user: user.value!,
    })
    existingLocations.value.push(location)
    rematchPendingRows()
    locations.push(location)
  }

  return locations
}

async function importCurrent() {
  const row = currentRow.value
  if (!row || row.status === 'success')
    return

  saving.value = true
  try {
    const locations = await resolveLocations(row)
    const log = await logRepo.insert({
      name: row.name,
      description: row.description,
      weather: row.weather,
      dateStart: row.dateStart,
      dateEnd: row.dateEnd,
      terrainId: row.raw.id,
      user: user.value!,
    })
    await Promise.allSettled(locations.map(location => logLocationRepo.insert({ log, location })))
    row.status = 'success'
    row.error = undefined
    if (currentIndex.value < rows.value.length - 1)
      goNext()
  }
  catch (err) {
    row.status = 'error'
    row.error = err instanceof Error ? err.message : 'Failed to import'
  }
  finally {
    saving.value = false
  }
}

function skipCurrent() {
  const row = currentRow.value
  if (!row)
    return
  row.status = 'skipped'
  if (currentIndex.value < rows.value.length - 1)
    goNext()
}
</script>

<template>
  <v-card flat>
    <v-card-text>
      <div class="d-flex flex-column ga-6">
        <template v-if="rows.length === 0">
          <p>
            Fetch entries straight from your Scouts Australia Terrain logbook, or upload a previously
            exported JSON file. You'll then step through each entry one at a time, with the option to
            link it to an existing location or create a new one, before importing it. You can stop at
            any point — anything already imported stays imported, and picking up the same account or
            file again later skips straight to what's left.
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
            :prepend-inner-icon="mdiFileUploadOutline" prepend-icon="" :loading="loadingEntries"
            @update:model-value="onFileChange"
          />
        </template>

        <template v-else>
          <div class="d-flex align-center justify-space-between ga-4">
            <div class="text-body-2">
              <strong>{{ importedCount }}</strong> imported ·
              <strong>{{ skippedCount }}</strong> skipped ·
              <strong>{{ remainingCount }}</strong> remaining of {{ totalCount }}
            </div>
            <v-btn variant="text" size="small" @click="startOver">
              Start Over
            </v-btn>
          </div>
          <v-progress-linear :model-value="progressPercent" color="primary" height="6" rounded />

          <v-alert v-if="allDone" type="success" variant="tonal">
            All entries reviewed — {{ importedCount }} imported, {{ skippedCount }} skipped.
          </v-alert>
          <v-btn v-if="allDone" color="primary" :to="{ name: 'logs' }">
            View Logs
          </v-btn>

          <template v-else-if="currentRow">
            <v-card variant="tonal">
              <v-card-text class="d-flex flex-column ga-4">
                <div class="d-flex align-center justify-space-between">
                  <span class="text-medium-emphasis">Entry {{ currentIndex + 1 }} of {{ totalCount }}</span>
                  <v-chip v-if="currentRow.status === 'success'" color="success" size="small">
                    Imported
                  </v-chip>
                  <v-chip v-else-if="currentRow.status === 'skipped'" color="warning" size="small">
                    Skipped
                  </v-chip>
                  <v-chip v-else-if="currentRow.status === 'error'" color="error" size="small">
                    {{ currentRow.error }}
                  </v-chip>
                </div>

                <v-text-field
                  v-model="currentRow.name" label="Name" variant="solo-filled" hide-details
                  :readonly="currentRow.status === 'success'"
                />

                <div class="d-flex ga-2 flex-wrap">
                  <v-chip v-if="currentRow.raw.achievement_meta?.stream" size="small" variant="outlined">
                    {{ currentRow.raw.achievement_meta.stream }}<template
                      v-if="currentRow.raw.achievement_meta.branch && currentRow.raw.achievement_meta.branch !== currentRow.raw.achievement_meta.stream"
                    >
                      / {{ currentRow.raw.achievement_meta.branch }}
                    </template>
                  </v-chip>
                  <v-chip v-if="currentRow.raw.details?.your_role" size="small" variant="outlined">
                    Role: {{ currentRow.raw.details.your_role }}
                  </v-chip>
                  <v-chip v-if="currentRow.raw.details?.who_lead" size="small" variant="outlined">
                    Led by: {{ currentRow.raw.details.who_lead }}
                  </v-chip>
                  <v-chip v-if="currentRow.raw.distance_travelled" size="small" variant="outlined">
                    {{ currentRow.raw.distance_travelled }}m travelled
                  </v-chip>
                </div>

                <div class="d-flex ga-4 flex-wrap">
                  <DatePicker v-model="currentRow.dateStart" label="Start Date" />
                  <DatePicker v-if="currentRow.dateEnd" v-model="currentRow.dateEnd" label="End Date" />
                </div>

                <v-text-field
                  v-model="currentRow.weather" label="Weather" variant="solo-filled" hide-details
                  :readonly="currentRow.status === 'success'"
                />

                <v-textarea
                  v-model="currentRow.description" label="Description" variant="solo-filled" hide-details
                  rows="4" :readonly="currentRow.status === 'success'"
                />

                <div
                  v-if="currentRow.raw.details?.other_participants || currentRow.raw.details?.purpose || currentRow.raw.details?.verifier?.name"
                  class="text-body-2 text-medium-emphasis"
                >
                  <div v-if="currentRow.raw.details?.purpose">
                    Purpose: {{ currentRow.raw.details.purpose }}
                  </div>
                  <div v-if="currentRow.raw.details?.other_participants">
                    Other participants: {{ currentRow.raw.details.other_participants }}
                  </div>
                  <div v-if="currentRow.raw.details?.verifier?.name">
                    Verifier: {{ currentRow.raw.details.verifier.name }}<template
                      v-if="currentRow.raw.details.verifier.contact"
                    >
                      ({{ currentRow.raw.details.verifier.contact }})
                    </template>
                  </div>
                </div>

                <v-divider />

                <v-autocomplete
                  v-model="currentRow.selectedLocationIds"
                  :items="existingLocations"
                  label="Locations"
                  :prepend-inner-icon="mdiMapMarker"
                  variant="solo-filled"
                  item-title="name"
                  item-value="id"
                  multiple
                  chips
                  closable-chips
                  hide-details
                  :disabled="currentRow.status === 'success'"
                />
                <p v-if="currentRow.locationText" class="text-caption text-medium-emphasis">
                  Terrain says: "{{ currentRow.locationText }}"
                </p>

                <v-checkbox
                  v-if="currentRow.status !== 'success'"
                  v-model="currentRow.addNewLocation"
                  label="Also create a new location"
                  hide-details
                  density="compact"
                />

                <v-card v-if="currentRow.addNewLocation && currentRow.status !== 'success'" variant="outlined">
                  <v-card-text class="d-flex flex-column ga-4">
                    <p class="text-subtitle-2 mb-0">
                      New Location
                    </p>
                    <v-text-field
                      v-model="currentRow.newLocationDraft.name" label="Name" variant="solo-filled" hide-details
                    />
                    <v-combobox
                      v-model="currentRow.newLocationDraft.nicknames" label="Nicknames" multiple chips
                      closable-chips variant="solo-filled" hide-details
                    />
                    <v-select
                      v-model="currentRow.newLocationDraft.type" label="Type" :items="campTypesText"
                      variant="solo-filled" hide-details
                    />
                    <div class="d-flex align-center ga-4">
                      <v-text-field
                        v-model="currentRow.newLocationDraft.address" label="Address" variant="solo-filled"
                        hide-details
                      />
                      <v-btn
                        color="primary" :loading="findingAddress" :disabled="findAddressDisabled"
                        @click="findDraftAddress"
                      >
                        Find
                      </v-btn>
                    </div>
                    <div v-if="currentRow.newLocationDraft.latitude" class="text-caption text-medium-emphasis">
                      {{ currentRow.newLocationDraft.city }}, {{ currentRow.newLocationDraft.state }},
                      {{ currentRow.newLocationDraft.country }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-card-text>
            </v-card>

            <div class="d-flex ga-4 align-center justify-space-between flex-wrap">
              <v-btn variant="tonal" :disabled="currentIndex === 0" :prepend-icon="mdiChevronLeft" @click="goPrevious">
                Previous
              </v-btn>
              <div class="d-flex ga-4">
                <v-btn v-if="currentRow.status !== 'success'" variant="text" :append-icon="mdiSkipNext" @click="skipCurrent">
                  Skip
                </v-btn>
                <v-btn
                  v-if="currentRow.status === 'success'" color="primary" :append-icon="mdiChevronRight"
                  :disabled="currentIndex === rows.length - 1" @click="goNext"
                >
                  Next
                </v-btn>
                <v-btn v-else color="primary" :loading="saving" @click="importCurrent">
                  Import &amp; Next
                </v-btn>
              </div>
            </div>
          </template>
        </template>
      </div>
    </v-card-text>
  </v-card>
</template>
