<script setup lang="ts">
import { ref } from 'vue'
import { mdiGoogle } from '@mdi/js'
import type { VForm } from 'vuetify/components'
import { required, validateForm } from '@/scripts/forms'
import { logInWithGoogle, register } from '@/scripts/user'
import { MIN_PASSWORD_LENGTH } from '@/shared/models/auth/User'

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const form = ref<VForm | null>(null)

const passwordRules = [
  (value: string) => value.length >= MIN_PASSWORD_LENGTH || `Use at least ${MIN_PASSWORD_LENGTH} characters`,
]
const confirmRules = [
  (value: string) => value === password.value || 'Passwords don’t match',
]

async function submit() {
  // Flag first - a double tap mustn't register twice.
  if (submitting.value)
    return
  submitting.value = true
  try {
    if (await validateForm(form.value))
      await register({ email: email.value, password: password.value, name: name.value })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>
        Register
      </v-card-title>
      <v-card-text>
        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-model="name"
            label="Name"
            autocomplete="name"
            required
            :rules="[required('Name is required')]"
          />
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            inputmode="email"
            autocomplete="email"
            required
            :rules="[required('Email is required')]"
          />
          <v-text-field
            v-model="password"
            label="Password"
            required
            type="password"
            autocomplete="new-password"
            :hint="`At least ${MIN_PASSWORD_LENGTH} characters`"
            persistent-hint
            :rules="passwordRules"
          />
          <v-text-field
            v-model="confirmPassword"
            label="Confirm Password"
            required
            type="password"
            autocomplete="new-password"
            :rules="confirmRules"
          />
          <div class="d-flex justify-space-between">
            <v-btn
              color="primary"
              type="submit"
              :loading="submitting"
            >
              Register
            </v-btn>
            <div>
              Already have an account?
              <router-link :to="{ name: 'login' }">
                Login
              </router-link>
            </div>
          </div>
          <v-divider class="my-4" />
          <v-btn
            block
            variant="outlined"
            :prepend-icon="mdiGoogle"
            @click="logInWithGoogle"
          >
            Sign in with Google
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>
