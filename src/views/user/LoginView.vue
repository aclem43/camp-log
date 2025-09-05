<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { checkLogin, logIn } from '@/scripts/user'
import router from '@/router'

const email = ref('')
const password = ref('')

onMounted(() => {
  if (checkLogin()) {
    router.push({ name: 'home' })
  }
})
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
              @click="() => logIn({ email, password })"
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
