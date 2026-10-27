/**
 * Zusicherungen: Die Web-Module in `web/src/lib` lesen `import.meta.env` geschützt (`?.`), damit sie auch ohne Vite
 * (tsx-Tests, Pipeline) laufen. Unter tsx ist `import.meta.env` undefined — jeder ungeschützte Zugriff wirft dort.
 * Läuft in `check:logic`.
 */
import { feedUrl } from '../web/src/lib/data.ts'
import { syncSharePath } from '../web/src/lib/router.ts'
import { shareUrl } from '../web/src/lib/share.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

function wirft(name: string, f: () => unknown): unknown {
  try {
    return f()
  } catch (e) {
    pruefe(name, false, String(e))
    return undefined
  }
}

const verlauf: string[] = []
const g = globalThis as unknown as Record<string, unknown>
const fenster: Record<string, unknown> = { location: { origin: 'https://beispiel.test', pathname: '/', search: '', hash: '' } }
g.window = fenster
g.history = { replaceState: (_s: unknown, _t: string, url: string) => verlauf.push(url), pushState: () => undefined }

pruefe('feedUrl ohne Vite-Umgebung', wirft('feedUrl wirft', () => feedUrl('woche.ics')) === '/data/feeds/woche.ics')
pruefe('shareUrl ohne Vite-Umgebung', wirft('shareUrl wirft', () => shareUrl('abc')) !== undefined)
wirft('syncSharePath wirft', () => syncSharePath('abc'))
pruefe('syncSharePath schreibt die Adresse mit leerer Basis', verlauf.length === 1 && verlauf[0].startsWith('/t/abc/'), verlauf)

// Eine gebaute Seite hat eine Kennung (nicht 'dev'), dann fragt sie `version.json` ab — mit der Basis `/`.
const abgerufen: string[] = []
g.__APP_VERSION__ = 'test-stand'
g.document = { addEventListener: () => undefined, hidden: false }
fenster.addEventListener = () => undefined
g.fetch = (url: string) => {
  abgerufen.push(url)
  return Promise.resolve({ ok: false })
}
const { pruefeVersionBeimLaden } = await import('../web/src/lib/aktualisierung.ts')
wirft('pruefeVersionBeimLaden wirft', () => pruefeVersionBeimLaden())
await new Promise((fertig) => setTimeout(fertig, 0))
pruefe('Versionsabfrage nutzt die Basis /', abgerufen.length === 1 && abgerufen[0].startsWith('/version.json?t='), abgerufen)

if (fehler > 0) {
  console.error(`✖ ${fehler} Fehler`)
  process.exit(1)
}
console.log('✔ import-meta-env: feedUrl, shareUrl, syncSharePath, pruefeVersionBeimLaden laufen ohne Vite (5 Fälle)')
