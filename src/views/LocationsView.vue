<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { remult } from 'remult'
import { Location } from '@/shared/models/Location'

const locations = ref<Location[]>([])

onMounted(async () => {
  locations.value = await remult.repo(Location).find({})
})
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
            <v-list>
              <v-list-item
                v-for="loc in locations"
                :key="loc.id"

                :title="loc.name"
                :subtitle="loc.address"
              />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
