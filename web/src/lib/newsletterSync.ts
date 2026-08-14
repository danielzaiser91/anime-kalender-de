import { useEffect, useRef } from 'react'

/**
 * Hält die im Newsletter gespeicherten Favoriten aktuell.
 *
 * Das Grundproblem: Favoriten liegen im Browser, der Versanddienst kennt sie
 * nicht. Bei der Anmeldung werden sie einmal übergeben — änderte der Nutzer sie
 * danach, verschickte der Dienst weiter den alten Stand. Genau das behebt dies.
 *
 * Der Ablauf: Die Bestätigungsmail führt zurück auf die Seite und bringt einen
 * Abgleich-Schlüssel mit. Der bleibt im Browser liegen, und ab da meldet jede
 * Änderung an den Favoriten sich von selbst.
 *
 * Grenze, die bleibt: Der Schlüssel liegt in genau dem Browser, in dem
 * bestätigt wurde. Wer auf einem zweiten Gerät Favoriten setzt, muss dort
 * einmal den Abgleich-Link aus einer Mail öffnen.
 */
const TOKEN_KEY = 'newsletterSyncToken'
const SENT_KEY = 'newsletterSyncSent'
const WORKER_URL = import.meta.env.VITE_NEWSLETTER_API ?? ''
const DEBOUNCE_MS = 2500

export function getSyncToken(): string | undefined {
  return localStorage.getItem(TOKEN_KEY) ?? undefined
}

export function setSyncToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearSyncToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SENT_KEY)
}

/** Sendet die Liste und meldet, ob der Schlüssel noch gilt. */
export async function pushFavorites(token: string, favorites: number[]): Promise<number> {
  const res = await fetch(`${WORKER_URL}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, favorites }),
  })
  const body = (await res.json()) as { ok?: boolean; count?: number; error?: string }
  if (res.status === 404) {
    // Abo gelöscht oder Schlüssel ungültig — dann hat der Browser hier nichts
    // mehr zu suchen.
    clearSyncToken()
    throw new Error(body.error ?? 'Abo nicht mehr vorhanden')
  }
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'Abgleich fehlgeschlagen')
  return body.count ?? favorites.length
}

/**
 * Holt die gespeicherten Favoriten — der Rückweg.
 *
 * Bis zum 14.08.2026 ging der Abgleich nur in eine Richtung: Der Dienst kannte
 * die Liste jedes Abonnenten, gab sie aber nie heraus. Wer seine Browserdaten
 * löschte oder das Gerät wechselte, verlor sie deshalb, obwohl sie da waren.
 */
export async function pullFavorites(token: string): Promise<number[]> {
  const res = await fetch(`${WORKER_URL}/favorites?token=${encodeURIComponent(token)}`)
  const body = (await res.json()) as { ok?: boolean; favorites?: number[]; error?: string }
  if (res.status === 404) {
    clearSyncToken()
    throw new Error(body.error ?? 'Abo nicht mehr vorhanden')
  }
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'Abruf fehlgeschlagen')
  return body.favorites ?? []
}

/**
 * Fordert eine Wiederherstellungsmail an.
 *
 * Die Antwort ist **immer dieselbe**, auch bei unbekannter Adresse — sonst
 * ließe sich damit herausfinden, wer abonniert hat. Der Aufrufer bekommt
 * deshalb nichts zurück, was er auswerten könnte.
 */
export async function requestRestore(email: string): Promise<void> {
  const res = await fetch(`${WORKER_URL}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const body = (await res.json()) as { ok?: boolean; error?: string }
  // Nur echte Eingabefehler (ungültige Adresse) werden gemeldet.
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'Anfrage fehlgeschlagen')
}

/**
 * Bittet den Browser, den lokalen Speicher nicht von allein zu räumen.
 *
 * Ohne das löscht iOS-Safari den Speicher nach **sieben Tagen ohne Besuch** —
 * die Intelligent Tracking Prevention macht keinen Unterschied zwischen einem
 * Werbe-Cookie und einer Merkliste. Für eine Seite, deren Zweck das Warten auf
 * einen Termin in Monaten ist, ist das die schlimmste Variante: Man merkt sich
 * etwas, kommt in drei Wochen wieder, und alles ist weg.
 *
 * Schützt **nicht** vor dem Löschen von Hand — das soll es auch nicht. Dafür
 * gibt es die Wiederherstellung per Mail.
 */
export function speicherSichern(): void {
  void navigator.storage?.persist?.().catch(() => undefined)
}

/**
 * Überträgt Änderungen an den Favoriten selbsttätig — verzögert, damit
 * mehrere Klicks hintereinander eine Anfrage ergeben statt fünf.
 */
export function useNewsletterSync(favorites: Set<number>): void {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!WORKER_URL) return
    const token = getSyncToken()
    if (!token) return

    const payload = [...favorites].sort((a, b) => a - b)
    const fingerprint = payload.join(',')
    // Kein Netzwerkverkehr, wenn sich nichts geändert hat — das trifft beim
    // Laden der Seite auf jeden Fall zu.
    if (localStorage.getItem(SENT_KEY) === fingerprint) return

    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      pushFavorites(token, payload)
        .then(() => localStorage.setItem(SENT_KEY, fingerprint))
        .catch(() => {
          // Stiller Fehlschlag ist hier richtig: Der Nutzer hat einen Stern
          // gesetzt, nicht den Newsletter bedient. Beim nächsten Versuch
          // klappt es, und die Mail trägt ohnehin einen Abgleich-Link.
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer.current)
  }, [favorites])
}
