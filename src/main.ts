import { createApp } from 'vue'

import { remult } from 'remult'
import App from './App.vue'

import router from './router'
import vuetify from './plugins/vuetify'
import { initialize } from './scripts/user'

const app = createApp(App)
remult.apiClient.url = '/api/'
app.use(router)
app.use(vuetify)

initialize()


app.mount('#app')
