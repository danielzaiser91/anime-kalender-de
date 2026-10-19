/**
 * Zusicherung am gebauten Bestand: Jeder Titel mit gemessenem Ja (Handbeleg `dub: true`) hat mindestens einen Weg (`streams` oder `watchLinks`);
 * bei Cartoons hat jedes (Titel, Anbieter) mit Ja einen Weg dieses Anbieters mit Deutsch und der Adresse einer Ja-Zeile.
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

/** Eine fehlende oder leere Datei ist ein Fehler: sonst meldet der Lauf grün über einer leeren Liste. */
function lies(datei: string): WegTitel[] {
  const roh = readJson<unknown>(resolve(ROOT, 'public/data', datei), null)
  if (!Array.isArray(roh) || roh.length === 0) throw new Error(`public/data/${datei} fehlt, ist leer oder keine Liste`)
  return roh as WegTitel[]
}

function main(): number {
  try {
    const cartoons = lies('cartoons.json')
    const titel = ['titles.json', 'ohne-synchro.json'].flatMap(lies)
    const fehler = bestandsFehler(titel, cartoons, ladeHandbelege(), AUSNAHMEN)
    if (fehler.length) {
      for (const zeile of fehler) console.error(zeile)
      return 1
    }
    console.log(`✓ Gemessenes Ja ⇒ ein Weg: ${titel.length + cartoons.length} Titel im Datensatz, keiner ohne Weg (Cartoons je Anbieter).`)
    return 0
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`)
    return 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
