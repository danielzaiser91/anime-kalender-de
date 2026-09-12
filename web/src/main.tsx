import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { applyDocumentLanguage } from './lib/i18n.tsx'
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

// Sprache, Titel und Beschreibung im Dokument setzen. Früher machte das der
// LanguageProvider bei jedem Sprachwechsel — es gibt nur noch Deutsch.
applyDocumentLanguage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * **Der Ladeschirm geht weg, wenn wirklich etwas dasteht.**
 *
 * `render()` kehrt sofort zurück — React zeichnet danach. Ihn hier direkt zu
 * entfernen zeigte für einen Bildaufbau wieder den Rohbau aus `#root`, also
 * genau das, wogegen er gebaut ist. `requestAnimationFrame` verschiebt es auf
 * den ersten Rahmen nach dem Zeichnen.
 *
 * Die Klasse fällt **vor** dem Entfernen: `#root` wird damit sichtbar,
 * während der Schirm noch darüberliegt — sonst blitzt für einen Rahmen der
 * leere Grund durch.
 */
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('ak-laedt')
    document.getElementById('ak-ladeschirm')?.remove()
  })
})
