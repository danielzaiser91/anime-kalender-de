import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { applyDocumentLanguage } from './lib/i18n.tsx'
import { registerServiceWorker } from './lib/pwa.ts'
import { kennungUmzug } from './lib/kennung-umzug.ts'
import { akUmleitung } from './lib/ak-umleitung.ts'
import { TippzieleSchalter } from './components/tippziele.tsx'
import { pruefeVersionBeimLaden } from './lib/aktualisierung.ts'
/* Selbst gehostet statt über Google Fonts: Ein Abruf dort übermittelt die IP-Adresse (DSGVO). */
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/700.css'
import '@fontsource-variable/manrope'
import './styles.css'

// Theme-Wahl vor dem ersten Rendern anwenden, damit es nicht kurz aufblitzt.
const stored = localStorage.getItem('theme')
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
const dark = stored ? stored === 'dark' : !prefersLight
document.documentElement.classList.toggle('dark', dark)
document.documentElement.style.colorScheme = dark ? 'dark' : 'light'

// Offline-Fähigkeit anmelden. Schlägt das fehl, läuft die Seite normal weiter.
registerServiceWorker()
pruefeVersionBeimLaden() // Neuer Code nach einem Deploy: beim Laden über version.json erkannt, einmal neu geladen (nie mitten in der Benutzung)

// Sprache, Titel und Beschreibung im Dokument setzen. Früher machte das der
// LanguageProvider bei jedem Sprachwechsel — es gibt nur noch Deutsch.
applyDocumentLanguage()

/* Gemerkte Titel ziehen vor dem ersten Rendern auf unsere Kennung um (einmalig, bis 05.11.2026) und zusammengeführte auf ihren Nachfolger (`ak-umleitung.json`). */
void kennungUmzug().then(akUmleitung).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <TippzieleSchalter />
    </StrictMode>,
  )
  ladeschirmEntfernen()
})

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
function ladeschirmEntfernen() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('ak-laedt')
      document.getElementById('ak-ladeschirm')?.remove()
    })
  })
}
