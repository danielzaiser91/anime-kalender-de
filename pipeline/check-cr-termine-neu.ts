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
import { titelStaffelNr } from './lib/cr-staffel-nummer.ts'
import { alleTermine, ausgelassen, termineAusSerie } from './lib/crunchyroll-termine.ts'

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
pruefe('Aristocrat S3: ohne Folgenzahl, Block führt mehr Folgen: laufend, die datierte Folge, Ende offen, Länge setzt der Bau', ari.raus[0]?.episodeCount === 1 && ari.raus[0]?.lastEpisodeDate === undefined && ari.raus[0]?.zahlOffen === true && ari.raus[0]?.rhythmus === 'weekly', ari.raus[0])
pruefe('Aristocrat S3: nichts verworfen', ari.verworfen.length === 0, ari.verworfen)

/* --- Last Boss S2 (GT00361955): zweiter Titel ohne dub und ohne Folgenzahl --- */
const LB = 'https://www.crunchyroll.com/de/series/GT00361955/a-wild-last-boss-appeared'
const lbEins: Block = ['Staffel 1', 12, 12, wochen('2025-10-18T14:00:00Z', 12)]
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
const apEins: Block = ['Die Tagebücher der Apothekerin', 24, 24, wochen('2023-11-18T21:30:00Z', 24)]
const apZwei: Block = ['Die Tagebücher der Apothekerin Staffel 2', 24, 24, wochen('2025-01-31T22:30:00Z', 24, 25)]
const apothekerin = serie(AP, [apEins, apZwei, ['Die Tagebücher der Apothekerin Staffel 3', 1, 4, [[49, '2026-10-23T15:00:00Z']]]])
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
pruefe('Termin vor der japanischen Ausstrahlung (2025 gegen 2026): Riegel 3 hält', vorJp.raus.length === 0 && vorJp.verworfen.length === 1 && vorJp.verworfen[0]?.grund === 'deutscher Termin vor der japanischen Ausstrahlung', vorJp)
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

/* --- C genauer: was „lückenlos“ heißt --- */
const unnummeriert = lauf(nurDrei([[49, '2026-10-16T15:00:00Z'], [undefined as never, '2026-10-23T15:00:00Z']]), drei12)
pruefe('eine Folge ohne Nummer neben Folge 49: nicht laufend', unnummeriert.raus.length === 0 && unnummeriert.verworfen[0]?.grund === 'Folgenzahl geht nicht auf', unnummeriert)
const dopplung = lauf(nurDrei([[49, '2026-10-09T15:00:00Z'], [49, '2026-10-16T15:00:00Z'], [51, '2026-10-23T15:00:00Z']]), drei12)
pruefe('49, 49, 51: gleich viele Nummern wie die Spanne, aber doppelt — nicht laufend', dopplung.raus.length === 0, dopplung)
const voll = lauf(serie(AP, [['Die Tagebücher der Apothekerin Staffel 3', 2, 2, [[1, '2026-10-16T15:00:00Z'], [2, '2026-10-23T15:00:00Z']]]]), [titel(195516, 'The Apothecary Diaries Season 3', 2026, AP, true, 2)])
pruefe('vollständiger frischer Block (2 von 2): nicht laufend, das Ende steht', voll.raus[0]?.lastEpisodeDate === '2026-10-23' && voll.raus[0]?.episodeCount === 2, voll.raus[0])

/* --- B genauer: nur die datierten Folgen --- */
const zweiTage = lauf(serie(LB, [lbEins, ['Staffel 2', 2, 5, [[2, '2026-10-24T13:30:00Z'], [1, '2026-10-17T14:00:00Z']]]]), lbTitel)
const z = zweiTage.raus[0]
pruefe('Folgen in falscher Reihenfolge: erster Tag der früheste, der späteste ist die zweite Beobachtung, Ende offen', z?.firstEpisodeDate === '2026-10-17' && z?.lastEpisodeDate === undefined && z?.beobachtet[2] === '2026-10-24', z)
pruefe('zwei verschiedene Uhrzeiten: keine geraten', z?.time === undefined, z)
pruefe('Wochenabstand wird gemessen und die Tage je Folge stehen dabei', z?.rhythmus === 'weekly' && JSON.stringify(z?.beobachtet) === '{"1":"2026-10-17","2":"2026-10-24"}', z)
const mitNull = lauf(serie(LB, [lbEins, ['Staffel 2', 3, 5, [[0, '2026-10-10T14:00:00Z'], [1, '2026-10-17T14:00:00Z'], [2, '2026-10-24T14:00:00Z']]]]), lbTitel)
pruefe('Folge 0 zählt nicht als Beobachtung, 1 und 2 bleiben', JSON.stringify(mitNull.raus[0]?.beobachtet) === '{"1":"2026-10-17","2":"2026-10-24"}', mitNull.raus[0])
const kaputtesDatum = lauf(serie(LB, [lbEins, ['Staffel 2', 1, 5, [[1, 'kaputt']]]]), lbTitel)
pruefe('ein Block, dessen einziges Datum kaputt ist: kein Termin, kein Absturz, gezählt', kaputtesDatum.raus.length === 0 && kaputtesDatum.verworfen.length === 1 && kaputtesDatum.verworfen[0]?.grund === 'Folgendatum nicht lesbar', kaputtesDatum)
const apOhneZahl = lauf(apothekerin, [apTitel(true)[0]!, apTitel(true)[1]!, titel(195516, 'The Apothecary Diaries Season 3', 2026, AP, undefined)])
pruefe('ohne Folgenzahl, Block ab 49: nur die datierte Folge, als Folge 1 gezählt, Ende offen', apOhneZahl.raus[0]?.episodeCount === 1 && apOhneZahl.raus[0]?.lastEpisodeDate === undefined && JSON.stringify(apOhneZahl.raus[0]?.beobachtet) === '{"1":"2026-10-23"}', apOhneZahl)
const mitLuecke = lauf(serie(AP, [apEins, apZwei, ['Die Tagebücher der Apothekerin Staffel 3', 2, 4, [[49, '2026-10-16T15:00:00Z'], [51, '2026-10-23T15:00:00Z']]]]), apTitel(undefined))
pruefe('Folgenzahl bekannt, aber Lücke in den Nummern: nur die zwei datierten Folgen, Ende gesetzt', mitLuecke.raus[0]?.episodeCount === 2 && mitLuecke.raus[0]?.lastEpisodeDate === '2026-10-23', mitLuecke)

/* --- B: welche Titel überhaupt in Frage kommen --- */
const fremderNein = (id: number, name: string, jahr: number, streams: object[]) => ({ ...titel(id, name, jahr, ARI, undefined), streams }) as unknown as Title
const nurAndererNein = lauf(aristocrat, [ariTitel[0]!, ariTitel[1]!, fremderNein(185756, `${ariName} Season 3`, 2026, [{ platform: 'crunchyroll', url: ARI }, { platform: 'netflix', url: 'https://netflix.test/x', dub: false }])])
pruefe('ein Nein bei einem anderen Anbieter schließt den Titel nicht aus', nurAndererNein.raus.length === 1, nurAndererNein)
const andereAdresse = lauf(aristocrat, [ariTitel[0]!, ariTitel[1]!, fremderNein(185756, `${ariName} Season 3`, 2026, [{ platform: 'crunchyroll', url: ARI }, { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/GANDERE/x', dub: false }])])
pruefe('ein Nein an einer anderen Crunchyroll-Adresse schließt den Titel nicht aus', andereAdresse.raus.length === 1, andereAdresse)
const alleNein = lauf(aristocrat, ariTitel.map((t) => ({ ...t, streams: [{ platform: 'crunchyroll', url: ARI, dub: false }] }) as unknown as Title))
pruefe('alle Titel mit Nein: kein Termin, verworfen und gezählt', alleNein.raus.length === 0 && alleNein.verworfen[0]?.grund === GRUND, alleNein)
const ohneJahr = lauf(aristocrat, [ariTitel[0]!, ariTitel[1]!, { ...ariTitel[2]!, jpYear: undefined } as Title])
pruefe('ein Titel ohne Jahr gilt nicht als der jüngste', ohneJahr.raus.length === 0, ohneJahr)
const jahrGleichIdUnten = lauf(aristocrat, [ariTitel[0]!, titel(185756, `${ariName} Season 2`, 2026, ARI, true, 12), titel(178434, `${ariName} Season 3`, 2026, ARI, true)])
pruefe('gleiches Jahr, niedrigere Kennung trägt „Season 3“: die höhere (Season 2) ist die jüngste, nicht eindeutig', jahrGleichIdUnten.raus.length === 0, jahrGleichIdUnten)

/* --- Überlebende der ersten Mutationsrunde --- */
const abEins = lauf(nurDrei([[1, '2026-10-16T15:00:00Z'], [2, '2026-10-23T15:00:00Z']]), drei12)
pruefe('laufende Staffel ab Folge 1 (wie „Das Band der Unterwelt“): 12 erwartet, Ende offen, Folgen 1 und 2', abEins.raus[0]?.episodeCount === 12 && abEins.raus[0]?.lastEpisodeDate === undefined && JSON.stringify(abEins.raus[0]?.beobachtet) === '{"1":"2026-10-16","2":"2026-10-23"}', abEins.raus[0])
const alteErste = lauf(nurDrei([[49, '2026-09-25T15:00:00Z'], [50, '2026-10-23T15:00:00Z']]), drei12)
pruefe('erste Folge 30 Tage alt, letzte frisch: laufend (es zählt die jüngste)', alteErste.raus.length === 1 && alteErste.raus[0]?.episodeCount === 12, alteErste)
const mitLuckeAlt = lauf(serie(AP, [['Die Tagebücher der Apothekerin Staffel 3', 4, 4, [[1, '2024-01-07T15:00:00Z'], [2, '2024-01-14T15:00:00Z'], [3, '2024-01-21T15:00:00Z'], [5, '2024-01-28T15:00:00Z']]]]), [titel(195516, 'The Apothecary Diaries Season 3', 2023, AP, true, 4)])
pruefe('Block 1, 2, 3, 5 bei 4 Folgen: Nummer 5 liegt über der Folgenzahl, keine Beobachtung', mitLuckeAlt.raus.length === 1 && JSON.stringify(mitLuckeAlt.raus[0]?.beobachtet) === '{}', mitLuckeAlt.raus[0])
const netflixGleicheAdresse = lauf(aristocrat, [ariTitel[0]!, ariTitel[1]!, fremderNein(185756, `${ariName} Season 3`, 2026, [{ platform: 'crunchyroll', url: ARI }, { platform: 'netflix', url: ARI, dub: false }])])
pruefe('ein Nein bei Netflix unter derselben Adresse schließt den Crunchyroll-Titel nicht aus', netflixGleicheAdresse.raus.length === 1, netflixGleicheAdresse)
const ohneJahrVorn = lauf(aristocrat, [{ ...ariTitel[2]!, jpYear: undefined } as Title, ariTitel[0]!, ariTitel[1]!])
pruefe('Titel ohne Jahr steht in der Liste vorn: gilt trotzdem nicht als jüngster', ohneJahrVorn.raus.length === 0, ohneJahrVorn)
const ohneJahrMitte = lauf(aristocrat, [ariTitel[0]!, { ...ariTitel[2]!, jpYear: undefined } as Title, ariTitel[1]!])
pruefe('Titel ohne Jahr in der Mitte: gilt trotzdem nicht als jüngster', ohneJahrMitte.raus.length === 0, ohneJahrMitte)

/* --- Standardzeit und Durchreichen: nie die echte Uhr im Erwartungswert, nur Fernzukunft und Fernvergangenheit --- */
const dreiBloecke = (letzterTag: string, jahr: number) => ({
  serie: serie(ARI, [['Staffel 1', 12, 12, wochen('1999-04-28T15:00:00Z', 12)], ['Staffel 2', 12, 12, wochen('1999-10-20T15:00:00Z', 12)], ['Staffel 3', 1, 4, [[1, letzterTag]]]]),
  titel: [titel(1, 'X', 1999, ARI, true, 12), titel(2, 'X Season 2', 1999, ARI, true, 12), titel(3, 'X Season 3', jahr, ARI, true)],
})
const alt2001 = dreiBloecke('2001-01-05T15:00:00Z', 2000)
pruefe('ohne eingespeiste Zeit gilt die echte: ein Block von 2001 ist nicht frisch', termineAusSerie(alt2001.serie, alt2001.titel).length === 0)
const fern = dreiBloecke('2999-12-30T15:00:00Z', 2000)
pruefe('ohne eingespeiste Zeit gilt die echte: ein Block von 2999 ist frisch', termineAusSerie(fern.serie, fern.titel).length === 1)
const durch = alleTermine([alt2001.serie], new Map([[ARI, alt2001.titel]]), Date.parse('2001-01-10T12:00:00Z'))
pruefe('alleTermine ohne Zeit: echte Uhr, 2001 alt und 2999 frisch', alleTermine([alt2001.serie], new Map([[ARI, alt2001.titel]])).length === 0 && alleTermine([fern.serie], new Map([[ARI, fern.titel]])).length === 1)
pruefe('alleTermine reicht die Zeit durch: 5 Tage nach der Folge von 2001 ist der Block frisch', durch.length === 1 && durch[0]?.titleId === 3, durch)

/* --- Eine Folge allein ist kein Abwurf (Aoashi Staffel 2, 26.10.2026; Zeitstempel wörtlich aus data/crunchyroll-dub.json) --- */
const AO = 'https://www.crunchyroll.com/de/aoashi'
const aoEins: Folge[] = Array.from({ length: 24 }, (_, i): Folge => [i + 1, i < 12 ? '2026-03-04T17:30:00Z' : '2026-07-15T16:30:00Z'])
const aoTitel = [titel(134732, 'Aoashi', 2022, AO, true, 24), titel(191788, 'Aoashi Season 2', 2026, AO, true, 24)]
const aoLauf = (zwei: Folge[], jetzt = Date.parse('2026-10-26T12:00:00Z')) =>
  lauf(serie(AO, [['Staffel 1', 24, 24, aoEins], ['Staffel 2', zwei.length, 4, zwei]]), aoTitel, jetzt)
const ao = aoLauf([[1, '2026-10-25T09:00:00Z']]).raus.find((t) => t.titleId === 191788)
pruefe('Aoashi S2: eine Folge am 25.10. ist ein Wochenstart, kein Abwurf', ao?.rhythmus === 'weekly', ao)
pruefe('Aoashi S2: Folge 1 belegt, Werkszahl 24 als Erwartung, Ende offen', ao?.episodeCount === 24 && ao?.lastEpisodeDate === undefined && JSON.stringify(ao?.beobachtet) === '{"1":"2026-10-25"}', ao)
const aoDoppel = aoLauf([[1, '2026-10-25T09:00:00Z'], [2, '2026-10-25T09:00:00Z']]).raus.find((t) => t.titleId === 191788)
pruefe('Aoashi S2 mit zwei Folgen am selben Tag: Abwurf-Rhythmus, nur die zwei belegten Folgen (nie 24), kein erfundenes Ende', aoDoppel?.rhythmus === 'batch' && aoDoppel?.episodeCount === 2 && aoDoppel?.lastEpisodeDate === undefined, aoDoppel)
pruefe('Aoashi S2 mit zwei Folgen am selben Tag: Beobachtung 1 und 2', JSON.stringify(aoDoppel?.beobachtet) === '{"1":"2026-10-25","2":"2026-10-25"}', aoDoppel?.beobachtet)
const aoErste = aoLauf([[1, '2026-10-25T09:00:00Z']]).raus.find((t) => t.titleId === 134732)
pruefe('Aoashi S1: 24 Folgen an zwei Tagen bleiben Abwurf (Katalog)', aoErste?.rhythmus === 'batch' && aoErste?.episodeCount === 24, aoErste)
const einzelfilm = lauf(serie(AO, [['Film', 1, 1, [[1, '2026-10-25T09:00:00Z']]]]), [titel(5, 'Film', 2026, AO, true, 1)])
pruefe('ein Film mit genau einer Folge (1 von 1): bleibt Abwurf „im Angebot seit“', einzelfilm.raus[0]?.rhythmus === 'batch' && einzelfilm.raus[0]?.episodeCount === 1, einzelfilm.raus[0])

/* --- Bestehendes: geht die Paarung auf, ändert sich nichts --- */
const aufgeht = lauf(serie(ARI, [['Staffel 1', 12, 12, wochen('2024-04-28T15:00:00Z', 12)]]), [titel(164702, ariName, 2024, ARI, true, 12)])
pruefe('Paarung geht auf: ein Termin wie bisher, ohne B', aufgeht.raus.length === 1 && aufgeht.raus[0]?.lastEpisodeDate === '2024-07-14' && aufgeht.verworfen.length === 0, aufgeht)
pruefe('Paarung geht auf: alle zwölf Tage als Beobachtung (Nummer = Obergrenze zählt)', Object.keys(aufgeht.raus[0]?.beobachtet ?? {}).length === 12, aufgeht.raus[0]?.beobachtet)

/* --- Staffelnummer aus dem Namen: Ordinalform („3rd Season“) und Zählform („Season 4“) --- */
const nrVon = (titleEn: string, titleDe?: string) => titelStaffelNr({ titleDe, titleEn })
pruefe('„3rd Season“ ist Staffel 3', nrVon('Show 3rd Season') === 3, nrVon('Show 3rd Season'))
pruefe('„2nd Season“ ist Staffel 2', nrVon('Show 2nd Season') === 2, nrVon('Show 2nd Season'))
pruefe('„1st Season“ ist Staffel 1', nrVon('Show 1st Season') === 1, nrVon('Show 1st Season'))
pruefe('„4th Season“ ist Staffel 4', nrVon('Show 4th Season') === 4, nrVon('Show 4th Season'))
pruefe('„Season 4“ greift ohne Ordinalform', nrVon('Show Season 4') === 4, nrVon('Show Season 4'))
pruefe('Ordinalform steht in einem späteren Namen', nrVon('Show', 'Show 3rd Season') === 3, nrVon('Show', 'Show 3rd Season'))
pruefe('ohne Staffelnennung: null', nrVon('Show') === null, nrVon('Show'))

/* --- Psyren (GT00371866, 26.10.2026): Titel ohne Folgenzahl, Block „Staffel 1“ mit 4 Folgen, 1 deutsch (wörtlich aus data/crunchyroll-dub.json) --- */
const PSY = 'https://www.crunchyroll.com/de/series/GT00371866/psyren'
const psyTitel = [titel(204011, 'PSYREN', 2026, PSY, true)]
const JETZT_PSY = Date.parse('2026-10-27T05:00:00Z')
const psy = lauf(serie(PSY, [['Staffel 1', 1, 4, [[1, '2026-10-26T14:30:00Z']]]]), psyTitel, JETZT_PSY).raus[0]
pruefe('Psyren: eine deutsche Folge von vier im Block, keine Zahl am Titel: wöchentlicher Auftakt, kein Abwurf', psy?.rhythmus === 'weekly' && psy?.zahlOffen === true, psy)
pruefe('Psyren: Folge 1 am 26.10. um 15:30, Ende offen', psy?.firstEpisodeDate === '2026-10-26' && psy?.time === '15:30' && psy?.lastEpisodeDate === undefined && psy?.episodeCount === 1, psy)
const psyVoll = lauf(serie(PSY, [['Staffel 1', 1, 1, [[1, '2026-10-26T14:30:00Z']]]]), psyTitel, JETZT_PSY).raus[0]
pruefe('Psyren-Form, aber der Block führt nur diese eine Folge: Abwurf wie bisher, Ende gesetzt', psyVoll?.rhythmus === 'batch' && psyVoll?.zahlOffen === undefined && psyVoll?.lastEpisodeDate === '2026-10-26', psyVoll)
const psyZahl = lauf(serie(PSY, [['Staffel 1', 1, 4, [[1, '2026-10-26T14:30:00Z']]]]), [titel(204011, 'PSYREN', 2026, PSY, true, 12)], JETZT_PSY).raus[0]
pruefe('mit Folgenzahl am Titel gilt der alte Weg (Aoashi): 12 erwartet, kein zahlOffen', psyZahl?.rhythmus === 'weekly' && psyZahl?.episodeCount === 12 && psyZahl?.zahlOffen === undefined, psyZahl)
const psyEins = lauf(serie(LB, [lbEins, ['Staffel 2', 1, 4, [[1, '2026-10-24T13:30:00Z']]]]), [lbTitel[0]!, titel(204389, 'A Wild Last Boss Appeared! Season 2', 2026, LB, undefined, 1)], JETZT).raus[0]
pruefe('Titel mit Folgenzahl 1 (ohne dub) und schon einer deutschen Folge: kein offenes Ende, Abwurf wie bisher', psyEins?.zahlOffen === undefined && psyEins?.lastEpisodeDate === '2026-10-24' && psyEins?.rhythmus === 'batch', psyEins)
const psyLuecke =lauf(serie(PSY, [['Staffel 1', 2, 4, [[1, '2026-10-26T14:30:00Z'], [3, '2026-11-09T14:30:00Z']]]]), psyTitel, Date.parse('2026-11-10T05:00:00Z')).raus[0]
pruefe('Psyren-Form mit Lücke in den Nummern (1, 3): nicht laufend, Ende gesetzt', psyLuecke?.zahlOffen === undefined && psyLuecke?.lastEpisodeDate === '2026-11-09', psyLuecke)
const psyZwei = lauf(serie(PSY, [['Staffel 1', 2, 4, [[1, '2026-10-26T14:30:00Z'], [2, '2026-11-02T15:30:00Z']]]]), psyTitel, Date.parse('2026-11-03T05:00:00Z')).raus[0]
pruefe('Psyren nach der zweiten Woche: weiter wöchentlich, Folgen 1 und 2, Ende offen', psyZwei?.rhythmus === 'weekly' && psyZwei?.zahlOffen === true && psyZwei?.lastEpisodeDate === undefined && JSON.stringify(psyZwei?.beobachtet) === '{"1":"2026-10-26","2":"2026-11-02"}', psyZwei)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
