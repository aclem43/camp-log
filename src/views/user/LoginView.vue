<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { mdiGoogle } from '@mdi/js'
import { checkLogin, logIn, logInWithGoogle } from '@/scripts/user'
import router from '@/router'

const email = ref('')
const password = ref('')
const submitting = ref(false)

onMounted(() => {
  if (checkLogin()) {
    router.push({ name: 'home' })
  }
})

async function submit() {
  // A double tap mustn't send the login twice.
  if (submitting.value)
    return
  submitting.value = true
  try {
    await logIn({ email: email.value, password: password.value })
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
        Login
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submit">
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
            autocomplete="current-password"
          />
          <div class="d-flex justify-space-between">
            <v-btn
              color="primary"
              type="submit"
              :loading="submitting"
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
