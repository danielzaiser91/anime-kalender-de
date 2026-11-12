/**
 * Zusicherungen zur Quote der Folgentitel aus der TMDB-Containerstaffel (`lib/folgentitel-staffel-quote.ts`, `lib/folgentitel-staffel-quote-bestand.ts`):
 * Herkunft „TMDB-Staffel" erkannt, Warnung bei weniger als der Hälfte der Folgen mit Titel und bei doppelten Titeln, nie ein Fehler.
 * Die Verdrahtung im Tor prüft `check-folgentitel-luecke-lauf.ts`. Aufruf: `npm run check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { TmdbEintrag, TmdbFolge } from './bau/folgentitel-tmdb.ts'
import { quoteGruende, staffelQuote, type StaffelQuote } from './lib/folgentitel-staffel-quote.ts'
import { pruefeStaffelQuote, quoteZeilen, staffelQuoten } from './lib/folgentitel-staffel-quote-bestand.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const NAME = 'Beispiel - Geschichten von Heldin und Kater'
/** Staffel `s` mit `n` Folgen; `ohne` sind bei TMDB nicht übersetzt (Titel gleich dem englischen), `gleich` tragen denselben Titel wie Folge 1. */
const staffel = (s: number, n: number, ohne: number[] = [], gleich: number[] = []): TmdbFolge[] =>
  Array.from({ length: n }, (_, i) => {
    const e = i + 1
    const en = `English ${s}-${e}`
    return { s, e, titel: ohne.includes(e) ? en : gleich.includes(e) ? ' s2e1 ' : `S${s}E${e}`, en, datum: `2017-0${1 + (i % 9)}-15` }
  })
const eintrag = (folgen: TmdbFolge[]): TmdbEintrag => ({ nameDe: NAME, folgen: [...staffel(1, 26), ...folgen] })
const titel = (id: number, n: number, folgen: number): Title =>
  ({ id, franchiseId: 900001, format: 'TV', episodes: folgen, titleDe: `Beispiel: Geschichten von Heldin und Kater Staffel ${n}`, streams: [] }) as unknown as Title
const datei = (nr: number, titelVon: (nr: number) => string) => ({ f: Array.from({ length: nr }, (_, i) => [i + 1, titelVon(i + 1)] as const), de: [[1, nr]] as const })
const voll = (nr: number) => `S2E${nr}`
const q = (titel: number, folgen: number, doppelt: string[] = []): StaffelQuote => ({ titel, folgen, doppelt })

console.log('\nStaffel-Quote: Herkunft und Zählung (staffelQuote)')
const s2 = titel(900012, 2, 25)
const ganz = staffelQuote(s2, eintrag(staffel(2, 25)), datei(25, voll))
pruefe('Folgendatei trägt die TMDB-Titel: Quote 25 von 25, keine doppelten', ganz?.titel === 25 && ganz.folgen === 25 && ganz.doppelt.length === 0, ganz)
const luecke = staffelQuote(s2, eintrag(staffel(2, 25, [3, 4, 5])), datei(25, (nr) => (nr >= 3 && nr <= 5 ? '' : voll(nr))))
pruefe('drei Folgen bei TMDB unübersetzt, in der Datei leer: Quote 22 von 25', luecke?.titel === 22 && luecke.folgen === 25, luecke)
pruefe('Titel ohne Folgendatei zählt nicht', staffelQuote(s2, eintrag(staffel(2, 25)), undefined) === undefined)
pruefe('Titel ohne Staffelzusatz zählt nicht', staffelQuote({ ...s2, titleDe: 'Beispiel: Geschichten von Heldin und Kater' } as Title, eintrag(staffel(2, 25)), datei(25, voll)) === undefined)
pruefe('ohne Franchise-Eintrag zählt der Titel nicht', staffelQuote(s2, undefined, datei(25, voll)) === undefined)
pruefe('Folgendatei mit anderem Wortlaut (andere Stufe, z. B. Crunchyroll): nicht „TMDB-Staffel"', staffelQuote(s2, eintrag(staffel(2, 25)), datei(25, (nr) => `Anderer Titel ${nr}`)) === undefined)
pruefe('ein einziger abweichender Titel genügt, die Herkunft zu verneinen', staffelQuote(s2, eintrag(staffel(2, 25)), datei(25, (nr) => (nr === 9 ? 'Abweichend' : voll(nr)))) === undefined)
const doppeltQ = staffelQuote(s2, eintrag(staffel(2, 25, [], [1, 2])), datei(25, (nr) => (nr <= 2 ? 's2e1' : voll(nr))))
pruefe('derselbe Titel zweimal: doppelt = [s2e1], Titel 25', doppeltQ?.doppelt.length === 1 && doppeltQ.doppelt[0] === 's2e1' && doppeltQ.titel === 25, doppeltQ)
const dreifach = staffelQuote(s2, eintrag(staffel(2, 25, [], [1, 2, 3])), datei(25, (nr) => (nr <= 3 ? 's2e1' : voll(nr))))
pruefe('derselbe Titel dreimal steht nur einmal in der Liste', dreifach?.doppelt.length === 1, dreifach)
/* Nummer 3 hat bei TMDB keinen echten Titel; ihn trägt die Datei aus einer späteren Stufe, in anderer Schreibweise als Folge 1 („S2E1"). */
const ohne3 = eintrag(staffel(2, 25, [3]))
const klein = staffelQuote(s2, ohne3, datei(25, (nr) => (nr === 3 ? 's2e1' : voll(nr))))
pruefe('Groß-/Kleinschreibung zählt nicht: „S2E1“ und „s2e1“ sind doppelt', klein?.doppelt.join('|') === 's2e1' && klein.titel === 25, klein)
const rand = staffelQuote(s2, ohne3, datei(25, (nr) => (nr === 3 ? ' S2E1 ' : voll(nr))))
pruefe('Randleerraum zählt nicht: „ S2E1 “ und „S2E1“ sind doppelt', rand?.doppelt.join('|') === 's2e1' && rand.titel === 25, rand)
pruefe('verschiedene Titel (Folge 3 „S2E3 neu“) sind nicht doppelt', staffelQuote(s2, ohne3, datei(25, (nr) => (nr === 3 ? 'S2E3 neu' : voll(nr))))?.doppelt.length === 0)

console.log('\nStaffel-Quote: Gründe (quoteGruende)')
pruefe('genau die Hälfte (3 von 6) ist keine Warnung', quoteGruende(q(3, 6)).length === 0, quoteGruende(q(3, 6)))
pruefe('knapp unter der Hälfte (2 von 6) warnt mit „2 von 6“', quoteGruende(q(2, 6)).join('|') === 'nur 2 von 6 Folgen mit Titel', quoteGruende(q(2, 6)))
pruefe('13 von 25 reicht, 12 von 25 warnt', quoteGruende(q(13, 25)).length === 0 && quoteGruende(q(12, 25)).length === 1)
pruefe('alle Folgen mit Titel und nichts doppelt: keine Gründe', quoteGruende(q(25, 25)).length === 0)
pruefe('doppelter Titel warnt bei voller Quote, mit dem Titel im Text', quoteGruende(q(25, 25, ['s2e1'])).join('|') === 'doppelte Titel: s2e1', quoteGruende(q(25, 25, ['s2e1'])))
pruefe('niedrige Quote und doppelter Titel nennen beide Gründe', quoteGruende(q(2, 25, ['x'])).length === 2)

console.log('\nStaffel-Quote: Auswahl und Zeilen (staffelQuoten, quoteZeilen)')
const fremd = { ...titel(900099, 2, 25), franchiseId: 900077 } as Title
const dateien: Record<number, ReturnType<typeof datei>> = { 900012: datei(25, voll), 900013: datei(26, (nr) => `S3E${nr}`), 900099: datei(25, voll) }
const treffer = staffelQuoten([s2, titel(900013, 3, 26), fremd, titel(900014, 4, 26)], { 900001: eintrag([...staffel(2, 25), ...staffel(3, 26)]) }, (id) => dateien[id])
pruefe('nur Titel mit TMDB-Eintrag ihrer Franchise und Folgendatei kommen vor (900012, 900013; nicht fremde Franchise 900099, nicht ohne Datei 900014)', treffer.map(([t]) => t.id).join(',') === '900012,900013', treffer.map(([t]) => t.id))
const zeilen = quoteZeilen([[s2, q(25, 25)], [titel(900013, 3, 26), q(10, 26)]])
pruefe('volle Quote: ✓-Zeile mit Kennung, Titel und Zahl, ohne Warnung', zeilen[0].startsWith('  ✓ Folgentitel TMDB-Staffel: 900012 (') && zeilen[0].includes('25 von 25 Folgen mit Titel') && !zeilen[0].includes('WARNUNG'), zeilen[0])
pruefe('niedrige Quote: Warnzeile mit „⚠ WARNUNG“ und Grund', zeilen[1].includes('⚠ WARNUNG Folgentitel TMDB-Staffel: 900013') && zeilen[1].includes('nur 10 von 26 Folgen mit Titel'), zeilen[1])
pruefe('Schlusszeile zählt Titel und Warnungen getrennt (2 Titel, 1 mit Warnung)', zeilen[2].includes('2 Titel, 1 mit Warnung'), zeilen[2])
pruefe('ohne Treffer nur die Schlusszeile mit 0 und 0', quoteZeilen([]).join('|') === '  Folgentitel TMDB-Staffel: 0 Titel, 0 mit Warnung')

console.log('\nStaffel-Quote: Tor-Funktion auf einer Wegwerf-Wurzel (pruefeStaffelQuote)')
const wurzel = mkdtempSync(join(tmpdir(), 'folgentitel-staffel-quote-'))
const schreibe = (pfad: string[], inhalt: unknown): void => {
  mkdirSync(join(wurzel, ...pfad.slice(0, -1)), { recursive: true })
  writeFileSync(join(wurzel, ...pfad), JSON.stringify(inhalt))
}
function mitAusgabe(f: () => number): { rueck: number; aus: string; fehler: string } {
  const log = console.log
  const err = console.error
  let aus = ''
  let fehler = ''
  console.log = (...a: unknown[]) => void (aus += `${a.join(' ')}\n`)
  console.error = (...a: unknown[]) => void (fehler += `${a.join(' ')}\n`)
  try {
    return { rueck: f(), aus, fehler }
  } finally {
    console.log = log
    console.error = err
  }
}
try {
  schreibe(['data', 'tmdb-folgen.json'], { 900001: eintrag(staffel(2, 25, Array.from({ length: 15 }, (_, i) => i + 1))) })
  const ohneTitles = mitAusgabe(() => pruefeStaffelQuote(wurzel))
  pruefe('ohne titles.json: Rückgabe 1 und Fehlerzeile', ohneTitles.rueck === 1 && ohneTitles.fehler.includes('titles.json fehlt'), ohneTitles)
  schreibe(['public', 'data', 'titles.json'], [s2])
  const ohneDatei = mitAusgabe(() => pruefeStaffelQuote(wurzel))
  pruefe('Titel ohne Folgendatei: Rückgabe 0, 0 Titel', ohneDatei.rueck === 0 && ohneDatei.aus.includes('0 Titel, 0 mit Warnung'), ohneDatei)
  schreibe(['public', 'data', 'folgen', '900012.json'], datei(25, (nr) => (nr <= 15 ? '' : voll(nr))))
  const knapp = mitAusgabe(() => pruefeStaffelQuote(wurzel))
  pruefe('10 von 25 Titeln aus der Containerstaffel: Rückgabe 0 (nie Fehler) und Warnzeile', knapp.rueck === 0 && knapp.aus.includes('⚠ WARNUNG Folgentitel TMDB-Staffel: 900012') && knapp.aus.includes('nur 10 von 25'), knapp)
  schreibe(['data', 'tmdb-folgen.json'], { 900001: eintrag(staffel(2, 25)) })
  schreibe(['public', 'data', 'folgen', '900012.json'], datei(25, voll))
  const gut = mitAusgabe(() => pruefeStaffelQuote(wurzel))
  pruefe('volle Staffel: Rückgabe 0, ✓-Zeile ohne Warnung', gut.rueck === 0 && gut.aus.includes('✓ Folgentitel TMDB-Staffel: 900012') && !gut.aus.includes('WARNUNG'), gut)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nFolgentitel TMDB-Staffel-Quote: alle Zusicherungen erfüllt (${faelle} Fälle).`)
