import { useSyncExternalStore } from 'react'
import { installStellen, KOPF_KNOPF_AB_PX, type MenueInstall } from './install-stellen.ts'

/**
 * Alles rund um „App installieren".
 *
 * Die Browser gehen hier drei verschiedene Wege, und das prägt den ganzen Code:
 *
 * - **Chrome und Edge** feuern `beforeinstallprompt`, bevor sie selbst etwas
 *   anzeigen. Das Ereignis muss aufgehoben werden — später lässt es sich genau
 *   einmal auslösen, und nur aus einer echten Nutzerhandlung heraus.
 * - **Safari auf iOS** kennt das Ereignis nicht. Dort geht Installieren
 *   ausschließlich über „Teilen → Zum Home-Bildschirm", also über eine
 *   Anleitung statt über einen Knopf.
 * - **Firefox** installiert auf dem Desktop gar nicht.
 *
 * Deshalb liefert der Hook nicht einfach „installierbar ja/nein", sondern
 * unterscheidet, *wie* installiert wird.
 */

/** Das Ereignis ist noch kein Standard und fehlt in den DOM-Typen. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DECIDED_KEY = 'installDialogSeen'

/** Läuft die Seite bereits als installierte App? */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari meldet es nicht über display-mode, sondern über diese Eigenschaft.
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

/** iPhone oder iPad? Dort gibt es nur den Weg über das Teilen-Menü. */
export function isIos(): boolean {
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS meldet sich seit Version 13 als Mac — der Touchscreen verrät es.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Ein Gerät, das man in der Hand hält — nur dort drängt sich eine App auf. */
export function isHandheld(): boolean {
  return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}

export interface InstallState {
  /** Der Browser hat die Installation angeboten — ein Knopf ist möglich. */
  canPrompt: boolean
  /** Kein Knopf möglich, aber eine Anleitung ist sinnvoll (iOS). */
  needsManual: boolean
  /** Läuft schon als App. */
  installed: boolean
  /** Löst den Browser-Dialog aus. Gibt zurück, ob installiert wurde. */
  install: () => Promise<boolean>
}

/*
  Ein Zustand für alle: Kopf-Knopf, Glocken-Menü und Dialog lesen denselben Stand. Mit je eigenem
  State bot das Menü nach einem abgelehnten Angebot weiter „installieren“ an, während der Kopf es
  schon zurückgezogen hatte. Die Ereignisse werden beim Laden des Moduls abonniert, damit
  `beforeinstallprompt` vor dem ersten Rendern nicht verpasst wird.
*/
let angebot: InstallPromptEvent | undefined
let stand = { installed: isStandalone(), hatAngebot: false }
const hoerer = new Set<() => void>()
function setzeStand(installed: boolean, neuesAngebot: InstallPromptEvent | undefined): void {
  angebot = neuesAngebot
  stand = { installed, hatAngebot: neuesAngebot !== undefined }
  hoerer.forEach((h) => h())
}
window.addEventListener('beforeinstallprompt', (event) => {
  // Verhindert den eigenen Hinweis des Browsers; wir fragen selbst.
  event.preventDefault()
  setzeStand(stand.installed, event as InstallPromptEvent)
})
window.addEventListener('appinstalled', () => setzeStand(true, undefined))

async function installieren(): Promise<boolean> {
  const verbraucht = angebot
  if (!verbraucht) return false
  await verbraucht.prompt()
  const { outcome } = await verbraucht.userChoice
  // Das Ereignis ist verbraucht — ein zweiter Aufruf würde nichts tun.
  setzeStand(stand.installed, undefined)
  return outcome === 'accepted'
}

export function useInstall(): InstallState {
  const { installed, hatAngebot } = useSyncExternalStore(
    (melden) => {
      hoerer.add(melden)
      return () => void hoerer.delete(melden)
    },
    () => stand,
  )
  return {
    canPrompt: !installed && hatAngebot,
    needsManual: !installed && !hatAngebot && isIos(),
    installed,
    install: installieren,
  }
}

/** Breit genug für den Kopf-Knopf? Gleiche Schwelle wie `min-[390px]` in `InstallButton`. */
function useBreit(): boolean {
  const abfrage = `(min-width: ${KOPF_KNOPF_AB_PX}px)`
  return useSyncExternalStore(
    (melden) => {
      const m = window.matchMedia(abfrage)
      m.addEventListener('change', melden)
      return () => m.removeEventListener('change', melden)
    },
    () => window.matchMedia(abfrage).matches,
  )
}

/** Was das Glocken-Menü zum Installieren zeigt — `null`, wenn der Kopf-Knopf es übernimmt oder nichts anzubieten ist. */
export function useMenueInstall(state: InstallState): MenueInstall {
  const breit = useBreit()
  return installStellen({
    handheld: isHandheld(),
    installed: state.installed,
    canPrompt: state.canPrompt,
    ios: isIos(),
    breit,
  }).menue
}

/** Wurde die Frage schon einmal beantwortet? Dann nicht wieder stellen. */
export function installDialogAnswered(): boolean {
  try {
    return localStorage.getItem(DECIDED_KEY) === '1'
  } catch {
    return true
  }
}

export function rememberInstallDialog(): void {
  try {
    localStorage.setItem(DECIDED_KEY, '1')
  } catch {
    // Privater Modus ohne Speicher — dann fragt die App eben noch einmal.
  }
}

/**
 * Meldet den Service Worker an.
 *
 * Bewusst erst nach `load`: Vorher konkurriert die Registrierung mit dem
 * Laden der Seite selbst, und der erste Besuch würde spürbar langsamer.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ohne Service Worker läuft alles weiter, nur eben nicht offline.
    })
  })
}

/**
 * Legt die Cover der aktuellen und nächsten Woche für den Offline-Fall ab.
 *
 * Nur diese zwei Wochen: Das ist, was jemand unterwegs zeigen will, und es
 * bleibt in der Größenordnung von ein paar Dutzend Bildern. Der gesamte
 * Katalog wären tausende — ungefragt hundert Megabyte auf ein fremdes Handy
 * zu legen wäre übergriffig.
 *
 * Die Auswahl passiert hier und nicht im Build, weil „aktuelle Woche" vom Tag
 * des Betrachters abhängt, nicht vom Tag des Builds.
 */
export function cacheCoversForOffline(urls: string[]): void {
  if (!('serviceWorker' in navigator) || !urls.length) return
  // Über `ready` statt über `controller`: Beim allerersten Besuch steuert noch
  // kein Worker diese Seite, obwohl er längst installiert ist. Genau dann wird
  // der Vorrat aber gebraucht — wer die App gerade erst geöffnet hat, geht
  // vielleicht als Nächstes vor die Tür.
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({ type: 'cache-covers', urls: [...new Set(urls)] })
    })
    .catch(() => undefined)
}
