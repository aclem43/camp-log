<script setup lang="ts">
import { mdiCloud, mdiMapMarker } from '@mdi/js'
import { remult } from 'remult'
import { computed, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useDisplay } from 'vuetify'
import type { VForm } from 'vuetify/components'
import router from '@/router'
import { Location } from '@/shared/models/Location'
import DatePicker from '@/components/date-picker/DatePicker.vue'
import LoadError from '@/components/LoadError.vue'
import { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import type { Log } from '@/shared/models/Log'
import { LogController, type LogInput } from '@/shared/controllers/LogController'
import { showAlert } from '@/scripts/alert'
import { startOfDay } from '@/scripts/dates'
import { required, validateForm } from '@/scripts/forms'
import { isNetworkError, pendingItems, queueMutation, serverErrorMessage } from '@/scripts/outbox'
import { syncOutbox } from '@/scripts/sync'
import { useUnsavedChanges } from '@/scripts/unsaved'
import { getUser } from '@/scripts/user'

const log = ref<Omit<Log, 'id' >>({
  name: '',
  description: '',
  weather: '',
  terrainId: '',
  dateStart: startOfDay(new Date()),
  // "One Day" starts unticked, so the End Date picker is showing.
  dateEnd: startOfDay(new Date()),
})

const user = getUser()
const { mobile } = useDisplay()
// Locations saved offline that haven't synced yet can be picked too - their
// id is their outbox id, and the log then waits in the outbox for them.
interface LocationOption {
  id: number | string
  name: string
  pending?: true
}

const locations = ref<Location[]>([])
const selectedLocations = ref<LocationOption[]>([])
const locationSearch = ref('')

const locationOptions = computed<LocationOption[]>(() => {
  const query = locationSearch.value.trim().toLowerCase()
  const pending = pendingItems.value
    .filter(item => item.entity === 'location')
    .map(item => ({ id: item.id, name: (item.payload.name as string) || 'Unnamed campsite' }))
    .filter(option => !query || option.name.toLowerCase().includes(query))
    .map(option => ({ ...option, name: `${option.name} (not synced yet)`, pending: true as const }))
  return [...pending, ...locations.value]
})

const oneDay = ref(false)
const saving = ref(false)

watch(oneDay, (value) => {
  if (value)
    log.value.dateEnd = undefined
  else
    log.value.dateEnd ??= new Date(log.value.dateStart)
})

const selectedActivities = ref<{ template: ActivityTemplate, value?: number }[]>([])
const currentlySelectedActivity = ref<ActivityTemplate | null>(null)

const activities = ref<ActivityTemplate[]>([])
const loadError = ref(false)

const locationRepo = remult.repo(Location)

let searchId = 0

async function searchLocations(query: string) {
  const requestToken = ++searchId
  try {
    const found = await locationRepo.find({
      where: {
        user: user.value!,
        ...(query
          ? { $or: [{ name: { $contains: query } }, { nicknames: { $contains: query } }] }
          : {}),
      },
      limit: 10,
    })
    if (requestToken === searchId)
      locations.value = found
  }
  catch {
    // offline - keep the options already listed
  }
}

const debouncedSearchLocations = useDebounceFn(searchLocations, 300)

function onLocationSearch(query: string | null) {
  locationSearch.value = query ?? ''
  debouncedSearchLocations(locationSearch.value)
}

async function load() {
  loadError.value = false
  try {
    const [found, templates] = await Promise.all([
      locationRepo.find({ where: { user: user.value! }, limit: 10 }),
      remult.repo(ActivityTemplate).find({ where: { user: user.value! }, orderBy: { name: 'asc' } }),
    ])
    locations.value = found
    activities.value = templates
  }
  catch {
    loadError.value = true
  }
}

onMounted(load)

const checkIncludesActivity = (activity: ActivityTemplate) => selectedActivities.value.some(a => a.template.id === activity.id)

function addActivities() {
  if (currentlySelectedActivity.value && !checkIncludesActivity(currentlySelectedActivity.value))
    selectedActivities.value.push({ template: currentlySelectedActivity.value })
}

function removeActivity(activity: { template: ActivityTemplate, value?: number }) {
  selectedActivities.value = selectedActivities.value.filter(a => a.template.id !== activity.template.id)
}

const form = ref<VForm | null>(null)
// Set once saved, so leaving for the logs list doesn't ask about unsaved changes.
let saved = false

useUnsavedChanges(() => !saved && !!(
  log.value.name.trim()
  || log.value.description.trim()
  || log.value.weather.trim()
  || selectedLocations.value.length
  || selectedActivities.value.length
))

function endDateRule() {
  const { dateStart, dateEnd } = log.value
  return !dateEnd || startOfDay(dateEnd) >= startOfDay(dateStart) || 'End Date can’t be before the Start Date'
}

function leaveForLogs() {
  saved = true
  router.push({ name: 'logs' })
}

type QueuedLogInput = LogInput & { pendingLocationIds?: string[] }

function buildInput(): QueuedLogInput {
  const pendingLocationIds = selectedLocations.value.filter(l => l.pending).map(l => String(l.id))
  return {
    name: log.value.name.trim(),
    description: log.value.description,
    weather: log.value.weather,
    dateStart: startOfDay(log.value.dateStart),
    dateEnd: log.value.dateEnd && startOfDay(log.value.dateEnd),
    locationIds: selectedLocations.value.filter(l => !l.pending).map(l => Number(l.id)),
    activities: selectedActivities.value.map(a => ({ templateId: a.template.id, value: Number(a.value) || 0 })),
    ...(pendingLocationIds.length ? { pendingLocationIds } : {}),
  }
}

async function addLog() {
  // Flag first - validation is async, and a double tap mustn't add two logs.
  if (saving.value)
    return
  saving.value = true
  if (!await validateForm(form.value)) {
    saving.value = false
    return
  }

  const input = buildInput()
  try {
    if (!navigator.onLine) {
      await queueLogOffline(input)
      return
    }
    // Can't be created until its new location exists on the server - the
    // outbox syncs them in order.
    if (input.pendingLocationIds) {
      await queueMutation('log', { ...input })
      syncOutbox()
      showAlert('Log saved — it will sync once its new location has.')
      leaveForLogs()
      return
    }

    await LogController.createLog(input)
    showAlert('Log Added')
    leaveForLogs()
  }
  catch (err) {
    if (isNetworkError(err)) {
      await queueLogOffline(input)
      return
    }
    const message = serverErrorMessage(err)
    showAlert(message ? `Failed to add log: ${message}` : 'Failed to add log. Please try again.')
  }
  finally {
    saving.value = false
  }
}

async function queueLogOffline(input: QueuedLogInput) {
  await queueMutation('log', { ...input })
  showAlert('Saved offline — will sync when you\'re back online.')
  leaveForLogs()
}
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title>
          Add New Log
        </v-card-title>
        <v-card-text>
          <LoadError v-if="loadError" what="your locations and activities" class="mb-4" @retry="load" />
          <v-form ref="form" @submit.prevent="addLog">
            <v-text-field
              v-model="log.name"
              label="Name"
              required
              variant="solo-filled"
              :rules="[required('Name is required')]"
            />

            <v-textarea
              v-model="log.description"
              label="Description"
              variant="solo-filled"
            />

            <v-autocomplete
              v-model="selectedLocations"
              label="Locations"
              variant="solo-filled"
              :items="locationOptions"
              :prepend-inner-icon="mdiMapMarker"
              item-title="name"
              item-value="id"
              multiple
              chips
              closable-chips
              return-object
              no-filter
              :rules="[required('Pick at least one location')]"
              @update:search="onLocationSearch"
            />
            <v-text-field
              v-model="log.weather"
              label="Weather"
              :prepend-inner-icon="mdiCloud"
              variant="solo-filled"
            />
            <v-container>
              <v-row>
                <v-col>
                  <v-checkbox v-model="oneDay" label="One Day" hide-details />
                </v-col>
              </v-row>
              <v-row density="compact">
                <v-col :cols="mobile || oneDay ? 12 : 6">
                  <DatePicker v-model="log.dateStart" label="Start Date" />
                </v-col>
                <v-col :cols="mobile ? 12 : 6">
                  <DatePicker v-if="!oneDay" v-model="log.dateEnd" label="End Date" :rules="[endDateRule]" />
                </v-col>
              </v-row>
            </v-container>
            <v-list density="comfortable">
              <div
                class="d-flex ga-4 align-center mb-4"
              >
                <v-select
                  v-model="currentlySelectedActivity"
                  label="Activity"
                  variant="solo-filled"
                  :items="activities"
                  style="max-width: 300px;"
                  item-title="name"
                  return-object
                  hide-details
                />
                <v-btn
                  color="primary"
                  :disabled="!currentlySelectedActivity"
                  @click="addActivities"
                >
                  Add Activity
                </v-btn>
              </div>
              <p v-if="!loadError && !activities.length" class="text-medium-emphasis mb-4">
                No activity types yet. Add them in
                <router-link :to="{ name: 'settings', query: { panel: 'activities' } }">
                  Settings
                </router-link>.
              </p>
              <v-divider />
              <v-list-item
                v-for="activity in selectedActivities"
                :key="activity.template.id"
              >
                <v-list-item-title>
                  {{ activity.template.name }}
                </v-list-item-title>
                <v-list-item-action class="d-flex ga-4 pa-2 align-center justify-space-between" :class="mobile ? 'flex-column' : ''">
                  <div>
                    {{ activity.template.description }}
                  </div>
                  <div class="d-flex ga-4 pa-2 align-center flex-grow-1 justify-end">
                    <v-text-field
                      v-model="activity.value"
                      :label="activity.template.name"
                      :suffix="activity.template.unit"
                      variant="solo-filled"
                      style="max-width: 300px;min-width: 100px"
                      hide-details
                      type="number"
                    />
                    <v-btn
                      color="error"
                      @click="removeActivity(activity)"
                    >
                      Remove
                    </v-btn>
                  </div>
                </v-list-item-action>
              </v-list-item>
            </v-list>
            <v-btn
              type="submit"
              color="primary"
              :loading="saving"
              :disabled="saving"
            >
              Add Log
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
