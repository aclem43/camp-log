<script setup lang="ts">
import { mdiArrowLeft, mdiCampfire, mdiDelete, mdiMapMarker } from '@mdi/js'
import { computed, onMounted, ref } from 'vue'
import { remult } from 'remult'
import { Location, campTypes, campTypesToText, type campTypesType } from '@/shared/models/Location'
import PhotoGallery from '@/components/PhotoGallery.vue'
import { showAlert } from '@/scripts/alert'
import { getUser } from '@/scripts/user'
import router from '@/router'

const props = defineProps<{
  id: number
}>()

const user = getUser()
const locationRepo = remult.repo(Location)

const loading = ref(true)
const location = ref<Location | null>(null)
const saving = ref(false)
const findingAddress = ref(false)

const campTypesText = campTypes.map(t => ({ title: campTypesToText(t as campTypesType), value: t }))

const nicknamesArray = computed<string[]>({
  get: () => location.value?.nicknames.split(',').map(n => n.trim()).filter(Boolean) ?? [],
  set: (value) => {
    if (location.value)
      location.value.nicknames = value.join(', ')
  },
})

onMounted(async () => {
  location.value = (await locationRepo.findOne({ where: { id: props.id, user: user.value! } })) ?? null
  loading.value = false
})

const findDisabled = computed(() => {
  if (!location.value || findingAddress.value)
    return true
  return location.value.address.length === 0
})

async function findAddress() {
  if (!location.value)
    return

  findingAddress.value = true

  try {
    const resp = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: location.value.address }),
    })
    const result = await resp.json()

    if (!resp.ok) {
      showAlert(result.message ?? 'Failed to find address')
      return
    }

    location.value.latitude = result.latitude
    location.value.longitude = result.longitude
    location.value.city = result.info.city
    location.value.state = result.info.state
    location.value.country = result.info.country
  }
  catch {
    showAlert('Failed to find address')
  }
  finally {
    findingAddress.value = false
  }
}

async function save() {
  if (!location.value)
    return

  saving.value = true
  try {
    await locationRepo.update(location.value.id, location.value)
    showAlert('Location updated')
  }
  catch {
    showAlert('Failed to update location')
  }
  finally {
    saving.value = false
  }
}

async function deleteLocation() {
  if (!location.value)
    return

  // eslint-disable-next-line no-alert
  const confirmed = window.confirm('Are you sure you want to delete this location?')
  if (!confirmed)
    return

  await locationRepo.delete(location.value)
  showAlert('Location deleted')
  router.push({ name: 'locations' })
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
          <v-btn size="small" color="primary" @click="router.back()">
            <v-icon :icon="mdiArrowLeft" />
          </v-btn> {{ location.name }}
        </v-card-title>

        <v-card-text>
          <div class="d-flex flex-column ga-6">
            <v-text-field v-model="location.name" hide-details label="Name" required variant="solo-filled" />
            <v-combobox
              v-model="nicknamesArray" hide-details label="Nicknames" multiple chips closable-chips
              variant="solo-filled" hint="Alternate names to help you find this place later" persistent-hint
            />
            <v-textarea v-model="location.notes" hide-details label="Notes" required variant="solo-filled" />
            <v-select
              v-model="location.type" hide-details label="Type" required :items="campTypesText"
              variant="solo-filled" :prepend-inner-icon="mdiCampfire"
            />
            <div class="d-flex align-center ga-4">
              <v-text-field
                v-model="location.address" hide-details label="Address" required variant="solo-filled"
                :prepend-inner-icon="mdiMapMarker"
              />
              <v-btn size="large" color="primary" :disabled="findDisabled" @click="findAddress">
                Find
              </v-btn>
            </div>
            <div class="d-flex ga-4">
              <v-text-field v-model.number="location.latitude" hide-details label="Latitude" type="number" variant="solo-filled" />
              <v-text-field v-model.number="location.longitude" hide-details label="Longitude" type="number" variant="solo-filled" />
            </div>
            <div class="d-flex ga-4">
              <v-text-field v-model="location.city" hide-details label="City" variant="solo-filled" />
              <v-text-field v-model="location.state" hide-details label="State" variant="solo-filled" />
              <v-text-field v-model="location.country" hide-details label="Country" variant="solo-filled" />
            </div>

            <div class="d-flex ga-4">
              <v-btn color="primary" :loading="saving" @click="save">
                Save
              </v-btn>
              <v-btn color="error" :prepend-icon="mdiDelete" @click="deleteLocation">
                Delete
              </v-btn>
            </div>

            <v-divider />
            <PhotoGallery :location-id="location.id" />
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
