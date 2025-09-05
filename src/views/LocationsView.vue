<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { remult } from 'remult'
import { mdiDelete, mdiEye } from '@mdi/js'
import { Location } from '@/shared/models/Location'
import { getUser } from '@/scripts/user'

const locations = ref<Location[]>([])
const user = getUser()
async function loadLocations() {
  locations.value = await remult.repo(Location).find({where: {user:user.value!}, orderBy: { name: 'asc' } } )
}

onMounted(async () => {
  await loadLocations()
})

async function deleteLocation(location: Location) {
  // eslint-disable-next-line no-alert
  const confirm = window.confirm('Are you sure you want to delete this location?')
  if (!confirm)
    return
  await remult.repo(Location).delete(location)
  await loadLocations()
}
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-card-title>
            Locations
          </v-card-title>
          <v-card-text>
            <v-btn
              color="primary"
              :to="{ name: 'addLocation' }"
            >
              Add Location
            </v-btn>
            <v-data-table
              density="compact"
              :headers="[
                { title: 'Name', value: 'name', sortable: true },
                { title: 'Notes', value: 'notes', sortable: true },
                { title: 'Address', value: 'address', sortable: true },
                { title: 'Actions', value: 'actions', sortable: false, width: '100px' },
              ]"
              :items="locations"
              :items-per-page="5"
              :sort-by="[{ key: 'dateStart', order: 'desc' }]"
            >
              <template #[`item.actions`]="{ item }">
                <div class="d-flex ga-2 align-center justify-center">
                  <v-btn density="compact" color="error" @click="deleteLocation(item)">
                    <v-icon :icon="mdiDelete" />
                  </v-btn>
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
