import { useEffect, useState } from 'react'

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

export function useInstall(): InstallState {
  const [prompt, setPrompt] = useState<InstallPromptEvent>()
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Verhindert den eigenen Hinweis des Browsers; wir fragen selbst.
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(undefined)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!prompt) return false
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    // Das Ereignis ist verbraucht — ein zweiter Aufruf würde nichts tun.
    setPrompt(undefined)
    return outcome === 'accepted'
  }

  return {
    canPrompt: !installed && prompt !== undefined,
    needsManual: !installed && prompt === undefined && isIos(),
    installed,
    install,
  }
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
