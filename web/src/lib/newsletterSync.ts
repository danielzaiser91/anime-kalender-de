import { useEffect, useRef, useSyncExternalStore } from 'react'

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
const MAIL_KEY = 'newsletterMail'
const WORKER_URL = import.meta.env.VITE_NEWSLETTER_API ?? ''
const DEBOUNCE_MS = 2500

/**
 * Der Verbindungszustand als **globaler** Wert, nicht als Einzelabfrage.
 *
 * Ob ein Newsletter hinterlegt ist, beeinflusst inzwischen mehrere Stellen der
 * Oberfläche: den Newsletter-Knopf im Kopf, den Merken-Hinweis im Detail-Panel,
 * die Newsletter-Seite selbst. Jede davon `localStorage` direkt lesen zu lassen
 * hätte zwei Fehler: Der Wert wäre an jeder Stelle ein anderer Schnappschuss,
 * und eine Änderung erreichte die anderen Stellen erst beim nächsten
 * Seitenaufbau (Daniel, 15.08.2026: „den verbindungszustand solltest du global
 * als variable zur verfügung haben").
 *
 * Umgesetzt als winziger Store mit `useSyncExternalStore`: Ein Schreibvorgang
 * benachrichtigt alle Abonnenten, und React zeichnet neu. Ein `storage`-Ereignis
 * genügt dafür nicht — das feuert nur in **anderen** Tabs, nicht in dem, der
 * geschrieben hat.
 */
export interface NewsletterVerbindung {
  verbunden: boolean
  mail?: string
}

const horcher = new Set<() => void>()
let stand: NewsletterVerbindung = lies()

function lies(): NewsletterVerbindung {
  const token = localStorage.getItem(TOKEN_KEY) ?? undefined
  return { verbunden: !!token, mail: localStorage.getItem(MAIL_KEY) ?? undefined }
}

function melden(): void {
  stand = lies()
  for (const h of horcher) h()
}

function abonnieren(cb: () => void): () => void {
  horcher.add(cb)
  // Andere Tabs melden sich über `storage` — dort greift der Browser selbst.
  const ausFremdemTab = () => melden()
  window.addEventListener('storage', ausFremdemTab)
  return () => {
    horcher.delete(cb)
    window.removeEventListener('storage', ausFremdemTab)
  }
}

/** Der aktuelle Verbindungszustand, überall in der Oberfläche gleich. */
export function useNewsletterVerbindung(): NewsletterVerbindung {
  return useSyncExternalStore(
    abonnieren,
    () => stand,
    // Beim Vorabrendern gibt es keinen `localStorage`.
    () => ({ verbunden: false }),
  )
}

export function getSyncToken(): string | undefined {
  return localStorage.getItem(TOKEN_KEY) ?? undefined
}

export function setSyncToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  melden()
}

export function clearSyncToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SENT_KEY)
  localStorage.removeItem(MAIL_KEY)
  melden()
}

/**
 * Die Adresse, an die wir schreiben — damit die Seite sie nennen kann.
 *
 * Ohne sie musste jeder Hinweis im Konjunktiv bleiben („falls du ein Abo
 * hast"). Mit ihr steht dort, was tatsächlich passiert: „Wir informieren dich
 * über deine hinterlegte Newsletter-E-Mail-Adresse: …" (Daniel, 15.08.2026).
 *
 * Sie liegt neben dem Abgleich-Schlüssel im selben Browser und wird mit ihm
 * zusammen gelöscht. Der Dienst liefert sie nur gegen diesen Schlüssel aus.
 */
export function getSyncMail(): string | undefined {
  return localStorage.getItem(MAIL_KEY) ?? undefined
}

export function setSyncMail(mail: string): void {
  localStorage.setItem(MAIL_KEY, mail)
  melden()
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
  const body = (await res.json()) as {
    ok?: boolean
    favorites?: number[]
    email?: string
    error?: string
  }
  if (res.status === 404) {
    clearSyncToken()
    throw new Error(body.error ?? 'Abo nicht mehr vorhanden')
  }
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'Abruf fehlgeschlagen')
  // Der Dienst liefert die Adresse mit; sie bleibt hier liegen, damit die
  // Oberfläche sie nennen kann, statt im Konjunktiv zu bleiben.
  if (body.email) setSyncMail(body.email)
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
 * Beendet das Abo, zu dem dieser Browser den Schlüssel hat.
 *
 * Der Schlüssel wird danach gelöscht — sonst zeigte die Seite weiter eine
 * Verbindung zu einem Abo, das es nicht mehr gibt.
 */
export async function unsubscribeByToken(token: string): Promise<void> {
  const res = await fetch(`${WORKER_URL}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const body = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'Abmelden fehlgeschlagen')
  clearSyncToken()
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

/** Die Einstellungen eines verbundenen Abos. */
export interface Einstellungen {
  email: string
  frequency: 'daily' | 'weekly'
  platforms: string[]
  /**
   * Auch melden, wenn zu einer gemerkten **Reihe** etwas Neues erscheint.
   *
   * Wer die letzte Staffel gemerkt hat, erfährt sonst nie von der nächsten — sie
   * ist ein eigener Titel, und den kann noch niemand gemerkt haben.
   */
  franchiseHinweis?: boolean
}

/**
 * Holt Rhythmus, Plattformen und Adresse zum verbundenen Browser.
 *
 * Damit zeigt die Newsletter-Seite einem Abonnenten seinen tatsächlichen Stand,
 * statt ihm dasselbe Anmeldeformular vorzulegen wie einem Fremden (Daniel,
 * 15.08.2026).
 */
export async function ladeEinstellungen(token: string): Promise<Einstellungen> {
  if (!WORKER_URL) throw new Error('Der Newsletter-Dienst ist in dieser Installation nicht verbunden.')
  const res = await fetch(`${WORKER_URL}/prefs?token=${encodeURIComponent(token)}`)
  const body = await alsJson<Partial<Einstellungen> & { ok?: boolean; error?: string }>(res)
  /**
   * Ein 404 von hier wird **nachgeprüft**, nicht geglaubt und nicht ignoriert.
   *
   * Er heißt zweierlei: „dieses Abo gibt es nicht" oder „diesen Endpunkt gibt es
   * nicht". Am 15.08.2026 war es das Zweite — der Client sprach `/prefs` an,
   * bevor der Worker die Route hatte, und trennte Daniels Browser. Die Antwort
   * darauf war, hier **gar nichts** mehr zu löschen. Das erzeugte am 18.08.2026
   * den umgekehrten Fehler: Nach einer Abmeldung aus der Mail behauptete die
   * Seite oben „gehört zu keinem aktiven Abo" und unten „dieser Browser ist mit
   * deinem Abo verbunden" — und zwar dauerhaft, denn niemand fragte je die
   * Stelle, die es wissen muss.
   *
   * Beides löst derselbe Griff: einen zweiten Beleg holen. Über den Bestand
   * eines Abos entscheidet `/favorites`; sagt auch die Route „kenne ich nicht",
   * räumt sie den Schlüssel selbst weg, und die Oberfläche zeigt wieder den
   * Anmeldezustand. Antwortet sie dagegen normal, fehlt hier nur ein Endpunkt —
   * dann bleibt alles, wie es ist.
   */
  if (res.status === 404) {
    try {
      await pullFavorites(token)
    } catch {
      // `pullFavorites` hat bei einem 404 bereits abgeräumt. Ein anderer Fehler
      // (offline, Zeitüberschreitung) beweist nichts und ändert deshalb nichts.
    }
    throw new Error(
      getSyncToken()
        ? (body.error ?? 'Einstellungen sind gerade nicht abrufbar.')
        : 'Dieses Abo gibt es nicht mehr — dieser Browser ist jetzt getrennt.',
    )
  }
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'Abruf fehlgeschlagen')
  if (body.email) setSyncMail(body.email)
  return {
    email: body.email ?? '',
    frequency: body.frequency === 'daily' ? 'daily' : 'weekly',
    platforms: body.platforms ?? [],
  }
}

/** Schreibt geänderte Einstellungen zurück. */
export async function speichereEinstellungen(
  token: string,
  werte: { frequency: 'daily' | 'weekly'; platforms: string[]; franchiseHinweis?: boolean },
): Promise<void> {
  if (!WORKER_URL) throw new Error('Der Newsletter-Dienst ist in dieser Installation nicht verbunden.')
  const res = await fetch(`${WORKER_URL}/prefs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...werte }),
  })
  const body = await alsJson<{ ok?: boolean; error?: string }>(res)
  if (!res.ok || !body.ok) throw new Error(body.error ?? 'Speichern fehlgeschlagen')
}

/**
 * Antwort als JSON lesen, ohne bei HTML in eine rohe Ausnahme zu laufen.
 *
 * Ohne `VITE_NEWSLETTER_API` zeigt jede dieser Adressen auf den eigenen
 * Entwicklungsserver, und der liefert die Startseite. `res.json()` warf dann
 * „Unexpected token '<'", und genau dieser Satz stand als Fehlermeldung in der
 * Oberfläche (15.08.2026).
 */
async function alsJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Der Newsletter-Dienst hat unerwartet geantwortet.')
  }
}
