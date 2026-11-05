/**
 * Zusicherung: **Eine Staffelzählung für Kachel-Marke, Widerlegung/Katalog (`staffelDesTitels`) und Disc-Verschiebung (`staffelNummer`)**: Spin-offs
 * (`eigenesWerk`) zählen in keinem mit (Daniel, 04.11.2026; PR 2748 hat das Panel umgestellt). Fall: Konosuba, Namen und Starttage wörtlich aus
 * `franchises.json` (03.11.2026) — „An Explosion“ stand als Staffel 3 neben der echten Staffel 3. Dazu die Markierung (`markiereReihenteile`) und der
 * Spin-off-Verdacht. Der Bestandsteil (alle Titel, Pipeline gegen Marke) steht in `check-staffelzaehlung-bestand.ts`. Läuft in `check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { staffelMarken } from '../web/src/lib/db-staffel-marke.ts'
import { markiereReihenteile } from './bau/reihenteil-markierung.ts'
import { staffelDesTitels } from './bau/widerlegung-staffel.ts'
import { reihenIndex, staffelNummer } from './lib/disc-verschiebungen-staffel.ts'
import { spinoffVerdacht, spinoffVerdachtZeile } from './lib/spinoff-verdacht.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const OHNE_REMAKE = { kanten: [], hand: [] }
const titel = (id: number, name: string, jpStart: string, mehr: Partial<Title> = {}): Title =>
  ({ id, titleEn: name, format: 'TV', jpYear: Number(jpStart.slice(0, 4)), jpStart, episodes: 12, franchiseId: 21202, streams: [], ...mehr }) as unknown as Title
const kopie = (liste: Title[]): Title[] => JSON.parse(JSON.stringify(liste)) as Title[]

const KONOSUBA_NAME = 'Konosuba: God’s Blessing on This Wonderful World!'
const KONOSUBA = (): Title[] => [
  titel(21202, KONOSUBA_NAME, '2016-01-14', { episodes: 10 }),
  titel(21699, 'KonoSuba: God’s Blessing on This Wonderful World! 2', '2017-01-12', { episodes: 10 }),
  titel(150075, 'Konosuba: An Explosion on This Wonderful World!', '2023-04-06'),
  titel(136804, 'KonoSuba: God’s Blessing on This Wonderful World! 3', '2024-04-10', { episodes: 11 }),
  titel(187924, 'KonoSuba: God’s Blessing on This Wonderful World! Season 4', '2027', { episodes: undefined }),
]
const EXPLOSION = 150075
const STAFFEL_3 = 136804
const ELTERN = new Map<number, number[]>([[EXPLOSION, [21202]]])
const markiert = (): Title[] => {
  const reihe = KONOSUBA()
  markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), ELTERN, new Set([EXPLOSION]))
  return reihe
}
const nummern = (reihe: Title[]) => Object.fromEntries(reihe.map((t) => [t.id, staffelDesTitels(t, reihe, OHNE_REMAKE) ?? null]))
const discNummern = (reihe: Title[]) => Object.fromEntries(reihe.map((t) => [t.id, staffelNummer(t, reihenIndex(reihe), OHNE_REMAKE) ?? null]))
const markenNummern = (reihe: Title[]) =>
  Object.fromEntries(reihe.map((t) => [t.id, /^Staffel (\d+)$/.exec(staffelMarken(reihe).get(t.id) ?? '')?.[1] ?? null]).map(([id, n]) => [id, n === null ? null : Number(n)]))

console.log('\nMarkierung (markiereReihenteile):')
{
  const reihe = [titel(1, 'Hauptserie', '2010-01-01'), titel(2, 'Hauptserie Extra', '2011-01-01'), titel(3, 'Fremde Serie', '2012-01-01', { franchiseId: 99 }), titel(4, 'Ohne Reihe', '2013-01-01', { franchiseId: undefined })]
  const eltern = new Map<number, number[]>([[2, [1]], [3, [1]], [4, [1]]])
  const z = markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), eltern, new Set([1, 4]))
  pruefe('Elternkante auf einen Teil derselben Reihe: Beiwerk', reihe[1]!.beiwerk === true)
  pruefe('Elternkante auf eine fremde Reihe: kein Beiwerk', reihe[2]!.beiwerk === undefined)
  pruefe('Titel ohne Reihe bleibt unmarkiert, auch in der Handliste', reihe[3]!.beiwerk === undefined && reihe[3]!.eigenesWerk === undefined)
  pruefe('Handliste: eigenes Werk', reihe[0]!.eigenesWerk === true && reihe[1]!.eigenesWerk === undefined)
  pruefe('Zähler: 1 Beiwerk, 1 eigenes Werk', z.beiwerk === 1 && z.eigenesWerk === 1, z)
  const zweiter = markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), eltern, new Set([1, 4]))
  pruefe('Zweiter Lauf ändert nichts', zweiter.beiwerk === 1 && zweiter.eigenesWerk === 1, zweiter)
  pruefe('Ohne Elternkanten und Handliste bleibt alles unmarkiert', markiereReihenteile(new Map([[9, titel(9, 'Allein', '2020-01-01')]]), new Map(), new Set()).beiwerk === 0)
}

console.log('\nKonosuba: alle drei Zähler lassen das Spin-off aus:')
{
  const reihe = markiert()
  const erwartet = { 21202: 1, 21699: 2, [EXPLOSION]: null, [STAFFEL_3]: 3, 187924: 4 }
  pruefe('staffelDesTitels (Widerlegung, Katalog)', JSON.stringify(nummern(reihe)) === JSON.stringify(erwartet), nummern(reihe))
  pruefe('staffelNummer (Disc-Verschiebung; Staffel 4 ohne Folgenzahl zählt dort nie)', JSON.stringify(discNummern(reihe)) === JSON.stringify({ ...erwartet, 187924: null }), discNummern(reihe))
  pruefe('Kachel-Marke (staffelMarken) nennt dieselben Nummern', JSON.stringify(markenNummern(reihe)) === JSON.stringify(erwartet), markenNummern(reihe))
  const ohne = kopie(KONOSUBA())
  pruefe('Kontrolle: ohne Markierung zählt das Spin-off als Staffel 3 und die echte Staffel 3 als 4', nummern(ohne)[EXPLOSION] === 3 && nummern(ohne)[STAFFEL_3] === 4, nummern(ohne))
}

console.log('\nBeiwerk-ONA zählt nicht mit (hauptstaffeln):')
{
  const reihe = [titel(1, 'Serie', '2020-01-01'), titel(2, 'Serie 2', '2021-01-01'), titel(3, 'Serie Gaiden', '2021-06-01', { format: 'ONA', episodes: 12 }), titel(4, 'Serie 3', '2022-01-01')]
  markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), new Map([[3, [1]]]), new Set())
  pruefe('Das Beiwerk-ONA hat keine Nummer, Staffel 3 bleibt 3', nummern(reihe)[3] === null && nummern(reihe)[4] === 3, nummern(reihe))
  const letztes = [titel(1, 'Serie', '2020-01-01'), titel(2, 'Serie 2', '2021-01-01'), titel(3, 'Serie Gaiden', '2022-01-01', { format: 'ONA', episodes: 12 })]
  markiereReihenteile(new Map(letztes.map((t) => [t.id, t])), new Map([[3, [1]]]), new Set())
  pruefe('Disc: das letzte Beiwerk-ONA bekommt keine Nummer, Staffel 2 bleibt 2', discNummern(letztes)[3] === null && discNummern(letztes)[2] === 2, discNummern(letztes))
}

console.log('\nSpin-off-Verdacht:')
{
  const reihe = [
    titel(1, 'Welt', '2010-01-01'),
    titel(2, 'Welt Season 2', '2011-01-01'),
    titel(3, 'Welt: Nebenschauplatz', '2012-01-01'),
    titel(4, 'Welt Season 3', '2013-01-01'),
    titel(5, 'Welt: Eigenes Werk', '2014-01-01'),
    titel(6, 'Welt: Ohne Eltern', '2015-01-01'),
  ]
  markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), new Map([[3, [1]], [4, [1]], [5, [1]]]), new Set([5]))
  const verdacht = spinoffVerdacht(reihe).map((t) => t.id)
  pruefe('Beiwerk-Serie mit eigenem Namen steht im Verdacht, nicht die mit Staffelnummer, nicht das eigene Werk, nicht die ohne Elternkante', JSON.stringify(verdacht) === '[3]', verdacht)
  const zeile = spinoffVerdachtZeile(spinoffVerdacht(reihe))
  pruefe('Eine Warnzeile mit Marke und Anzahl', zeile.length === 1 && zeile[0]!.includes('⚠ WARNUNG') && zeile[0]!.includes('1 Titel') && zeile[0]!.includes('Welt: Nebenschauplatz (3)'), zeile)
  pruefe('Ohne Verdacht keine Zeile', spinoffVerdachtZeile([]).length === 0)
  pruefe('Reihe ohne Beiwerk: kein Verdacht', spinoffVerdacht(kopie(KONOSUBA())).length === 0)
  pruefe('Konosuba markiert: das Handlisten-Spin-off ist aus dem Verdacht', spinoffVerdacht(markiert()).length === 0)
  const nurBeiwerk = KONOSUBA()
  markiereReihenteile(new Map(nurBeiwerk.map((t) => [t.id, t])), ELTERN, new Set())
  pruefe('Konosuba ohne Handliste: „An Explosion“ steht im Verdacht', spinoffVerdacht(nurBeiwerk).map((t) => t.id).join() === String(EXPLOSION))
}

if (verletzt) {
  console.error(`\ncheck-staffelzaehlung: ${verletzt} von ${faelle} Zusicherungen verletzt.`)
  process.exit(1)
}
console.log(`\ncheck-staffelzaehlung: ${faelle} Zusicherungen, 0 verletzt`)
