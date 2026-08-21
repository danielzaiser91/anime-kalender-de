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
import { expandEvents, lastEpisodeDate } from '../shared/logic.ts'
import {
  alsEinBlock,
  bestimmeRhythmus,
  bewerteTreffer,
  ordneBloeckeZuStaffeln,
  passtZuSerie,
  staffelBloecke,
  staffelnDesFranchise,
  volltreffer,
  type AdnEpisode,
  type AdnShow,
} from './lib/adn.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'
import { beurteile } from './lib/crunchyroll-dub.ts'
import {
  bestandAus,
  belegtDeutsch,
  hatDeutschenTon,
  ordneFolgenZuStaffeln,
  ordneShowsZu,
  uebernehmbar,
  type MotnEpisode,
} from './lib/motn.ts'
import { beobachtungenZusammenfuehren } from './lib/crunchyroll.ts'
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

console.log('\nADN-Zuordnung: der beste Treffer, nicht der erste:')
{
  /**
   * Die beiden Fehlgriffe vom 17.08.2026, mit den echten Titeln.
   *
   * Beide entstanden aus derselben Ursache: `passtZuSerie` lässt jeden Treffer
   * durch, der ein aussagekräftiges Wort teilt, und früher gewann der erste
   * zulässige. Beide sind teuer geworden — der zweite hat den Build abgebrochen.
   */
  const titel = (romaji: string, english?: string) => ({ title: { romaji, english: english ?? null, native: null } })

  // Fall 1: „Motto To Love-Ru" gegen die Fortsetzung und den Reihenkopf. Alle
  // drei teilen „love", alle drei haben 12 bzw. 26 Folgen — die Stückzahl trennt
  // sie nicht, nur das Wort „Darkness" und die vollständige Deckung.
  const motto = { title: 'Motto To Love-Ru', originalTitle: 'Motto To Love-Ru' }
  const richtig = titel('Motto To LOVE-Ru', 'Motto To Love Ru')
  const darkness = titel('To LOVE-Ru Darkness', 'To Love Ru Darkness')
  const kopf = titel('To LOVE-Ru', 'To Love Ru')
  pruefe(
    'Motto To Love-Ru: die eigene Staffel schlägt Darkness',
    bewerteTreffer(motto, richtig) > bewerteTreffer(motto, darkness),
    [bewerteTreffer(motto, richtig), bewerteTreffer(motto, darkness)],
  )
  pruefe(
    'Motto To Love-Ru: die eigene Staffel schlägt den Reihenkopf',
    bewerteTreffer(motto, richtig) > bewerteTreffer(motto, kopf),
    [bewerteTreffer(motto, richtig), bewerteTreffer(motto, kopf)],
  )
  pruefe('Motto To Love-Ru: nur die eigene Staffel ist ein Volltreffer', volltreffer(motto, richtig) && !volltreffer(motto, darkness))

  /**
   * Fall 2: „Wolf's Rain" gegen seine OVA — der Fall, der den Build abbrach.
   *
   * „OVA" hat drei Buchstaben und fiel damit durch die Vier-Zeichen-Grenze der
   * Wortzerlegung. „Wolf's Rain OVA" sah dadurch wie vollständige Deckung aus,
   * die Suche brach beim ersten Treffer ab, und der Datensatz behauptete 30
   * Folgen für einen Eintrag mit vier. Deshalb zählen `ova`, `ona`, `oad` und
   * `tv` mit, obwohl sie kürzer sind — sie sind Werktypen, keine Füllwörter.
   */
  const wolf = { title: "Wolf's Rain", originalTitle: "Wolf's Rain" }
  const serie = titel("Wolf's Rain")
  const ova = titel("Wolf's Rain OVA")
  pruefe('Wolf’s Rain: die Serie schlägt ihre OVA', bewerteTreffer(wolf, serie) > bewerteTreffer(wolf, ova), [
    bewerteTreffer(wolf, serie),
    bewerteTreffer(wolf, ova),
  ])
  pruefe('Wolf’s Rain: die OVA ist kein Volltreffer', volltreffer(wolf, serie) && !volltreffer(wolf, ova))

  /**
   * Fall 3: „One Piece" gegen „One Piece • Le Film" — der Gleichstand.
   *
   * Beide teilen mit „ONE PIECE" genau ein Wort und bringen kein fremdes mit;
   * ohne die Deckungsprüfung standen sie gleich, und die Reihenfolge im Katalog
   * entschied. Der Film gewann, und die Serie stand ohne jede Zuordnung da —
   * schlimmer als der Fehler, der davor behoben werden sollte. „Film" ist das
   * Wort, das der Treffer nicht abdeckt, und genau das kostet ihn jetzt.
   */
  const opSerie = { title: 'One Piece', originalTitle: 'One Piece' }
  const opFilm = { title: 'One Piece • Le Film', originalTitle: 'One Piece • Le Film' }
  const onePiece = titel('ONE PIECE', 'ONE PIECE')
  pruefe(
    'One Piece: die Serie schlägt ihren Film um denselben Eintrag',
    bewerteTreffer(opSerie, onePiece) > bewerteTreffer(opFilm, onePiece),
    [bewerteTreffer(opSerie, onePiece), bewerteTreffer(opFilm, onePiece)],
  )

  // Und die Grenze kippt nicht ins Gegenteil: Füllwörter bleiben draußen, sonst
  // machte „The" aus jedem fremden Titel einen Halbtreffer.
  const the = { title: 'The Rising of the Shield Hero', originalTitle: '' }
  pruefe('Füllwörter zählen weiterhin nicht', bewerteTreffer(the, titel('The Eminence in Shadow')) <= 0, bewerteTreffer(the, titel('The Eminence in Shadow')))
}

console.log('\nLieferwellen sind keine Staffeln:')
{
  /**
   * One Piece, verkleinert: ADN teilt die deutschen Folgen in „Sagas", AniList
   * kennt für die Serie einen einzigen Eintrag. Kein Block lässt sich also einer
   * eigenen Staffel zuordnen, alle zeigen auf denselben Titel, und die Sperre
   * gegen Doppelungen behielt den ersten und warf den Rest weg — 505 der 515
   * belegten Folgen (17.08.2026).
   */
  const wellen: AdnShow = {
    showId: 561,
    title: 'One Piece',
    url: 'https://animationdigitalnetwork.com/de/video/561',
    // Wochentakt je Saga, sonst zerfällt jede Folge in einen eigenen Block —
    // `staffelBloecke` schneidet ohne Wochentakt nach Termin.
    episodes: [
      ...folgen(10, '2019-05-20', 'Saga 1', 1, 7),
      ...folgen(12, '2019-09-20', 'Saga 2', 11, 7),
      ...folgen(8, '2020-02-20', 'Saga 3', 23, 7),
    ],
    batch: true,
  }
  const bloecke = staffelBloecke(wellen)
  pruefe('drei Sagas ergeben drei Blöcke', bloecke.length === 3, bloecke.length)
  // Keine Staffeln im Datensatz — genau die Lage bei One Piece.
  const ohneStaffeln = ordneBloeckeZuStaffeln(bloecke, [])
  pruefe('ohne Reihenteile bekommt kein Block einen eigenen Titel', ohneStaffeln.every((z) => !z.teile.length))

  const einer = alsEinBlock(wellen)
  pruefe('zusammengefasst bleibt keine Folge liegen', einer.episodes.length === 30, einer.episodes.length)
  const alleDaten = wellen.episodes.map((e) => e.date).sort()
  pruefe(
    'der Zeitraum umspannt alle Wellen',
    einer.firstDate === alleDaten[0] && einer.lastDate === alleDaten[alleDaten.length - 1],
    [einer.firstDate, einer.lastDate],
  )
  pruefe('die Folgennummern laufen durch', einer.nummern.length === 30 && einer.nummern[29] === 30, einer.nummern.length)
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

  /**
   * Der Fall, der drei Wochenläufe gekostet hat (10.–17.08.2026).
   *
   * ADN führt „To Love-Ru" unter zwei Kennungen, 217 und 670, beide mit 26
   * Folgen. Die Zuordnung gab beiden denselben AniList-Eintrag 3455, und die
   * Prüfung brach ab: „zusammen 52 Folgen bei 26 vorhandenen". Der Abbruch war
   * richtig — er hat einen falschen Datensatz verhindert. Falsch war, dass die
   * Zuordnung überhaupt zwei Kennungen auf einen Titel legen konnte.
   *
   * Diese Zusicherung hält den Melder fest. Wer sie in Zukunft weicher stellt,
   * um „endlich wieder einen grünen Lauf" zu bekommen, bricht sie und muss die
   * Zuordnung reparieren statt den Melder.
   */
  const doppelt: Release[] = [
    { slug: 'adn-217', titleId: 3455, name: 'To LOVE-Ru', platform: 'adn', releaseType: 'batch', dateMeaning: 'available-from', schedule: { firstEpisodeDate: '2025-01-10', episodeCount: 26, lastEpisodeDate: '2025-01-10' }, year: 2025, sources: ['https://animationdigitalnetwork.com/de/'] },
    { slug: 'adn-670', titleId: 3455, name: 'To LOVE-Ru', platform: 'adn', releaseType: 'batch', dateMeaning: 'available-from', schedule: { firstEpisodeDate: '2025-03-14', episodeCount: 26, lastEpisodeDate: '2025-03-14' }, year: 2025, sources: ['https://animationdigitalnetwork.com/de/'] },
  ]
  const zwei = pruefeErgebnis(
    doppelt,
    doppelt.map((r, i) => ({ id: `t${i}`, releaseSlug: r.slug, titleId: 3455, date: r.schedule.firstEpisodeDate, episode: undefined, releaseType: 'batch' as const, platform: 'adn' as const, name: r.name })),
    new Map<number, Title>([[3455, titel(3455, 'To LOVE-Ru', 26, 2008, 'SPRING')]]),
    '2026-08-17',
  )
  pruefe(
    'zwei ADN-Kennungen auf einem Titel werden gemeldet',
    zwei.fehler.some((f) => f.includes('52 Folgen bei 26')),
    zwei.fehler,
  )
}

console.log('\nCrunchyroll: fremde Staffelfehler nicht nachbauen:')
{
  const t = (id: number, episodes: number, jahr: number): Title => titel(id, `T${id}`, episodes, jahr, 'SUMMER')

  /**
   * 1) Keine deutsche Tonspur in der Audio-Zeile — **kein** Urteil.
   *
   * Diese Zusicherung stand bis zum 15.08.2026 genau andersherum („beide
   * false") und hat die falsche Regel nicht etwa verhindert, sondern
   * festgeschrieben. Der Denkfehler: Ein Abruf ohne Anmeldung sieht bei
   * Crunchyroll nicht, was es gibt, sondern was ein Gast sehen darf — nicht
   * angemeldet, angemeldet ohne Abo und mit Abo sind drei Ansichten (Daniel,
   * 15.08.2026). 975 Einträge trugen daraufhin ein `dub: false`, das nichts
   * belegte, darunter Frieren.
   *
   * Sie steht jetzt in der Gegenrichtung und bewacht denselben Fehler von der
   * anderen Seite: Wer die alte Bequemlichkeit wieder einbaut, fällt hier auf.
   */
  const ohne = beurteile({ url: 'u', deutschImAngebot: false, geprueftAm: '2026-08-12' }, [
    t(1, 12, 2020),
    t(2, 12, 2021),
  ])
  pruefe('Gast-Ansicht ohne Deutsch belegt nichts: kein Urteil', ohne.length === 0, ohne)

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

/**
 * Was ein Mensch eingetragen hat, überlebt den nächsten Kalenderlauf.
 *
 * Der Vorrang stand überall im Projekt, nur nicht hier: `schedule.observed`
 * wurde beim Bau durch die Kalenderablesung **ersetzt**, und ein von Hand
 * eingetragener Mehrfachstart war beim nächsten Lauf wieder weg. Nachgestellt
 * wird der reale Fall — Crunchyroll zeigt für „Mushoku Tensei" Staffel 3 eine
 * Kachel am 19.08.2026, tatsächlich lagen dort drei Folgen (Daniel,
 * 21.08.2026).
 */
console.log('\nBeobachtungen zusammenführen:')
{
  const ausKalender = { 1: '2026-08-19' }
  const vonHand = { 2: '2026-08-19', 3: '2026-08-19' }
  const zusammen = beobachtungenZusammenfuehren(ausKalender, vonHand)
  pruefe(
    'kuratierte Beobachtungen gehen nicht verloren',
    zusammen?.[2] === '2026-08-19' && zusammen?.[3] === '2026-08-19',
    zusammen,
  )
  pruefe('die abgeleitete bleibt daneben stehen', zusammen?.[1] === '2026-08-19', zusammen)

  const kollision = beobachtungenZusammenfuehren({ 1: '2026-08-12' }, { 1: '2026-08-19' })
  pruefe('bei gleicher Folgennummer gewinnt die Handeintragung', kollision?.[1] === '2026-08-19', kollision)

  pruefe('ohne jede Beobachtung bleibt das Feld leer', beobachtungenZusammenfuehren({}, undefined) === undefined)

  // Und das Ergebnis muss im Sendeplan ankommen: drei Termine am selben Tag,
  // unterscheidbare Kennungen, und Folge 4 eine Woche nach dem Auftakt.
  const release: Release = {
    slug: 'mushoku-tensei-s3',
    titleId: 178789,
    name: 'Mushoku Tensei',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-08-19', episodeCount: 14, observed: zusammen },
    year: 2026,
    sources: ['https://www.crunchyroll.com/de/'],
  }
  const events = expandEvents(release)
  const amAuftakt = events.filter((e) => e.date === '2026-08-19')
  pruefe('drei Folgen am 19.08.2026', amAuftakt.length === 3, amAuftakt.map((e) => e.episode))
  pruefe('drei unterscheidbare Kennungen', new Set(amAuftakt.map((e) => e.id)).size === 3, amAuftakt.map((e) => e.id))
  pruefe(
    'Folge 4 eine Woche nach dem Auftakt',
    events.find((e) => e.episode === 4)?.date === '2026-08-26',
    events.find((e) => e.episode === 4)?.date,
  )
  pruefe('am Ende stehen 14 Folgen', events.length === 14 && events.at(-1)?.episode === 14, events.length)

  /**
   * Die Seite darf sich nicht selbst widersprechen: Die Zeile „Letzte Folge"
   * kommt aus `lastEpisodeDate`, die Liste darunter aus `expandEvents`. Ohne
   * die Stützpunkte rechnete die erste stur 13 Wochen ab dem Start und
   * behauptete den 18.11.2026, während die Liste am 04.11.2026 endete.
   */
  pruefe(
    'letzte Folge und Terminliste enden am selben Tag',
    lastEpisodeDate(release) === events.at(-1)?.date,
    { berechnet: lastEpisodeDate(release), liste: events.at(-1)?.date },
  )
}

/**
 * Die Streaming Availability API belegt nur, was da ist — nie, was fehlt.
 *
 * Vier Grenzen dieser Quelle wurden am 21.08.2026 gemessen, und jede davon
 * kostet eine Zeile Code, die man beim nächsten Umbau versehentlich wegräumen
 * kann. Deshalb steht hier je Grenze ein Fall.
 *
 * Der teuerste Irrtum wäre der dritte: Aus einem Schweigen ein Nein zu machen
 * hat diesem Projekt schon 975 falsche Angaben eingebracht. Folge 7 von
 * „Thunderbolt Fantasy" war am 19.08.2026 fällig, lag am 21.08. auf Netflix in
 * deutscher Fassung, und die API kannte sie nicht.
 */
console.log('\nStreaming Availability API:')
{
  const folge = (nummer: number, dienst: string, ton: string[], untertitel: string[] = []): MotnEpisode => ({
    episodeNumber: nummer,
    seasonNumber: 1,
    streamingOptions: {
      de: [
        {
          service: { id: dienst },
          audios: ton.map((language) => ({ language })),
          subtitles: untertitel.map((language) => ({ closedCaptions: false, locale: { language } })),
        },
      ],
    },
  })

  // Grenze 1: `audios` belegt, `subtitles` nicht. Die Trennlinie des Projekts.
  pruefe('deu unter audios ist ein Beleg', hatDeutschenTon({ audios: [{ language: 'deu' }] }))
  pruefe(
    'deu nur unter subtitles belegt nichts',
    !hatDeutschenTon({ audios: [{ language: 'jpn' }], subtitles: [{ locale: { language: 'deu' } }] }),
  )

  /**
   * Grenze 2: Die Serienebene widerspricht der eigenen Episodenebene. Bei
   * „Frieren" meldet sie deutschen Ton bei Crunchyroll, während alle 28
   * Crunchyroll-Episoden `audios: [jpn]` tragen. Gelesen wird deshalb nur die
   * Episodenebene — und Crunchyroll gar nicht.
   */
  const frieren = bestandAus(
    {
      imdbId: 'tt22248376',
      title: 'Frieren: Beyond Journey’s End',
      firstAirYear: 2023,
      streamingOptions: { de: [{ service: { id: 'crunchyroll' }, audios: [{ language: 'deu' }] }] },
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            ...Array.from({ length: 28 }, (_, i) => folge(i + 1, 'netflix', ['jpn', 'deu'])),
            // Die laufende zweite Staffel steht dort als leerer Platzhalter.
            { episodeNumber: 29, seasonNumber: 1, title: 'Episode 29' },
          ],
        },
      ],
    },
    '2026-08-21',
  )
  pruefe(
    'die Serienebene bringt keinen Dienst in den Bestand',
    // Auf Serienebene steht dort Crunchyroll mit deutschem Ton. Erfasst ist
    // trotzdem nur, was die Folgen selbst tragen — hier also Netflix.
    !frieren?.dienste.crunchyroll && !!frieren?.dienste.netflix,
    frieren?.dienste,
  )
  pruefe('28 Netflix-Folgen mit deutschem Ton', frieren?.dienste.netflix?.deutsch.length === 28, frieren?.dienste.netflix?.deutsch.length)
  pruefe('die leere Folge 29 wird nirgends gelistet', !frieren?.dienste.netflix?.gelistet.includes(29))

  /**
   * Grenze 3: Die Staffelzählung der Quelle ist eine andere als unsere.
   * „Frieren" ist dort **eine** Staffel mit 39 Folgen, bei uns sind es 28 + 11.
   * Zugeordnet wird deshalb über Folgennummern.
   */
  const s1 = titel(52991, 'Frieren', 28, 2023, 'FALL')
  const s2 = titel(176496, 'Frieren Staffel 2', 11, 2026, 'WINTER')
  const bereiche = ordneFolgenZuStaffeln(39, [s1, s2])
  pruefe('39 Folgen der Quelle sind unsere 28 + 11', bereiche?.length === 2, bereiche)
  pruefe('Staffel 2 beginnt bei Folge 29', bereiche?.[1]?.von === 29 && bereiche?.[1]?.bis === 39, bereiche?.[1])

  /**
   * Geht die Rechnung nicht auf, gibt es **keine** Zuordnung. Bei „Sword Art
   * Online" haben Staffel 2 und Alicization beide 24 Folgen — die Zahl trennt
   * sie nicht, also ist sie kein Beweis.
   */
  const sao2 = titel(20594, 'Sword Art Online II', 24, 2014, 'SUMMER')
  const alicization = titel(100182, 'Sword Art Online: Alicization', 24, 2018, 'FALL')
  pruefe(
    'zwei gleich lange Staffeln ergeben keine Zuordnung',
    ordneFolgenZuStaffeln(24, [titel(11757, 'Sword Art Online', 25, 2012, 'SUMMER'), sao2, alicization]) === undefined,
  )

  /**
   * Grenze 4 — und die schärfste Regel: Aus dieser Quelle entsteht nie ein
   * `dub: false`, und aus einem **laufenden** Release entsteht gar nichts. Bei
   * Mushoku Tensei Staffel 3 meldete sie null deutsche Folgen, während seit dem
   * 19.08.2026 drei belegt sind.
   */
  const beleg = {
    titleId: 178789,
    platform: 'netflix' as const,
    imdbId: 'tt13293588',
    von: 1,
    bis: 12,
    deutsch: true,
    eindeutig: true,
  }
  pruefe('abgeschlossen und eindeutig: übernommen', uebernehmbar(beleg, false, '2026-08-21'))
  pruefe('laufendes Release: nichts wird übernommen', !uebernehmbar(beleg, true, '2026-08-21'))
  pruefe('unvollständige Zuordnung: nichts wird übernommen', !uebernehmbar({ ...beleg, eindeutig: false }, false, '2026-08-21'))
  pruefe(
    'Crunchyroll kommt aus dieser Quelle nie in den Datensatz',
    !uebernehmbar({ ...beleg, platform: 'crunchyroll' }, false, '2026-08-21'),
  )
  pruefe(
    'ein abgelaufenes Angebot belegt nichts mehr',
    !uebernehmbar({ ...beleg, laeuftAusAm: '2026-08-01' }, false, '2026-08-21'),
  )

  /**
   * Eine Folge ohne Eintrag heißt „noch nicht bekannt", nicht „ohne deutschen
   * Ton" — der Beleg gilt deshalb nur, wenn **jede** Folge des Bereichs ihn
   * trägt. Genau der Fall `thunder-3`: Folgen 1 bis 6 mit deutschem Ton, ab 7
   * keine Netflix-Option, und Folge 7 gibt es trotzdem.
   */
  const thunder = { gelistet: [1, 2, 3, 4, 5, 6], deutsch: [1, 2, 3, 4, 5, 6] }
  pruefe('Folgen 1 bis 6 sind belegt', belegtDeutsch(thunder, 1, 6))
  pruefe('Folge 7 ist nicht belegt, nur unbekannt', !belegtDeutsch(thunder, 1, 7))

  /**
   * Ein geteiltes Wort ist keine Zuordnung.
   *
   * Gemessen am 21.08.2026 gegen den echten Datensatz: Ein Bestand mit der
   * einen Serie „Akashic Records of Bastard Magic Instructor" (12 Folgen) zog
   * über das Wort „magic" fünf fremde Reihen an — MASHLE, The Saint's Magic
   * Power is Omnipotent, Anti-Magic Academy, Magic Maker. Alle haben zwölf
   * Folgen, also ging bei allen auch die Folgenrechnung auf. Was sie trennt,
   * ist die vollständige Wortdeckung und das Jahr.
   */
  const richtig = titel(21700, 'Akashic Records of Bastard Magic Instructor', 12, 2017, 'SPRING')
  const fremd = titel(151801, 'MASHLE: MAGIC AND MUSCLES', 12, 2023, 'SPRING')
  const zuordnungen = ordneShowsZu(
    [richtig, fremd],
    {
      tt6741278: {
        imdbId: 'tt6741278',
        titel: 'Akashic Records of Bastard Magic Instructor',
        jahr: 2017,
        folgen: 12,
        dienste: { netflix: { gelistet: [1], deutsch: [1] } },
        geprueftAm: '2026-08-21',
      },
    },
    () => [],
    { passtZuSerie, bewerteTreffer, volltreffer },
  )
  pruefe(
    'nur die passende Reihe bekommt eine Zuordnung',
    zuordnungen.length === 1 && zuordnungen[0].titleId === 21700,
    zuordnungen.map((z) => z.titleId),
  )

  /**
   * Grenze 5 — ein Kanal im fremden Abo ist nicht der Katalog des Anbieters.
   *
   * Am 21.08.2026 am ersten echten Abruf sichtbar geworden und an 130 Serien
   * bestätigt: Neben `netflix` und `crunchyroll` steht bei „Frieren" ein
   * dritter Eintrag mit `service.id = "prime"`, `type = "addon"` und
   * `addon.id = "crunchyrollde"` — der Crunchyroll-Kanal bei Amazon. Wer nur
   * `service.id` liest, schreibt Prime Video 24 deutsche Folgen zu, die es dort
   * nicht gibt.
   *
   * Der Kanal wird trotzdem **erfasst**, weil die Kontrollmessung ohne ihn fast
   * leer bliebe: Der Dienst `crunchyroll` führte 2.252 Folgeneinträge mit 108
   * `deu`, der Kanal `crunchyrollde` 1.158 mit 1.093.
   */
  const mitKanal = bestandAus(
    {
      imdbId: 'tt00000001',
      title: 'Kanalprobe',
      firstAirYear: 2023,
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            {
              episodeNumber: 1,
              seasonNumber: 1,
              streamingOptions: {
                de: [{ service: { id: 'prime' }, type: 'addon', addon: { id: 'crunchyrollde' }, audios: [{ language: 'deu' }] }],
              },
            },
          ],
        },
      ],
    },
    '2026-08-21',
  )
  pruefe('ein Kanal landet nicht im Katalog seines Basisdienstes', !mitKanal?.dienste.primevideo, mitKanal?.dienste)
  pruefe('ein Kanal wird eigens geführt', mitKanal?.addons?.crunchyrollde?.deutsch.length === 1, mitKanal?.addons)

  /**
   * Und die Zusicherung, an der alles hängt: Ein Beleg aus einem Kanal geht
   * **nie** in den Datensatz, auch wenn sonst alles passt. Er belegt die
   * Sprachfassung, nicht das Angebot des Anbieters, unter dem er läuft — und
   * „Crunchyroll bei Amazon hat Folge 3 auf Deutsch" ist keine Aussage über
   * crunchyroll.com und schon gar keine über Netflix.
   */
  pruefe(
    'ein Beleg aus einem Kanal wird nie übernommen',
    !uebernehmbar({ ...beleg, kanal: 'crunchyrollde' }, false, '2026-08-21'),
  )
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
