import { createApp } from 'vue'

import { remult } from 'remult'
import App from './App.vue'

import router from './router'
import vuetify from './plugins/vuetify'

const app = createApp(App)
remult.apiClient.url = '/api/'
app.use(router)
app.use(vuetify)
app.mount('#app')
