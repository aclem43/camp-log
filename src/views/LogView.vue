<script setup lang="ts">
import { remult } from 'remult'
import { onMounted, ref, watch } from 'vue'
import { mdiArrowLeft, mdiCloud, mdiDelete, mdiMapMarker } from '@mdi/js'
import { useDisplay } from 'vuetify'
import type { VForm } from 'vuetify/components'
import { useDebounceFn } from '@vueuse/core'
import { Log } from '@/shared/models/Log'
import { Activity } from '@/shared/models/Activity'
import { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { LogLocation } from '@/shared/models/LogLocation'
import { Location } from '@/shared/models/Location'
import { LogController } from '@/shared/controllers/LogController'
import LoadError from '@/components/LoadError.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'
import DatePicker from '@/components/date-picker/DatePicker.vue'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { startOfDay } from '@/scripts/dates'
import { required, validateForm } from '@/scripts/forms'
import { describeFailure } from '@/scripts/outbox'
import { useUnsavedChanges } from '@/scripts/unsaved'
import { getUser } from '@/scripts/user'
import router from '@/router'

const props = defineProps<{
  id: number
}>()

const user = getUser()
const { mobile } = useDisplay()
const form = ref<VForm | null>(null)

// Back to wherever the user came from (search results, a filtered list...),
// or the logs list when this page was opened directly.
const backTo = (window.history.state?.back as string | null) ?? { name: 'logs' }
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
  template: ActivityTemplate
  value: number
}

const activityRows = ref<ActivityRow[]>([])
const templates = ref<ActivityTemplate[]>([])
const currentlySelectedActivity = ref<ActivityTemplate | null>(null)

const selectedLocations = ref<Location[]>([])
const locationOptions = ref<Location[]>([])

watch(oneDay, (value) => {
  if (!log.value)
    return
  if (value)
    log.value.dateEnd = undefined
  else
    log.value.dateEnd ??= new Date(log.value.dateStart)
})

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
      locationOptions.value = found
  }
  catch {
    // offline - keep the options already listed (the selected locations at least)
  }
}

const debouncedSearchLocations = useDebounceFn(searchLocations, 300)

// What's saved, to tell whether the form has unsaved edits.
const savedState = ref('')
let leaving = false

function formState() {
  if (!log.value)
    return ''
  return JSON.stringify({
    name: log.value.name,
    description: log.value.description,
    weather: log.value.weather,
    dateStart: log.value.dateStart?.getTime(),
    dateEnd: log.value.dateEnd?.getTime(),
    locationIds: selectedLocations.value.map(l => l.id),
    activities: activityRows.value.map(r => [r.template.id, Number(r.value) || 0]),
  })
}

useUnsavedChanges(() => !leaving && !!log.value && formState() !== savedState.value)

function endDateRule() {
  const { dateStart, dateEnd } = log.value ?? {}
  return !dateEnd || !dateStart || startOfDay(dateEnd) >= startOfDay(dateStart) || 'End date can’t be before the start date'
}

// `refresh` reloads in place after a save, keeping the form (and scroll
// position) on screen rather than swapping it for the skeleton.
async function load(refresh = false) {
  if (!refresh)
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

    // template/location can resolve to null for rows orphaned before deletes
    // cascaded - drop those rather than crash (saving then removes them).
    activityRows.value = activityLinks
      .filter((a): a is Activity & { template: ActivityTemplate } => !!a.template)
      .map(a => ({ template: a.template, value: a.value }))

    selectedLocations.value = locationLinks
      .filter((l): l is LogLocation & { location: Location } => !!l.location)
      .map(l => l.location)
    locationOptions.value = selectedLocations.value.slice()
    savedState.value = formState()
  }
  catch {
    // After a save the edits are already stored, so a failed refresh just
    // leaves the form as it is.
    if (!refresh)
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
  if (!log.value || !await validateForm(form.value))
    return

  saving.value = true
  try {
    await LogController.updateLog(log.value.id, {
      name: log.value.name,
      description: log.value.description,
      weather: log.value.weather,
      dateStart: startOfDay(log.value.dateStart),
      dateEnd: log.value.dateEnd && startOfDay(log.value.dateEnd),
      locationIds: selectedLocations.value.map(l => l.id),
      activities: activityRows.value.map(r => ({ templateId: r.template.id, value: Number(r.value) || 0 })),
    })
    showAlert('Log updated')
    await load(true)
  }
  catch (err) {
    showAlert(describeFailure('update log', err))
  }
  finally {
    saving.value = false
  }
}

async function deleteLog() {
  if (!log.value)
    return

  const confirmed = await askConfirm('Are you sure you want to delete this log? Its activities and photos will be deleted too. This cannot be undone.', { confirmText: 'Delete' })
  if (!confirmed)
    return

  deleting.value = true
  try {
    await logRepo.delete(log.value)
    showAlert('Log deleted')
    leaving = true
    router.push({ name: 'logs' })
  }
  catch (err) {
    showAlert(describeFailure('delete log', err))
  }
  finally {
    deleting.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <v-container>
    <v-col>
      <v-card v-if="loading">
        <v-card-text>
          <v-skeleton-loader type="article" />
        </v-card-text>
      </v-card>

      <LoadError v-else-if="loadError" what="this log" @retry="load()" />

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
          <v-btn icon color="primary" aria-label="Back" :to="backTo">
            <v-icon :icon="mdiArrowLeft" />
          </v-btn>
          <span class="text-truncate" style="min-width: 0;">{{ log.name }}</span>
        </v-card-title>

        <v-card-text>
          <v-form ref="form" class="d-flex flex-column ga-6" @submit.prevent="save">
            <v-text-field
              v-model="log.name" hide-details="auto" label="Name" required variant="solo-filled" autocomplete="off"
              :rules="[required('Name is required')]"
            />
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
              hide-details="auto"
              :rules="[required('Pick at least one location')]"
              @update:search="debouncedSearchLocations"
            />
            <v-text-field
              v-model="log.weather" label="Weather" :prepend-inner-icon="mdiCloud"
              variant="solo-filled" hide-details
            />

            <v-checkbox v-model="oneDay" label="One Day" hide-details />
            <div class="d-flex flex-wrap ga-4">
              <div :style="mobile ? 'width: 100%' : 'flex: 1 1 0'">
                <DatePicker v-model="log.dateStart" label="Start Date" />
              </div>
              <div v-if="!oneDay" :style="mobile ? 'width: 100%' : 'flex: 1 1 0'">
                <DatePicker v-model="log.dateEnd" label="End Date" :rules="[endDateRule]" />
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
                  item-title="name"
                  return-object
                  hide-details
                />
                <v-btn color="primary" :disabled="!currentlySelectedActivity" @click="addActivityRow">
                  Add Activity
                </v-btn>
              </div>
              <p v-if="!templates.length" class="text-medium-emphasis mb-4">
                No activity types yet. Add them in
                <router-link :to="{ name: 'settings', query: { panel: 'activities' } }">
                  Settings
                </router-link>.
              </p>
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
                      :label="row.template.name"
                      :suffix="row.template.unit"
                      variant="solo-filled"
                      style="max-width: 300px;min-width: 100px"
                      hide-details
                      type="number"
                      inputmode="decimal"
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
              <v-btn type="submit" color="primary" :loading="saving">
                Save
              </v-btn>
              <v-btn color="error" :prepend-icon="mdiDelete" :loading="deleting" @click="deleteLog">
                Delete
              </v-btn>
            </div>

            <v-divider />
            <PhotoGallery :log-id="log.id" />
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
