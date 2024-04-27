<script setup lang="ts">
import { mdiMagnify } from '@mdi/js'
</script>

<template>
  <v-container>
    <v-col>
      <v-autocomplete
        label="Search" :prepend-inner-icon="mdiMagnify" variant="solo-filled"
        hide-details
      />
      <v-chip-group
        multiple
      >
        <v-chip
          text="Camping"
          variant="outlined"
          filter
        />
        <v-chip
          text="Hiking"
          variant="outlined"
          filter
        />
        <v-chip
          text="Fishing"
          variant="outlined"
          filter
        />
      </v-chip-group>
      <v-divider />
      <div class="d-flex flex-column ga-4">
        <v-card v-for="x in 5" :key="x" title="Result" text="Example Result" />
      </div>
    </v-col>
  </v-container>
</template>
