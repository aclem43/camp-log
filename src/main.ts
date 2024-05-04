import { createApp } from 'vue'
import 'vue3-openlayers/styles.css'

import OpenLayersMap from 'vue3-openlayers'
import App from './App.vue'

import router from './router'
import vuetify from './plugins/vuetify'
import { options } from './plugins/OpenLayers'

const app = createApp(App)

app.use(router)
app.use(vuetify)
app.use(OpenLayersMap, options)
app.mount('#app')
