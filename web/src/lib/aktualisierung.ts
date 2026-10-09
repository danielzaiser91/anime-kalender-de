declare const __APP_VERSION__: string | undefined
const MEINE_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
const MARKE = 'ak-neu-geladen'
const WIEDERHOLUNG_MS = 2 * 60_000 // Marke gilt so lange; danach neuer Versuch (CDN-Verzögerung)

/**
 * **Neuer Code ist beim nächsten Laden da** (Daniel, 08.10.2026): Nach einem Deploy hält der Browser die alte Seite bis zu zehn Minuten (`max-age=600` bei GitHub Pages). Der Bau legt deshalb
 * `version.json` ab (Commit-Kennung); die Seite fragt sie **nur beim Laden** ab, mit eindeutiger Adresse und ohne Cache. Weicht die Kennung vom eigenen Stand ab, wird der Cache der Seite verworfen
 * und einmal neu geladen — noch bevor jemand etwas bedient. **Kein Neuladen mitten in der Benutzung:** Wer die Seite offen hat, behält sie, bis er navigiert oder selbst neu lädt. Eine Marke (Kennung + Zeit) in
 * `sessionStorage` verhindert eine Schleife, falls die neue Fassung nicht ankommt; nach 2 min gilt ein neuer Versuch.
 */
async function neuesteVersion(): Promise<string | undefined> {
  try {
    const antwort = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    return antwort.ok ? ((await antwort.json()) as { v?: string }).v : undefined
  } catch {
    return undefined
  }
}

async function cacheLeeren(): Promise<void> {
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update()
    for (const name of await caches.keys()) if (name.startsWith('shell-')) await caches.delete(name)
  } catch {
    /* Die Seite lädt auch ohne aufgeräumten Cache neu. */
  }
}

async function neuLaden(version: string): Promise<void> {
  try {
    const [v, zeit] = (sessionStorage.getItem(MARKE) ?? '').split('|')
    if (v === version && Date.now() - Number(zeit) < WIEDERHOLUNG_MS) return
    sessionStorage.setItem(MARKE, `${version}|${Date.now()}`)
  } catch {
    /* Ohne Speicher gibt es keine Schleifensperre — dann lieber nicht neu laden. */
    return
  }
  await cacheLeeren()
  location.reload()
}

async function pruefe(): Promise<void> {
  const neu = await neuesteVersion()
  if (neu && neu !== MEINE_VERSION) await neuLaden(neu)
}

export function pruefeVersionBeimLaden(): void {
  if (import.meta.env.DEV || MEINE_VERSION === 'dev') return
  void pruefe()
  // Alter Stand verweist auf Chunks, die der Deploy gelöscht hat: still einmal neu laden.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault()
    void neuLaden('chunk')
  })
}
