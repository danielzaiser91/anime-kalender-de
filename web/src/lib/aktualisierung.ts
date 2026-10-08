declare const __APP_VERSION__: string | undefined
const MEINE_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
const MARKE = 'ak-neu-geladen'

/**
 * **Neuer Code ist beim nächsten Laden da** (Daniel, 08.10.2026): Nach einem Deploy hält der Browser die alte Seite bis zu zehn Minuten (`max-age=600` bei GitHub Pages). Der Bau legt deshalb
 * `version.json` ab (Commit-Kennung); die Seite fragt sie **nur beim Laden** ab, mit eindeutiger Adresse und ohne Cache. Weicht die Kennung vom eigenen Stand ab, wird der Cache der Seite verworfen
 * und einmal neu geladen — noch bevor jemand etwas bedient. **Kein Neuladen mitten in der Benutzung:** Wer die Seite offen hat, behält sie, bis er navigiert oder selbst neu lädt. Eine Marke in
 * `sessionStorage` verhindert eine Schleife, falls die neue Fassung nicht ankommt.
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

export function pruefeVersionBeimLaden(): void {
  if (import.meta.env.DEV || MEINE_VERSION === 'dev') return
  void pruefe()
}
