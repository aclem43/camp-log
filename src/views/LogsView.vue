<script setup lang="ts">
import { remult } from 'remult'
import { onMounted, ref } from 'vue'
import { mdiDelete, mdiEye } from '@mdi/js'
import { Log } from '@/shared/models/Log'

const logs = ref<Log[]>([])

onMounted(async () => {
  logs.value = await remult.repo(Log).find({ include: { location: true } })
})
</script>

<template>
  <v-container>
    <v-col>
      <v-card>
        <v-card-title>
          Logs
        </v-card-title>
        <v-card-text>
          <v-data-table
            density="compact"
            :headers="[
              { title: 'Name', value: 'name', sortable: true },
              { title: 'Location', value: 'location', sortable: true },
              { title: 'Start Date', value: 'dateStart', sortable: true },
              { title: 'Actions', value: 'actions', sortable: false, width: '100px' },
            ]"
            :items="logs"
            :items-per-page="5"
          >
            <template #[`item.location`]="{ item }">
              {{ item.location?.name }}
            </template>
            <template #[`item.dateStart`]="{ item }">
              {{ item.dateStart?.toLocaleDateString() }}
            </template>
            <template #[`item.dateEnd`]="{ item }">
              {{ item.dateEnd?.toLocaleDateString() }}
            </template>
            <template #[`item.actions`]="{ item }">
              <div class="d-flex ga-2 align-center justify-center">
                <v-btn density="compact" color="primary">
                  <v-icon :icon="mdiEye" />
                </v-btn>
                <v-btn density="compact" color="error">
                  <v-icon :icon="mdiDelete" />
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-container>
</template>
