import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// The generated token sheet, imported from the workspace package exactly as a
// consumer would import it. Everything else in this bundle is downstream of it.
import '@mizan/tokens/tokens.css'
import './app.css'

import { ModeProvider } from './lib/mode'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <ModeProvider>
      <App />
    </ModeProvider>
  </StrictMode>
)
