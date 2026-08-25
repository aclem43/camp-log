<script setup lang="ts">
import { mdiCloud, mdiMapMarker } from '@mdi/js'
import { remult } from 'remult'
import { onMounted, ref, toRaw, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useDisplay } from 'vuetify'
import router from '@/router'
import { Location } from '@/shared/models/Location'
import DatePicker from '@/components/date-picker/DatePicker.vue'
import { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { Log } from '@/shared/models/Log'
import { showAlert } from '@/scripts/alert'
import { isNetworkError, queueMutation } from '@/scripts/outbox'
import { Activity } from '@/shared/models/Activity'
import { getUser } from '@/scripts/user'

const log = ref<Omit<Log, 'id' >>({
  name: '',
  description: '',
  weather: '',
  terrainId: '',
  dateStart: new Date(),
  dateEnd: undefined,

})

const user = getUser()
const { mobile } = useDisplay()
const locations = ref<Location[]>([])
const oneDay = ref(false)
const saving = ref(false)

watch(oneDay, (value) => {
  if (value)
    log.value.dateEnd = undefined
})

const selectedActivities = ref<{ template: ActivityTemplate, value?: number }[]>([])
const currentlySelectedActivity = ref<ActivityTemplate | null>(null)

const activities = ref<ActivityTemplate[]>([])

const locationRepo = remult.repo(Location)

async function searchLocations(query: string) {
  locations.value = await locationRepo.find({
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

onMounted(async () => {
  await searchLocations('')
  activities.value = await remult.repo(ActivityTemplate).find({ where: { user: user.value! }, orderBy: { name: 'asc' } })
})

const checkIncludesActivity = (activity: ActivityTemplate) => selectedActivities.value.some(a => a.template.id === activity.id)

function addActivities() {
  if (currentlySelectedActivity.value && !checkIncludesActivity(currentlySelectedActivity.value))
    selectedActivities.value.push({ template: currentlySelectedActivity.value })
}

function removeActivity(activity: { template: ActivityTemplate, value?: number }) {
  selectedActivities.value = selectedActivities.value.filter(a => a.template.id !== activity.template.id)
}
const logRepo = remult.repo(Log)
const activityRepo = remult.repo(Activity)
async function addLog() {
  if (!log.value.name || !log.value.dateStart) {
    showAlert('Name and Start Date are required')
    return
  }
  if (!log.value.location) {
    showAlert('Location is required')
    return
  }

  saving.value = true
  try {
    if (!navigator.onLine) {
      await queueLogOffline()
      return
    }

    const l = await logRepo.insert(log.value)

    const results = await Promise.allSettled(
      selectedActivities.value.map(activity => activityRepo.insert({
        template: activity.template,
        value: activity.value,
        log: l,
      })),
    )
    const failed = results.filter(r => r.status === 'rejected').length

    if (failed > 0)
      showAlert(`Log added, but ${failed} ${failed === 1 ? 'activity' : 'activities'} failed to save`)
    else
      showAlert('Log Added')

    router.push({ name: 'logs' })
  }
  catch (err) {
    if (isNetworkError(err)) {
      await queueLogOffline()
      return
    }
    showAlert('Failed to add log. Please try again.')
  }
  finally {
    saving.value = false
  }
}

async function queueLogOffline() {
  await queueMutation('log', toRaw(log.value))
  showAlert(
    selectedActivities.value.length
      ? 'Saved offline — will sync when you\'re back online. Activities couldn\'t be attached and will need to be added afterwards.'
      : 'Saved offline — will sync when you\'re back online.',
  )
  router.push({ name: 'logs' })
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
          <v-form @submit.prevent="addLog">
            <v-text-field
              v-model="log.name"
              label="Name"
              required
              variant="solo-filled"
            />

            <v-textarea
              v-model="log.description"
              label="Description"
              variant="solo-filled"
              required
            />

            <v-autocomplete
              v-model="log.location"
              label="Location"
              variant="solo-filled"
              :items="locations"
              :prepend-inner-icon="mdiMapMarker"
              item-title="name"
              item-value="id"
              no-filter
              @update:search="debouncedSearchLocations"
            />
            <v-text-field
              v-model="log.weather"
              label="Weather"
              :prepend-inner-icon="mdiCloud"
              variant="solo-filled"
              required
            />
            <v-container>
              <v-row>
                <v-col>
                  <v-checkbox v-model="oneDay" label="One Day" hide-details density="compact" />
                </v-col>
              </v-row>
              <v-row dense>
                <v-col :cols="mobile || oneDay ? 12 : 6">
                  <DatePicker v-model="log.dateStart" label="Start Date" />
                </v-col>
                <v-col :cols="mobile ? 12 : 6">
                  <DatePicker v-if="!oneDay" v-model="log.dateEnd" label="End Date" />
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
                  density="compact"
                  item-title="name"
                  return-object
                  hide-details
                />
                <v-btn
                  color="primary"
                  @click="addActivities"
                >
                  Add Activity
                </v-btn>
              </div>
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
                      :label="activity.template.unit"
                      variant="solo-filled"
                      style="max-width: 300px;min-width: 100px"
                      density="compact"
                      hide-details
                      type="number"
                      required
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
