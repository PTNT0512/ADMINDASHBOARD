import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// suppress noisy renderer console messages early
import './utils/suppress-console'
// Import theme variables then base index
import './theme/light-theme.css'
import './theme/admin-redesign.css'
import './theme/page-display-overrides.css'
import './theme/admin-dark.css'
import './index.css'
import './theme/page-icons.js'
import './theme/numeric-enhancer.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
