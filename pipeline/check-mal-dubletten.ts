/**
 * Zusicherung: Die vier MAL-Dubletten (Psyren, Beerus, Hyouken II, Fool Night; Befund 08.10.2026) lösen sich über die Handbindung auf:
 * AniList-Titel im Bestand → die aniSearch-Zeile entfällt, fehlt er, bleibt sie. Läuft auf einer Kulisse im Temp-Ordner (`AK_ROOT`,
 * `lib/kulisse-mal-dubletten.ts`); dieselben Zeilen im echten Bestand prüft `check-mal-dubletten-bestand.ts` (`check:bestand`).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-mal-dubletten.ts`
 */
import { DUBLETTEN as dubletten } from './lib/kulisse-mal-dubletten.ts'
import type { Title } from '../shared/types.ts'
import { anisearchUmgezogen, ergaenzeAnisearchTitel } from './bau/anisearch-titel.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nMAL-Dubletten (Kulisse):')
{
  const ohne = new Map<number, Title>()
  ergaenzeAnisearchTitel(ohne, new Map(), new Map())
  pruefe('fehlt der AniList-Titel, bleibt die aniSearch-Zeile (kein Werk geht verloren)', dubletten.every(([, as]) => ohne.has(10_000_000 + as)))
  pruefe('eine Zeile ohne Handbindung bleibt', ohne.has(10_021_900))
  const mit = new Map<number, Title>(dubletten.map(([al]) => [al, { id: al, streams: [] } as unknown as Title]))
  ergaenzeAnisearchTitel(mit, new Map(), new Map())
  pruefe('steht der AniList-Titel im Bestand, entfällt die aniSearch-Zeile', dubletten.every(([, as]) => !mit.has(10_000_000 + as)))
  pruefe('… und die Zeile ohne Handbindung bleibt auch dann', mit.has(10_021_900))
  pruefe('Psyren (aniSearch: Dub geplant, seit 11.10.2026 ohne deutsches Datum), Beerus und Fool Night (kein Deutsch) bekommen keine Erstausgabe', !mit.get(204011)!.deErstausgabe && !mit.get(206814)!.deErstausgabe && !mit.get(213457)!.deErstausgabe)
  const kette = anisearchUmgezogen(new Set([204011]), new Set(), undefined, undefined)
  pruefe('die Handbindung zählt als Umzug (Verlust-Riegel des Baus)', kette.has(10_021_084))
  /* Hyouken II (aniSearch: Dub geplant): weder die aniSearch-Zeile noch der AniList-Titel trägt seit 11.10.2026 eine deutsche Erstausgabe aus dem Block (Psyren ist oben geprüft). */
  pruefe('Hyouken II übernimmt keine Erstausgabe aus dem Block mit Marke Geplant', !ohne.get(10_021_575)?.deErstausgabe && !mit.get(212503)!.deErstausgabe)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
