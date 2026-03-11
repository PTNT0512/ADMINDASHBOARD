import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// suppress noisy renderer console messages early
import './utils/suppress-console'
import './utils/web-electron-shim'
import { installMojibakeDomRepair } from './utils/mojibake'
// Import theme variables then base index
import './theme/light-theme.css'
import './theme/admin-redesign.css'
import './theme/page-display-overrides.css'
import './theme/admin-dark.css'
import './index.css'
import './theme/page-icons.js'
import './theme/numeric-enhancer.js'
import App from '@app-root'
import { ToastProvider } from './components/ToastContext'

const rootElement = document.getElementById('root')

createRoot(rootElement).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

installMojibakeDomRepair(rootElement || document.body)
