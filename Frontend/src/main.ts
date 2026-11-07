import { createApp } from 'vue'

import '@fontsource-variable/lora/index.css'
import '@fontsource-variable/lora/wght-italic.css'
import '@fontsource-variable/source-sans-3/index.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/forms.css'

import App from './App.vue'
import { API_CONTEXT, defaultApiContext } from './composables/useApi'
import { createAppRouter } from './router'

createApp(App)
  .provide(API_CONTEXT, defaultApiContext)
  .use(createAppRouter(defaultApiContext))
  .mount('#app')
