<script setup lang="ts">
import { ref } from 'vue'
import { logIn, register } from '@/scripts/user'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>
        Register
      </v-card-title>
      <v-card-text>
        <v-form>
          <v-text-field
            v-model="email"
            label="Email"
            required
          />
          <v-text-field
            v-model="password"
            label="Password"
            required
            type="password"
          />
          <v-text-field
            v-model="confirmPassword"
            label="Confirm Password"
            required
            type="password"
          />
          <div class="d-flex justify-space-between">
            <v-btn
              color="primary"
              @click="register({ email, password })"
            >
              Login
            </v-btn>
            <div>
              Alread have an account?
              <router-link :to="{ name: 'login' }">
                Login
              </router-link>
            </div>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>
