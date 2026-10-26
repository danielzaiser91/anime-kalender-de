/**
 * Bestandswache: Jeder Eintrag in `franchises.json`, `titles.json` und `ohne-synchro.json` hat ein Cover oder steht auf der Lückenliste
 * `data/cover-luecken.json` (Kennung → Grund aus `data/cover-eigen.json`). Bewertung in `lib/cover-luecken.ts`.
 * Ein neuer Eintrag ohne Cover ist **nur eine Warnung** (Exit 0): Rot stoppt den ganzen Bestandsbau, und aniSearch-only-Titel kommen täglich ohne Bild hinzu.
 * Rot nur bei fehlender oder kaputter Lückenliste. Test: `check-cover-luecken-wache.ts`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { pruefeCoverLuecken } from './lib/cover-luecken.ts'

const lies = (pfad: string): unknown => JSON.parse(readFileSync(pfad, 'utf8'))
const kennungen = (liste: number[]): string => `${liste.slice(0, 10).join(', ')}${liste.length > 10 ? ', …' : ''}`

export function main(wurzel: string): number {
  const listePfad = join(wurzel, 'data/cover-luecken.json')
  let luecken: Record<string, string>
  try {
    luecken = lies(listePfad) as Record<string, string>
    if (!luecken || typeof luecken !== 'object' || Array.isArray(luecken)) throw new Error('keine Kennung-Grund-Zuordnung')
  } catch (e) {
    console.error(`  ✖ Lückenliste data/cover-luecken.json: ${(e as Error).message}`)
    console.error('VERSTÖSSE: 1')
    return 1
  }
  const daten = (name: string): never => lies(join(wurzel, 'public/data', name)) as never
  const r = pruefeCoverLuecken(daten('franchises.json'), [...(daten('titles.json') as []), ...(daten('ohne-synchro.json') as [])], luecken)
  if (r.fehlt.length) console.log(`  ⚠ WARNUNG Cover: ${r.fehlt.length} Eintrag/Einträge in Reihe oder Datenbank ohne Cover und nicht auf data/cover-luecken.json (Kennung samt Grund aus data/cover-eigen.json eintragen): ${kennungen(r.fehlt)}`)
  if (r.veraltet.length) console.log(`  ⚠ WARNUNG Cover: ${r.veraltet.length} Kennung(en) auf data/cover-luecken.json haben inzwischen ein Cover (Eintrag entfernen): ${kennungen(r.veraltet)}`)
  if (!r.fehlt.length && !r.veraltet.length) console.log(`  ✓ Cover: jeder Eintrag hat ein Cover oder steht auf der Lückenliste (${Object.keys(luecken).length} Lücken)`)
  console.log('VERSTÖSSE: 0')
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url))))
}
