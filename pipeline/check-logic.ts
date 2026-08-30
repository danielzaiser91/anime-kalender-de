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
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { discSlug } from './lib/util.ts'
import { expandEvents, lastEpisodeDate, istErschienen, titleStatus } from '../shared/logic.ts'
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
import {
  beurteileAdnVerweis,
  leeresArchiv,
  nimmSerieAuf,
  zerlegeAdnAdresse,
  type AdnRohVideo,
} from './lib/adn-sprachen.ts'
import {
  beschreibeBereiche,
  bildeBereiche,
  ordneFolgeZu,
  ordneMeldungZu,
  ordneNachStaffelliste,
  verteileAufStaffeln,
} from './lib/folgenbereiche.ts'
import { adressePasst, entwirreWeiterleitung, plattformAusAdresse } from '../shared/adresse-passt.ts'
import { dubGrenze } from '../shared/dub-grenze.ts'
import { netflixNeutral } from '../shared/mappings.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'
import { schluesselAdresse, titelSchluessel } from './lib/zuordnung.ts'
import { netflixTitelAdresse } from './lib/netflix-adresse.ts'
import { findeStaffel, folgenKern, ordneZu } from '../shared/folgen-zuordnung.ts'
import { netflixAdresseTaugt } from '../shared/netflix-adresse-pruefung.ts'
import { beurteile } from './lib/crunchyroll-dub.ts'
import {
  bucketLand,
  hauptStaffeln,
  kennungAusZiel,
  ladeZugang,
  nameNenntDeutsch,
  staffelAuszaehlen,
} from './lib/crunchyroll-api.ts'
import {
  bestandAus,
  belegtDeutsch,
  hatDeutschenTon,
  ordneFolgenZuStaffeln,
  ordneShowsZu,
  uebernehmbar,
  type MotnEpisode,
} from './lib/motn.ts'
import {
  beobachtungenZusammenfuehren,
  durchlaufendeZaehlung,
  DURCHZAEHLUNG_UNKLAR,
} from './lib/crunchyroll.ts'
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

/**
 * Crunchyroll zählt die Reihe durch, AniList zählt je Staffel.
 *
 * Der Fall vom 21.08.2026: „Wistoria: Wand and Sword Staffel 2" stand mit zwölf
 * Terminen vom 08.02. bis 26.04.2026 im Datensatz. Belegt war das Gegenteil —
 * Staffel 2 lief vom 03.05. bis 19.07.2026 als Folgen 13 bis 24. Alle zwölf
 * ausgelieferten Termine waren erfunden, und kein einziger belegter stand drin.
 *
 * Nachgestellt werden beide Hälften: die Ableitung, die den Fehler erzeugte,
 * und die Gegenprobe, die ihn künftig abfängt.
 */
console.log('\nDurchlaufende Folgenzählung:')
{
  const wistoria: Record<number, string> = {
    17: '2026-05-31',
    18: '2026-06-07',
    19: '2026-06-14',
    20: '2026-06-21',
    21: '2026-06-28',
    22: '2026-07-05',
    23: '2026-07-12',
    24: '2026-07-19',
  }
  /**
   * Wie weit der Kalender am 21.08.2026 inhaltlich reichte: bis zum 19.08. Der
   * abgesuchte Zeitraum ging bis zum 30.08., aber Crunchyroll kündigt
   * Synchronfolgen praktisch nicht vor — hinter dem 19.08. stand im ganzen
   * Kalender keine einzige deutsche Kachel mehr.
   *
   * Für Wistoria reicht das: Folge 25 hätte am 26.07. stehen müssen, einen
   * Monat vor dieser Marke. Sie steht nicht da, also endete die Staffel bei 24.
   */
  const kalenderBis = '2026-08-19'

  const z = durchlaufendeZaehlung(wistoria, 12, kalenderBis)
  pruefe('Wistoria: Staffel 2 beginnt bei Folge 13', z?.firstEpisodeNumber === 13, z)
  pruefe('Wistoria: Start am 03.05.2026', z?.firstEpisodeDate === '2026-05-03', z?.firstEpisodeDate)
  pruefe('Wistoria: zwölf Folgen bleiben zwölf', z?.episodeCount === 12, z?.episodeCount)

  // Eine Staffel, die wirklich bei eins beginnt und nur aus dem Abruffenster
  // gerutscht ist, wird nicht angefasst — die Rückrechnung ist dort richtig.
  pruefe(
    'Folge 5 in einem Zwölfteiler ist kein Fall für die Korrektur',
    durchlaufendeZaehlung({ 5: '2026-05-26', 6: '2026-06-02' }, 12, kalenderBis) === undefined,
  )

  /**
   * „The 100 Girlfriends" Staffel 3, der zweite große Fall vom 21.08.2026: 24
   * zurückgerechnete Termine ab Februar. Die Reihe läuft aber noch — Folge 28
   * lief am 16.08., Folge 29 stünde am 23.08. und damit hinter allem, was der
   * Kalender zeigt. Ihr Ausbleiben belegt nichts.
   *
   * Damit ist die Startnummer nicht zu bestimmen: Bei zwölf Folgen je Staffel
   * käme jede Zahl von 17 bis 25 in Frage. Geraten wird keine — geführt wird,
   * was gesehen wurde. (Anker auf Folge 28 hätte Folge 17 ergeben, also
   * dieselbe Erfindung wie zuvor, nur um acht Wochen versetzt.)
   */
  const laeuftNoch = durchlaufendeZaehlung(
    { 25: '2026-07-26', 26: '2026-08-02', 27: '2026-08-09', 28: '2026-08-16' },
    12,
    kalenderBis,
  )
  pruefe(
    'noch laufende Reihe: nur das Belegte, keine Rückrechnung',
    laeuftNoch?.firstEpisodeNumber === 25 &&
      laeuftNoch?.firstEpisodeDate === '2026-07-26' &&
      laeuftNoch?.episodeCount === 4 &&
      laeuftNoch?.note === DURCHZAEHLUNG_UNKLAR,
    laeuftNoch,
  )

  // Und ohne belegte Staffellänge erst recht nicht — dann fehlt jeder Anker.
  const ohneFolgenzahl = durchlaufendeZaehlung({ 25: '2026-07-26' }, undefined, kalenderBis)
  pruefe(
    'ohne belegte Staffellänge bleibt es beim Belegten',
    ohneFolgenzahl?.firstEpisodeNumber === 25 && ohneFolgenzahl?.episodeCount === 1,
    ohneFolgenzahl,
  )

  // Und der Sendeplan muss am Ende genau das ergeben: Folge 13 am 03.05.,
  // Folge 17 am 31.05. als belegter Stützpunkt, Folge 24 am 19.07.
  const release: Release = {
    slug: 'cr-GW4HM7WK9',
    titleId: 182300,
    name: 'Wistoria: Wand and Sword Staffel 2',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: z?.firstEpisodeDate ?? '',
      firstEpisodeNumber: z?.firstEpisodeNumber,
      episodeCount: z?.episodeCount,
      observed: wistoria,
    },
    year: 2026,
    sources: ['https://www.crunchyroll.com/de/simulcastcalendar'],
  }
  const termine = expandEvents(release)
  pruefe('zwölf Termine, Folge 13 bis 24', termine.length === 12 && termine.at(-1)?.episode === 24, termine.length)
  pruefe('Folge 13 am 03.05.2026', termine[0]?.date === '2026-05-03', termine[0]?.date)
  pruefe(
    'Folge 17 am 31.05.2026 — belegt, nicht gerechnet',
    termine.find((e) => e.episode === 17)?.date === '2026-05-31',
    termine.find((e) => e.episode === 17)?.date,
  )
  pruefe('Folge 24 am 19.07.2026', termine.at(-1)?.date === '2026-07-19', termine.at(-1)?.date)

  /**
   * Die Gegenprobe am erzeugten Datensatz: Der Stand vom 21.08.2026 muss
   * auffallen, ohne dass jemand von Crunchyrolls Zählweise weiß. „Der letzte
   * Termin liegt vor der frühesten belegten Beobachtung" reicht dafür.
   */
  const alt: Release = {
    ...release,
    schedule: {
      firstEpisodeDate: '2026-02-08',
      episodeCount: 12,
      observed: wistoria,
    },
  }
  const gemeldet = pruefeErgebnis(
    [alt],
    expandEvents(alt),
    new Map<number, Title>([[182300, titel(182300, 'Wistoria: Wand and Sword Season 2', 12, 2026, 'SPRING')]]),
    '2026-08-21',
  )
  pruefe(
    'Termine vor der frühesten Beobachtung werden gemeldet',
    gemeldet.fehler.some((f) => f.includes('vor der frühesten belegten')),
    gemeldet.fehler,
  )
  const repariert = pruefeErgebnis(
    [release],
    expandEvents(release),
    new Map<number, Title>([[182300, titel(182300, 'Wistoria: Wand and Sword Season 2', 12, 2026, 'SPRING')]]),
    '2026-08-21',
  )
  pruefe('der reparierte Sendeplan geht durch', repariert.fehler.length === 0, repariert.fehler)
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

  /**
   * 1b) Dieselbe Auskunft, aber aus dem **US-Katalog** — weiterhin kein Urteil.
   *
   * Der Grund ist seit dem 22.08.2026 präziser als „Gast gegen Angemeldeter":
   * Crunchyroll leitet die Region aus der IP ab, GitHub-Runner stehen in den
   * USA, und dort trägt „Fairy Tail" durchgehend `ja-JP, en-US` — während
   * Daniel in Deutschland 277 deutsche Folgen sieht. Alle 1.655 Folgen des
   * Laufs vom 21.08.2026 tragen `eligible_region: "US"`.
   *
   * Ein Block **mit** Folgen macht daran nichts besser: Die Folgenliste ist
   * vollständig, sie ist nur die falsche.
   */
  const ausUs = beurteile(
    {
      url: 'u',
      katalog: 'us',
      deutschImAngebot: false,
      geprueftAm: '2026-08-21',
      staffeln: [{ name: 'Fairy Tail', folgen: 175, kacheln: 175, deutsch: 0, fremd: 175 }],
    },
    [t(1, 175, 2009)],
  )
  pruefe('US-Katalog ohne de-DE: kein Urteil', ausUs.length === 0, ausUs)

  /**
   * 1c) Aus dem **deutschen** Katalog ist dasselbe Schweigen ein Nein.
   *
   * „Fairy Tail Final Season" trägt dort `ja-JP` und sonst nichts, während die
   * ersten beiden Blöcke `de-DE` führen — genau der Stand, den Daniel von Hand
   * gesehen hat (22.08.2026). Ein Katalog, der die deutsche Fassung der
   * Nachbarstaffeln kennt und diese nicht, sagt etwas aus.
   *
   * Die Zusicherung bewacht beide Richtungen: Wer das `katalog`-Feld wegnimmt
   * oder es hier weglässt, verliert einen belegten Befund; wer die Bedingung
   * lockert, holt sich 426 unbelegte Neins zurück.
   */
  const ausDe = beurteile(
    {
      url: 'u',
      katalog: 'de',
      deutschImAngebot: false,
      geprueftAm: '2026-08-22',
      staffeln: [{ name: 'Fairy Tail Final Season', folgen: 51, kacheln: 51, deutsch: 0, fremd: 51 }],
    },
    [t(1, 51, 2018)],
  )
  pruefe(
    'deutscher Katalog ohne de-DE: belegtes Nein',
    ausDe.length === 1 && ausDe[0].dub === false,
    ausDe,
  )

  /**
   * 1d) Ohne gelesene Blöcke bleibt es auch im deutschen Katalog beim Schweigen.
   *
   * Eine leere Staffelliste heißt „diese Kennung führt hier nichts" — das ist
   * eine Nichtauskunft und wird oben zu `nichtVerfuegbar` oder zu einem
   * `fehler`, aber nie zu einer Aussage über die Tonspur.
   */
  const leerDe = beurteile({ url: 'u', katalog: 'de', deutschImAngebot: false, geprueftAm: '2026-08-22' }, [t(1, 12, 2020)])
  pruefe('deutscher Katalog ohne jeden Block: kein Urteil', leerDe.length === 0, leerDe)

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

  /**
   * 7) Der Gun-Gale-Fall: Wir führen nur die **zweite** Staffel dieser Adresse.
   *
   * Zwei Blöcke zu je zwölf Folgen, der erste ohne deutsche Folge, der zweite
   * vollständig deutsch. Unser einziger Eintrag ist der zweite — aber das
   * Anlegen beginnt beim ersten Block, und zwölf ist zwölf. Herausgekommen
   * wäre „Gun Gale Online II ohne deutsche Folge" für eine Staffel, die
   * durchgehend deutsch ist (21.08.2026, aus der Content-API).
   *
   * Sichtbar wurde es erst mit der genaueren Quelle: Die Serienseite las beide
   * Blöcke als vollständig deutsch, damit zog Fall 2 und die Zuordnung kam gar
   * nicht erst dran.
   */
  const nurZweite = beurteile(
    {
      url: 'u',
      deutschImAngebot: true,
      geprueftAm: '2026-08-21',
      staffeln: [
        { name: 'Gun Gale Online', folgen: 12, kacheln: 12, deutsch: 0, fremd: 12 },
        { name: 'Gun Gale Online II', folgen: 12, kacheln: 12, deutsch: 12, fremd: 0 },
      ],
    },
    [t(2, 12, 2024)],
  )
  pruefe('weniger Einträge als Blöcke: kein Urteil, statt am falschen Block zu rechnen', nurZweite.length === 0, nurZweite)
}

/**
 * Die Content-API zählt nach `versions`, nicht nach `is_dubbed`.
 *
 * `is_dubbed` steht auf `true`, sobald es **irgendeine** Synchronfassung gibt.
 * Bei „Mushoku Tensei" Staffel 3 tragen es auch die Folgen 4 und 5, obwohl dort
 * nur Englisch, Italienisch, Spanisch und Portugiesisch vorliegen (Daniel,
 * 21.08.2026). Wer das Feld benutzte, hielte jede Folge für deutsch
 * synchronisiert — und weil das Feld genau dann falsch ist, wenn es darauf
 * ankommt, fällt es beim Nachsehen an Stichproben nicht auf.
 *
 * Nachgestellt ist der echte Fall: acht Folgen, die ersten drei mit deutscher
 * Fassung, alle acht mit fremden Synchronfassungen.
 */
{
  console.log('\n8) Crunchyroll-Content-API: Tonspuren je Folge')
  const version = (locale: string, guid: string, original = false) => ({ audio_locale: locale, guid, original })
  const mushoku = Array.from({ length: 8 }, (_, i) => ({
    episode_number: i + 1,
    is_dubbed: true,
    versions: [
      version('ja-JP', `GE0037445${i}JAJP`, true),
      version('en-US', `GE0037445${i}ENUS`),
      version('it-IT', `GE0037445${i}ITIT`),
      ...(i < 3 ? [version('de-DE', `GE0037445${i}DEDE`)] : []),
    ],
  }))
  const gezaehlt = staffelAuszaehlen(mushoku)
  const deutsch = [...gezaehlt.jeFolge.values()].filter((x) => x === 'deutsch').length
  const fremd = [...gezaehlt.jeFolge.values()].filter((x) => x === 'fremd').length
  pruefe('drei von acht Folgen deutsch, nicht acht von acht', deutsch === 3, deutsch)
  pruefe('die übrigen fünf gelten als fremd vertont, nicht als deutsch', fremd === 5, fremd)
  pruefe(
    'je deutscher Folge genau eine Kennung, und zwar die de-DE-Fassung',
    gezaehlt.deutscheFolgen.length === 3 && gezaehlt.deutscheFolgen.every((f) => f.guid.endsWith('DEDE')),
    gezaehlt.deutscheFolgen,
  )

  /**
   * Dieselbe Folge zweimal, einmal deutsch und einmal nicht.
   *
   * Crunchyroll führt Folgen doppelt und hat sogar zwei Wähler-Einträge zur
   * selben Staffel (Daniel, 12.08.2026). Gezählt wird deshalb je Folgennummer,
   * und die deutsche Fassung schlägt die fremde — sonst hinge das Ergebnis
   * daran, in welcher Reihenfolge die Schnittstelle antwortet.
   */
  const doppelt = staffelAuszaehlen([
    { episode_number: 1, versions: [version('ja-JP', 'a', true)] },
    { episode_number: 1, versions: [version('ja-JP', 'a', true), version('de-DE', 'aDEDE')] },
    { episode_number: 2, versions: [version('ja-JP', 'b', true), version('de-DE', 'bDEDE')] },
    { episode_number: 2, versions: [version('ja-JP', 'b', true)] },
  ])
  pruefe(
    'doppelt geführte Folgen zählen einmal, und zwar deutsch',
    doppelt.jeFolge.size === 2 && [...doppelt.jeFolge.values()].every((x) => x === 'deutsch'),
    [...doppelt.jeFolge],
  )

  /**
   * Ein misslungener Seitenaufruf ist eine Nichtauskunft, keine fremde Serie.
   *
   * Der teuerste Fehler dieses Abrufs, gemessen am 21.08.2026: Crunchyroll zog
   * nach rund 300 Serien die Bot-Sperre, jedes weitere `page.goto` schlug fehl
   * — und weil ein fehlgeschlagener Aufruf die Seite nicht wechselt, stand im
   * Browser weiter die Aufwärmseite. 91 fremde Adressen bekamen deren
   * Staffelliste zugeschrieben, „sing-a-bit-of-harmony" mitsamt
   * „JUJUTSU KAISEN: 24/24".
   */
  const zielFaelle: [string, string | undefined][] = [
    ['about:blank', undefined],
    ['https://www.crunchyroll.com/de/series/GRDV0019R', undefined],
    ['https://www.crunchyroll.com/de/series/GRDV0019R/jujutsu-kaisen', 'GRDV0019R'],
    ['https://www.crunchyroll.com/de/watch/GE00374453/eine-folge', undefined],
    ['https://www.crunchyroll.com/de/sing-a-bit-of-harmony', undefined],
  ]
  for (const [ziel, soll] of zielFaelle) {
    const ist = kennungAusZiel(ziel)
    pruefe(`Kennung aus „${ziel.slice(0, 58)}" ist ${soll ?? 'keine'}`, ist === soll, ist)
  }

  // Folgen ohne Nummer (Filme, Specials) dürfen nicht zu einer verschmelzen.
  const ohneNummer = staffelAuszaehlen([
    { versions: [version('ja-JP', 'x', true)] },
    { versions: [version('ja-JP', 'y', true), version('de-DE', 'yDEDE')] },
  ])
  pruefe('Folgen ohne Nummer bleiben getrennt', ohneNummer.jeFolge.size === 2, [...ohneNummer.jeFolge])
}

/**
 * Der deutsche Katalog führt je Tonspur eine eigene Staffel.
 *
 * Der echte Fall, gemessen am 22.08.2026: „Fairy Tail" liefert über
 * `/cms/v2/DE/M2/-/seasons` **fünf** Blöcke statt der drei aus `/content/v2` —
 * zu den Staffeln 1 und 2 kommt je ein Block „(German Dub)". Ungefiltert zählte
 * die Serie dieselben Folgen zweimal, und `beurteile()` legte unsere Staffeln
 * an Blöcken an, die es als eigene Staffeln gar nicht gibt.
 */
{
  console.log('\n9) Crunchyroll: je Tonspur eine Staffel — wieder zusammenlegen')
  const st = (id: string, title: string, original: string, deutsch?: string) => ({
    id,
    title,
    slug_title: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    versions: [
      { audio_locale: 'ja-JP', guid: original, original: true },
      ...(deutsch ? [{ audio_locale: 'de-DE', guid: deutsch, original: false }] : []),
    ],
  })
  const fairyTail = [
    st('GRWEC397X', 'Fairy Tail (German Dub)', 'GYQ4KKN16', 'GRWEC397X'),
    st('GYQ4KKN16', 'Fairy Tail', 'GYQ4KKN16', 'GRWEC397X'),
    st('G65VCD2G9', 'Fairy Tail Series 2 (German Dub)', 'GR5VKXN8R', 'G65VCD2G9'),
    st('GR5VKXN8R', 'Fairy Tail Staffel 2', 'GR5VKXN8R', 'G65VCD2G9'),
    st('GY5PJVE7Y', 'Fairy Tail Final Season', 'GY5PJVE7Y'),
  ]
  const haupt = hauptStaffeln(fairyTail)
  pruefe('aus fünf Blöcken werden drei', haupt.length === 3, haupt.map((s) => s.title))
  /**
   * Genommen wird der **Originalblock**, nicht der deutsche.
   *
   * Der deutsche Block enthält nur die Folgen, die es deutsch gibt — er wäre
   * immer zu 100 Prozent deutsch, und „15 von 17" ließe sich daran nie ablesen.
   * Am Originalblock hängt die vollständige Folgenliste, und jede Folge nennt
   * in ihrem eigenen `versions`, ob es sie deutsch gibt.
   */
  pruefe(
    'gewählt ist je Paar der Originalblock',
    haupt.map((s) => s.id).join(',') === 'GYQ4KKN16,GR5VKXN8R,GY5PJVE7Y',
    haupt.map((s) => s.id),
  )
  // Fehlt der Originalblock im Katalog, bleibt der vorhandene Block stehen —
  // sonst fiele eine Staffel ersatzlos aus der Zählung.
  const nurDub = hauptStaffeln([st('GRWEC397X', 'Nur die Synchro', 'GYQ4KKN16', 'GRWEC397X')])
  pruefe('ohne Originalblock bleibt der vorhandene', nurDub.length === 1 && nurDub[0].id === 'GRWEC397X', nurDub)

  /**
   * Der Name ist die Kontrolle, `versions` ist der Beleg.
   *
   * Er darf nie selbst entscheiden: „German" im Titel eines Blocks sagt nichts
   * darüber, welche seiner Folgen deutsch vorliegen, und ein Block ohne diesen
   * Zusatz kann die deutsche Fassung trotzdem führen.
   */
  pruefe('„(German Dub)" wird als Nennung erkannt', nameNenntDeutsch('Fairy Tail (German Dub)'))
  pruefe('der Slug genügt auch', nameNenntDeutsch(undefined, 'fairy-tail-german-dub'))
  pruefe('ein gewöhnlicher Staffelname nennt nichts', !nameNenntDeutsch('Fairy Tail Staffel 2', 'fairy-tail-series-2'))
}

/**
 * Ohne gültiges Zugangspaket wird nicht abgerufen — und schon gar nicht geraten.
 *
 * Die Regel, um die es geht: Ein Lauf, der unbemerkt die falsche Region liest,
 * ist schlimmer als keiner. Er schreibt Befunde in den Datensatz, die für
 * Deutschland nichts belegen, und niemand sieht es der Datei an. Deshalb prüft
 * `ladeZugang()` vor dem ersten Abruf, und deshalb wirft es, statt etwas
 * zurückzugeben.
 */
{
  console.log('\n10) Crunchyroll-Zugangspaket: fehlt oder abgelaufen heißt Abbruch')
  const paket = (gueltigBis: string) =>
    JSON.stringify({
      land: 'DE',
      bucket: '/DE/M2/-',
      policy: 'p',
      signature: 's',
      key_pair_id: 'k',
      gueltig_bis: gueltigBis,
    })
  const wirft = (roh: string | undefined): string | undefined => {
    try {
      ladeZugang(roh)
      return undefined
    } catch (err) {
      return (err as Error).message
    }
  }
  // Leerzeichenkette statt `undefined`: Ein weggelassenes Argument greift auf
  // `process.env.CR_ZUGANG` zurück, und im CI ist das gesetzt.
  pruefe('ungesetztes CR_ZUGANG: Abbruch', (wirft('') ?? '').includes('Kein Zugangspaket'), wirft(''))
  pruefe('CR_ZUGANG aus Leerzeichen: Abbruch', wirft('   ') !== undefined)
  pruefe('kaputtes JSON: Abbruch', (wirft('{nope') ?? '').includes('kein JSON'), wirft('{nope'))
  pruefe(
    'unvollständiges Paket: Abbruch mit Namen des fehlenden Feldes',
    (wirft(JSON.stringify({ land: 'DE', bucket: '/DE/M2/-' })) ?? '').includes('signature'),
    wirft(JSON.stringify({ land: 'DE', bucket: '/DE/M2/-' })),
  )
  const abgelaufen = wirft(paket('2020-01-01T00:00:00Z'))
  pruefe(
    'abgelaufenes Paket: Abbruch mit dem Befehl zum Erneuern',
    (abgelaufen ?? '').includes('abgelaufen') && (abgelaufen ?? '').includes('cr-zugang-holen.mjs'),
    abgelaufen,
  )
  const gueltig = new Date(Date.now() + 3600_000).toISOString()
  pruefe('gültiges Paket kommt durch', ladeZugang(paket(gueltig)).bucket === '/DE/M2/-')

  /**
   * Die Region steht im **Bucket**, nicht im Feld daneben.
   *
   * Unterschrieben ist der Pfad `/DE/M2/-`; `land` ist eine Beigabe aus der
   * Token-Antwort. Wo beide auseinandergehen, gilt die Signatur — sie ist es,
   * die den Katalog öffnet.
   */
  pruefe('das Land kommt aus dem Bucket', bucketLand('/DE/M2/-') === 'DE', bucketLand('/DE/M2/-'))
  pruefe('ein Bucket ohne Land liefert nichts', bucketLand('/M2/-') === undefined, bucketLand('/M2/-'))
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
 * Das ADN-Archiv beantwortet nur, wonach der Verweis fragt.
 *
 * Die Auskunft ist verlockend eindeutig — `vde` steht je Folge in der
 * Rohantwort —, und genau deshalb ist die Versuchung groß, sie weiter zu
 * spannen, als sie trägt. Eine ADN-Serienkennung ist ein Franchise, keine
 * Staffel: Unter 1375 liegen beide Staffeln von Dorohedoro, elf Folgen der
 * zweiten mit deutscher Fassung und dreizehn der ersten ohne. Wer daraus für
 * einen Verweis auf die nackte Serienseite irgendetwas ableitet, rät.
 *
 * Der zweite Fall steht hier, weil er beim Bau tatsächlich zugeschlagen hat:
 * `animationdigitalnetwork.de/video/50-nuances-de-gras` ist „Plus-Sized Elf"
 * unter seinem französischen Namen, und die 50 davor ist keine Serienkennung.
 * Unter der alten Adresse steht dort ein Name, unter der neuen eine Zahl.
 */
console.log('\nADN-Sprachen aus dem Archiv:')
{
  const folgenRoh = (anzahl: number, season: string, abId: number, vde: boolean): AdnRohVideo[] =>
    Array.from({ length: anzahl }, (_, i) => ({
      id: abId + i,
      season,
      languages: vde ? ['vostde', 'vde'] : ['vostde'],
      show: { url: `https://animationdigitalnetwork.com/de/video/1375-dorohedoro` },
    }))

  const archiv = leeresArchiv()
  nimmSerieAuf(archiv, '1375', [...folgenRoh(13, '1', 100, false), ...folgenRoh(11, '2', 200, true)])
  nimmSerieAuf(archiv, '1069', folgenRoh(70, '1', 900, false))
  const urteil = (url: string) => beurteileAdnVerweis(url, archiv).dub

  pruefe(
    'eine Folge mit vde belegt die deutsche Fassung',
    urteil('https://animationdigitalnetwork.com/de/video/1375-dorohedoro/205-folge-6') === true,
  )
  pruefe(
    'der Staffelverweis wertet nur seine eigene Staffel',
    urteil('https://animationdigitalnetwork.com/de/video/1375-dorohedoro?s=2') === true,
  )
  pruefe(
    'die gemischte Serie ohne Staffelangabe bleibt offen',
    urteil('https://animationdigitalnetwork.com/de/video/1375-dorohedoro') === undefined,
  )
  pruefe(
    'eine Folge ohne vde spricht nur für ihre eigene Staffel',
    urteil('https://animationdigitalnetwork.com/de/video/1375-dorohedoro/105-ova-13') === false,
  )
  pruefe(
    'keine einzige Folge mit vde ist ein belegtes Nein',
    urteil('https://animationdigitalnetwork.com/de/video/1069-cardcaptor-sakura') === false,
  )
  pruefe(
    'eine Serie ohne Archivdatei heißt unbekannt, nicht nein',
    urteil('https://animationdigitalnetwork.com/de/video/4711-kiznaiver') === undefined,
  )
  pruefe(
    'die alte Adresse trägt keine Serienkennung',
    zerlegeAdnAdresse('https://animationdigitalnetwork.de/video/50-nuances-de-gras').showId === undefined,
    zerlegeAdnAdresse('https://animationdigitalnetwork.de/video/50-nuances-de-gras'),
  )
  pruefe(
    'die neue Adresse trägt sie sehr wohl',
    zerlegeAdnAdresse('https://animationdigitalnetwork.com/de/video/1329-love-hina/29929-folge-26').showId === '1329',
  )
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

/**
 * Folgenbereiche aus Einzelmeldungen — Daniels Fall vom 22.08.2026.
 *
 * Vorher schrieb jede Meldung ein `dub` für die **ganze** Reihe; seine sieben
 * Meldungen zu einer Serie hoben einander auf, und am Ende stand „kein
 * Deutsch", obwohl er Folgen mit deutschem Ton gesehen hatte.
 */
{
  console.log('\nFolgenbereiche aus Einzelmeldungen')

  // Sein Beispiel im Wortlaut: „melden von 1,3,4,13 müsste reichen, um daraus
  // die infos zu ziehen das 1-3 keine und 4-13 eine synchro haben."
  const daniel = bildeBereiche([
    { folge: 1, dub: false },
    { folge: 3, dub: false },
    { folge: 4, dub: true },
    { folge: 13, dub: true },
  ])
  pruefe(
    'aus 1,3,4,13 werden zwei Bereiche',
    daniel.bereiche.length === 2,
    daniel.bereiche,
  )
  pruefe(
    '1–3 ohne, 4–13 mit deutschem Ton',
    daniel.bereiche[0]?.von === 1 && daniel.bereiche[0]?.bis === 3 && !daniel.bereiche[0]?.dub &&
      daniel.bereiche[1]?.von === 4 && daniel.bereiche[1]?.bis === 13 && daniel.bereiche[1]?.dub === true,
    daniel.bereiche,
  )
  pruefe(
    'die belegten Folgen bleiben von den gefolgerten unterscheidbar',
    JSON.stringify(daniel.bereiche[0]?.belegt) === '[1,3]',
    daniel.bereiche[0]?.belegt,
  )

  // Black Clover, der reale Fall aus `data/dub-confirmed.yaml`: 1–155 deutsch,
  // 156–171 nicht.
  const bc = bildeBereiche([
    { folge: 1, dub: true },
    { folge: 155, dub: true },
    { folge: 156, dub: false },
    { folge: 171, dub: false },
  ])
  pruefe(
    'Black Clover kippt bei 156',
    bc.bereiche.length === 2 && bc.bereiche[0]?.bis === 155 && bc.bereiche[1]?.von === 156,
    bc.bereiche,
  )

  /**
   * Die Zusicherung, auf die es ankommt: **Zwischen zwei ungleichen Befunden
   * wird nichts geraten.** Aus „3 ohne" und „6 mit" darf nicht „3–5 ohne"
   * werden — wo die Grenze liegt, weiß niemand, und eine geratene Grenze sieht
   * aus wie ein Befund.
   */
  const lueckig = bildeBereiche([
    { folge: 3, dub: false },
    { folge: 6, dub: true },
  ])
  pruefe(
    'zwischen ungleichen Befunden wird die Lücke nicht gefüllt',
    lueckig.bereiche[0]?.bis === 3 && lueckig.bereiche[1]?.von === 6,
    lueckig.bereiche,
  )
  pruefe(
    'und die Lücke wird benannt statt verschwiegen',
    beschreibeBereiche(lueckig.bereiche).includes('4–5 ungeprüft'),
    beschreibeBereiche(lueckig.bereiche),
  )

  // Zwei Meldungen zur selben Folge: die jüngere gilt, der Widerspruch wird
  // gemeldet statt stillschweigend aufgelöst.
  const streit = bildeBereiche([
    { folge: 5, dub: false },
    { folge: 5, dub: true },
  ])
  pruefe(
    'ein Widerspruch zur selben Folge wird gemeldet',
    streit.widersprueche.includes(5) && streit.bereiche[0]?.dub === true,
    streit,
  )

  // Reihenfolge und Unsinn dürfen nichts kaputt machen.
  const wirr = bildeBereiche([
    { folge: 13, dub: true },
    { folge: 1, dub: false },
    { folge: 0, dub: true },
    { folge: Number.NaN, dub: true },
  ])
  pruefe(
    'unsortierte Eingaben und Unsinn stören nicht',
    wirr.bereiche.length === 2 && wirr.bereiche[0]?.von === 1 && wirr.bereiche[1]?.von === 13,
    wirr.bereiche,
  )
}

/**
 * Durchgezählte Anbieternummern auf unsere Staffeln umrechnen.
 *
 * Netflix zählt Jujutsu Kaisen durch. Daniel am 22.08.2026, mit Bild aus dem
 * Player: „staffel 1 (bis 24) staffel 2 (bis 47) staffel 3 (bis 59)" — Folge 59
 * heißt dort „Die Sendai-Barriere". Unser Datensatz führt dieselbe Adresse an
 * drei AniList-Einträgen mit 24, 23 und 12 Folgen.
 */
{
  console.log('\nDurchgezählte Folgen den Staffeln zuordnen')

  const jjk = [
    { id: 113415, titel: 'JUJUTSU KAISEN', folgen: 24 },
    { id: 145064, titel: 'JUJUTSU KAISEN Season 2', folgen: 23 },
    { id: 172463, titel: 'JUJUTSU KAISEN Season 3', folgen: 12 },
  ]

  pruefe('Folge 24 ist die letzte der ersten Staffel',
    ordneFolgeZu(24, jjk)?.staffel.id === 113415 && ordneFolgeZu(24, jjk)?.folgeInStaffel === 24,
    ordneFolgeZu(24, jjk))
  pruefe('Folge 25 ist die erste der zweiten',
    ordneFolgeZu(25, jjk)?.staffel.id === 145064 && ordneFolgeZu(25, jjk)?.folgeInStaffel === 1,
    ordneFolgeZu(25, jjk))
  pruefe('Folge 47 ist die letzte der zweiten',
    ordneFolgeZu(47, jjk)?.staffel.id === 145064 && ordneFolgeZu(47, jjk)?.folgeInStaffel === 23,
    ordneFolgeZu(47, jjk))
  pruefe('Folge 59 ist die zwölfte der dritten — Daniels Fall',
    ordneFolgeZu(59, jjk)?.staffel.id === 172463 && ordneFolgeZu(59, jjk)?.folgeInStaffel === 12,
    ordneFolgeZu(59, jjk))
  pruefe('hinter der letzten bekannten Folge wird nicht geraten',
    ordneFolgeZu(60, jjk) === null, ordneFolgeZu(60, jjk))

  /**
   * Black Clover, der reale Fall: 1–155 deutsch, 156–171 nicht. Nur eine
   * **ganz** abgedeckte Staffel darf einen Befund für die ganze Staffel
   * bekommen — bei einer angeschnittenen wäre es eine Aussage über Folgen, die
   * niemand geprüft hat.
   */
  const bc = [
    { id: 1, titel: 'Staffel 1', folgen: 51 },
    { id: 2, titel: 'Staffel 2', folgen: 51 },
    { id: 3, titel: 'Staffel 3', folgen: 51 },
    { id: 4, titel: 'Staffel 4', folgen: 18 },
  ]
  const verteilt = verteileAufStaffeln({ von: 1, bis: 155, dub: true }, bc)
  pruefe('der Bereich 1–155 berührt alle vier Staffeln',
    verteilt.length === 4, verteilt.map((v) => v.staffel.id))
  pruefe('die ersten drei liegen ganz darin, die vierte nur angeschnitten',
    verteilt[0]?.ganz && verteilt[1]?.ganz && verteilt[2]?.ganz && verteilt[3]?.ganz === false,
    verteilt.map((v) => v.ganz))
  pruefe('von der vierten sind es die Folgen 1–2',
    verteilt[3]?.von === 1 && verteilt[3]?.bis === 2, verteilt[3])
}

/**
 * Vom gemeldeten Browser-Zustand zurück zu unserem Datensatz.
 */
{
  console.log('\nAdressen und Titel zuordnen')

  /**
   * Der Fall, der eine gültige Prüfung stillschweigend verworfen hat: Unser
   * Datensatz führt „K" als `http://www.netflix.com/title/80040118`, Daniels
   * Browser meldete dieselbe Seite als `https://…` (22.08.2026).
   */
  pruefe(
    'http und https treffen dieselbe Seite',
    schluesselAdresse('http://www.netflix.com/title/80040118') ===
      schluesselAdresse('https://www.netflix.com/title/80040118'),
  )
  pruefe(
    'www, Schrägstrich am Ende und Herkunftsangaben stören nicht',
    schluesselAdresse('https://netflix.com/title/80040118/') ===
      schluesselAdresse('https://www.netflix.com/title/80040118?trackId=99'),
  )
  pruefe(
    'verschiedene Titel bleiben verschieden',
    schluesselAdresse('https://www.netflix.com/title/80040118') !==
      schluesselAdresse('https://www.netflix.com/title/80040119'),
  )

  /**
   * **Zwei Amazon-Suchen sind nicht dieselbe Adresse.**
   *
   * Der Query-String fällt sonst weg — bei einer Titelseite richtig, bei
   * `amazon.de/s?k=…` verhängnisvoll: Übrig bleibt `amazon.de/s`, und das ist
   * die Adresse **jeder** Amazon-Suche.
   *
   * Am 27.08.2026 hat eine einzige Meldung („Cowboy Bebop gibt es dort nicht")
   * auf diesem Weg alle **118** Prime-Suchadressen getroffen: 118 Einträge
   * `available: false` in `dub-confirmed.yaml`, 118 entfernte Verweise, roter
   * Deploy. Der Fehler lag latent, seit es Suchadressen gibt — ausgelöst hat
   * ihn die erste Meldung gegen eine von ihnen.
   */
  pruefe(
    'zwei Amazon-Suchen mit verschiedenem Begriff bleiben verschieden',
    schluesselAdresse('https://www.amazon.de/s?k=Cowboy%20Bebop&i=instant-video') !==
      schluesselAdresse('https://www.amazon.de/s?k=Full%20Metal%20Panic!&i=instant-video'),
  )
  /* Und dieselbe Suche bleibt dieselbe, auch mit Amazons angehängten Parametern. */
  pruefe(
    'dieselbe Suche trifft sich trotz crid und Schreibweise des Leerzeichens',
    schluesselAdresse('https://www.amazon.de/s?k=Cowboy%20Bebop&i=instant-video') ===
      schluesselAdresse('https://www.amazon.de/s?k=Cowboy+Bebop&i=instant-video&crid=2XYZ'),
  )
  /* Eine Titelseite verliert ihre Herkunftsangabe weiterhin — dort ist das richtig. */
  pruefe(
    'eine Amazon-Titelseite bleibt von der Ausnahme unberührt',
    schluesselAdresse('https://www.amazon.de/dp/B0B8TR93HR?ref_=atv_dp') ===
      schluesselAdresse('https://www.amazon.de/dp/B0B8TR93HR'),
  )

  pruefe(
    'der Anbietername fällt aus dem Seitentitel',
    titelSchluessel('Beyblade Burst Surge – Netflix') === titelSchluessel('Beyblade Burst Surge'),
  )
  /**
   * Und die Zusicherung, die den Vorschlag zum Vorschlag macht: Zwei Serien,
   * die ein einziges Wort trennt, dürfen **nicht** denselben Schlüssel
   * bekommen. Sonst schriebe ein Namensvergleich irgendwann einen Befund an
   * die falsche Serie.
   */
  pruefe(
    'Surge und Rise fallen nicht zusammen',
    titelSchluessel('Beyblade Burst Surge') !== titelSchluessel('Beyblade Burst Rise'),
  )
}

/**
 * Die Zeile, die im Detail-Panel neben dem Anbieter steht.
 */
{
  console.log('\nGrenze des deutschen Tons im Detail-Panel')

  pruefe('ganz deutsch sagt nichts Zusätzliches',
    dubGrenze([{ from: 1, to: 24, dub: true }]) === null)
  pruefe('gar nicht deutsch sagt nichts Zusätzliches',
    dubGrenze([{ from: 1, to: 24, dub: false }]) === null)
  pruefe('ohne Bereiche bleibt es still',
    dubGrenze(undefined) === null && dubGrenze([]) === null)

  // Black Clover auf Netflix: 1–155 deutsch, 156–171 nicht.
  const bc = dubGrenze([
    { from: 1, to: 155, dub: true },
    { from: 156, to: 171, dub: false },
  ])
  pruefe('Black Clover nennt die letzte deutsche Folge',
    bc?.schluessel === 'detail.dubUntil' && bc.n === 155, bc)

  // Der umgekehrte Fall: erst ohne, dann mit.
  const spaeter = dubGrenze([
    { from: 1, to: 3, dub: false },
    { from: 4, to: 13, dub: true },
  ])
  pruefe('fängt Deutsch später an, steht die erste deutsche Folge da',
    spaeter?.schluessel === 'detail.dubFrom' && spaeter.n === 4, spaeter)

  pruefe('unsortierte Bereiche stören nicht',
    dubGrenze([
      { from: 156, to: 171, dub: false },
      { from: 1, to: 155, dub: true },
    ])?.n === 155)
}

/**
 * Adressen, die nicht zu dem Anbieter gehören, unter dem sie stehen.
 */
{
  console.log('\nAnbieter und Adresse zusammenbringen')

  pruefe('eine Google-Trefferadresse wird auf ihr Ziel aufgelöst',
    entwirreWeiterleitung('https://www.google.com/url?sa=t&url=https://www.crunchyroll.com/de/series/GY8VEQ95Y/nana')
      === 'https://www.crunchyroll.com/de/series/GY8VEQ95Y/nana')
  pruefe('eine gewöhnliche Adresse bleibt unangetastet',
    entwirreWeiterleitung('https://www.crunchyroll.com/de/series/GY8VEQ95Y/nana')
      === 'https://www.crunchyroll.com/de/series/GY8VEQ95Y/nana')
  pruefe('Unsinn wirft nicht, sondern kommt zurück',
    entwirreWeiterleitung('kein-url') === 'kein-url')

  /**
   * Die Zusicherung, die 94 Verweise gerettet hat: `animationdigitalnetwork.de`
   * ist ADNs deutsche Domain (75 von 76 Verweisen), `tvnow.de` der alte Name
   * von RTL+. Eine unvollständige Hosttabelle wirft gültige Verweise weg, und
   * zwar stillschweigend.
   */
  pruefe('ADN wird unter seiner deutschen Domain erkannt',
    adressePasst('https://animationdigitalnetwork.de/video/one-piece', 'adn'))
  pruefe('TVNow zählt als RTL+',
    adressePasst('https://www.tvnow.de/serien/pokemon-master-quest-19162', 'rtlplus'))
  pruefe('eine Amazon-Adresse gehört nicht zu Crunchyroll',
    !adressePasst('https://www.amazon.de/dp/B0C9H2BQWM', 'crunchyroll'))

  /**
   * Und die, auf die es beim Retten ankommt: Eine falsch einsortierte Adresse
   * wird **umsortiert**, nicht weggeworfen. Von 33 solchen Fällen zeigten alle
   * auf Amazon — sie zu verwerfen hätte 33 gültige Kaufwege gekostet.
   */
  pruefe('eine Amazon-Adresse findet zu Prime Video',
    plattformAusAdresse('https://www.amazon.de/dp/B0C9H2BQWM') === 'primevideo')
  pruefe('was zu keinem bekannten Anbieter führt, bleibt ohne Zuordnung',
    plattformAusAdresse('https://example.com/irgendwas') === undefined)
  pruefe('Unterdomänen zählen mit',
    plattformAusAdresse('https://beta.crunchyroll.com/de/series/X') === 'crunchyroll')
}

/**
 * Die Staffelliste des Anbieters schlägt jede Rechnung.
 */
{
  console.log('\nGemeldete Staffelliste statt Umrechnung')

  // Netflix' eigene Auskunft zu Sword Art Online (Daniel, 22.08.2026).
  const netflixSao = [
    { seq: 1, name: 'St. 1', folgen: 25, erste: 1 },
    { seq: 2, name: 'St. 2', folgen: 24, erste: 1 },
  ]
  const unsereSao = [
    { id: 11757, titel: 'Sword Art Online', folgen: 25 },
    { id: 100182, titel: 'Alicization', folgen: 24 },
    { id: 108759, titel: 'War of Underworld', folgen: 12 },
    { id: 114308, titel: 'War of Underworld Part 2', folgen: 11 },
  ]

  const sao = ordneNachStaffelliste(netflixSao, unsereSao)
  pruefe('die ersten beiden Staffeln finden ihren Eintrag',
    sao.paare.length === 2 && sao.paare[1]?.unser.id === 100182, sao.paare.map((p) => p.unser.id))
  pruefe('was Netflix nicht führt, bleibt ohne Entsprechung',
    sao.ohneEntsprechung.length === 2 && sao.ohneEntsprechung[0]?.id === 108759,
    sao.ohneEntsprechung.map((s) => s.id))

  /**
   * Der Kern: Netflix zählt bei SAO **nicht** durch (`erste: 1` in beiden
   * Staffeln). Folge 24 der zweiten Staffel ist Alicizations letzte — die
   * Umrechnung hätte daraus Folge 24 der **ersten** Staffel gemacht.
   */
  const daniel = ordneMeldungZu({ folge: 24, staffel: 2 }, unsereSao, netflixSao)
  pruefe('Daniels Meldung landet bei Alicization, Folge 24',
    daniel?.staffel.id === 100182 && daniel.folgeInStaffel === 24, daniel)
  const ohneListe = ordneMeldungZu({ folge: 24, staffel: 2 }, unsereSao)
  pruefe('ohne Staffelliste hätte dieselbe Meldung die erste Staffel getroffen',
    ohneListe?.staffel.id === 11757, ohneListe)

  // Jujutsu Kaisen, der umgekehrte Fall: Netflix zählt durch.
  const jjkNetflix = [
    { seq: 1, name: 'St. 1', folgen: 24, erste: 1 },
    { seq: 2, name: 'St. 2', folgen: 23, erste: 25 },
    { seq: 3, name: 'St. 3', folgen: 12, erste: 48 },
  ]
  const jjkUnser = [
    { id: 113415, titel: 'JJK', folgen: 24 },
    { id: 145064, titel: 'JJK 2', folgen: 23 },
    { id: 172463, titel: 'JJK 3', folgen: 12 },
  ]
  const jjk = ordneMeldungZu({ folge: 59, staffel: 3 }, jjkUnser, jjkNetflix)
  pruefe('durchgezählte Folge 59 wird zur zwölften der dritten Staffel',
    jjk?.staffel.id === 172463 && jjk.folgeInStaffel === 12, jjk)

  /**
   * Und die Zusicherung, die eine falsche Zuordnung verhindert: Stimmen bei
   * **mehreren** Einträgen die Folgenzahlen nicht überein, ist die Reihenfolge
   * falsch — dann wird gar nichts zugeordnet. Ein falsch zugeordneter Befund
   * sieht aus wie ein geprüfter.
   *
   * Bei einem einzigen Eintrag gilt das nicht: Dort gibt es keine Reihenfolge,
   * die falsch sein könnte, und eine abweichende Zahl sagt nur, dass der
   * Anbieter anders zählt.
   */
  const schief = ordneNachStaffelliste(
    [
      { seq: 1, name: 'St. 1', folgen: 13, erste: 1 },
      { seq: 2, name: 'St. 2', folgen: 12, erste: 1 },
    ],
    [
      { id: 1, titel: 'irgendwas', folgen: 25 },
      { id: 2, titel: 'irgendwas anderes', folgen: 24 },
    ],
  )
  pruefe('abweichende Folgenzahlen verhindern jede Zuordnung',
    schief.paare.length === 0 && Boolean(schief.problem), schief)
  pruefe('eine Folge außerhalb der Staffel wird nicht zugeordnet',
    ordneMeldungZu({ folge: 99, staffel: 2 }, unsereSao, netflixSao) === null)

  /**
   * Der Fall, der die Paarung fast falsch gemacht hätte.
   *
   * Netflix führt „My Hero Academia" in sieben Staffeln (Daniel, 22.08.2026).
   * An unserer Adresse hängen nur zwei Einträge: Staffel 1 und Staffel **6** —
   * für die vier dazwischen hat nie jemand einen Verweis eingetragen. Von vorn
   * gepaart würde Netflix' zweite Staffel mit unserer sechsten verheiratet, und
   * weil beide 25 Folgen haben, merkt die Folgenzahl-Kontrolle nichts davon.
   */
  const mhaNetflix = [
    { seq: 1, name: 'St. 1', folgen: 13, erste: 1 },
    { seq: 2, name: 'St. 2', folgen: 25, erste: 15 },
    { seq: 3, name: 'St. 3', folgen: 25, erste: 41 },
    { seq: 4, name: 'St. 4', folgen: 25, erste: 66 },
    { seq: 5, name: 'St. 5', folgen: 25, erste: 93 },
    { seq: 6, name: 'St. 6', folgen: 25, erste: 120 },
    { seq: 7, name: 'St. 7', folgen: 25, erste: 146 },
  ]
  const mhaUnser = [
    { id: 21459, titel: 'My Hero Academia', folgen: 13 },
    { id: 139630, titel: 'My Hero Academia Season 6', folgen: 25 },
  ]
  /**
   * Ein einziger Eintrag nimmt alles auf, was der Anbieter dort führt.
   *
   * Netflix teilt „One Piece" in sieben Arcs, unser Datensatz kennt einen
   * Eintrag (Daniel, 22.08.2026). Von einer falschen Reihenfolge kann hier
   * nichts kommen: Es gibt nur eine, und alles gehört dazu.
   */
  const opNetflix = [
    { seq: 1, name: 'East Blue', folgen: 61, erste: 1 },
    { seq: 2, name: 'Ankunft auf der Grand Line', folgen: 16, erste: 62 },
    { seq: 3, name: 'Drum', folgen: 15, erste: 78 },
  ]
  const opUnser = [{ id: 21, titel: 'ONE PIECE', folgen: 0 }]
  const op = ordneNachStaffelliste(opNetflix, opUnser)
  pruefe('sieben Arcs, ein Eintrag: alles wird zugeordnet',
    op.paare.length === 3 && op.paare.every((p) => p.unser.id === 21), op.problem)
  pruefe('und eine Meldung aus Arc 1 landet dort',
    ordneMeldungZu({ folge: 61, staffel: 1 }, opUnser, opNetflix)?.staffel.id === 21)
  pruefe('auch eine aus einem späteren Arc',
    ordneMeldungZu({ folge: 78, staffel: 3 }, opUnser, opNetflix)?.staffel.id === 21)

  const mha = ordneNachStaffelliste(mhaNetflix, mhaUnser)
  pruefe('fehlen uns Verweise, wird gar nicht gepaart',
    mha.paare.length === 0 && Boolean(mha.problem), mha.problem)
  pruefe('und keine Meldung landet an der falschen Staffel',
    ordneMeldungZu({ folge: 170, staffel: 7 }, mhaUnser, mhaNetflix) === null)

  /**
   * Die Gegenprobe: Wären alle sieben Staffeln bei uns verzeichnet, müsste
   * Daniels Folge 170 als 25. Folge der siebten ankommen — Netflix zählt hier
   * durch, mit `erste: 146`.
   */
  const mhaVoll = [
    { id: 1, titel: 'S1', folgen: 13 }, { id: 2, titel: 'S2', folgen: 25 },
    { id: 3, titel: 'S3', folgen: 25 }, { id: 4, titel: 'S4', folgen: 25 },
    { id: 5, titel: 'S5', folgen: 25 }, { id: 6, titel: 'S6', folgen: 25 },
    { id: 7, titel: 'S7', folgen: 25 },
  ]
  const treffer = ordneMeldungZu({ folge: 170, staffel: 7 }, mhaVoll, mhaNetflix)
  pruefe('vollständig verzeichnet wäre Folge 170 die 25. der siebten Staffel',
    treffer?.staffel.id === 7 && treffer.folgeInStaffel === 25, treffer)

  /**
   * Die Nachsicht mit **einer** abweichenden Zahl — und ihre Grenze.
   *
   * Netflix meldet für My Hero Academia 13, 25, 25, 25, 25, 25, 25; unsere
   * sieben Staffeln haben 13, 25, 25, 25, 25, 25, **21**. Sechs Zahlen in Folge
   * treffen exakt; dass die siebte abweicht, liegt an unterschiedlicher Zählung,
   * nicht an falscher Reihenfolge.
   */
  const mhaVollUnser = [
    { id: 21459, titel: 'S1', folgen: 13 }, { id: 21856, titel: 'S2', folgen: 25 },
    { id: 100166, titel: 'S3', folgen: 25 }, { id: 104276, titel: 'S4', folgen: 25 },
    { id: 117193, titel: 'S5', folgen: 25 }, { id: 139630, titel: 'S6', folgen: 25 },
    { id: 163139, titel: 'S7', folgen: 21 },
  ]
  const mhaGepaart = ordneNachStaffelliste(mhaNetflix, mhaVollUnser)
  pruefe('sechs exakte Treffer tragen eine Ausnahme',
    mhaGepaart.paare.length === 7 && mhaGepaart.paare[6]?.unser.id === 163139,
    mhaGepaart.problem)
  pruefe('die Abweichung wird trotzdem benannt',
    Boolean(mhaGepaart.problem?.includes('Staffel 7')), mhaGepaart.problem)
  pruefe('Daniels Folge 170 landet damit an Staffel 7',
    ordneMeldungZu({ folge: 170, staffel: 7 }, mhaVollUnser, mhaNetflix)?.staffel.id === 163139)

  /**
   * Die Grenze: Ohne exakte Treffer ist die Abweichung nicht die Ausnahme,
   * sondern der ganze Befund.
   */
  pruefe('eine einzelne falsche Zahl ohne Rückhalt ordnet nichts zu',
    ordneNachStaffelliste(
      [{ seq: 1, name: 'St. 1', folgen: 13, erste: 1 }, { seq: 2, name: 'St. 2', folgen: 25, erste: 14 }],
      [{ id: 1, titel: 'A', folgen: 13 }, { id: 2, titel: 'B', folgen: 12 }],
    ).paare.length === 0)
  pruefe('zwei Abweichungen ordnen nie zu',
    ordneNachStaffelliste(
      [{ seq: 1, name: '1', folgen: 13, erste: 1 }, { seq: 2, name: '2', folgen: 25, erste: 14 },
       { seq: 3, name: '3', folgen: 25, erste: 39 }],
      [{ id: 1, titel: 'A', folgen: 13 }, { id: 2, titel: 'B', folgen: 12 }, { id: 3, titel: 'C', folgen: 11 }],
    ).paare.length === 0)
}

/**
 * Netflix-Adressen ohne Regionspfad.
 */
{
  console.log('\nNetflix-Adressen neutral machen')

  pruefe('der nackte Ländercode fällt weg',
    netflixNeutral('https://www.netflix.com/de/title/70302573') === 'https://www.netflix.com/title/70302573')

  /**
   * Der Fall, der wie ein toter Verweis aussah: `id-en` ist Indonesien auf
   * Englisch. In Deutschland leitet die Adresse auf die Startseite um — Daniel
   * am 22.08.2026: „7th time loop link is dead (gets redirected to homepage)."
   * Tot war sie nicht, nur in der falschen Region, und die Verweisprüfung sieht
   * eine Weiterleitung auf die Startseite als HTTP 200.
   */
  pruefe('Land **und** Sprache fallen weg',
    netflixNeutral('https://www.netflix.com/id-en/title/81747897') === 'https://www.netflix.com/title/81747897')
  pruefe('dasselbe für jp-en',
    netflixNeutral('https://www.netflix.com/jp-en/title/80237814') === 'https://www.netflix.com/title/80237814')
  pruefe('eine neutrale Adresse bleibt, wie sie ist',
    netflixNeutral('https://www.netflix.com/title/70302573') === 'https://www.netflix.com/title/70302573')
  pruefe('was keine Titeladresse ist, wird nicht angefasst',
    netflixNeutral('https://www.netflix.com/browse') === 'https://www.netflix.com/browse')
}

console.log('\nLücken im Sendeplan und die Uhrzeit')

/**
 * Eine Folge darf nie nach einer höheren **beobachteten** Folge liegen.
 *
 * Gemeldet von Daniel am 23.08.2026 mit zwei Bildern: Die Kalenderkarte zeigte
 * „Ep 5/14", das Detail-Panel darunter „4/14" — dieselbe Serie, dieselbe
 * Minute. Der Bestand kannte für „Mushoku Tensei" Staffel 3 die Folgen 1–3 vom
 * 19.08. und Folge 5 vom 23.08.; Folge 4 hatte kein Abruf gesehen. Die stumme
 * Wochenrechnung setzte sie auf den 26.08. — hinter eine Folge, die es längst
 * gibt.
 */
{
  const release = {
    slug: 'test-luecke',
    titleId: 1,
    name: 'Test',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: '2026-08-19',
      episodeCount: 14,
      time: '17:00',
      observed: { 1: '2026-08-19', 2: '2026-08-19', 3: '2026-08-19', 5: '2026-08-23' },
    },
  } as unknown as Release

  const termine = expandEvents(release)
  const nach = (n: number) => termine.find((e) => e.episode === n)?.date

  /**
   * Eine fehlende Folge landet auf dem naechsten belegten Termin.
   *
   * Die erste Fassung teilte die Spanne gleichmaessig und legte Folge 4 auf
   * den 21.08. Das war falsch: Crunchyroll hat 4 und 5 am selben Tag
   * veroeffentlicht (Daniel, 24.08.2026: "i dont remember watching ep 4
   * yesterday, so it must be correct that it released today").
   *
   * Eine Folge fehlt nicht zufaellig in den Daten, sondern weil kein Abruf sie
   * als eigenen Termin gesehen hat -- am haeufigsten, weil sie keinen hatte.
   * Der naechste belegte Termin ist eine Obergrenze: Sie kann zu spaet liegen,
   * behauptet aber nie eine Folge, die es noch nicht gibt.
   */
  pruefe(
    'Folge 4 landet auf dem belegten Termin von Folge 5, nicht dazwischen',
    nach(4) === nach(5),
    { f3: nach(3), f4: nach(4), f5: nach(5) },
  )
  pruefe(
    'und liegt damit nicht vor Folge 3',
    nach(4)! >= nach(3)!,
    { f3: nach(3), f4: nach(4) },
  )

  /**
   * **Eine belegte Folge behaelt ihren Termin.**
   *
   * Der erste Versuch der Lueckenfuellung schob auch Stuetzpunkte: Folge 3 lag
   * belegt am 19.08. und landete auf dem 23.08. Eine Messung durch eine
   * Ableitung zu ersetzen ist der schlimmste Tausch, den dieses Projekt kennt
   * -- schlimmer als eine Luecke, denn die sieht man.
   */
  pruefe(
    'die belegten Folgen 1 bis 3 bleiben auf ihrem Termin (19.08.)',
    nach(1) === '2026-08-19' && nach(2) === '2026-08-19' && nach(3) === '2026-08-19',
    { f1: nach(1), f2: nach(2), f3: nach(3) },
  )
  pruefe(
    'und die belegte Folge 5 ebenso (23.08.)',
    nach(5) === '2026-08-23',
    nach(5),
  )

  /**
   * Die allgemeine Fassung derselben Regel: Über die ganze Reihe hinweg darf
   * kein Termin vor seinem Vorgänger liegen. Ein Einzelfall ist behoben,
   * sobald man ihn kennt — diese Zeile fängt den nächsten.
   */
  let verdreht = 0
  for (let i = 1; i < termine.length; i++) {
    if (termine[i]!.date < termine[i - 1]!.date) verdreht++
  }
  pruefe('kein Termin liegt vor seinem Vorgänger', verdreht === 0, verdreht)
}

/**
 * „Erschienen" richtet sich nach der Uhrzeit, nicht nach dem Tag.
 *
 * Daniel am 23.08.2026: „um 16:59 sollte im panel 4 stehen, ab 17:00 uhr
 * (release zeitpunkt) sollte dort 5 stehen." Ein Vergleich über das Datum
 * allein zählt die heutige Folge ab Mitternacht mit — siebzehn Stunden, bevor
 * es sie gibt.
 */
{
  const ereignis = { date: '2026-08-23', time: '17:00' }
  const kurzVorher = new Date('2026-08-23T14:59:00Z') // 16:59 Berlin (Sommerzeit)
  const punkt = new Date('2026-08-23T15:00:00Z') // 17:00 Berlin

  pruefe('um 16:59 gilt die Folge noch nicht als erschienen', !istErschienen(ereignis, kurzVorher))
  pruefe('um 17:00 gilt sie als erschienen', istErschienen(ereignis, punkt))

  /**
   * Ohne Uhrzeit gilt der Tag als abgeschlossen. Wir wissen dann nicht, wann
   * die Folge kam, aber dass sie kam — ein „noch nicht" wäre die schlechtere
   * Auskunft.
   */
  pruefe(
    'ohne Uhrzeit zählt der Tag, nicht die Minute',
    istErschienen({ date: '2026-08-22' }, kurzVorher),
  )

  /**
   * Die Zeile „Nächste Folge" darf nie eine vergangene nennen.
   *
   * Sie zeigte am 23.08.2026 um 22 Uhr noch den 23.08. — fünf Stunden nachdem
   * die Folge lief (Daniel, mit Bild). Der Grund war derselbe Tagesvergleich,
   * der schon die Folgenzahl verfälscht hatte.
   */
  const reihe = [
    { date: '2026-08-19', time: '17:00' },
    { date: '2026-08-21', time: '17:00' },
    { date: '2026-08-23', time: '17:00' },
    { date: '2026-08-30', time: '17:00' },
  ]
  const abends = new Date('2026-08-23T20:00:00Z') // 22:00 Berlin
  const naechste = reihe.find((e) => !istErschienen(e, abends))
  pruefe(
    'abends um 22 Uhr ist die nächste Folge der 30.08., nicht der heutige 23.08.',
    naechste?.date === '2026-08-30',
    naechste?.date,
  )

  const nachmittags = new Date('2026-08-23T14:00:00Z') // 16:00 Berlin
  pruefe(
    'um 16 Uhr ist die nächste Folge dagegen die heutige',
    reihe.find((e) => !istErschienen(e, nachmittags))?.date === '2026-08-23',
  )
}


console.log('\nWerktitel gegen Teiltitel')

/**
 * Ein Titel traegt nie die Nummer eines seiner Teile.
 *
 * Bei Yu-Gi-Oh zeigte die Kalenderkarte "Staffel 3", das Detail-Panel
 * darunter "Staffel 2" -- dieselbe Serie, dieselbe Sekunde (Daniel,
 * 24.08.2026, mit zwei Bildern). Beide Disney+-Ausgaben gehoeren zu einer
 * AniList-Serie mit 224 Folgen; der zuerst gelesene kuratierte Eintrag
 * setzte seinen Namen als Werktitel.
 *
 * Geprueft wird am **gebauten** Datensatz, nicht an einer nachgestellten
 * Eingabe: Der Fehler entstand aus der Reihenfolge zweier Eintraege, und
 * genau die bildet nur der echte Lauf ab.
 */
{
  /** Direkt von der Platte — diese Datei zieht sonst nichts aus dem Repo. */
  const lies = (p: string) =>
    JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')) as unknown
  const roh = lies('public/data/titles.json') as Title[] | Record<string, Title>
  const alleTitel = Array.isArray(roh) ? roh : Object.values(roh)
  const mitTeilnummer = alleTitel.filter((t) =>
    /[–—-]\s*(staffel|season|vol\.?|teil|part)\s*\d+\s*$/i.test(t.titleDe ?? ""),
  )
  pruefe(
    'kein Titel traegt die Nummer eines seiner Teile im Namen',
    mitTeilnummer.length === 0,
    mitTeilnummer.map((t) => t.titleDe).slice(0, 5),
  )

  /**
   * Die Gegenrichtung: Beim **Release** gehoert die Nummer hin. Sie sagt,
   * welcher Teil erscheint -- ohne sie stuenden zwei gleichnamige Termine
   * untereinander.
   */
  const rohR = lies('public/data/releases.json') as Array<{
    titleId: number
    name: string
    platform: string
  }>
  type KurzRelease = { titleId: number; name: string; platform: string }
  const releasesR: KurzRelease[] = Array.isArray(rohR)
    ? rohR
    : (Object.values(rohR) as KurzRelease[])
  const yugi = releasesR.filter((r) => r.titleId === 481 && r.platform === "disneyplus")
  pruefe(
    'die beiden Yu-Gi-Oh-Ausgaben behalten ihre Staffelnummern',
    yugi.length === 0 ||
      (yugi.some((r) => /Staffel 2/.test(r.name)) && yugi.some((r) => /Staffel 3/.test(r.name))),
    yugi.map((r) => r.name),
  )
}

/**
 * Ein belegter Anbieter-Verweis heißt „erschienen" — nicht „Termin unbekannt".
 *
 * Am 24.08.2026 stand „Der Held ohne Klasse: Der Aufstieg eines Talentlosen"
 * auf „Termin unbekannt", obwohl ADN alle zwölf Folgen mit deutscher Tonspur
 * führt und das Detail-Panel sie eine Zeile tiefer mit grünem „DE ✓" anzeigt.
 * Für den Leser war der Widerspruch nicht auflösbar: oben eine Fehlanzeige,
 * unten das Angebot.
 *
 * Der Status hing allein am japanischen Enddatum und einem Jahr Abstand. Wer
 * die Fassung schon anbietet, hat sie aber veröffentlicht — das ist die
 * stärkste Auskunft, die es hier gibt.
 */
console.log('\nStatus: ein belegter Verweis schlägt das Enddatum')
{
  const heute = '2026-08-24'
  const mitVerweis = { jpYear: 2025, dubConfidence: 'low' as const, streams: [{ platform: 'adn', url: 'x', dub: true }] }
  const ohneVerweis = { jpYear: 2025, dubConfidence: 'low' as const, streams: [] }
  pruefe(
    'ein Verweis mit belegter Synchro ergibt „erschienen"',
    titleStatus([], heute, mitVerweis as never) === 'erschienen',
    titleStatus([], heute, mitVerweis as never),
  )
  pruefe(
    'ohne belegten Verweis bleibt es bei „unbekannt"',
    titleStatus([], heute, ohneVerweis as never) === 'unbekannt',
    titleStatus([], heute, ohneVerweis as never),
  )
  pruefe(
    'ein Verweis ohne belegte Synchro ändert nichts',
    titleStatus([], heute, { ...ohneVerweis, streams: [{ platform: 'adn', url: 'x' }] } as never) === 'unbekannt',
  )
}

/*
  **Netflix-Adressen: drei Formen, eine Seite.**

  Fünfzehn Netflix-Verweise standen als „ohne Titelseite" außerhalb jeder
  Prüfung, obwohl acht davon eine Kennung tragen — nur eben in der
  Abspiel-, der Alt- oder der Suchform (Daniel, 27.08.2026).
*/
{
  const gleich = 'https://www.netflix.com/title/80180071'
  pruefe(
    'die Abspieladresse wird zur Titelseite',
    netflixTitelAdresse('https://www.netflix.com/watch/80180071?source=35') === gleich,
    netflixTitelAdresse('https://www.netflix.com/watch/80180071?source=35'),
  )
  pruefe(
    'die alte WiMovie-Form ebenso',
    netflixTitelAdresse('http://movies.netflix.com/WiMovie/Samurai_Champloo/70213065') ===
      'https://www.netflix.com/title/70213065',
    netflixTitelAdresse('http://movies.netflix.com/WiMovie/Samurai_Champloo/70213065'),
  )
  pruefe(
    'WiMovie auch ohne Namen im Pfad',
    netflixTitelAdresse('http://www.netflix.com/WiMovie/70305217') === 'https://www.netflix.com/title/70305217',
  )
  pruefe(
    'die Suche mit Vorschaufenster trägt die Kennung in jbv',
    netflixTitelAdresse('https://www.netflix.com/search?q=berserk&jbv=80243876') ===
      'https://www.netflix.com/title/80243876',
  )
  /*
    Wunschadressen tragen keine Kennung im Pfad — die steht in Netflix' eigener
    Weiterleitung und wurde am 27.08.2026 einmal für alle fünf abgefragt.
  */
  pruefe(
    'eine Wunschadresse wird über die gemessene Weiterleitung aufgelöst',
    netflixTitelAdresse('http://netflix.com/pokemonconcierge') === 'https://www.netflix.com/title/81186864',
    netflixTitelAdresse('http://netflix.com/pokemonconcierge'),
  )
  pruefe(
    'auch die mit dem Und-Zeichen im Namen',
    netflixTitelAdresse('https://www.netflix.com/mymelody&kuromi') === 'https://www.netflix.com/title/81318403',
  )
  /* Eine Genre-Liste ist keine Titelseite — die bleibt, wie sie ist. */
  pruefe(
    'eine unbekannte Wunschadresse wird nicht erfunden',
    netflixTitelAdresse('http://netflix.com/DetectiveConanMovies') === 'http://netflix.com/DetectiveConanMovies',
  )
  pruefe(
    'und eine leere Titeladresse wird nicht erfunden',
    netflixTitelAdresse('https://www.netflix.com/title/') === 'https://www.netflix.com/title/',
  )
  pruefe(
    'fremde Anbieter gehen unverändert durch',
    netflixTitelAdresse('https://www.amazon.de/dp/B0B8TR93HR') === 'https://www.amazon.de/dp/B0B8TR93HR',
  )
}

/*
  **Folgen-Zuordnung: Datum vor Titel vor Position.**

  Die Nummer taugt nicht — Amazon zeigt Haikyu Staffel 1 mit 44 durchgezählten
  Folgen, unser Eintrag hat 25. Was nicht wandert, ist der Sendetermin.
*/
{
  const staffel = [
    { s: 1, e: 1, titel: 'Ende und Anfang', datum: '2014-04-06', minuten: 24 },
    { s: 1, e: 2, titel: 'Der Volleyballclub', datum: '2014-04-13', minuten: 24 },
    { s: 1, e: 3, titel: 'Der stärkste Verbündete', datum: '2014-04-20', minuten: 24 },
    { s: 2, e: 1, titel: 'Ende der Sommerferien', datum: '2015-10-04', minuten: 24 },
  ]

  pruefe('die Staffel mit passender Folgenzahl wird gefunden', findeStaffel(staffel, 3, 2014) === 1)
  pruefe('ohne passende Zahl bleibt es offen', findeStaffel(staffel, 12, 2014) === null)
  pruefe('ohne unsere Folgenzahl wird nicht geraten', findeStaffel(staffel, null, 2014) === null)

  /* Amazons Nummern sind durchgezählt und damit falsch — das Datum trägt trotzdem. */
  const amazon = [
    { nummer: 42, titel: '42. Ende und Anfang', datum: '2014-04-06', minuten: 24 },
    { nummer: 43, titel: '43. Der Volleyballclub', datum: '2014-04-13', minuten: 24 },
  ]
  const z = ordneZu(amazon, staffel.filter((f) => f.s === 1))
  pruefe('das Datum ordnet trotz falscher Nummern zu', z[0].unsere === 1 && z[1].unsere === 2, JSON.stringify(z))
  pruefe('und nennt seinen Grund', z.every((y) => y.grund === 'datum'))

  /* Ohne Datum trägt der Titel — die führende Nummer stört nicht. */
  const ohneDatum = ordneZu(
    [{ nummer: null, titel: '3. Der stärkste Verbündete', datum: null, minuten: null }],
    staffel.filter((f) => f.s === 1),
  )
  pruefe('der Titel ordnet zu, wenn das Datum fehlt', ohneDatum[0].unsere === 3 && ohneDatum[0].grund === 'titel')

  /* Bei abweichender Länge wird nicht über die Position geraten. */
  const fremd = ordneZu(
    [{ nummer: 1, titel: 'Etwas ganz anderes', datum: '2099-01-01', minuten: null }],
    staffel.filter((f) => f.s === 1),
  )
  pruefe('was nicht passt, bleibt offen statt geraten', fremd[0].unsere === null && fremd[0].grund === 'offen')

  pruefe('der Folgenkern wirft die führende Nummer weg', folgenKern('1. Ende und Anfang') === folgenKern('Ende und Anfang'))
}

/*
  **Ein Netflix-Verweis ohne Kennung führt ins Leere.**

  Zwei blieben nach der Vereinheitlichung vom 27.08.2026 übrig, beide aus
  AniLists Verweisliste.
*/
pruefe('eine Titelseite taugt', netflixAdresseTaugt('https://www.netflix.com/title/80175351'))
pruefe('eine Abspieladresse auch', netflixAdresseTaugt('https://www.netflix.com/watch/80180071'))
pruefe('title/ ohne Nummer nicht', !netflixAdresseTaugt('https://www.netflix.com/title/'))
pruefe('eine Genre-Liste nicht', !netflixAdresseTaugt('http://netflix.com/DetectiveConanMovies'))
pruefe('fremde Anbieter bleiben unberuehrt', netflixAdresseTaugt('https://www.amazon.de/dp/B0B8TR93HR'))

/*
  **Aus einem Kanal-Titel darf kein Nein werden — gemessen am echten Bestand.**

  Prime zeigt bei einem Kanal-Abo (ADN, aniverse, Crunchyroll) die Sprachen des
  **Kanals**, nicht der Folge: „Kill Blue" meldete 12 deutsche Folgen, zwei
  unabhängige Quellen je 4. Die Erweiterung markiert solche Meldungen seit dem
  24.08.2026, und die Notiz sagt es im Klartext — nur folgte daraus nie etwas.

  Am 29.08.2026 trugen **19 von 239** solcher Handbelege ein `dub: false`, und
  ein Nein entfernt den Verweis: „Fullmetal Alchemist" verlor dadurch seinen
  letzten Weg, obwohl derselbe Eintrag sagte, dass die Angabe kein Beleg ist.

  Ein Ja bleibt erlaubt — „es gibt dort deutsche Folgen" stimmt auch bei zu
  hoher Zahl. Geprüft wird nur die eine Richtung, die Daten löscht.
*/
{
  const yaml = readFileSync(new URL('../data/dub-confirmed.yaml', import.meta.url), 'utf8')
  const mitWarnung = yaml.split(/\n(?=- anilistId:)/).filter((b) => b.includes('Kanal-Titel'))
  const neins = mitWarnung.filter((b) => b.includes('\n  dub: false'))
  pruefe(
    `kein Handbeleg macht aus einem Kanal-Titel ein Nein (${mitWarnung.length} mit Kanal-Warnung)`,
    neins.length === 0,
  )
}



/*
  **Die Reihenfolge im Bau ist selbst eine Aussage — sie wird geprüft.**

  Am 29.08.2026 sind die Disc-Wege zweimal in einer Stunde ins Leere gelaufen:
  erst zu früh eingebaut (vor den Bereinigungen — 87 von 176 kamen an), dann zu
  spät (hinter `slim`, dem Aufbau der Auslieferung — **null** kamen an). Beide
  Male war der Code richtig und die Stelle falsch, und beide Male fiel es erst
  am ausgelieferten Datensatz auf.

  Diese Zusicherung liest `build.ts` als Text und prüft die Reihenfolge der
  Marken. Das ist grob, aber es fängt genau den Fehler, der zweimal passiert
  ist — und er ist billig zu machen: Ein Block wandert beim Umbau mit, seine
  Wirkung nicht.
*/
{
  const bau = readFileSync(new URL('../pipeline/build.ts', import.meta.url), 'utf8')
  const pos = (marke: string) => bau.indexOf(marke)
  const letzteEntfernung = pos('Verweise ohne deutsche Synchro entfernt')
  const disc = pos('**Deutsche Disc-Ausgaben aus dem aniSearch-Archiv.**')
  const nachhut = pos('**Nachhut: kein Verweis verlässt den Bau ohne Zugangsart.**')
  const auslieferung = pos('const allTitles = [...titles.values()]')
  pruefe(
    'die Disc-Wege entstehen nach der letzten Entfernung',
    letzteEntfernung > 0 && disc > letzteEntfernung,
  )
  pruefe('… und vor dem Aufbau der Auslieferung', disc > 0 && disc < auslieferung)
  pruefe('die Zugangsart-Nachhut ebenso', nachhut > letzteEntfernung && nachhut < auslieferung)
}

/*
  **Ein Disc-Slug behält sein Datum — auch bei einem sehr langen Titel.**

  `slugify` kappt bei 80 Zeichen. Bei „My Gift Lvl 9999 Unlimited Gacha:
  Backstabbed in a Backwater Dungeon, I'm Out for Revenge!" fiel damit genau
  das Datum weg, und zwei Verkaufsstarts (08.09. und 24.09.2026) beanspruchten
  dieselbe Adresse — `data:validate` brach ab, der Deploy stand (30.08.2026).

  Vier Releases im ausgelieferten Bestand tragen solche gekappten Adressen; der
  doppelte Slug war nur der eine Fall, der laut geworden ist.
*/
{
  const lang =
    'My Gift Lvl 9999 Unlimited Gacha: Backstabbed in a Backwater Dungeon, I’m Out for Revenge!'
  const a = discSlug(lang, '2026-09-08')
  const b = discSlug(lang, '2026-09-24')
  pruefe('ein langer Titel behält sein Datum im Slug', a.endsWith('-2026-09-08'))
  pruefe('… und zwei Termine ergeben zwei Adressen', a !== b)
  pruefe('… ohne die bisherige Höchstlänge zu sprengen', a.length <= 80)
  pruefe(
    'ein kurzer Titel bleibt unverändert',
    discSlug('Steins;Gate 0', '2026-10-16') === 'steins-gate-0-2026-10-16',
  )
}

/*
  **Die Handbelege müssen sich lesen lassen — `data:validate` prüft sie nicht.**

  `data/dub-confirmed.yaml` liegt außerhalb von `data/curated/` und wird vom
  Validator nicht angefasst. Am 30.08.2026 schrieb `fetch-pruefungen.ts` einem
  Eintrag zwei `url:`-Zeilen; YAML verbietet doppelte Schlüssel, und der Fehler
  fiel erst beim Bau auf — mit einer Zeilennummer aus 24.000 Zeilen.
*/
{
  const roh = readFileSync(new URL('../data/dub-confirmed.yaml', import.meta.url), 'utf8')
  let lesbar = true
  let grund = ''
  try {
    yaml.load(roh)
  } catch (e) {
    lesbar = false
    grund = (e as Error).message.split(String.fromCharCode(10))[0] ?? ''
  }
  pruefe(`data/dub-confirmed.yaml ist gültiges YAML${lesbar ? '' : ` — ${grund}`}`, lesbar)
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
