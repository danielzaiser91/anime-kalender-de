/**
 * Zusicherung: **Ein Spin-off bekommt keine Staffelnummer der Hauptzählung** (Prüfer PR 2744, 03.11.2026: Konosuba „Staffel 3" und
 * „An Explosion" standen beide als Staffel 3). `data/spinoff-von-hand.yaml` setzt `FranchiseMember.eigenesWerk`; `hauptstaffeln()` zählt
 * den Eintrag nicht, die Reihenliste zeigt ihn unter „Eigene Serien". Fälle wörtlich aus `public/data/franchises.json` (03.11.2026):
 * Konosuba, My Hero Academia (Spin-off samt Fortsetzung). Der Bestandsteil (Rest der doppelten Nummern) steht in
 * `check-remake-zaehlung-bestand.ts`. Läuft in `check:logic`.
 */
import type { FranchiseMember } from '../shared/types.ts'
import { hauptstaffeln, staffelStaende } from '../shared/titles.ts'
import { reihenGruppen } from '../web/src/components/detail/reihen-gruppen.ts'
import { ladeAlleEigenenWerke, ladeEigeneListe, markiereEigeneWerke, SPINOFF_DATEI } from './bau/cartoon-reihen.ts'
import { doppelteNummern } from './lib/remake-zaehlung-pruefung.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const tv = (id: number, jpStart: string, name: string, mehr: Partial<FranchiseMember> = {}): FranchiseMember =>
  ({ id, name, format: 'TV', jpYear: Number(jpStart.slice(0, 4)), jpStart, episodes: 12, ...mehr }) as FranchiseMember
const kopie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const nummer = (reihe: FranchiseMember[], reihenName: string): Record<number, string> => {
  const stand = staffelStaende(hauptstaffeln(reihe), reihenName)
  return Object.fromEntries([...stand].map(([id, s]) => [id, `${s.staffel}`]))
}
const doppelt = (reihe: FranchiseMember[]): string[] => doppelteNummern({ 1: reihe }).map((d) => `${d.reihe}|${d.nummer}`)

/** Konosuba, wörtlich aus `franchises.json`: das Spin-off „An Explosion" (AniList SPIN_OFF von 21202) stand als Staffel 3 neben „3". */
const KONOSUBA_NAME = 'Konosuba: God’s Blessing on This Wonderful World!'
const KONOSUBA = (): FranchiseMember[] => [
  tv(21202, '2016-01-14', KONOSUBA_NAME, { episodes: 10 }),
  tv(21699, '2017-01-12', 'KonoSuba: God’s Blessing on This Wonderful World! 2', { episodes: 10, staffelQuelle: 2 }),
  tv(150075, '2023-04-06', 'Konosuba: An Explosion on This Wonderful World!', { beiwerk: true }),
  tv(136804, '2024-04-10', 'KonoSuba: God’s Blessing on This Wonderful World! 3', { episodes: 11, staffelQuelle: 3 }),
  tv(187924, '2027', 'KonoSuba: God’s Blessing on This Wonderful World! Season 4', { episodes: undefined }),
]

/** My Hero Academia: das Spin-off Vigilantes (SPIN_OFF von 21459) und seine zweite Staffel standen als Staffel 8 und 2. */
const MHA_NAME = 'My Hero Academia'
const MHA = (): FranchiseMember[] => [
  tv(21459, '2016-04-03', MHA_NAME, { episodes: 13 }),
  tv(21856, '2017-04-01', 'My Hero Academia 2', { episodes: 25 }),
  tv(100166, '2018-04-07', 'My Hero Academia 3', { episodes: 25 }),
  tv(104276, '2019-10-12', 'My Hero Academia 4', { episodes: 25, staffelQuelle: 4 }),
  tv(117193, '2021-03-27', 'My Hero Academia 5', { episodes: 25, staffelQuelle: 5 }),
  tv(139630, '2022-10-01', 'My Hero Academia Staffel 6', { episodes: 25, staffelQuelle: 6 }),
  tv(163139, '2024-05-04', 'My Hero Academia: Season 7', { episodes: 21, staffelQuelle: 7 }),
  tv(182896, '2025-10-04', 'My Hero Academia: Final Season', { episodes: 11, staffelQuelle: 8 }),
  tv(185736, '2025-04-07', 'My Hero Academia: Vigilantes', { episodes: 13, beiwerk: true }),
  tv(195322, '2026-01-05', 'My Hero Academia: Vigilantes Staffel 2', { episodes: 13, staffelQuelle: 2 }),
]

console.log('\nSpin-offs zählen nicht als Staffel:')
{
  const liste = ladeAlleEigenenWerke()
  const ids = liste.flatMap((e) => e.ids)
  pruefe('Die Handliste der Spin-offs ist nicht leer', ladeEigeneListe(SPINOFF_DATEI).length > 0)
  pruefe('Keine Kennung steht zweimal in den Handlisten', new Set(ids).size === ids.length, ids.filter((id, i) => ids.indexOf(id) !== i))
  pruefe('Jede Kennung ist eine ganze Zahl', ids.every((id) => Number.isInteger(id)))

  const roh = KONOSUBA()
  pruefe('ohne Markierung steht die Staffelnummer 3 doppelt (Kulisse unterscheidet)', doppelt(roh).join() === `${KONOSUBA_NAME}|3/-`, doppelt(roh))
  const nachher = markiereEigeneWerke({ 1: kopie(roh) })[1]!
  pruefe('Standardliste von markiereEigeneWerke enthält die Spin-off-Datei (Explosion trägt die Marke)', nachher.find((m) => m.id === 150075)?.eigenesWerk === true)
  pruefe('die Hauptstaffeln tragen die Marke nicht', nachher.filter((m) => m.id !== 150075).every((m) => !m.eigenesWerk))
  pruefe('danach kommt keine Nummer doppelt vor', doppelt(nachher).length === 0, doppelt(nachher))
  pruefe('das Spin-off zählt nicht als Hauptstaffel', !hauptstaffeln(nachher).some((m) => m.id === 150075))
  const vorher = nummer(roh, KONOSUBA_NAME)
  const danach = nummer(nachher, KONOSUBA_NAME)
  pruefe('Staffeln 1, 2 und 3 behalten ihre Nummer, Staffel 4 bleibt Staffel 4', ['21202', '21699', '136804', '187924'].every((id, i) => danach[Number(id)] === String(i + 1)), danach)
  pruefe('die dritte Hauptstaffel (136804) hieß vorher „3" und heißt weiter „3"', vorher[136804] === '3' && danach[136804] === '3', [vorher, danach])
  pruefe('das Spin-off hat nach der Markierung keine Staffelnummer', danach[150075] === undefined)

  const gruppen = reihenGruppen(nachher, (m) => hauptstaffeln(nachher).some((h) => h.id === m.id), (a, b) => a.id - b.id, (k) => k)
  const eigene = gruppen.find((g) => g.titel === 'detail.gruppeEigene')
  pruefe('die Reihenliste zeigt das Spin-off unter „Eigene Serien"', eigene?.teile.map((m) => m.id).join() === '150075', gruppen.map((g) => g.titel))
  pruefe('die Hauptserie in der Reihenliste enthält es nicht', !gruppen.find((g) => g.titel === 'detail.gruppeStaffeln')?.teile.some((m) => m.id === 150075))

  const mha = kopie(MHA())
  const mhaVorher = doppelt(mha)
  pruefe('My Hero Academia: ohne Markierung stehen 2 und 8 doppelt (Spin-off und seine Fortsetzung)', mhaVorher.join() === `${MHA_NAME}|2/-,${MHA_NAME}|8/-`, mhaVorher)
  const mhaNachher = markiereEigeneWerke({ 1: kopie(mha) })[1]!
  pruefe('My Hero Academia: Spin-off und Fortsetzung tragen die Marke', mhaNachher.filter((m) => m.eigenesWerk).map((m) => m.id).join() === '185736,195322')
  pruefe('My Hero Academia: danach keine doppelte Nummer', doppelt(mhaNachher).length === 0, doppelt(mhaNachher))
  const nm = nummer(mhaNachher, MHA_NAME)
  pruefe('My Hero Academia: die acht Hauptstaffeln heißen unverändert 1 bis 8', [21459, 21856, 100166, 104276, 117193, 139630, 163139, 182896].every((id, i) => nm[id] === String(i + 1)), nm)
  const nv = nummer(mha, MHA_NAME)
  pruefe('My Hero Academia: die Nummern der Hauptstaffeln sind vor und nach der Markierung gleich', [21459, 21856, 100166, 104276, 117193, 139630, 163139, 182896].every((id) => nm[id] === nv[id]), [nv, nm])
}

console.log(`check-spinoff-zaehlung: ${faelle} Zusicherungen, ${verletzt} verletzt`)
if (verletzt) process.exit(1)
