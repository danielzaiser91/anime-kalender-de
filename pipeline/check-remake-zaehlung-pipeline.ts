/**
 * Zusicherung: **Die Zähler der Pipeline zählen eine Neuverfilmung wie das Panel** (`staffelDesTitels` für Widerlegung und Katalog,
 * `staffelNummer` für Disc-Verschiebungen). Anlass: Yaiba 2025 ist Staffel 1 der eigenen Linie, die Pipeline zählte sie als Staffel 2
 * der Reihe (03.11.2026). Fall: Yaiba wörtlich aus `franchises.json` (Kennung 177476, Stand 26.10.2026); die Neuverfilmung kommt über
 * einen Handeintrag in `remakeQuellen`, damit der Test keine Datei liest.
 */
import type { Title } from '../shared/types.ts'
import { staffelDesTitels } from './bau/widerlegung-staffel.ts'
import { remakeVonDerReihe } from './bau/remake-von.ts'
import { reihenIndex, staffelNummer } from './lib/disc-verschiebungen-staffel.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, titleDe: string, jpStart: string, mehr: Partial<Title> = {}): Title =>
  ({ id, titleDe, titleEn: titleDe, format: 'TV', jpYear: Number(jpStart.slice(0, 4)), jpStart, episodes: 24, franchiseId: 2335, streams: [], ...mehr }) as unknown as Title

const YAIBA = [
  titel(180000, 'Kenyuu Densetsu YAIBA (Mikoukai Pilot)', '1991', { format: 'OVA', episodes: 1 }),
  titel(2335, 'Legendary Brave Swordsman Yaiba', '1993-04-09', { episodes: 52 }),
  titel(177476, 'Yaiba: Samurai Legend', '2025-04-05'),
  titel(199337, 'Shin Samurai-den YAIBA 2', '2027-01-09', { episodes: undefined }),
]
const MIT = { kanten: [], hand: [{ remake: 177476, original: 2335, grund: 'Test', quelle: 'https://example.org/' }] }
const OHNE = { kanten: [], hand: [] }

console.log('\nstaffelDesTitels (Widerlegung, Katalog):')
const nr = (id: number, q: typeof MIT) => staffelDesTitels(YAIBA.find((t) => t.id === id)!, YAIBA, q)
pruefe('ohne Neuverfilmung zählt 2025 als Staffel 2 (der alte Fehler)', nr(177476, OHNE) === 2, nr(177476, OHNE))
pruefe('Neuverfilmung 2025 ist Staffel 1', nr(177476, MIT) === 1, nr(177476, MIT))
pruefe('Fortsetzung 2027 ist Staffel 2', nr(199337, MIT) === 2, nr(199337, MIT))
pruefe('das Original ist einzige Staffel seiner Linie: Staffel 1 (wie vorher)', nr(2335, MIT) === 1, nr(2335, MIT))

console.log('\nstaffelNummer (Disc-Verschiebungen):')
const reihen = reihenIndex(YAIBA)
const dn = (id: number, q: typeof MIT) => staffelNummer(YAIBA.find((t) => t.id === id)!, reihen, q)
pruefe('ohne Neuverfilmung ist 2025 Staffel 2', dn(177476, OHNE) === 2, dn(177476, OHNE))
pruefe('Neuverfilmung 2025 allein in ihrer Gruppe (Fortsetzung ohne Folgenzahl): keine Nummer, nicht Staffel 2', dn(177476, MIT) === undefined, dn(177476, MIT))
pruefe('Fortsetzung 2027 (ohne Folgenzahl, nicht gezählt) bleibt ohne Nummer', dn(199337, MIT) === undefined, dn(199337, MIT))
pruefe('Original ist einzige Staffel seiner Linie: Staffel 1 (wie vorher)', dn(2335, MIT) === 1, dn(2335, MIT))

const mitFolgen = YAIBA.map((t) => (t.id === 199337 ? { ...t, episodes: 24 } : t))
const dn1 = staffelNummer(mitFolgen.find((t) => t.id === 177476)!, reihenIndex(mitFolgen), MIT)
pruefe('Neuverfilmung 2025 ist mit gezählter Fortsetzung Staffel 1', dn1 === 1, dn1)
const dn2 = staffelNummer(mitFolgen.find((t) => t.id === 199337)!, reihenIndex(mitFolgen), MIT)
pruefe('Fortsetzung 2027 mit Folgenzahl ist Staffel 2', dn2 === 2, dn2)

console.log('\nNeuverfilmung ohne Fortsetzung (Anne Shirley 2025, Reihe 283):')
const ANNE = [titel(283, 'Anne mit den roten Haaren', '1979-01-07', { franchiseId: 283, episodes: 50 }), titel(184639, 'Anne Shirley', '2025-04-05', { franchiseId: 283 })]
const anneQ = { kanten: [], hand: [{ remake: 184639, original: 283, grund: 'Test', quelle: 'https://example.org/' }] }
const anneNr = (id: number, q: typeof MIT) => [staffelDesTitels(ANNE.find((t) => t.id === id)!, ANNE, q), staffelNummer(ANNE.find((t) => t.id === id)!, reihenIndex(ANNE), q)]
pruefe('ohne Markierung: Anne Shirley 2025 gilt als Staffel 2', JSON.stringify(anneNr(184639, OHNE)) === '[2,2]', anneNr(184639, OHNE))
pruefe('mit Markierung: Anne Shirley 2025 ist Staffel 1 der eigenen Linie', JSON.stringify(anneNr(184639, anneQ)) === '[1,1]', anneNr(184639, anneQ))
pruefe('mit Markierung: das Original bleibt Staffel 1', JSON.stringify(anneNr(283, anneQ)) === '[1,1]', anneNr(283, anneQ))
const reiheOhne = [titel(500, 'Einzel', '2000-01-01', { franchiseId: 500 })]
pruefe('Reihe ohne Neuverfilmung und mit einer Staffel bleibt ohne Nummer', staffelDesTitels(reiheOhne[0]!, reiheOhne, OHNE) === undefined)

console.log('\nPaar wird verworfen (Film als Original, Original später):')
const REIHE = [
  titel(702, 'Alt Film', '1990-01-01', { franchiseId: 700, format: 'MOVIE', episodes: 1 }),
  titel(700, 'Alt Serie', '2000-01-01', { franchiseId: 700 }),
  titel(701, 'Neu Serie', '2010-01-01', { franchiseId: 700 }),
]
const paarQ = (remake: number, original: number) => ({ kanten: [], hand: [{ remake, original, grund: 'Test', quelle: 'https://example.org/' }] })
const zaehlung = (q: typeof MIT) => REIHE.map((t) => [staffelDesTitels(t, REIHE, q), staffelNummer(t, reihenIndex(REIHE), q)])
const ohneMarke = JSON.stringify(zaehlung(OHNE))
const filmPaar = [...remakeVonDerReihe(REIHE, paarQ(701, 702))]
const spaetPaar = [...remakeVonDerReihe(REIHE, paarQ(700, 701))]
pruefe('Original ist ein Film: Paar verworfen, keine Neuverfilmung', filmPaar.length === 0, filmPaar)
pruefe('Original ist ein Film: Zählung wie ohne Markierung', JSON.stringify(zaehlung(paarQ(701, 702))) === ohneMarke, zaehlung(paarQ(701, 702)))
pruefe('Original startet später: Paar verworfen', spaetPaar.length === 0, spaetPaar)
pruefe('Original startet später: Zählung wie ohne Markierung', JSON.stringify(zaehlung(paarQ(700, 701))) === ohneMarke, zaehlung(paarQ(700, 701)))
pruefe('Gegenprobe: gültiges Paar (Serie 2010 von Serie 2000) bleibt', remakeVonDerReihe(REIHE, paarQ(701, 700)).get(701) === 700)

console.log(`\nremake-zaehlung-pipeline: ${verletzt ? `${verletzt} verletzt` : 'alle Fälle ok'}`)
process.exit(verletzt ? 1 : 0)
