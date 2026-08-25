<script setup lang="ts">
import { remult } from 'remult'
import { onMounted, ref, watch } from 'vue'
import { mdiArrowLeft, mdiCloud, mdiDelete, mdiMapMarker } from '@mdi/js'
import { useDisplay } from 'vuetify'
import { useDebounceFn } from '@vueuse/core'
import { Log } from '@/shared/models/Log'
import { Activity } from '@/shared/models/Activity'
import { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { LogLocation } from '@/shared/models/LogLocation'
import { Location } from '@/shared/models/Location'
import PhotoGallery from '@/components/PhotoGallery.vue'
import DatePicker from '@/components/date-picker/DatePicker.vue'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { getUser } from '@/scripts/user'
import router from '@/router'

const props = defineProps<{
  id: number
}>()

const user = getUser()
const { mobile } = useDisplay()
const logRepo = remult.repo(Log)
const activityRepo = remult.repo(Activity)
const activityTemplateRepo = remult.repo(ActivityTemplate)
const logLocationRepo = remult.repo(LogLocation)
const locationRepo = remult.repo(Location)

const loading = ref(true)
const loadError = ref(false)
const saving = ref(false)
const deleting = ref(false)
const log = ref<Log | null>(null)
const oneDay = ref(false)

interface ActivityRow {
  id?: number
  template: ActivityTemplate
  value: number
}

const existingActivities = ref<(Activity & { template: ActivityTemplate })[]>([])
const activityRows = ref<ActivityRow[]>([])
const templates = ref<ActivityTemplate[]>([])
const currentlySelectedActivity = ref<ActivityTemplate | null>(null)

const existingLogLocations = ref<(LogLocation & { location: Location })[]>([])
const selectedLocations = ref<Location[]>([])
const locationOptions = ref<Location[]>([])

watch(oneDay, (value) => {
  if (value && log.value)
    log.value.dateEnd = undefined
})

async function searchLocations(query: string) {
  locationOptions.value = await locationRepo.find({
    where: {
      user: user.value!,
      ...(query
        ? { $or: [{ name: { $contains: query } }, { nicknames: { $contains: query } }] }
        : {}),
    },
    limit: 10,
  })
}

const debouncedSearchLocations = useDebounceFn(searchLocations, 300)

async function load() {
  loading.value = true
  loadError.value = false
  try {
    log.value = (await logRepo.findOne({ where: { id: props.id, user: user.value! } })) ?? null
    if (!log.value)
      return

    oneDay.value = !log.value.dateEnd

    const [activityLinks, locationLinks, allTemplates] = await Promise.all([
      activityRepo.find({ where: { log: log.value, user: user.value! }, include: { template: true } }),
      logLocationRepo.find({ where: { log: log.value, user: user.value! }, include: { location: true } }),
      activityTemplateRepo.find({ where: { user: user.value! }, orderBy: { name: 'asc' } }),
    ])
    templates.value = allTemplates

    // template/location can resolve to null if the linked row was since
    // deleted (Settings has no cascade cleanup) - drop those rather than crash.
    existingActivities.value = activityLinks.filter((a): a is Activity & { template: ActivityTemplate } => !!a.template)
    activityRows.value = existingActivities.value.map(a => ({ id: a.id, template: a.template, value: a.value }))

    existingLogLocations.value = locationLinks.filter((l): l is LogLocation & { location: Location } => !!l.location)
    selectedLocations.value = existingLogLocations.value.map(l => l.location)
    locationOptions.value = selectedLocations.value.slice()
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

const checkIncludesActivity = (activity: ActivityTemplate) => activityRows.value.some(a => a.template.id === activity.id)

function addActivityRow() {
  if (currentlySelectedActivity.value && !checkIncludesActivity(currentlySelectedActivity.value))
    activityRows.value.push({ template: currentlySelectedActivity.value, value: 0 })
  currentlySelectedActivity.value = null
}

function removeActivityRow(row: ActivityRow) {
  activityRows.value = activityRows.value.filter(r => r !== row)
}

async function save() {
  if (!log.value)
    return
  if (!log.value.name.trim()) {
    showAlert('Name is required')
    return
  }
  if (!log.value.dateStart) {
    showAlert('Start date is required')
    return
  }
  if (!selectedLocations.value.length) {
    showAlert('At least one location is required')
    return
  }

  saving.value = true
  try {
    await logRepo.update(log.value.id, log.value)

    const currentLocationIds = new Set(selectedLocations.value.map(l => l.id))
    const existingLocationIds = new Set(existingLogLocations.value.map(link => link.location.id))
    const removedLinks = existingLogLocations.value.filter(link => !currentLocationIds.has(link.location.id))
    const addedLocations = selectedLocations.value.filter(l => !existingLocationIds.has(l.id))

    const currentActivityIds = new Set(activityRows.value.filter(r => r.id).map(r => r.id))
    const removedActivities = existingActivities.value.filter(a => !currentActivityIds.has(a.id))
    const addedActivityRows = activityRows.value.filter(r => !r.id)
    const updatedActivityRows = activityRows.value.filter((r) => {
      if (!r.id)
        return false
      const original = existingActivities.value.find(a => a.id === r.id)
      return !!original && original.value !== r.value
    })

    const results = await Promise.allSettled([
      ...removedLinks.map(link => logLocationRepo.delete(link)),
      ...addedLocations.map(loc => logLocationRepo.insert({ location: loc, log: log.value! })),
      ...removedActivities.map(a => activityRepo.delete(a)),
      ...addedActivityRows.map(r => activityRepo.insert({ template: r.template, value: r.value, log: log.value! })),
      ...updatedActivityRows.map(r => activityRepo.update(r.id!, { value: r.value })),
    ])

    const failures = results.filter(r => r.status === 'rejected').length
    showAlert(failures > 0 ? `Log updated, but ${failures} related change${failures === 1 ? '' : 's'} failed to save` : 'Log updated')
    await load()
  }
  catch {
    showAlert('Failed to update log. Please check your connection and try again.')
  }
  finally {
    saving.value = false
  }
}

async function deleteLog() {
  if (!log.value)
    return

  const confirmed = await askConfirm('Are you sure you want to delete this log? This cannot be undone.', { confirmText: 'Delete' })
  if (!confirmed)
    return

  deleting.value = true
  try {
    await logRepo.delete(log.value)
    showAlert('Log deleted')
    router.push({ name: 'logs' })
  }
  catch {
    showAlert('Failed to delete log')
  }
  finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <v-container>
    <v-col>
      <v-card v-if="loading">
        <v-card-text>
          <v-skeleton-loader type="article" />
        </v-card-text>
      </v-card>

      <v-card v-else-if="loadError">
        <v-card-title>
          Failed to load log
        </v-card-title>
        <v-card-text>
          <p class="mb-4">
            The request didn't go through. If you're using an ad blocker or privacy extension, try allowing this site, then retry.
          </p>
          <v-btn color="primary" @click="load">
            Retry
          </v-btn>
        </v-card-text>
      </v-card>

      <v-card v-else-if="!log">
        <v-card-title>
          Log not found
        </v-card-title>
        <v-card-text>
          <v-btn color="primary" :to="{ name: 'logs' }">
            Back to Logs
          </v-btn>
        </v-card-text>
      </v-card>

      <v-card v-else>
        <v-card-title class="d-flex align-center ga-4">
          <v-btn size="small" color="primary" @click="router.back()">
            <v-icon :icon="mdiArrowLeft" />
          </v-btn> {{ log.name }}
        </v-card-title>

        <v-card-text>
          <div class="d-flex flex-column ga-6">
            <v-text-field v-model="log.name" hide-details label="Name" required variant="solo-filled" />
            <v-textarea v-model="log.description" hide-details label="Description" variant="solo-filled" />
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
              hide-details
              @update:search="debouncedSearchLocations"
            />
            <v-text-field
              v-model="log.weather" label="Weather" :prepend-inner-icon="mdiCloud"
              variant="solo-filled" hide-details
            />

            <v-checkbox v-model="oneDay" label="One Day" hide-details density="compact" />
            <div class="d-flex flex-wrap ga-4">
              <div :style="mobile ? 'width: 100%' : 'flex: 1 1 0'">
                <DatePicker v-model="log.dateStart" label="Start Date" />
              </div>
              <div v-if="!oneDay" :style="mobile ? 'width: 100%' : 'flex: 1 1 0'">
                <DatePicker v-model="log.dateEnd" label="End Date" />
              </div>
            </div>

            <v-list density="comfortable">
              <v-list-subheader>
                Activities
              </v-list-subheader>
              <div class="d-flex ga-4 align-center mb-4">
                <v-select
                  v-model="currentlySelectedActivity"
                  label="Activity"
                  variant="solo-filled"
                  :items="templates"
                  style="max-width: 300px;"
                  density="compact"
                  item-title="name"
                  return-object
                  hide-details
                />
                <v-btn color="primary" @click="addActivityRow">
                  Add Activity
                </v-btn>
              </div>
              <v-divider />
              <v-list-item v-for="row in activityRows" :key="row.template.id">
                <v-list-item-title>
                  {{ row.template.name }}
                </v-list-item-title>
                <v-list-item-action class="d-flex ga-4 pa-2 align-center justify-space-between" :class="mobile ? 'flex-column' : ''">
                  <div>
                    {{ row.template.description }}
                  </div>
                  <div class="d-flex ga-4 pa-2 align-center flex-grow-1 justify-end">
                    <v-text-field
                      v-model="row.value"
                      :label="row.template.unit"
                      variant="solo-filled"
                      style="max-width: 300px;min-width: 100px"
                      density="compact"
                      hide-details
                      type="number"
                    />
                    <v-btn color="error" @click="removeActivityRow(row)">
                      Remove
                    </v-btn>
                  </div>
                </v-list-item-action>
              </v-list-item>
              <p v-if="!activityRows.length" class="text-medium-emphasis">
                No activities logged.
              </p>
            </v-list>

            <div class="d-flex ga-4">
              <v-btn color="primary" :loading="saving" @click="save">
                Save
              </v-btn>
              <v-btn color="error" :prepend-icon="mdiDelete" :loading="deleting" @click="deleteLog">
                Delete
              </v-btn>
            </div>

            <v-divider />
            <PhotoGallery :log-id="log.id" />
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
