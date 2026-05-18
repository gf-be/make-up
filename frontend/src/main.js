import { createApp } from 'vue'
import router from './router/index'
import App from './App.vue'
// import './assets/css/global.css'
import './assets/css/tableHeight.css'

const app = createApp(App)
app.use(router)
app.mount('#app')
