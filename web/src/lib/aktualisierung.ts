import { merkeLesestelle, ortJetzt } from './lesestelle.ts'

declare const __APP_VERSION__: string | undefined
const MEINE_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
const MARKE = 'ak-neu-geladen'
const WIEDERHOLUNG_MS = 2 * 60_000 // Marke gilt so lange; danach neuer Versuch (CDN-Verzögerung)
const PAUSE_MS = 10 * 60_000 // so lange verborgen, dann zählt die Rückkehr wie ein Laden (Browser-Cache der Seite: max-age=600)

/**
 * **Neuer Code ist beim nächsten Laden da** (Daniel, 08.10.2026): Nach einem Deploy hält der Browser die alte Seite bis zu zehn Minuten (`max-age=600` bei GitHub Pages). Der Bau legt deshalb
 * `version.json` ab (Commit-Kennung); die Seite fragt sie beim Laden und bei der Rückkehr nach langer Pause ab, mit eindeutiger Adresse und ohne Cache. Weicht die Kennung vom eigenen Stand ab, wird der Cache der Seite verworfen
 * und einmal neu geladen — noch bevor jemand etwas bedient. **Kein Neuladen mitten in der Benutzung:** Wer die Seite offen hat, behält sie, bis er navigiert oder selbst neu lädt. Eine Marke (Kennung + Zeit) in
 * `sessionStorage` verhindert eine Schleife, falls die neue Fassung nicht ankommt; nach 2 min gilt ein neuer Versuch.
 */
async function neuesteVersion(): Promise<string | undefined> {
  try {
    const antwort = await fetch(`${import.meta.env?.BASE_URL ?? '/'}version.json?t=${Date.now()}`, { cache: 'no-store' })
    return antwort.ok ? ((await antwort.json()) as { v?: string }).v : undefined
  } catch {
    return undefined
  }
}

async function cacheLeeren(): Promise<void> {
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update()
    for (const name of await caches.keys()) if (/^(shell|data)-/.test(name)) await caches.delete(name)
  } catch {
    /* Die Seite lädt auch ohne aufgeräumten Cache neu. */
  }
}

/**
 * Kam der Besucher zurück, während das Neuladen im Verborgenen vorbereitet wurde, wird nicht mehr sichtbar neu geladen. Die Schleifensperre
 * fällt, damit der Rückfall bei der Rückkehr (`pruefeNachPause`, Tab war ≥ `PAUSE_MS` verborgen) den Versuch sofort erneuert.
 */
function abgebrochen(): void {
  try {
    sessionStorage.removeItem(MARKE)
  } catch {
    /* ohne Speicher gab es keine Marke */
  }
}

async function neuLaden(version: string, nurVerborgen = false): Promise<void> {
  try {
    const [v, zeit] = (sessionStorage.getItem(MARKE) ?? '').split('|')
    if (v === version && Date.now() - Number(zeit) < WIEDERHOLUNG_MS) return
    sessionStorage.setItem(MARKE, `${version}|${Date.now()}`)
  } catch {
    /* Ohne Speicher gibt es keine Schleifensperre — dann lieber nicht neu laden. */
    return
  }
  await cacheLeeren()
  if (nurVerborgen && !document.hidden) return abgebrochen()
  merkeLesestelle(document, sessionStorage, ortJetzt(), Date.now())
  location.reload()
}

async function pruefe(nurVerborgen = false): Promise<void> {
  const neu = await neuesteVersion()
  if (neu && neu !== MEINE_VERSION) await neuLaden(neu, nurVerborgen)
}

export type Uhr = { jetzt: () => number; setze: (f: () => void, ms: number) => number; loesche: (id: number) => void }
export const ECHTE_UHR: Uhr = { jetzt: () => Date.now(), setze: (f, ms) => window.setTimeout(f, ms), loesche: (id) => window.clearTimeout(id) }

/**
 * Handy-Tabs und die installierte App bleiben Stunden offen und werden nie „geladen". **Die Prüfung läuft im Verborgenen** (Daniel, 01.11.2026):
 * Ist der Tab `PAUSE_MS` verborgen, wird geprüft und bei neuer Fassung gleich dort neu geladen — der Besucher sieht beim Zurückkommen nur die fertige Seite.
 * Rückfall (Tab war eingefroren, kein Timer lief): Kommt jemand nach ≥ `PAUSE_MS` zurück, wird dann geprüft; die Lesestelle bleibt erhalten (`lesestelle.ts`).
 * Zusagen (Test `pipeline/check-aktualisierung-verborgen.ts`): Timer nur beim Verbergen, bei Rückkehr davor gelöscht, nur wenn noch verborgen; Rückkehr nach Pause prüft einmal.
 */
export function pruefeNachPause(doc: Pick<Document, 'hidden' | 'addEventListener'>, pruefeJetzt: (imVerborgenen: boolean) => void, uhr: Uhr = ECHTE_UHR): void {
  let verborgenSeit = 0
  let timer: number | undefined
  const stoppe = () => {
    if (timer !== undefined) uhr.loesche(timer)
    timer = undefined
  }
  doc.addEventListener('visibilitychange', () => {
    stoppe()
    if (doc.hidden) {
      verborgenSeit = uhr.jetzt()
      timer = uhr.setze(() => {
        timer = undefined
        if (doc.hidden) pruefeJetzt(true)
      }, PAUSE_MS)
    } else if (verborgenSeit && uhr.jetzt() - verborgenSeit >= PAUSE_MS) pruefeJetzt(false)
  })
}

export function pruefeVersionBeimLaden(): void {
  if (import.meta.env?.DEV || MEINE_VERSION === 'dev') return
  void pruefe()
  pruefeNachPause(document, (imVerborgenen) => void pruefe(imVerborgenen))
  // Alter Stand verweist auf Chunks, die der Deploy gelöscht hat: still einmal neu laden.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault()
    void neuLaden('chunk')
  })
}
