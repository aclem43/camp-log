<script setup lang="ts">
import { mdiArrowLeft, mdiDelete } from '@mdi/js'
import { onMounted, ref } from 'vue'
import { remult } from 'remult'
import type { VForm } from 'vuetify/components'
import { Location } from '@/shared/models/Location'
import LoadError from '@/components/LoadError.vue'
import LocationForm from '@/components/LocationForm.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'
import { showAlert } from '@/scripts/alert'
import { askConfirm } from '@/scripts/confirm'
import { offline } from '@/scripts/connectivity'
import { validateForm } from '@/scripts/forms'
import { describeFailure } from '@/scripts/outbox'
import { useUnsavedChanges } from '@/scripts/unsaved'
import { getUser } from '@/scripts/user'
import router from '@/router'

const props = defineProps<{
  id: number
}>()

const user = getUser()
const locationRepo = remult.repo(Location)

const loading = ref(true)
const loadError = ref(false)
const location = ref<Location | null>(null)
const saving = ref(false)
const deleting = ref(false)
const form = ref<VForm | null>(null)

// Back to wherever the user came from (the map, search results...), or the
// locations list when this page was opened directly.
const backTo = (window.history.state?.back as string | null) ?? { name: 'locations' }

// What's saved, to tell whether the form has unsaved edits.
const savedState = ref('')
let leaving = false
const formState = () => location.value ? JSON.stringify(locationRepo.toJson(location.value)) : ''
useUnsavedChanges(() => !leaving && !!location.value && formState() !== savedState.value)

async function load() {
  loading.value = true
  loadError.value = false
  try {
    location.value = (await locationRepo.findOne({ where: { id: props.id, user: user.value! } })) ?? null
    savedState.value = formState()
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

async function save() {
  if (!location.value || offline.value || !await validateForm(form.value))
    return

  // A cleared coordinate field holds '' - store it as 0, i.e. no pin.
  location.value.latitude = Number(location.value.latitude) || 0
  location.value.longitude = Number(location.value.longitude) || 0

  saving.value = true
  try {
    await locationRepo.update(location.value.id, location.value)
    savedState.value = formState()
    showAlert('Location updated')
  }
  catch (err) {
    showAlert(describeFailure('update location', err))
  }
  finally {
    saving.value = false
  }
}

async function deleteLocation() {
  if (!location.value)
    return

  const confirmed = await askConfirm('Are you sure you want to delete this location? Its photos will be deleted too, and logs will no longer link to it. This cannot be undone.', { confirmText: 'Delete' })
  if (!confirmed)
    return

  deleting.value = true
  try {
    await locationRepo.delete(location.value)
    showAlert('Location deleted')
    leaving = true
    router.push({ name: 'locations' })
  }
  catch (err) {
    showAlert(describeFailure('delete location', err))
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <v-container>
    <v-col>
      <v-card v-if="loading">
        <v-card-text>
          <v-skeleton-loader type="article" />
        </v-card-text>
      </v-card>

      <LoadError v-else-if="loadError" what="this location" @retry="load" />

      <v-card v-else-if="!location">
        <v-card-title>
          Location not found
        </v-card-title>
        <v-card-text>
          <v-btn color="primary" :to="{ name: 'locations' }">
            Back to Locations
          </v-btn>
        </v-card-text>
      </v-card>

      <v-card v-else>
        <v-card-title class="d-flex align-center ga-4">
          <v-btn icon color="primary" aria-label="Back" :to="backTo">
            <v-icon :icon="mdiArrowLeft" />
          </v-btn>
          <span class="text-truncate" style="min-width: 0;">{{ location.name }}</span>
          <v-spacer />
          <!-- Outside the form, but still its submit button - so Enter in a field saves. -->
          <v-btn type="submit" form="location-form" color="primary" :loading="saving" :disabled="offline">
            Save
          </v-btn>
        </v-card-title>
        <v-card-text v-if="offline" class="text-body-small text-medium-emphasis text-end pb-0">
          Saving changes needs a connection.
        </v-card-text>

        <v-card-text>
          <v-form id="location-form" ref="form" class="d-flex flex-column ga-6" @submit.prevent="save">
            <LocationForm v-model="location" detail-fields />

            <v-divider />
            <PhotoGallery :location-id="location.id" />

            <v-divider />
            <div>
              <v-btn color="error" variant="tonal" :prepend-icon="mdiDelete" :loading="deleting" @click="deleteLocation">
                Delete Location
              </v-btn>
            </div>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
