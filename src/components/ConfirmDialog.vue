<script setup lang="ts">
import { resolveConfirm, setupConfirm } from '@/scripts/confirm'

const state = setupConfirm()
</script>

<template>
  <v-dialog v-model="state.show" max-width="400" persistent>
    <v-card>
      <v-card-title>
        {{ state.title }}
      </v-card-title>
      <v-card-text>
        {{ state.message }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="resolveConfirm(false)">
          {{ state.cancelText }}
        </v-btn>
        <v-btn :color="state.color" variant="flat" @click="resolveConfirm(true)">
          {{ state.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
