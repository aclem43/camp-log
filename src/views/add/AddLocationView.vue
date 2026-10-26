<script setup lang="ts">
import { remult } from 'remult'
import { ref, toRaw } from 'vue'
import type { VForm } from 'vuetify/components'
import LocationForm from '@/components/LocationForm.vue'
import router from '@/router'
import { showAlert } from '@/scripts/alert'
import { validateForm } from '@/scripts/forms'
import { isNetworkError, queueMutation } from '@/scripts/outbox'
import { useUnsavedChanges } from '@/scripts/unsaved'
import { getUser } from '@/scripts/user'
import { Location } from '@/shared/models/Location'

const user = getUser()

const location = ref<Omit<Location, 'id'>>({
  name: '',
  notes: '',
  nicknames: '',
  latitude: 0,
  longitude: 0,
  type: '2wdAcess',
  address: '',
  city: '',
  state: '',
  country: '',
  user: user.value!,
})

const saving = ref(false)

const form = ref<VForm | null>(null)
// Set once saved, so leaving for the locations list doesn't ask about unsaved changes.
let saved = false

useUnsavedChanges(() => {
  const { name, notes, nicknames, address, latitude, longitude } = location.value
  return !saved && !!(name.trim() || notes.trim() || nicknames || address.trim() || latitude || longitude)
})

function leaveForLocations() {
  saved = true
  router.push({ name: 'locations' })
}

async function addLog() {
  // Flag first - validation is async, and a double tap mustn't add two locations.
  if (saving.value)
    return
  saving.value = true
  if (!await validateForm(form.value)) {
    saving.value = false
    return
  }

  try {
    if (!navigator.onLine) {
      await queueLocationOffline()
      return
    }

    const locationRepo = remult.repo(Location)
    await locationRepo.insert(location.value)
    showAlert('Location added successfully')
    leaveForLocations()
  }
  catch (err) {
    if (isNetworkError(err)) {
      await queueLocationOffline()
      return
    }
    showAlert('Failed to add location')
  }
  finally {
    saving.value = false
  }
}

async function queueLocationOffline() {
  // `user` is a remult entity relation object — the server derives it from
  // the session on insert anyway, and it isn't structured-clone-safe for
  // IndexedDB (unlike the online path, which just JSON-serializes it).
  const { user: _user, ...payload } = toRaw(location.value)
  await queueMutation('location', payload)
  showAlert('Saved offline — will sync when you’re back online.')
  leaveForLocations()
}
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title>
          Add New Location
        </v-card-title>

        <v-card-text>
          <v-form ref="form" class="d-flex flex-column ga-6" @submit.prevent="addLog">
            <LocationForm v-model="location" />

            <v-btn type="submit" color="primary" :loading="saving">
              Add Location
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
