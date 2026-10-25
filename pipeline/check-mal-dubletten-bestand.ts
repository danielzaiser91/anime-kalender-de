/**
 * Zusicherung an den echten Dateien (`data/`): Die Ausnahmen der MAL-Dubletten sind aniSearch-Kennungen im Eintragsbestand, die alten
 * Slug-Kennungen automatischer Termine stehen in der Handdatei, und die vier Dubletten tragen in `data/kennungen.json` die ak ihres
 * AniList-Titels als Nachfolger. Die Regeln dazu laufen auf einer Kulisse in `check-mal-dubletten.ts` und `check-logic.ts`.
 * Läuft in `check:bestand`, nicht in `check:logic`: eine legitime Datenänderung darf die Logikprüfung nicht röten.
 */
import { readFileSync } from 'node:fs'
import { ladeAkVon } from './lib/ausgabe-kennung.ts'
import { MAL_AUSNAHMEN } from './lib/mal-dubletten.ts'
import { ALTE_AUTO_KENNUNG } from './lib/meldungen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const dubletten = [[204011, 21084], [206814, 21566], [212503, 21575], [213457, 21751]] as const

console.log('\nMAL-Dubletten in den echten Dateien:')
{
  const eintraege = JSON.parse(readFileSync('data/anisearch-eintraege.json', 'utf8')) as Record<string, { mal?: number }>
  pruefe('jede Ausnahme nennt ihren Grund, und die Kennungen der Ausnahmen sind aniSearch-Kennungen im Eintragsbestand', Object.entries(MAL_AUSNAHMEN).every(([id, g]) => g.length > 10 && id in eintraege))
  const handText = readFileSync('data/anisearch-ids-hand.yaml', 'utf8')
  pruefe(
    'jede alte Slug-Kennung automatischer Termine (ALTE_AUTO_KENNUNG) ist die aniSearch-Kennung, die die Handdatei an den AniList-Titel bindet',
    Object.entries(ALTE_AUTO_KENNUNG).every(([al, alt]) => new RegExp(`^${al}:\\s*${alt - 10_000_000}\\b`, 'm').test(handText)),
  )
  const { zeilen } = ladeAkVon('data/kennungen.json')
  const jeAnilist = new Map(zeilen.map((z) => [z[1], z]))
  pruefe('Kennung: die aniSearch-Zeile jeder Dublette hat die ak des AniList-Titels als Nachfolger (zuAk), und der Nachfolger ist kein Zwischenglied',
    dubletten.every(([al, as]) => {
      const alt = jeAnilist.get(10_000_000 + as)
      const ziel = jeAnilist.get(al)
      return alt !== undefined && ziel !== undefined && alt[3] === ziel[0] && ziel[3] === undefined
    }))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('\nOK')
console.log('VERSTÖSSE: 0')
