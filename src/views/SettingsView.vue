<script setup lang="ts">
import { remult } from 'remult'
import { onMounted, ref, watch } from 'vue'
import type { UnitPreference } from '@/shared/models/auth/User'
import { ActivityTemplate } from '@/shared/models/ActivityTemplate'
import { showAlert } from '@/scripts/alert'
import { darkTheme } from '@/scripts/theme'
import { deactivateAccount, getUser, logOut, updateProfile } from '@/scripts/user'

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

  try {
    const response = await fetch('/api/version')
    const data = await response.json()
    version.value = data.version
  }
  catch {
    version.value = 'Unknown'
  }
})

async function removeActivity(activity: ActivityTemplate) {
  // eslint-disable-next-line no-alert
  const confirm = window.confirm('Are you sure you want to remove this activity?')
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

const unitOptions: { title: string, value: UnitPreference }[] = [
  { title: 'Metric (km, kg)', value: 'metric' },
  { title: 'Imperial (mi, lb)', value: 'imperial' },
]

const profile = ref<{ name: string, unitPreference: UnitPreference }>({
  name: '',
  unitPreference: 'metric',
})

watch(user, (u) => {
  if (u) {
    profile.value.name = u.name
    profile.value.unitPreference = u.unitPreference
  }
}, { immediate: true })

const savingProfile = ref(false)
async function saveProfile() {
  if (!profile.value.name.trim()) {
    showAlert('Name is required')
    return
  }
  savingProfile.value = true
  await updateProfile({ name: profile.value.name.trim(), unitPreference: profile.value.unitPreference })
  savingProfile.value = false
}

async function handleDeactivate() {
  // eslint-disable-next-line no-alert
  const confirm = window.confirm('Are you sure you want to deactivate your account? You will be logged out and will not be able to sign back in.')
  if (!confirm)
    return
  await deactivateAccount()
}

function exportData() {
  window.location.href = '/api/export-data'
}

const importFile = ref<File | null>(null)
const importing = ref(false)

async function importData() {
  if (!importFile.value)
    return

  importing.value = true
  try {
    const text = await importFile.value.text()
    const parsed = JSON.parse(text)
    const response = await fetch('/api/import-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      showAlert(body?.message ?? 'Import failed')
      return
    }
    const result = await response.json()
    showAlert(
      `Imported ${result.locations} location(s), ${result.activityTemplates} template(s), `
      + `${result.logs} log(s), ${result.activities} entrie(s)`
      + `${result.failed ? `, ${result.failed} failed` : ''}`,
    )
    importFile.value = null
    await loadActivities()
  }
  catch {
    showAlert('Invalid export file')
  }
  finally {
    importing.value = false
  }
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
                <v-expansion-panel-title> Account </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="d-flex flex-column ga-4">
                    <v-text-field v-model="profile.name" label="Display Name" variant="solo-filled" hide-details />
                    <v-select
                      v-model="profile.unitPreference"
                      :items="unitOptions"
                      label="Units"
                      variant="solo-filled"
                      hide-details
                    />
                    <v-btn color="primary" :loading="savingProfile" @click="saveProfile">
                      Save Profile
                    </v-btn>

                    <v-divider class="my-2" />

                    <v-btn color="secondary" @click="() => logOut()">
                      Logout
                    </v-btn>
                    <v-btn color="error" variant="outlined" @click="handleDeactivate">
                      Deactivate Account
                    </v-btn>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title> Themes </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-switch v-model="darkTheme" label="Dark Theme" />
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title>Manage Activities</v-expansion-panel-title>

                <v-expansion-panel-text>
                  <v-list density="comfortable">
                    <v-list-subheader>
                      Current Activity Templates
                    </v-list-subheader>
                    <v-list-item v-for="act in activityTemplates" :key="act.id">
                      <v-list-item-title>
                        {{ act.name }}
                      </v-list-item-title>
                      <v-list-item-subtitle>
                        {{ act.description }}
                      </v-list-item-subtitle>
                      <v-list-item-action class="my-2">
                        <v-btn density="compact" color="error" @click="removeActivity(act)">
                          Remove
                        </v-btn>
                      </v-list-item-action>
                      <v-divider />
                    </v-list-item>
                  </v-list>
                  <v-text-field v-model="activity.name" label="Name" required variant="solo-filled" />
                  <v-text-field v-model="activity.description" label="Description" required variant="solo-filled" />
                  <v-text-field
                    v-model="activity.unit"
                    label="Units"
                    required
                    variant="solo-filled"
                    :placeholder="profile.unitPreference === 'metric' ? 'e.g. km, kg' : 'e.g. mi, lb'"
                  />
                  <v-btn color="primary" @click="addActivity">
                    Add Activity
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title> Data </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="d-flex flex-column ga-4">
                    <div>
                      <p class="mb-2">
                        Export all of your logs, locations, and activity templates as a JSON file.
                      </p>
                      <v-btn color="primary" @click="exportData">
                        Export Data
                      </v-btn>
                    </div>

                    <v-divider />

                    <div>
                      <p class="mb-2">
                        Import data from a previously exported JSON file.
                      </p>
                      <v-file-input
                        v-model="importFile"
                        label="Export file"
                        accept="application/json"
                        variant="solo-filled"
                        hide-details
                      />
                      <v-btn class="mt-2" color="primary" :disabled="!importFile" :loading="importing" @click="importData">
                        Import Data
                      </v-btn>
                    </div>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
