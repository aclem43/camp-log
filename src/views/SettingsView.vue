<script setup lang="ts">
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { showAlert } from '@/scripts/alert'
import { darkTheme } from '@/scripts/theme'
import { getUser } from '@/scripts/user'

const activityRepo = remult.repo(ActivityTemplate)

const activityTemplates = ref<ActivityTemplate[]>([])

const activity = ref<Omit<ActivityTemplate, 'id'>>({
  name: '',
  description: '',
  unit: '',
})
const user = getUser()
async function loadActivities() {
  activityTemplates.value = await activityRepo.find({ where: { user: user.value! } })
}

const version = ref('Loading')

onMounted(async () => {
  loadActivities()

  const response = await fetch('/api/version')
  const data = await response.json()
  version.value = data.version
})

async function removeActivity(activity: ActivityTemplate) {
  // eslint-disable-next-line no-alert
  const confirm = window.confirm('Are you sure you want to add this activity?')
  if (!confirm)
    return
  await activityRepo.delete(activity.id)
  showAlert('Activity removed successfully')
  await loadActivities()
}

async function addActivity() {
  if (!activity.value.name || !activity.value.description || !activity.value.unit) {
    showAlert('Name, Description, and Units are required')
    return
  }
  await activityRepo.insert(activity.value)
  showAlert('Activity added successfully')
  await loadActivities()
}
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-card-title>
            Settings
          </v-card-title>
          <v-card-text>
            <v-expansion-panels>
              <v-expansion-panel>
                <v-expansion-panel-title> Info </v-expansion-panel-title>
                <v-expansion-panel-text>
                  Version: {{ version }}
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title> Themes </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-switch
                    v-model="darkTheme"
                    label="Dark Theme"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title>Manage Activities</v-expansion-panel-title>

                <v-expansion-panel-text>
                  <v-list density="comfortable">
                    <v-list-subheader>
                      Current Activity Templates
                    </v-list-subheader>
                    <v-list-item
                      v-for="act in activityTemplates"
                      :key="act.id"
                    >
                      <v-list-item-title>
                        {{ act.name }}
                      </v-list-item-title>
                      <v-list-item-subtitle>
                        {{ act.description }}
                      </v-list-item-subtitle>
                      <v-list-item-action class="my-2">
                        <v-btn
                          density="compact"
                          color="error"
                          @click="removeActivity(act)"
                        >
                          Remove
                        </v-btn>
                      </v-list-item-action>
                      <v-divider />
                    </v-list-item>
                  </v-list>
                  <v-text-field
                    v-model="activity.name"
                    label="Name"
                    required
                    variant="solo-filled"
                  />
                  <v-text-field
                    v-model="activity.description"
                    label="Description"
                    required
                    variant="solo-filled"
                  />
                  <v-text-field
                    v-model="activity.unit"
                    label="Units"
                    required
                    variant="solo-filled"
                  />
                  <v-btn
                    color="primary"
                    @click="addActivity"
                  >
                    Add Activity
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
