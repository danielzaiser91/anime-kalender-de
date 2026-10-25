/**
 * Zusicherungen für die frisch startende Staffel in `termineAusSerie()` (`lib/crunchyroll-termine.ts`):
 * der jüngste Block wird auch dann dem jüngsten Titel zugeordnet, wenn Blöcke und Titel nicht aufgehen (B),
 * und eine durchnummerierte laufende Staffel zählt ab ihrer kleinsten Nummer (C).
 *
 * Die Fälle sind die drei vom 25.10.2026 mit wörtlichen Namen, Nummern und Zeitstempeln aus `data/crunchyroll-dub.json`.
 * „Jetzt“ ist fest eingespeist (`JETZT`), nie die echte Uhr.
 *
 * Aufruf: npx tsx pipeline/check-cr-termine-neu.ts
 */
import type { Title } from '../shared/types.ts'
import type { CrSerie } from './lib/crunchyroll-dub.ts'
import { ausgelassen, termineAusSerie } from './lib/crunchyroll-termine.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const JETZT = Date.parse('2026-10-25T12:00:00Z')
const TAG = 24 * 3600 * 1000

type Folge = [nummer: number, verfuegbarAb: string]
type Block = [name: string, deutsch: number, folgen: number, datiert: Folge[]]

const serie = (url: string, bloecke: Block[]): CrSerie =>
  ({
    url,
    katalog: 'de',
    staffeln: bloecke.map(([name, deutsch, folgen, datiert]) => ({
      name,
      deutsch,
      folgen,
      deutscheFolgen: datiert.map(([nummer, verfuegbarAb]) => ({ nummer, guid: `g${nummer}`, verfuegbarAb })),
    })),
  }) as unknown as CrSerie

const wochen = (ab: string, n: number, ersteNummer = 1): Folge[] =>
  Array.from({ length: n }, (_, i) => [ersteNummer + i, new Date(Date.parse(ab) + i * 7 * TAG).toISOString().replace('.000Z', 'Z')])

const titel = (id: number, titleEn: string, jpYear: number, url: string, dub: boolean | undefined, episodes?: number): Title =>
  ({ id, titleEn, jpYear, episodes, titleRomaji: titleEn, streams: [{ platform: 'crunchyroll', url, dub }] }) as unknown as Title

/** Ergebnis und Zahl der neu gezählten Verwürfe. */
function lauf(s: CrSerie, t: Title[], jetzt = JETZT) {
  const vorher = ausgelassen.length
  const raus = termineAusSerie(s, t, jetzt)
  return { raus, verworfen: ausgelassen.slice(vorher) }
}

/* --- Aristocrat S3 (GG5H5XQMD): 3 Blöcke, 2 Titel mit dub und Folgenzahl --- */
const ARI = 'https://www.crunchyroll.com/de/series/GG5H5XQMD/as-a-reincarnated-aristocrat-ill-use-my-appraisal-skill-to-rise-in-the-world'
const ariName = "As a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World"
const aristocrat = serie(ARI, [
  ['Staffel 1', 12, 12, wochen('2024-04-28T15:00:00Z', 12)],
  ['Staffel 2', 12, 12, wochen('2024-10-20T15:00:00Z', 12)],
  ['Staffel 3', 1, 4, [[1, '2026-10-18T15:00:00Z']]],
])
const ariTitel = [
  titel(164702, ariName, 2024, ARI, true, 12),
  titel(178434, `${ariName} Season 2`, 2024, ARI, true, 12),
  titel(185756, `${ariName} Season 3`, 2026, ARI, true),
]
const ari = lauf(aristocrat, ariTitel)
pruefe('Aristocrat S3: 3 Blöcke, 2 Titel mit Zahl — der jüngste Block bekommt den jüngsten Titel', ari.raus.length === 1 && ari.raus[0]?.titleId === 185756, ari.raus)
pruefe('Aristocrat S3: der Termin ist der 18.10. um 17:00 Berlin', ari.raus[0]?.firstEpisodeDate === '2026-10-18' && ari.raus[0]?.time === '17:00', ari.raus[0])
pruefe('Aristocrat S3: ohne Folgenzahl nur die datierte Folge, keine Fortschreibung', ari.raus[0]?.episodeCount === 1 && ari.raus[0]?.lastEpisodeDate === '2026-10-18', ari.raus[0])
pruefe('Aristocrat S3: nichts verworfen', ari.verworfen.length === 0, ari.verworfen)

/* --- Last Boss S2 (GT00361955): zweiter Titel ohne dub und ohne Folgenzahl --- */
const LB = 'https://www.crunchyroll.com/de/series/GT00361955/a-wild-last-boss-appeared'
const lastBoss = serie(LB, [
  ['Staffel 1', 12, 12, wochen('2025-10-18T14:00:00Z', 12)],
  ['Staffel 2', 2, 5, [[1, '2026-10-24T13:30:00Z'], [2, '2026-10-24T13:30:00Z']]],
])
const lbTitel = [titel(180523, 'A Wild Last Boss Appeared!', 2025, LB, true, 12), titel(204389, 'A Wild Last Boss Appeared! Season 2', 2026, LB, undefined)]
const lb = lauf(lastBoss, lbTitel)
pruefe('Last Boss S2: Termin am 24.10. für den zweiten Titel, obwohl er weder dub noch Folgenzahl trägt', lb.raus.length === 1 && lb.raus[0]?.titleId === 204389 && lb.raus[0]?.firstEpisodeDate === '2026-10-24', lb.raus)
pruefe('Last Boss S2: zwei Folgen am selben Tag, nur diese zwei — keine erfundene Zahl', lb.raus[0]?.episodeCount === 2 && lb.raus[0]?.lastEpisodeDate === '2026-10-24' && lb.raus[0]?.datiert === 2, lb.raus[0])
pruefe('Last Boss S2: Uhrzeit 15:30 Berlin (beide Folgen gleich)', lb.raus[0]?.time === '15:30', lb.raus[0]?.time)

/* --- Apothekerin S3 (G3KHEVDJ7): durchnummeriert, Folge 49 --- */
const AP = 'https://www.crunchyroll.com/de/series/G3KHEVDJ7/the-apothecary-diaries'
const apothekerin = serie(AP, [
  ['Die Tagebücher der Apothekerin', 24, 24, wochen('2023-11-18T21:30:00Z', 24)],
  ['Die Tagebücher der Apothekerin Staffel 2', 24, 24, wochen('2025-01-31T22:30:00Z', 24, 25)],
  ['Die Tagebücher der Apothekerin Staffel 3', 1, 4, [[49, '2026-10-23T15:00:00Z']]],
])
const apTitel = (dubDrei: boolean | undefined) => [
  titel(161645, 'The Apothecary Diaries', 2023, AP, true, 24),
  titel(176301, 'The Apothecary Diaries Season 2', 2025, AP, true, 24),
  titel(195516, 'The Apothecary Diaries Season 3', 2026, AP, dubDrei, 12),
]
for (const [wie, dubDrei] of [['ohne dub am dritten Titel (Riegel 1 geht nicht auf)', undefined], ['mit dub (Paarung geht auf, Folgenzahl nicht)', true]] as const) {
  const ap = lauf(apothekerin, apTitel(dubDrei))
  const drei = ap.raus.find((t) => t.titleId === 195516)
  pruefe(`Apothekerin S3 ${wie}: Termin am 23.10. für den dritten Titel`, drei?.firstEpisodeDate === '2026-10-23', ap)
  pruefe(`Apothekerin S3 ${wie}: laufende Staffel, 12 Folgen erwartet, Ende offen`, drei?.episodeCount === 12 && drei?.lastEpisodeDate === undefined, drei)
  pruefe(`Apothekerin S3 ${wie}: Folge 49 zählt als Folge 1`, JSON.stringify(drei?.beobachtet) === '{"1":"2026-10-23"}', drei?.beobachtet)
}
const apPaar = lauf(apothekerin, apTitel(true))
pruefe('Apothekerin: Staffel 1 und 2 bleiben wie bisher gepaart (24 von 24, kein Versatz)', apPaar.raus.length === 3 && apPaar.raus[1]?.titleId === 176301 && apPaar.raus[1]?.lastEpisodeDate === '2025-07-12' && JSON.stringify(apPaar.raus[1]?.beobachtet) === '{}', apPaar.raus[1])

/* --- C: nur lückenlose, frische Staffeln zählen als laufend --- */
const nurDrei = (datiert: Folge[]) => serie(AP, [['Die Tagebücher der Apothekerin Staffel 3', datiert.length, 12, datiert]])
const drei12 = [titel(195516, 'The Apothecary Diaries Season 3', 2026, AP, true, 12)]
const luecke = lauf(nurDrei([[49, '2026-10-16T15:00:00Z'], [51, '2026-10-23T15:00:00Z']]), drei12)
pruefe('Lücke in den Nummern (49, 51): nicht laufend, Serie verworfen und gezählt', luecke.raus.length === 0 && luecke.verworfen[0]?.grund === 'Folgenzahl geht nicht auf', luecke)
const doppelt = lauf(nurDrei([[49, '2026-10-16T15:00:00Z'], [49, '2026-10-23T15:00:00Z']]), drei12)
pruefe('doppelte Nummer (49, 49): nicht laufend', doppelt.raus.length === 0, doppelt)
const zweiLauf = lauf(nurDrei([[49, '2026-10-16T15:00:00Z'], [50, '2026-10-23T15:00:00Z']]), drei12)
pruefe('zwei lückenlose Nummern ab 49: laufend, Folgen 1 und 2', zweiLauf.raus[0]?.episodeCount === 12 && JSON.stringify(zweiLauf.raus[0]?.beobachtet) === '{"1":"2026-10-16","2":"2026-10-23"}', zweiLauf.raus[0])
const alt = lauf(nurDrei([[49, '2026-10-03T15:00:00Z']]), drei12, Date.parse('2026-10-25T12:00:00Z'))
pruefe('letzte Folge 22 Tage her: nicht mehr frisch, nicht laufend', alt.raus.length === 0, alt)
const grenze = lauf(nurDrei([[49, '2026-10-05T15:00:00Z']]), drei12, Date.parse('2026-10-26T00:00:00Z'))
pruefe('letzte Folge genau 21 Tage her (Tagesanfang): nicht mehr laufend (Grenze < 21 Tage wie bisher)', grenze.raus.length === 0, grenze)
const knapp = lauf(nurDrei([[49, '2026-10-06T15:00:00Z']]), drei12, Date.parse('2026-10-26T00:00:00Z'))
pruefe('letzte Folge 20 Tage her: laufend', knapp.raus.length === 1, knapp)

/* --- B: Fälle, in denen weiter verworfen und gezählt wird --- */
const GRUND = 'Blöcke und Titel verschieden viele'
const alterBlock = lauf(aristocrat, ariTitel, Date.parse('2026-11-12T12:00:00Z'))
pruefe('erste Folge des jüngsten Blocks 25 Tage her: verworfen und gezählt', alterBlock.raus.length === 0 && alterBlock.verworfen[0]?.grund === GRUND, alterBlock)
const genau21 = lauf(aristocrat, ariTitel, Date.parse('2026-11-08T00:00:00Z'))
pruefe('erste Folge genau 21 Tage her (Tagesanfang): noch erlaubt', genau21.raus.length === 1, genau21)
const einsDrueber = lauf(aristocrat, ariTitel, Date.parse('2026-11-08T00:00:01Z'))
pruefe('eine Sekunde später: nicht mehr', einsDrueber.raus.length === 0, einsDrueber)
const falscheNr = serie(ARI, [['Staffel 1', 12, 12, wochen('2024-04-28T15:00:00Z', 12)], ['Staffel 2', 12, 12, wochen('2024-10-20T15:00:00Z', 12)], ['Staffel 4', 1, 4, [[1, '2026-10-18T15:00:00Z']]]])
const nr4 = lauf(falscheNr, ariTitel)
pruefe('Block „Staffel 4“ gegen Titel „Season 3“: nicht eindeutig, verworfen', nr4.raus.length === 0 && nr4.verworfen[0]?.grund === GRUND, nr4)
const ohneNr = serie(ARI, [['Staffel 1', 12, 12, wochen('2024-04-28T15:00:00Z', 12)], ['Staffel 2', 12, 12, wochen('2024-10-20T15:00:00Z', 12)], ['Die Fortsetzung', 1, 4, [[1, '2026-10-18T15:00:00Z']]]])
pruefe('Block ohne Staffelnummer: verworfen', lauf(ohneNr, ariTitel).raus.length === 0)
const vorJp = lauf(serie(ARI, [['Staffel 1', 12, 12, wochen('2024-04-28T15:00:00Z', 12)], ['Staffel 2', 12, 12, wochen('2024-10-20T15:00:00Z', 12)], ['Staffel 3', 1, 4, [[1, '2025-10-18T15:00:00Z']]]]), ariTitel, Date.parse('2025-10-20T12:00:00Z'))
pruefe('Termin vor der japanischen Ausstrahlung (2025 gegen 2026): Riegel 3 hält', vorJp.raus.length === 0 && vorJp.verworfen[0]?.grund === 'deutscher Termin vor der japanischen Ausstrahlung', vorJp)
const nein = lauf(aristocrat, [ariTitel[0]!, ariTitel[1]!, titel(185756, `${ariName} Season 3`, 2026, ARI, false)])
pruefe('ein belegtes Nein am jüngsten Titel: kein Termin', nein.raus.length === 0, nein)
const doppeltNr = lauf(aristocrat, [ariTitel[0]!, titel(178434, `${ariName} Season 3`, 2024, ARI, true, 12), ariTitel[2]!])
pruefe('zwei Titel mit „Season 3“: nicht eindeutig, verworfen', doppeltNr.raus.length === 0, doppeltNr)
const ohneMarke = lauf(aristocrat, [titel(164702, ariName, 2024, ARI, true, 12), titel(178434, `${ariName} 2`, 2025, ARI, true, 12), titel(185756, ariName, 2026, ARI, true)])
pruefe('ohne Nummer im Namen zählt die Stelle in der Reihe (3 von 3)', ohneMarke.raus.length === 1 && ohneMarke.raus[0]?.titleId === 185756, ohneMarke)
const zuWenig = lauf(aristocrat, [titel(164702, ariName, 2024, ARI, true, 12), titel(185756, ariName, 2026, ARI, true)])
pruefe('ohne Nummer, aber nur Stelle 2 von 2 gegen Block 3: verworfen', zuWenig.raus.length === 0, zuWenig)
const gleichesJahr = lauf(aristocrat, [titel(164702, ariName, 2024, ARI, true, 12), titel(178434, `${ariName} Season 2`, 2026, ARI, true, 12), titel(185756, `${ariName} Season 3`, 2026, ARI, true)])
pruefe('gleiches Jahr: die höhere Kennung ist die jüngste', gleichesJahr.raus[0]?.titleId === 185756, gleichesJahr)
const gleichesJahrUmgekehrt = lauf(aristocrat, [titel(164702, ariName, 2024, ARI, true, 12), titel(178434, `${ariName} Season 3`, 2026, ARI, true, 12), titel(185756, `${ariName} Season 2`, 2026, ARI, true)])
pruefe('gleiches Jahr, Nummern vertauscht: die höhere Kennung trägt „Season 2“, also nicht eindeutig', gleichesJahrUmgekehrt.raus.length === 0, gleichesJahrUmgekehrt)
pruefe('US-Katalog: nichts', termineAusSerie({ ...aristocrat, katalog: 'us' } as CrSerie, ariTitel, JETZT).length === 0)

/* --- Bestehendes: geht die Paarung auf, ändert sich nichts --- */
const aufgeht = lauf(serie(ARI, [['Staffel 1', 12, 12, wochen('2024-04-28T15:00:00Z', 12)]]), [titel(164702, ariName, 2024, ARI, true, 12)])
pruefe('Paarung geht auf: ein Termin wie bisher, ohne B', aufgeht.raus.length === 1 && aufgeht.raus[0]?.lastEpisodeDate === '2024-07-14' && aufgeht.verworfen.length === 0, aufgeht)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
