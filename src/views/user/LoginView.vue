<script setup lang="ts">
import { ref } from 'vue'
import { logIn } from '@/scripts/user'

const email = ref('')
const password = ref('')
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>
        Login
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
          <div class="d-flex justify-space-between">
            <v-btn
              color="primary"
              @click="logIn({ email, password })"
            >
              Login
            </v-btn>
            <div>
              Not registered?
              <router-link :to="{ name: 'register' }">
                Register
              </router-link>
            </div>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>
