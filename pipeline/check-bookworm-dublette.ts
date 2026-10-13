/**
 * Zusicherung: Ascendance of a Bookworm Staffel 5 steht nur einmal da (PR 856/861, Daniel 11.10.2026). Die aniSearch-Zeile 22017 (Titel 10022017)
 * ist in den AniList-Titel 217712 aufgegangen; ihre öffentliche Kennung 26256 leitet auf die des AniList-Titels (17943) um, sonst läuft
 * `/#/datenbank?t=26256` ins Leere. Der gebaute Bestand dazu: `check-bookworm-dublette-bestand.ts` (`check:bestand`).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-bookworm-dublette.ts`
 */
import { readFileSync } from 'node:fs'
import { ladeAkVon, umleitungen } from './lib/ausgabe-kennung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nBookworm Staffel 5: eine Zeile, alte Kennung leitet um:')
{
  const { akVon, zeilen } = ladeAkVon('data/kennungen.json')
  const zeile = zeilen.find((z) => z[2] === 22017 && z[1] === 10_022_017)
  const ziel = zeilen.find((z) => z[1] === 217_712)
  pruefe('Handdatei bindet AniList 217712 an aniSearch 22017 (die Zeile entfällt)', /^217712:\s*22017\b/m.test(readFileSync('data/anisearch-ids-hand.yaml', 'utf8')))
  pruefe('Kennung 26256 (Zeile 10022017) trägt als Nachfolger die ak des AniList-Titels 217712', zeile?.[0] === 26256 && ziel !== undefined && zeile[3] === ziel[0], [zeile, ziel])
  pruefe('Der Nachfolger ist kein Zwischenglied und trägt dieselbe aniSearch-Kennung', ziel?.[3] === undefined && ziel?.[2] === 22017, ziel)
  pruefe('akVon der Zeile ist die ak des AniList-Titels (die Ausgabe nennt nie 26256)', akVon(10_022_017) === akVon(217_712) && akVon(217_712) !== 26256)
  pruefe('ak-umleitung.json führt 26256 auf den Nachfolger', umleitungen(zeilen).some(([alt, neu]) => alt === 26256 && neu === ziel?.[0]))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
