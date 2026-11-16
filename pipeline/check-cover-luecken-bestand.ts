/**
 * Bestandswache: Jeder Eintrag in `franchises.json`, `titles.json` und `ohne-synchro.json` hat ein Cover oder steht auf der Lückenliste
 * `data/cover-luecken.json` (Kennung → Grund aus `data/cover-eigen.json`). Bewertung in `lib/cover-luecken.ts`.
 * Ein neuer Eintrag ohne Cover ist **nur eine Warnung** (Exit 0): Rot stoppt den ganzen Bestandsbau, und aniSearch-only-Titel kommen täglich ohne Bild hinzu.
 * **Cover-Verlust (16.11.2026):** Die Lückenliste schreibt der Bau aus dem Datensatz, deckt also jeden Titel ohne Cover und meldet nie etwas. Darum zusätzlich:
 * Titel im Hauptbestand ohne Cover und ohne Eintrag in der Handliste `data/cover-ohne-bekannt.json` → herabgestufte Warnzeile (Posteingang), Exit 0.
 * Rot bei fehlender oder kaputter Lückenliste und bei **veralteten** Einträgen (Kennung steht drauf, hat aber ein Cover): Der Bau schreibt die Liste selbst
 * (`bau/13-11-cover-luecken.ts`), ein veralteter Eintrag heißt also, dass dieser Schritt nicht lief oder falsch rechnet. Test: `check-cover-luecken-wache.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { HERABGESTUFT } from './lib/bestand-warnzeile.ts'
import { coverOhneImHauptbestand, pruefeCoverLuecken } from './lib/cover-luecken.ts'

const lies = (pfad: string): unknown => JSON.parse(readFileSync(pfad, 'utf8'))
const kennungen = (liste: number[]): string => `${liste.slice(0, 10).join(', ')}${liste.length > 10 ? ', …' : ''}`

/** Hauptbestand ohne Cover gegen die Handliste: eine herabgestufte Warnzeile je Befund (Posteingang), nie rot — ein neuer aniSearch-Titel ohne Bild stoppte sonst den Bau. */
export function hauptbestandOhneCover(haupt: Parameters<typeof coverOhneImHauptbestand>[0], bekannt: Record<string, string>): string[] {
  const r = coverOhneImHauptbestand(haupt, bekannt)
  const zeilen: string[] = []
  if (r.fehlt.length) {
    const namen = r.fehlt.map((t) => `${t.id} „${t.titleDe ?? t.titleEn ?? t.titleRomaji ?? '?'}“`).join(', ')
    zeilen.push(`⚠ WARNUNG ${HERABGESTUFT} Cover-Verlust: ${r.fehlt.length} Titel im Hauptbestand ohne Cover und nicht auf data/cover-ohne-bekannt.json (Bildquelle suchen, sonst mit Grund eintragen): ${namen}`)
  }
  if (r.veraltet.length) zeilen.push(`⚠ WARNUNG Cover: ${r.veraltet.length} Kennung(en) auf data/cover-ohne-bekannt.json haben ein Cover oder keinen Titel mehr (Eintrag streichen): ${kennungen(r.veraltet)}`)
  return zeilen
}

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
  if (r.veraltet.length) {
    console.error(`  ✖ Cover: ${r.veraltet.length} Kennung(en) auf data/cover-luecken.json haben ein Cover (der Bau schreibt die Liste neu, Schritt prüfen): ${kennungen(r.veraltet)}`)
    console.error(`VERSTÖSSE: ${r.veraltet.length}`)
    return 1
  }
  const bekannt = existsSync(join(wurzel, 'data/cover-ohne-bekannt.json')) ? (lies(join(wurzel, 'data/cover-ohne-bekannt.json')) as Record<string, string>) : {}
  for (const zeile of hauptbestandOhneCover(daten('titles.json') as [], bekannt)) console.log(`  ${zeile}`)
  if (!r.fehlt.length) console.log(`  ✓ Cover: jeder Eintrag hat ein Cover oder steht auf der Lückenliste (${Object.keys(luecken).length} Lücken)`)
  console.log('VERSTÖSSE: 0')
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url))))
}
