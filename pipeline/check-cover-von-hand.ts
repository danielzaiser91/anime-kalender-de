/**
 * Test von `lib/cover-von-hand.ts` und seiner Verdrahtung in `bau/cover-regel.ts` (`setzeCoverNachRegel`): Das Plakat eines Schwestertitels ist der letzte Rückfall.
 * Anlass 16.11.2026: Kitaro Shinsei-ban (10019697) stand nach PR 3954 ohne Bild im Kalender. Kulisse in einem Wegwerf-Ordner über `AK_ROOT`, kein Echtdatenzugriff.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { coverVonHand } from './lib/cover-von-hand.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TMDB = 'https://image.tmdb.org/t/p/w500'
const plakate = { '130622': { p: '/orig.jpg' }, '55': null, '56': { p: '' } }
const hand = { '10019697': 130622, '77': 55, '78': 56, '88': 999 }
pruefe('Plakat des benannten Titels', coverVonHand(10019697, hand, plakate) === `${TMDB}/orig.jpg`, coverVonHand(10019697, hand, plakate))
pruefe('kein Eintrag: kein Cover', coverVonHand(130622, hand, plakate) === undefined)
pruefe('Spender ohne Plakat (null): kein Cover', coverVonHand(77, hand, plakate) === undefined)
pruefe('Spender mit leerem Pfad: kein Cover', coverVonHand(78, hand, plakate) === undefined)
pruefe('Spender fehlt in den Plakaten: kein Cover', coverVonHand(88, hand, plakate) === undefined)
pruefe('leere Handliste: kein Cover', coverVonHand(10019697, {}, plakate) === undefined)

// Verdrahtung: setzeCoverNachRegel im Kindprozess gegen eine Kulisse (Mutant „Aufruf in coverFuer entfernt“ muss rot werden).
const wurzel = mkdtempSync(join(tmpdir(), 'cover-von-hand-'))
mkdirSync(join(wurzel, 'data'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'tmdb-poster.json'), JSON.stringify({ '130622': { p: '/orig.jpg' }, '55': null }))
writeFileSync(
  join(wurzel, 'data', 'cover-von-hand.yaml'),
  ['- id: 10019697', '  plakatVon: 130622', '  grund: Neufassung', '- id: 77', '  plakatVon: 55', '  grund: Spender ohne Plakat', '- id: 5', '  plakatVon: 130622', '  grund: hat schon AniList-Cover', ''].join('\n'),
)
const kind = `
import { setzeCoverNachRegel } from ${JSON.stringify(new URL('./bau/cover-regel.ts', import.meta.url).href)}
const t = (id, coverImage) => [id, { id, coverImage }]
const titel = new Map([t(130622), t(10019697), t(77), t(99), t(5, 'anilist.jpg')])
setzeCoverNachRegel(titel)
console.log('ERGEBNIS ' + JSON.stringify([...titel.values()].map((x) => [x.id, x.coverImage ?? null])))
`
const lauf = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', kind], { encoding: 'utf8', windowsHide: true, timeout: 60000, env: { ...process.env, AK_ROOT: wurzel } })
const zeile = lauf.stdout.split('\n').find((z) => z.startsWith('ERGEBNIS '))
const ergebnis = new Map<number, string | null>(zeile ? (JSON.parse(zeile.slice(9)) as [number, string | null][]) : [])
pruefe('Kindprozess lief bis zum Ende (Exit 0, Ergebniszeile)', lauf.status === 0 && Boolean(zeile), { status: lauf.status, err: lauf.stderr.slice(0, 300) })
pruefe('Kitaro Shinsei-ban bekommt das Plakat des Originals', ergebnis.get(10019697) === `${TMDB}/orig.jpg`, ergebnis.get(10019697))
pruefe('das Original behält sein Plakat', ergebnis.get(130622) === `${TMDB}/orig.jpg`, ergebnis.get(130622))
pruefe('Eintrag mit Spender ohne Plakat bleibt ohne Cover', ergebnis.get(77) === null, ergebnis.get(77))
pruefe('Titel ohne Eintrag bleibt ohne Cover', ergebnis.get(99) === null, ergebnis.get(99))
pruefe('eigenes AniList-Cover schlägt den Rückfall', ergebnis.get(5) === 'anilist.jpg', ergebnis.get(5))

if (verletzt) {
  console.error(`check-cover-von-hand: ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('check-cover-von-hand: alle Zusicherungen halten (6 Logik-, 6 Verdrahtungsfälle)')
