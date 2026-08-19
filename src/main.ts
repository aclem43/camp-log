import { createApp } from 'vue'

import { remult } from 'remult'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'

import router from './router'
import vuetify from './plugins/vuetify'
import { showAlert } from './scripts/alert'
import { askConfirm } from './scripts/confirm'
import { initSync } from './scripts/sync'
import { initialize } from './scripts/user'

const app = createApp(App)
remult.apiClient.url = '/api'
app.use(router)
app.use(vuetify)

initialize().then(initSync)

app.mount('#app')

const updateSW = registerSW({
  onNeedRefresh() {
    askConfirm('A new version of Camp Log is available.', {
      title: 'Update Available',
      confirmText: 'Reload',
      cancelText: 'Later',
      color: 'primary',
    }).then((confirmed) => {
      if (confirmed)
        updateSW(true)
    })
  },
  onOfflineReady() {
    showAlert('Camp Log is ready to work offline')
  },
})
