/**
 * Zusicherung: **Die Zähler der Pipeline zählen eine Neuverfilmung wie das Panel** (`staffelDesTitels` für Widerlegung und Katalog,
 * `staffelNummer` für Disc-Verschiebungen). Anlass: Yaiba 2025 ist Staffel 1 der eigenen Linie, die Pipeline zählte sie als Staffel 2
 * der Reihe (03.11.2026). Fall: Yaiba wörtlich aus `franchises.json` (Kennung 177476, Stand 26.10.2026); die Neuverfilmung kommt über
 * einen Handeintrag in `remakeQuellen`, damit der Test keine Datei liest.
 */
import type { Title } from '../shared/types.ts'
import { staffelDesTitels } from './bau/widerlegung-staffel.ts'
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
pruefe('das Original steht allein in seiner Gruppe: keine Nummer', nr(2335, MIT) === undefined, nr(2335, MIT))

console.log('\nstaffelNummer (Disc-Verschiebungen):')
const reihen = reihenIndex(YAIBA)
const dn = (id: number, q: typeof MIT) => staffelNummer(YAIBA.find((t) => t.id === id)!, reihen, q)
pruefe('ohne Neuverfilmung ist 2025 Staffel 2', dn(177476, OHNE) === 2, dn(177476, OHNE))
pruefe('Neuverfilmung 2025 allein in ihrer Gruppe (Fortsetzung ohne Folgenzahl): keine Nummer, nicht Staffel 2', dn(177476, MIT) === undefined, dn(177476, MIT))
pruefe('Fortsetzung 2027 (ohne Folgenzahl, nicht gezählt) bleibt ohne Nummer', dn(199337, MIT) === undefined, dn(199337, MIT))
pruefe('Original bleibt ohne Nummer (allein in der Gruppe)', dn(2335, MIT) === undefined, dn(2335, MIT))

const mitFolgen = YAIBA.map((t) => (t.id === 199337 ? { ...t, episodes: 24 } : t))
const dn1 = staffelNummer(mitFolgen.find((t) => t.id === 177476)!, reihenIndex(mitFolgen), MIT)
pruefe('Neuverfilmung 2025 ist mit gezählter Fortsetzung Staffel 1', dn1 === 1, dn1)
const dn2 = staffelNummer(mitFolgen.find((t) => t.id === 199337)!, reihenIndex(mitFolgen), MIT)
pruefe('Fortsetzung 2027 mit Folgenzahl ist Staffel 2', dn2 === 2, dn2)

console.log(`\nremake-zaehlung-pipeline: ${verletzt ? `${verletzt} verletzt` : 'alle Fälle ok'}`)
process.exit(verletzt ? 1 : 0)
