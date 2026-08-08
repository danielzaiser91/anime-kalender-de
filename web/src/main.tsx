import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { LanguageProvider } from './lib/i18n.tsx'
import { registerServiceWorker } from './lib/pwa.ts'
import './styles.css'

// Theme-Wahl vor dem ersten Rendern anwenden, damit es nicht kurz aufblitzt.
const stored = localStorage.getItem('theme')
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
const dark = stored ? stored === 'dark' : !prefersLight
document.documentElement.classList.toggle('dark', dark)
document.documentElement.style.colorScheme = dark ? 'dark' : 'light'

// Offline-Fähigkeit anmelden. Schlägt das fehl, läuft die Seite normal weiter.
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
