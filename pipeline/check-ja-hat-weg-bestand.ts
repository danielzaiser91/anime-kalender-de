/**
 * Zusicherung am gebauten Bestand: Jeder Titel mit gemessenem Ja (Handbeleg `dub: true`) hat mindestens einen Weg (`streams` oder `watchLinks`).
 * Anlass 18.10.2026: Hazbin Hotel und fünf weitere Cartoons, bei denen ein Nein zu einer anderen Prime-Ausgabe den Weg der Ja-Ausgabe löschte
 * (`bau/cartoon-belege.ts`). Die Regel selbst und ihre Fälle prüft `check-ja-hat-weg.ts` in check:logic; dieser Lauf misst sie an den echten Daten.
 *
 * Aufruf: npx tsx pipeline/check-ja-hat-weg-bestand.ts
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ladeHandbelege } from './lib/dub-confirmed.ts'
import { bestandsFehler, type WegTitel } from './lib/ja-hat-weg.ts'
import { readJson, ROOT } from './lib/util.ts'

/** Titelkennung → Grund. Nur belegt Unvermeidbares (der Weg ist nachweislich nicht zu führen); Stand 19.10.2026: keine. */
export const AUSNAHMEN: ReadonlyMap<number, string> = new Map()

const lies = (datei: string): WegTitel[] => {
  const roh = readJson<WegTitel[] | { titles: WegTitel[] }>(resolve(ROOT, 'public/data', datei), [])
  return Array.isArray(roh) ? roh : roh.titles
}

function main(): number {
  const titel = ['titles.json', 'cartoons.json', 'ohne-synchro.json'].flatMap(lies)
  const belege = ladeHandbelege()
  const fehler = bestandsFehler(titel, belege, AUSNAHMEN)
  if (fehler.length) {
    for (const zeile of fehler) console.error(zeile)
    return 1
  }
  console.log(`✓ Gemessenes Ja ⇒ mindestens ein Weg: ${titel.length} Titel im Datensatz, keiner ohne Weg.`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
