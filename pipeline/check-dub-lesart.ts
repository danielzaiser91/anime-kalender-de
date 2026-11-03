/**
 * Ratsche: `x.dub === true` als „deutsch bestätigt“ lesen, ohne `dubAbgeleitet` zu beachten.
 * Neue Stellen in shared/ und pipeline/bau/ fallen auf; der Bestand darf nur sinken
 * (Grenze: tools/dub-lesart-grenzen.json). Ausnahme mit Begründung: Kommentar `dub-lesart: <Grund>`.
 * Aufruf: npx tsx pipeline/check-dub-lesart.ts [--liste] [--wurzel <ordner>]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { offeneLesungen } from './lib/dub-lesart.ts'

const ORDNER = ['shared', 'pipeline/bau']

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = join(ordner, e.name)
    if (e.isDirectory()) return dateien(pfad)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [pfad] : []
  })
}

/** Offene Lesestellen `pfad:zeile` unter der Wurzel. */
export function offeneStellen(wurzel: string): string[] {
  return ORDNER.flatMap((o) => dateien(join(wurzel, o))).flatMap((datei) =>
    offeneLesungen(readFileSync(datei, 'utf8')).map((l) => `${datei.slice(wurzel.length + 1).replaceAll('\\', '/')}:${l.zeile}`),
  )
}

function argument(name: string, vorgabe: string): string {
  const i = process.argv.indexOf(name)
  return i >= 0 ? resolve(process.argv[i + 1]!) : vorgabe
}

function main(): number {
  const wurzel = argument('--wurzel', resolve(import.meta.dirname, '..'))
  const stellen = offeneStellen(wurzel)
  if (process.argv.includes('--liste')) {
    console.log(stellen.join('\n'))
    return 0
  }
  const erlaubt = (JSON.parse(readFileSync(join(wurzel, 'tools/dub-lesart-grenzen.json'), 'utf8')) as { offen: number }).offen
  console.log(`dub-lesart: ${stellen.length} offene Lese-Stellen (höchstens ${erlaubt})`)
  if (stellen.length > erlaubt) {
    console.error(
      `✖ Neue Stelle liest dub === true, ohne dubAbgeleitet zu beachten (Joyn pauschal und Prime-Kanal sind nur abgeleitet). ` +
        `Beachte dubAbgeleitet bzw. istLautAnbieter (shared/saison.ts) oder markiere mit „dub-lesart: <Grund>“. Die Grenze wird nicht angehoben.\n  ${stellen.join('\n  ')}`,
    )
    return 1
  }
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) process.exit(main())
