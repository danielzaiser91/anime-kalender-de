declare const __APP_VERSION__: string | undefined
const MEINE_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
const MARKE = 'ak-neu-geladen'
const ALLE_MS = 5 * 60_000

/**
 * **Neuer Code ist sofort da** (Daniel, 08.10.2026): Nach einem Deploy hält der Browser die alte Seite bis zu zehn Minuten (`max-age=600` bei GitHub Pages). Der Bau legt deshalb `version.json`
 * ab (Commit-Kennung); die Seite fragt sie mit eindeutiger Adresse und ohne Cache ab — beim Start, beim Zurückkehren in den Tab und alle fünf Minuten. Weicht die Kennung vom
 * eigenen Stand ab, wird der Service-Worker-Cache der Seite verworfen und neu geladen. Eine Marke in `sessionStorage` verhindert eine Schleife, falls die neue Fassung nicht ankommt.
 */
async function neuesteVersion(): Promise<string | undefined> {
  try {
    const antwort = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    return antwort.ok ? ((await antwort.json()) as { v?: string }).v : undefined
  } catch {
    return undefined
  }
}

async function neuLaden(version: string): Promise<void> {
  try {
    if (sessionStorage.getItem(MARKE) === version) return
    sessionStorage.setItem(MARKE, version)
  } catch {
    /* Ohne Speicher gibt es keine Schleifensperre — dann lieber nicht neu laden. */
    return
  }
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update()
    for (const name of await caches.keys()) if (name.startsWith('shell-')) await caches.delete(name)
  } catch {
    /* Die Seite lädt auch ohne aufgeräumten Cache neu. */
  }
  location.reload()
}

async function pruefe(): Promise<void> {
  const neu = await neuesteVersion()
  if (neu && neu !== MEINE_VERSION) await neuLaden(neu)
}

export function beobachteVersion(): void {
  if (import.meta.env.DEV || MEINE_VERSION === 'dev') return
  window.setTimeout(() => void pruefe(), 2000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void pruefe())
  window.setInterval(() => document.visibilityState === 'visible' && void pruefe(), ALLE_MS)
}
