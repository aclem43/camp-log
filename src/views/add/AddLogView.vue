<script setup lang="ts">
import { mdiCloud, mdiMapMarker } from '@mdi/js'
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { Location } from '@/shared/models/Location'
import DatePicker from '@/components/date-picker/DatePicker.vue'
import { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { Log } from '@/shared/models/Log'
import { showAlert } from '@/scripts/alert'
import { Activity } from '@/shared/models/Activity'

const log = ref<Omit<Log, 'id' >>({
  name: '',
  description: '',
  weather: '',
  dateStart: new Date(),
  dateEnd: null,

})

const { mobile } = useDisplay()
const locations = ref<Location[]>([])
const oneDay = ref(false)

const selectedActivities = ref<{ template: ActivityTemplate, value?: number }[]>([])
const currentlySelectedActivity = ref<ActivityTemplate | null>(null)

const activities = ref<ActivityTemplate[]>([])

onMounted(async () => {
  locations.value = await remult.repo(Location).find({ limit: 5 })
  activities.value = await remult.repo(ActivityTemplate).find()
})

const checkIncludesActivity = (activity: ActivityTemplate) => selectedActivities.value.some(a => a.template.id === activity.id)

function addActivities() {
  if (currentlySelectedActivity.value && !checkIncludesActivity(currentlySelectedActivity.value))
    selectedActivities.value.push({ template: currentlySelectedActivity.value })
}

function romeoveActivity(activity: { template: ActivityTemplate, value?: number }) {
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
  const l = await logRepo.insert(log.value)
  if (activities.value.length > 0) {
    for (const activity of selectedActivities.value) {
      activityRepo.insert({
        template: activity.template,
        value: activity.value,
        log: l,
      })
    }
  }
  showAlert('Log Added')
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
          <v-form>
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
                      @click="romeoveActivity(activity)"
                    >
                      Remove
                    </v-btn>
                  </div>
                </v-list-item-action>
              </v-list-item>
            </v-list>
            <v-btn
              color="primary"
              @click="addLog"
            >
              Add Log
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
