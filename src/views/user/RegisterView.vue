<script setup lang="ts">
import { ref } from 'vue'
import { mdiGoogle } from '@mdi/js'
import { showAlert } from '@/scripts/alert'
import { logInWithGoogle, register } from '@/scripts/user'

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

function submit() {
  if (password.value !== confirmPassword.value) {
    showAlert('Passwords don\'t match')
    return
  }
  register({ email: email.value, password: password.value, name: name.value })
}
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>
        Register
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submit">
          <v-text-field
            v-model="name"
            label="Name"
            autocomplete="name"
            required
          />
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            inputmode="email"
            autocomplete="email"
            required
          />
          <v-text-field
            v-model="password"
            label="Password"
            required
            type="password"
            autocomplete="new-password"
          />
          <v-text-field
            v-model="confirmPassword"
            label="Confirm Password"
            required
            type="password"
            autocomplete="new-password"
          />
          <div class="d-flex justify-space-between">
            <v-btn
              color="primary"
              type="submit"
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
