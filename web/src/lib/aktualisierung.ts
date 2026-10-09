declare const __APP_VERSION__: string | undefined
const MEINE_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
const MARKE = 'ak-neu-geladen'
const WIEDERHOLUNG_MS = 2 * 60_000 // Marke gilt so lange; danach neuer Versuch (CDN-Verzögerung)
const DROSSEL_MS = 60_000
const HINWEIS_ID = 'ak-update-hinweis'

/**
 * **Neuer Code ist beim nächsten Laden da** (Daniel, 08.10.2026): Nach einem Deploy hält der Browser die alte Seite bis zu zehn Minuten (`max-age=600` bei GitHub Pages). Der Bau legt deshalb
 * `version.json` ab (Commit-Kennung); die Seite fragt sie **nur beim Laden** ab, mit eindeutiger Adresse und ohne Cache. Weicht die Kennung vom eigenen Stand ab, wird der Cache der Seite verworfen
 * und einmal neu geladen — noch bevor jemand etwas bedient. **Kein Neuladen mitten in der Benutzung:** Wer die Seite offen hat, behält sie, bis er navigiert oder selbst neu lädt. Eine Marke (Kennung + Zeit) in
 * `sessionStorage` verhindert eine Schleife, falls die neue Fassung nicht ankommt; nach 2 min gilt ein neuer Versuch.
 * Bei Rückkehr in den Tab (sichtbar/Fokus, höchstens je 60 s) erscheint stattdessen ein Hinweis mit Knopf.
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

function zeigeHinweis(): void {
  if (document.getElementById(HINWEIS_ID)) return
  const feld = document.createElement('div')
  feld.id = HINWEIS_ID
  feld.setAttribute('role', 'status')
  feld.style.cssText =
    'position:fixed;left:50%;transform:translateX(-50%);top:max(8px,env(safe-area-inset-top));white-space:nowrap;z-index:2147483000;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;border-radius:12px;border:1px solid var(--ak-rand);background:var(--ak-flaeche);color:var(--ak-text);font:600 14px/1.3 var(--font-sans);box-shadow:0 6px 24px rgba(0,0,0,.35)'
  const text = document.createElement('span')
  text.textContent = 'Neue Version'
  const knopf = document.createElement('button')
  knopf.type = 'button'
  knopf.textContent = 'Neu laden'
  knopf.style.cssText =
    'cursor:pointer;border:0;border-radius:8px;padding:8px 14px;min-height:36px;background:var(--ak-akzent);color:var(--ak-auf-akzent);font:700 14px var(--font-sans)'
  knopf.addEventListener('click', () => void cacheLeeren().then(() => location.reload()))
  feld.append(text, knopf)
  document.body.append(feld)
}

async function pruefe(imLaufenden: boolean): Promise<void> {
  const neu = await neuesteVersion()
  if (!neu) return
  if (neu === MEINE_VERSION) document.getElementById(HINWEIS_ID)?.remove()
  else if (imLaufenden) zeigeHinweis()
  else await neuLaden(neu)
}

export function pruefeVersionBeimLaden(): void {
  if (import.meta.env.DEV || MEINE_VERSION === 'dev') return
  void pruefe(false)
  let zuletzt = Date.now()
  const nachRueckkehr = (): void => {
    if (document.visibilityState !== 'visible' || Date.now() - zuletzt < DROSSEL_MS) return
    zuletzt = Date.now()
    void pruefe(true)
  }
  document.addEventListener('visibilitychange', nachRueckkehr)
  window.addEventListener('focus', nachRueckkehr)
  // Alter Stand verweist auf Chunks, die der Deploy gelöscht hat: Hinweis statt leerem Dialog.
  window.addEventListener('vite:preloadError', zeigeHinweis)
}
