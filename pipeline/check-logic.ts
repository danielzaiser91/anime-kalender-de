/**
 * Zusicherungen für die Regeln, an denen der Kalender am 12.08.2026 zerbrochen
 * ist.
 *
 * Der Fehler war groß und peinlich zugleich: Für „Sword Art Online" standen 96
 * wöchentliche Termine bis zum 07.04.2027 im Kalender, für „Sailor Moon" 100
 * bis zum 16.11.2027 — zusammen 196 von 867 Terminen, also fast ein Viertel
 * des Datenbestands, frei erfunden. Zwei davon lagen in der laufenden Woche
 * und trugen kein Näherungszeichen, galten also als belegt.
 *
 * Er entstand nicht durch eine falsche Zeile, sondern dadurch, dass vier
 * kleine Annahmen hintereinander gerieten. Genau solche Ketten fängt kein
 * Blick in den Quelltext, sondern nur ein Prüfsatz, der die Ausgangslage
 * nachstellt. Hier steht deshalb je Annahme ein Fall, der vor der Reparatur
 * durchgefallen wäre.
 *
 * Aufruf: npm run check:logic
 */
import { expandEvents } from '../shared/logic.ts'
import {
  bestimmeRhythmus,
  ordneBloeckeZuStaffeln,
  staffelBloecke,
  staffelnDesFranchise,
  type AdnEpisode,
  type AdnShow,
} from './lib/adn.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'
import { beurteile } from './lib/crunchyroll-dub.ts'
import type { Release, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Baut Folgen so, wie ADN sie liefert. */
function folgen(
  anzahl: number,
  date: string,
  season: string,
  ab = 1,
  schritteTage = 0,
): AdnEpisode[] {
  return Array.from({ length: anzahl }, (_, i) => ({
    date: schritteTage ? verschiebe(date, i * schritteTage) : date,
    time: '09:00',
    episode: ab + i,
    url: `https://animationdigitalnetwork.com/de/video/442/${ab + i}`,
    season,
    seasonReference: `serie_tv${season}`,
  }))
}

function verschiebe(iso: string, tage: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function titel(id: number, name: string, episodes: number, jahr: number, saison: string): Title {
  return {
    id,
    slug: `t-${id}`,
    titleRomaji: name,
    format: 'TV',
    episodes,
    jpYear: jahr,
    jpSeason: saison,
    franchiseId: 11757,
    genres: [],
    keywords: [],
    dubConfidence: 'high',
    streams: [],
  }
}

console.log('Sendeplan gegen belegtes Ende:')
{
  // Die Ausgangslage: 96 Folgen, als wöchentlich eingestuft, Ende belegt.
  const release: Release = {
    slug: 'adn-442',
    titleId: 11757,
    name: 'Sword Art Online',
    platform: 'adn',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: '2025-06-11',
      time: '09:00',
      episodeCount: 96,
      lastEpisodeDate: '2025-07-17',
    },
    year: 2025,
    sources: ['https://animationdigitalnetwork.com/de/'],
  }
  const events = expandEvents(release)
  const letzter = events.at(-1)?.date
  pruefe('kein Termin nach lastEpisodeDate', (letzter ?? '') <= '2025-07-17', letzter)
  pruefe('nicht mehr 96 Termine aus zwei Abwurftagen', events.length < 96, events.length)

  // Ohne belegte Folgenzahl entsteht ein Termin, nicht zwölf.
  const einzeln = expandEvents({
    ...release,
    slug: 'x',
    schedule: { firstEpisodeDate: '2026-01-07' },
  })
  pruefe('ohne episodeCount genau ein Termin', einzeln.length === 1, einzeln.length)
}

console.log('\nRhythmus:')
{
  const sao = [...folgen(25, '2025-06-11', '1'), ...folgen(47, '2025-07-17', '3')]
  pruefe('zwei Abwurftage sind kein Wochentakt', bestimmeRhythmus(sao) === 'batch', bestimmeRhythmus(sao))

  const woche = folgen(12, '2025-04-06', '1', 1, 7)
  pruefe('echter Wochentakt bleibt wöchentlich', bestimmeRhythmus(woche) === 'weekly', bestimmeRhythmus(woche))

  const sailor = [
    ...folgen(46, '2025-10-29', '1'),
    ...folgen(42, '2025-11-26', '2'),
    ...folgen(38, '2025-12-23', '3'),
  ]
  pruefe('drei Wellen sind kein Wochentakt', bestimmeRhythmus(sailor) === 'batch', bestimmeRhythmus(sailor))
}

console.log('\nStaffeln trennen und zuordnen:')
{
  const show: AdnShow = {
    showId: 442,
    title: 'Sword Art Online',
    url: 'https://animationdigitalnetwork.com/de/video/442',
    batch: true,
    episodes: [
      ...folgen(25, '2025-06-11', '1'),
      ...folgen(24, '2025-06-11', '2'),
      ...folgen(47, '2025-07-17', '3'),
    ],
  }
  const bloecke = staffelBloecke(show)
  pruefe('drei Staffelblöcke statt einer Reihe', bloecke.length === 3, bloecke.length)
  pruefe(
    'Folgenzahlen je Block: 25 / 24 / 47',
    bloecke.map((b) => b.nummern.length).join('/') === '25/24/47',
    bloecke.map((b) => b.nummern.length),
  )

  const franchise = [
    titel(11757, 'Sword Art Online', 25, 2012, 'SUMMER'),
    titel(20594, 'Sword Art Online II', 24, 2014, 'SUMMER'),
    titel(100183, 'Gun Gale Online', 12, 2018, 'SPRING'),
    titel(100182, 'Alicization', 24, 2018, 'FALL'),
    titel(108759, 'War of Underworld', 12, 2019, 'FALL'),
    titel(114308, 'War of Underworld Part 2', 11, 2020, 'SUMMER'),
  ]
  const staffeln = staffelnDesFranchise(franchise, 11757)
  const zuordnung = ordneBloeckeZuStaffeln(bloecke, staffeln)
  pruefe('Staffel 1 → Sword Art Online', zuordnung[0].teile[0]?.title.id === 11757, zuordnung[0].teile[0]?.title.id)
  pruefe('Staffel 2 → Sword Art Online II', zuordnung[1].teile[0]?.title.id === 20594, zuordnung[1].teile[0]?.title.id)
  pruefe(
    'ADN-Staffel 3 zerfällt in Alicization + WoU + WoU Part 2',
    zuordnung[2].teile.map((t) => t.title.id).join(',') === '100182,108759,114308',
    zuordnung[2].teile.map((t) => t.title.id),
  )
  pruefe(
    'Folge 25 der ADN-Staffel 3 ist die erste von War of Underworld',
    zuordnung[2].teile[1]?.adnVon === 25,
    zuordnung[2].teile[1]?.adnVon,
  )
  pruefe(
    'Gun Gale Online wird übersprungen, nicht eingerechnet',
    !zuordnung[2].teile.some((t) => t.title.id === 100183),
  )
}

console.log('\nGegenprobe des erzeugten Datensatzes:')
{
  const kaputt: Release = {
    slug: 'adn-442',
    titleId: 11757,
    name: 'Sword Art Online',
    platform: 'adn',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2025-06-11', episodeCount: 96, lastEpisodeDate: '2025-07-17' },
    year: 2025,
    sources: ['https://animationdigitalnetwork.com/de/'],
  }
  const titles = new Map<number, Title>([[11757, titel(11757, 'Sword Art Online', 25, 2012, 'SUMMER')]])
  const erfundeneTermine = [
    { id: 'a', releaseSlug: 'adn-442', titleId: 11757, date: '2026-08-12', episode: 62, releaseType: 'weekly' as const, platform: 'adn' as const, name: 'Sword Art Online' },
  ]
  const ergebnis = pruefeErgebnis([kaputt], erfundeneTermine, titles, '2026-08-12')
  pruefe('Termin nach dem Ende wird als Fehler gemeldet', ergebnis.fehler.some((f) => f.includes('nach dem belegten Ende')), ergebnis.fehler)
  pruefe('96 Folgen für einen 25-Teiler werden gemeldet', ergebnis.fehler.some((f) => f.includes('mehreren Staffeln')), ergebnis.fehler)

  const sauber: Release = {
    ...kaputt,
    slug: 'adn-442-s1',
    releaseType: 'batch',
    dateMeaning: 'available-from',
    schedule: { firstEpisodeDate: '2025-06-11', episodeCount: 25, lastEpisodeDate: '2025-06-11' },
  }
  const ok = pruefeErgebnis([sauber], [{ ...erfundeneTermine[0], releaseSlug: 'adn-442-s1', date: '2025-06-11', episode: undefined, releaseType: 'batch' }], titles, '2026-08-12')
  pruefe('der reparierte Eintrag geht durch', ok.fehler.length === 0, ok.fehler)
}

console.log('\nCrunchyroll: fremde Staffelfehler nicht nachbauen:')
{
  const t = (id: number, episodes: number, jahr: number): Title => titel(id, `T${id}`, episodes, jahr, 'SUMMER')

  // 1) Keine deutsche Tonspur auf der Seite — beide Einträge sicher „nein",
  //    ganz ohne Zuordnung.
  const ohne = beurteile({ url: 'u', deutschImAngebot: false, geprueftAm: '2026-08-12' }, [
    t(1, 12, 2020),
    t(2, 12, 2021),
  ])
  pruefe('ohne deutsche Tonspur: beide false', ohne.length === 2 && ohne.every((u) => !u.dub), ohne)

  // 2) Alles vollständig deutsch — beide „ja", ebenfalls ohne Zuordnung.
  const voll = beurteile(
    {
      url: 'u',
      deutschImAngebot: true,
      geprueftAm: '2026-08-12',
      staffeln: [{ name: 'Staffel 1', folgen: 24, kacheln: 24, deutsch: 24, fremd: 0 }],
    },
    [t(1, 12, 2020), t(2, 12, 2021)],
  )
  pruefe('vollständig deutsch: beide true', voll.length === 2 && voll.every((u) => u.dub), voll)

  /**
   * 3) Der Slime-Fall: Ein Block ist nur zu 15 von 17 Folgen deutsch. Genau
   *    hier darf nicht geraten werden — wo die Grenze zwischen „deutsch" und
   *    „noch nicht" verläuft, verrät keine Summe.
   */
  const teilweise = beurteile(
    {
      url: 'u',
      deutschImAngebot: true,
      geprueftAm: '2026-08-12',
      staffeln: [
        { name: 'Staffel 1', folgen: 24, kacheln: 24, deutsch: 24, fremd: 0 },
        { name: 'Staffel 4', folgen: 17, kacheln: 17, deutsch: 15, fremd: 1 },
      ],
    },
    [t(1, 24, 2018), t(2, 17, 2026)],
  )
  pruefe(
    'teilweise vertonter Block bleibt ohne Urteil',
    teilweise.length === 1 && teilweise[0].titleId === 1,
    teilweise,
  )

  /**
   * 4) Crunchyroll fasst zwei unserer Staffeln zu einem Block zusammen — und
   *    führt dabei 25 Kacheln für 24 Folgen, also eine Doppelung. Gezählt wird
   *    die Folgenzahl, nicht die Kachelzahl; dann geht die Summe auf und das
   *    Urteil gilt für beide, ohne dass wir ihre Einteilung übernehmen.
   */
  const zusammen = beurteile(
    {
      url: 'u',
      deutschImAngebot: true,
      geprueftAm: '2026-08-12',
      staffeln: [{ name: 'Staffel 2', folgen: 24, kacheln: 25, deutsch: 24, fremd: 0 }],
    },
    [t(1, 12, 2021), t(2, 12, 2021)],
  )
  pruefe('ein Block über zwei unserer Staffeln: beide true', zusammen.length === 2 && zusammen.every((u) => u.dub), zusammen)

  /**
   * 5) Gemischte Seite, bei der die Folgenzahlen nicht aufgehen: Der erste
   *    Block hat 13 Folgen, unsere Einträge je zwölf. Dann bleibt alles offen —
   *    hier zu raten hieße, eine Staffel als deutsch auszugeben, weil die
   *    Nachbarstaffel es ist.
   *
   *    Wichtig ist die Abgrenzung zum Fall darüber: Wäre die **ganze** Seite
   *    deutsch, gälte das Urteil trotz krummer Summe, denn dann ist jede Folge
   *    deutsch, die dort liegt. Erst die Mischung macht die Zuordnung nötig —
   *    und ohne aufgehende Summe gibt es keine.
   */
  const krumm = beurteile(
    {
      url: 'u',
      deutschImAngebot: true,
      geprueftAm: '2026-08-12',
      staffeln: [
        { name: 'Staffel 1', folgen: 13, kacheln: 13, deutsch: 13, fremd: 0 },
        { name: 'Staffel 2', folgen: 13, kacheln: 13, deutsch: 0, fremd: 13 },
      ],
    },
    [t(1, 12, 2020), t(2, 12, 2021)],
  )
  pruefe('gemischte Seite mit krummer Summe: kein Urteil', krumm.length === 0, krumm)

  /**
   * 6) Dieselbe Mischung, aber die Summen gehen auf: Der erste Block deckt
   *    genau unseren ersten Eintrag, der zweite den zweiten. Dann darf und soll
   *    unterschieden werden.
   */
  const sauber = beurteile(
    {
      url: 'u',
      deutschImAngebot: true,
      geprueftAm: '2026-08-12',
      staffeln: [
        { name: 'Staffel 1', folgen: 12, kacheln: 12, deutsch: 12, fremd: 0 },
        { name: 'Staffel 2', folgen: 12, kacheln: 12, deutsch: 0, fremd: 12 },
      ],
    },
    [t(1, 12, 2020), t(2, 12, 2021)],
  )
  pruefe(
    'aufgehende Summen: erste Staffel deutsch, zweite nicht',
    sauber.length === 2 && sauber[0].dub === true && sauber[1].dub === false,
    sauber,
  )
}

/**
 * Der Ausgangsstand der Synchro-Historie darf nie als Neuzugang gelten.
 *
 * Real passiert am 13.08.2026, unmittelbar beim Bau des Features: Der erste
 * Lauf schrieb für **alle** 2.753 Titel das heutige Datum, der zweite hielt
 * jeden einzelnen davon für neu — jeder Abonnent hätte eine Mail über 2.753
 * Serien bekommen, die er längst kennt. Aufgefallen ist es nur, weil die
 * Logzeile die Zahl nannte.
 *
 * Die Zusicherung stellt genau diesen Ablauf nach: anlegen, dann prüfen. Sie
 * steht hier und nicht im Kommentar, weil ein Kommentar sich überlesen lässt.
 */
{
  const heute = '2026-08-13'
  const angelegtAm = heute
  const seit: Record<string, string> = { 1: heute, 2: heute, 3: heute }
  const grenze = '2026-06-14'

  const neuBeimZweitenLauf = Object.keys(seit).filter(
    (id) => seit[id] >= grenze && seit[id] !== angelegtAm,
  )
  pruefe(
    'Synchro-Historie: der Ausgangsstand löst keine Massenmail aus',
    neuBeimZweitenLauf.length === 0,
    neuBeimZweitenLauf,
  )

  // Ein echter Zugang danach wird sehr wohl gemeldet.
  seit['4'] = '2026-08-20'
  const spaeter = Object.keys(seit).filter((id) => seit[id] >= grenze && seit[id] !== angelegtAm)
  pruefe('Synchro-Historie: ein späterer Zugang wird gemeldet', spaeter.length === 1 && spaeter[0] === '4', spaeter)
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
