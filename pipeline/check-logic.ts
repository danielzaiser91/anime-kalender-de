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
import { titelAus } from './lib/anisearch-titel.ts'
import yaml from 'js-yaml'
import { discSlug, slugify } from './lib/util.ts'
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
import { adnAdresseSchaerfen } from './lib/adn-sprachen.ts'
import { adressePasst, entwirreWeiterleitung, plattformAusAdresse } from '../shared/adresse-passt.ts'
import { dubGrenze } from '../shared/dub-grenze.ts'
import { netflixNeutral } from '../shared/mappings.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'
import { schluesselAdresse, titelSchluessel } from './lib/zuordnung.ts'
import { netflixTitelAdresse } from './lib/netflix-adresse.ts'
import { gruppiereNachAusgabe, findeStaffel, folgenKern, ordneZu } from '../shared/folgen-zuordnung.ts'
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
import { crAdresseZu, crNamensindex, crNamensindexAusDatei } from './lib/cr-katalog-adresse.ts'

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
  /**
   * **Der Anbieter zählt kumulativ — Haikyu!!, gemessen am 10.09.2026.**
   *
   * Daniel fand „Lev ist hier!" bei Netflix unter `/watch/81308427`; der
   * Zurück-Pfeil führte auf **Staffel 1, Folge 26**. Die OVA ist dort keine
   * eigene Staffel, sie hängt am Ende der Staffel, zu der sie gehört — und
   * dasselbe gilt für die drei anderen Nebenausgaben.
   *
   * Die Positionspaarung machte daraus vier Jahre Arbeit zunichte: Sie
   * verheiratete unsere Staffel 1 (25) mit Netflix' Staffel 1 (26), verglich
   * die Zahlen nur auf „Abstand höchstens 3" und erklärte den überzähligen
   * fünften Eintrag für nicht vorhanden. Der Verweis auf „TO THE TOP Part 2"
   * war deshalb seit dem 22.08.2026 entfernt.
   *
   * Die Zahlen unten stehen wörtlich im Netflix-Folgenwähler (26, 26, 11, 27)
   * und in unserem Bestand.
   */
  const netflixHaikyu = [
    { seq: 1, name: 'Haikyu!!', folgen: 26, erste: 1 },
    { seq: 2, name: 'Haikyu!! II', folgen: 26, erste: 1 },
    { seq: 3, name: 'Haikyu!! Karasuno vs Shiratorizawa', folgen: 11, erste: 1 },
    { seq: 4, name: 'Haikyu!! Staffel 4', folgen: 27, erste: 1 },
  ]
  const unsereHaikyu = [
    { id: 20464, titel: 'HAIKYU!!', folgen: 25 },
    { id: 20884, titel: 'Lev Appears!', folgen: 1 },
    { id: 20992, titel: 'HAIKYU!! 2nd Season', folgen: 25 },
    { id: 21348, titel: 'VS Failing Marks', folgen: 1 },
    { id: 21698, titel: 'HAIKYU!! 3rd Season', folgen: 10 },
    { id: 107351, titel: 'Spring Tournament Special', folgen: 1 },
    { id: 106625, titel: 'TO THE TOP', folgen: 13 },
    { id: 111790, titel: 'LAND VS. AIR', folgen: 2 },
    { id: 113538, titel: 'TO THE TOP Part 2', folgen: 12 },
  ]
  const haikyu = ordneNachStaffelliste(netflixHaikyu, unsereHaikyu)
  pruefe('jede der vier Netflix-Staffeln bekommt ihre Titel',
    haikyu.paare.length === 4 && haikyu.ohneEntsprechung.length === 0,
    { paare: haikyu.paare.length, ohne: haikyu.ohneEntsprechung.length })
  pruefe('kein Titel gilt mehr als nicht geführt — Part 2 liegt in Staffel 4',
    haikyu.paare[3]?.teile?.some((t) => t.id === 113538) === true,
    haikyu.paare[3]?.teile?.map((t) => t.id))
  /* Der Fall, der die ganze Kette ausgelöst hat: Folge 26 der ersten Staffel. */
  const lev = ordneMeldungZu({ folge: 26, staffel: 1 }, unsereHaikyu, netflixHaikyu)
  pruefe('Folge 26 der Staffel 1 ist die OVA „Lev Appears!", nicht die Serie',
    lev?.staffel.id === 20884 && lev.folgeInStaffel === 1, lev)
  pruefe('Folge 25 derselben Staffel bleibt bei der Serie',
    ordneMeldungZu({ folge: 25, staffel: 1 }, unsereHaikyu, netflixHaikyu)?.staffel.id === 20464)
  /* Staffel 4 trägt drei Titel — die Grenzen liegen bei 13 und 15. */
  pruefe('Staffel 4, Folge 14 ist die erste Folge von „LAND VS. AIR"',
    ordneMeldungZu({ folge: 14, staffel: 4 }, unsereHaikyu, netflixHaikyu)?.staffel.id === 111790)
  pruefe('Staffel 4, Folge 16 ist die erste von „TO THE TOP Part 2"',
    ordneMeldungZu({ folge: 16, staffel: 4 }, unsereHaikyu, netflixHaikyu)?.staffel.id === 113538)

  /**
   * **Und die Rechnung behauptet nichts, wo sie nicht aufgeht.**
   *
   * Bei „Mushoku Tensei" führt Netflix 23 + 25 = 48 Folgen, unsere sechs
   * Einträge zusammen 49 — eine Folge zu viel. Dann bleibt es beim bisherigen
   * Weg; ein erzwungener Treffer wäre schlimmer als keiner.
   */
  const schiefeSumme = ordneNachStaffelliste(
    [{ seq: 1, name: 'St. 1', folgen: 10, erste: 1 }],
    [
      { id: 1, titel: 'A', folgen: 6 },
      { id: 2, titel: 'B', folgen: 5 },
    ],
  )
  pruefe('geht die Summe nicht auf, entsteht keine kumulative Zuordnung',
    !schiefeSumme.paare.some((paar) => paar.teile), schiefeSumme.paare)

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
  /*
    **Die eine Ausnahme: eine zweite, unabhängige Quelle.**

    Am 07.09.2026 an „7th Time Loop" gemessen — Daniels Erweiterungsmeldung
    nennt keine deutsche Tonspur, und JustWatch führt für beide
    Crunchyroll-Angebote `audio: ja, pt` mit Deutsch nur als Untertitel. Zwei
    Quellen, die unabhängig voneinander dasselbe sagen, ergeben ein Nein; eine
    allein nicht.

    Geprüft wird das **Feld**, nicht die Notiz: Ein Textmuster ließe sich mit
    jeder Formulierung umgehen, und genau darum geht es hier nicht.
  */
  const neins = mitWarnung.filter((b) => b.includes('\n  dub: false') && !/\n  zweiteQuelle:/.test(b))
  pruefe(
    `kein Handbeleg macht aus einem Kanal-Titel ein Nein (${mitWarnung.length} mit Kanal-Warnung)`,
    neins.length === 0,
    'die Ausnahme ist ein `zweiteQuelle:`-Feld — siehe CLAUDE.md, „auch für ein fehlendes Deutsch"',
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

  /*
    **Und dieselbe Falle hat am 02.09.2026 ein zweites Mal zugeschlagen — bei
    den Crunchyroll-Terminen.**

    Der neue Ableiter baute seinen Slug mit `slugify(name + '-crunchyroll-de-'
    + datum)`. Bei „I Was Reincarnated as the 7th Prince so I Can Take My Time
    Perfecting My Magical Ability“ (84 Zeichen) fiel das Datum der Kappung zum
    Opfer, und Staffel 1 und 2 beanspruchten dieselbe Adresse. Der Bau brach mit
    einer Meldung ab, die nach einem Datenfehler aussah: „Termin 2025-07-30
    (Folge 1) liegt nach dem belegten Ende 2024-07-16“ — zwei Staffeln in einem
    Eintrag.

    Die Lehre stand seit dem 30.08.2026 in CLAUDE.md, und `discSlug()` war die
    Antwort darauf. Sie hat nicht getragen, weil an der neuen Stelle niemand
    nach ihr gesucht hat. Diese Zusicherung nennt deshalb den echten Titel:
    Wer den Ableiter wieder auf `slugify` umstellt, wird rot.
  */
  const langeStaffel =
    'I Was Reincarnated as the 7th Prince so I Can Take My Time Perfecting My Magical Ability crunchyroll de'
  const s1 = discSlug(langeStaffel, '2024-04-23')
  const s2 = discSlug(langeStaffel, '2025-07-30')
  pruefe('zwei Staffeln eines langen Titels bekommen zwei Adressen', s1 !== s2, `${s1} / ${s2}`)
  pruefe('beide tragen ihr Datum', s1.endsWith('-2024-04-23') && s2.endsWith('-2025-07-30'))
  /*
    Die Gegenprobe zum Fehler selbst: So sah der kaputte Slug aus. Er ist der
    Grund, warum hier `discSlug` steht und nicht `slugify`.
  */
  pruefe(
    'ein bloßes slugify hätte beide gleich gemacht',
    slugify(`${langeStaffel}-2024-04-23`) === slugify(`${langeStaffel}-2025-07-30`),
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
  /*
    **Kein Beleg zweimal.** Am 11.09.2026 standen 1.489 identische Doppel in der
    Datei, entstanden bei mehrfachen lokalen Läufen am 22.–24.08. Sie änderten
    nichts am Ergebnis, aber jede Zählung („so viele Handbelege") lag um fast
    die Hälfte daneben. Aufgeräumt mit `tools/handbelege-doppel-entfernen.mjs`.
  */
  if (lesbar) {
    const liste = (yaml.load(roh) as unknown[]) ?? []
    const doppelt = liste.length - new Set(liste.map((b) => JSON.stringify(b))).size
    pruefe('Handbelege: kein Beleg steht zweimal in der Datei', doppelt === 0, `${doppelt} identische Doppel`)
    /*
      **Kein Beleg nennt Folgen, die sein Titel nicht hat** — sonst ist die
      Zählung des Anbieters auf unseren Titel gerutscht. Am 11.09.2026 stand
      „HAIKYU!! 2nd Season" (25 Folgen) mit „Folge 26 deutsch" im Datensatz:
      Netflix' S2 E26 ist die OVA „VS Failing Marks". Berichtigt; gemessen
      standen danach noch 24 Belege derselben Art, am selben Tag 22. Die Schwelle darf nur sinken.
    */
    const folgenJeTitel = new Map(
      (JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { id: number; episodes?: number }[]).map(
        (t) => [t.id, t.episodes ?? 0],
      ),
    )
    const drueber = (liste as { anilistId?: number; dubRanges?: { to?: number }[] }[]).filter((b) => {
      const n = folgenJeTitel.get(b.anilistId ?? -1) ?? 0
      return n > 0 && (b.dubRanges ?? []).some((r) => (r.to ?? 0) > n)
    }).length
    pruefe('Handbelege: höchstens 22 nennen Folgen über der Folgenzahl ihres Titels', drueber <= 22, `${drueber}`)
  }
}

/**
 * **Ein Zuordnungslauf, der nichts zuordnet, ist kaputt — nicht erfolglos.**
 *
 * `fetch-rohfolgen.ts` meldete vom 28. bis 31.08.2026 in jedem Lauf
 * „795 Rohfolgen geholt, **0 Adressen zugeordnet**". Die Zahl stand im Log,
 * drei Tage lang, und niemand las sie. Die Ursache war ein Feld, das die
 * Erweiterung sendete, ohne dass es je gefüllt war (`titelId` lag in der
 * Prüfliste eine Ebene tiefer, siehe CLAUDE.md).
 *
 * Diese Zusicherung macht daraus einen roten Lauf: Liegen Rohfolgen vor und ist
 * **keine einzige** Adresse zugeordnet, stimmt etwas an der Zuordnung nicht.
 * Eine niedrige Quote ist normal — Prime führt Titel, die wir nicht kennen.
 * Null ist es nicht.
 */
{
  const lies = (pfad: string): unknown => {
    try {
      return JSON.parse(readFileSync(pfad, "utf8"))
    } catch {
      return []
    }
  }
  const unzugeordnet = lies("data/prime-unzugeordnet.json") as Array<{ url?: string }>
  const zugeordnet = lies("data/prime-zugeordnet.json") as Record<string, unknown> | unknown[]
  const zahlZugeordnet = Array.isArray(zugeordnet)
    ? zugeordnet.length
    : Object.keys(zugeordnet).length
  /*
    **Nur Meldungen, die eine Kennung mitbrachten, sind ein Maßstab.**

    Die 795 Rohfolgen vom 28. bis 31.08.2026 kamen alle mit `titel_id: null` an;
    für sie ist „nicht zugeordnet" die Folge des Fehlers, nicht sein Beleg. Eine
    Zusicherung, die sie mitzählt, bliebe rot, bis Daniel jede einzelne neu
    meldet — und wäre damit ein Dauerlicht statt eines Alarms.
  */
  const liste = (Array.isArray(unzugeordnet) ? unzugeordnet : []) as Array<{
    url?: string
    mitKennung?: boolean
  }>
  /*
    **Zwei Fehlgriffe an derselben Zeile, an einem Tag — und beide Male log die Zahl.**

    Zuerst zählte die Prüfung nur Adressen mit `mitKennung`. Am 02.09.2026 trug
    keiner der 210 offenen Einträge eine, `adressen` war null, die Bedingung grün
    — und der Lauf meldete vier Tage lang „0 Adressen zugeordnet", ohne dass
    jemand rot wurde. Der Ausweg deckte genau den Fall zu, für den die Prüfung
    gebaut war.

    Die Schärfung darauf („zähle alle Adressen") **hielt keine Stunde**: Nach der
    behobenen Zuordnung waren 187 Rohfolgen abgehakt, und der nächste Lauf fand
    nur noch die zwei Adressen, die sich bauartbedingt nicht auflösen lassen. Null
    zugeordnet von zwei offenen — richtig, und trotzdem rot. **Der Deploy stand.**

    Das ist die dokumentierte Falle: Eine Prüfung, die rot wird, weil die Arbeit
    erledigt ist, misst das Falsche (CLAUDE.md, 25.08.2026). Ein Rest, der sich
    nicht auflösen lässt, ist am Ende einer Arbeitsliste der **Normalfall**.

    Deshalb jetzt zweigeteilt:

    - **Die Regel** prüft eine Kulisse, unabhängig von jedem Datenstand (unten).
      Sie hätte den echten Fehler gefangen: eine Adresse mit zwölf Folgen und
      zwölf verschiedenen ASINs muss **eine** Gruppe ergeben, nicht zwölf.
    - **Der Bestand** wird nur noch gegen eine Schwelle gehalten. Zwei
      unauflösbare Reste sind normal, siebzehn Adressen ohne eine einzige
      Zuordnung nicht.
  */
  const adressen = new Set(liste.map((e) => e.url).filter(Boolean)).size
  const SCHWELLE = 5
  pruefe(
    `Rohfolgen-Zuordnung greift (${zahlZugeordnet} zugeordnet, ${adressen} Adressen offen)`,
    adressen < SCHWELLE || zahlZugeordnet > 0,
    `${adressen} Adressen offen, keine einzige zugeordnet — bei so vielen ist das kein magerer Ertrag, sondern ein Fehler`,
  )
}

console.log('\nRohfolgen: eine Adresse, eine Gruppe:')
{
  /*
    Der Fehler vom 02.09.2026, wörtlich nachgestellt: Prime gibt jeder Folge eine
    eigene ASIN. Wer danach gruppiert, bekommt je Folge eine Gruppe — und die
    Zuordnung über Folgentitel braucht drei in einer Hand.
  */
  const zwoelf = Array.from({ length: 12 }, (_, i) => ({
    url: 'https://www.amazon.de/dp/B0CH3DCVW6',
    nummer: i + 1,
    asin: `B0CN6MWL${String(i).padStart(2, '0')}`,
  }))
  const gruppen = gruppiereNachAusgabe(zwoelf)
  pruefe(
    `durchzählende Adresse bleibt eine Gruppe (${gruppen.size})`,
    gruppen.size === 1 && [...gruppen.values()][0]!.length === 12,
    `${gruppen.size} Gruppen statt einer — nach der ASIN gruppiert?`,
  )

  /* Und der Fall, für den die Trennung überhaupt gebaut wurde: zwei Ausgaben, beide ab 1. */
  const zweiAusgaben = [
    ...Array.from({ length: 12 }, (_, i) => ({ url: 'https://x/dp/A', nummer: i + 1, asin: 'S1' })),
    ...Array.from({ length: 12 }, (_, i) => ({ url: 'https://x/dp/A', nummer: i + 1, asin: 'S2' })),
  ]
  const geteilt = gruppiereNachAusgabe(zweiAusgaben)
  pruefe(
    `zwei Ausgaben unter einer Adresse werden getrennt (${geteilt.size})`,
    geteilt.size === 2 && [...geteilt.values()].every((l) => l.length === 12),
    `${geteilt.size} Gruppen — Golden Kamuy Staffel 1 und 2 lägen in einem Topf`,
  )

  /* Eine Folge ohne Nummer darf die Gruppe nicht sprengen. */
  const ohneNummer = [
    { url: 'https://x/dp/B', nummer: 1, asin: 'a' },
    { url: 'https://x/dp/B', nummer: null, asin: 'b' },
    { url: 'https://x/dp/B', nummer: 2, asin: 'c' },
  ]
  pruefe(
    'eine Folge ohne Nummer bleibt bei ihrer Adresse',
    gruppiereNachAusgabe(ohneNummer).size === 1,
    'die nummernlose Folge hat eine eigene Gruppe bekommen',
  )
}

/*
  **Ein verpasster Termin verschiebt alles dahinter — und bleibt selbst stehen.**

  Der reale Fall: Mushoku Tensei Staffel 3, Folge 6 kam am 30.08.2026 nicht.
  Der Kalender rechnete unbeirrt weiter und setzte für den 06.09. Folge **7** an,
  obwohl die Recherche in `data/termine-verpasst.json` genau diesen Tag für
  Folge 6 nennt (Daniel, 01.09.2026).

  Der alte Tag verschwindet dabei nicht: „damit weiterhin sichtbar ist, das es
  dort stand, aber die echte neue info es nachweislich überschreibt."
*/
console.log('\nVerpasster Termin:')
{
  const release: Release = {
    slug: 'probe-verpasst',
    titleId: 1,
    name: 'Probe',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: '2026-07-26',
      episodeCount: 8,
      time: '17:00',
      estimated: true,
      verpasst: {
        6: {
          erwartetAm: '2026-08-30T15:00:00.000Z',
          neuErwartet: '2026-09-06T15:00:00.000Z',
        },
      },
    },
    year: 2026,
    sources: ['https://www.crunchyroll.com/de/simulcastcalendar'],
  }
  const termine = expandEvents(release)
  const sechs = termine.filter((e) => e.episode === 6)
  pruefe(
    'die ausgefallene Folge steht zweimal: am alten Tag und am neuen',
    sechs.length === 2,
    sechs.map((e) => e.date),
  )
  pruefe(
    'nur der ausgefallene Tag traegt den Vermerk',
    sechs.filter((e) => e.verpasst).length === 1 && sechs.find((e) => e.verpasst)?.date === '2026-08-30',
    sechs.map((e) => e.date + (e.verpasst ? ' (verpasst)' : '')),
  )
  pruefe(
    'der Ersatztermin ist der 06.09. und traegt keinen Vermerk',
    sechs.some((e) => e.date === '2026-09-06' && !e.verpasst),
    sechs.map((e) => e.date),
  )
  pruefe(
    'Folge 7 rueckt mit — 13.09., nicht 06.09.',
    termine.find((e) => e.episode === 7)?.date === '2026-09-13',
    termine.find((e) => e.episode === 7)?.date,
  )
  /* Gegenprobe: Ohne recherchierten Ersatztermin wird nichts verschoben. */
  const ohneErsatz = expandEvents({
    ...release,
    schedule: {
      ...release.schedule,
      verpasst: { 6: { erwartetAm: '2026-08-30T15:00:00.000Z' } },
    },
  })
  pruefe(
    'ohne recherchierten Ersatztermin bleibt der Plan, wie er war',
    ohneErsatz.filter((e) => e.episode === 6).length === 1 &&
      ohneErsatz.find((e) => e.episode === 7)?.date === '2026-09-06',
    ohneErsatz.find((e) => e.episode === 7)?.date,
  )
}

/* ══ Ein Abruf löscht seinen eigenen Ertrag nicht ═══════════════════════════ */
{
  /*
    **Der teuerste Fehler dieser Art, gemessen am 03.09.2026.**

    `fetch-cr-filmbloecke.mjs` nimmt nur Titel **ohne** Urteil als Kandidaten und
    schrieb `data/cr-filmbloecke.json` danach komplett neu. Wer beim letzten Lauf
    gefunden wurde und dadurch ein `dub: true` bekam, war beim nächsten kein
    Kandidat mehr — und fiel aus der Datei. Beim nächsten Bau fehlte sein Beleg,
    er stand wieder ohne Urteil da, und beim übernächsten Lauf war er wieder
    Kandidat. Ein Kreislauf, der bei jedem Durchgang Belege kostet.

    Der Lauf vom 02.09. brachte die Datei von 32 auf 25 Einträge und verlor 15
    Treffer — darunter „Detektiv Conan: Der Magier des letzten Jahrhunderts", den
    Daniel am selben Tag mit „Synchro | Untertitel" auf der Seite belegt hat.

    Geprüft wird der **Code**, nicht der Datenstand: Wie viele Einträge die Datei
    heute hat, hängt vom Abruf ab und ist morgen anders — dass der Abruf
    zusammenführt statt zu ersetzen, gilt immer.
  */
  const abruf = readFileSync(new URL('./fetch-cr-filmbloecke.mjs', import.meta.url), 'utf8')
  pruefe(
    'der Filmblock-Abruf liest den alten Stand, bevor er schreibt',
    /readFileSync\('data\/cr-filmbloecke\.json'/.test(abruf),
  )
  pruefe(
    '… führt beide Stände zusammen',
    /const zusammen = new Map\(\)/.test(abruf) && /zusammen\.set\(f\.id, f\)/.test(abruf),
  )
  pruefe(
    '… und ein Schweigen überschreibt keinen alten Treffer',
    /if \(alt\?\.treffer && !f\.treffer\)/.test(abruf),
  )
  pruefe(
    'geschrieben wird der zusammengeführte Stand, nicht die Fundliste',
    /writeFileSync\('data\/cr-filmbloecke\.json', JSON\.stringify\(gesamt/.test(abruf),
  )
}

/*
  **Zwei Ausgaben bei Prime, zwei Wege — der Handbeleg sperrt nur seinen eigenen.**

  Bis zum 05.09.2026 stieg der Bau bei jeder Rohfolgen-Meldung aus, sobald es zu
  Titel und Anbieter überhaupt einen Handbeleg gab (`checks.has(<id>|primevideo)`).
  Die Belege werden je Titel und Anbieter zu **einem** zusammengeführt — eine
  geprüfte Ausgabe sperrte damit jede Meldung zur zweiten.

  Gekostet hat es elf Folgen: Daniel prüfte am 30.08.2026 den Kanal-Titel von
  „My First Girlfriend Is a Gal" (`B0GV5SHH5P`, zehn Folgen) und meldete am
  01.09. den Kauftitel (`B0GPD4GNLL`, elf Folgen mit deutscher Tonspur). Die
  Meldung lag vier Tage unverwertet im Briefkasten.

  Beide Richtungen stehen hier, denn die Lockerung ist die gefährlichere Hälfte:
  Ein Beleg **ohne** Adresse gilt dem Anbieter und muss weiter alles sperren —
  sonst überschreibt eine Meldung ein geprüftes Nein.
*/
console.log('\nPrime: ein Handbeleg gilt seiner Adresse:')
{
  const bau = readFileSync('pipeline/build.ts', 'utf8')
  pruefe(
    'der Riegel sperrt nicht mehr pauschal je Anbieter',
    !/if \(checks\.has\(dubKey\(eintrag\.titleId, 'primevideo'\)\)\) continue/.test(bau),
    'der pauschale Riegel steht wieder da — Meldungen zur zweiten Ausgabe kommen nicht an',
  )
  pruefe(
    '… sondern vergleicht die Adresse des Belegs',
    /if \(beleg && \(!beleg\.url \|\| beleg\.url === seite\)\) continue/.test(bau),
    'der Adressvergleich fehlt',
  )
  pruefe(
    'der Verweis zeigt auf die gemeldete Seite, nicht auf die ASIN der ersten Folge',
    /const gemeldeteAdresse = schluessel\.split\('#'\)\[0\]!/.test(bau) && /\? gemeldeteAdresse/.test(bau),
    'die Folgen-ASIN wird wieder als Titelseite verlinkt (B0GSSL7BMZ statt B0GPD4GNLL)',
  )

  /*
    Und die beiden Stellen in `fetch-rohfolgen.ts`, ohne die die Meldung gar
    nicht erst bei einem Titel ankäme: der Schnitt am Gedankenstrich (Daniels
    Zusatz „— Kauftitel (FSK 16, mit OVA)") und der Beleg ohne Folgenzuordnung,
    wenn Prime eigene Folgennamen und für alle dasselbe Datum führt.
  */
  const roh = readFileSync('pipeline/fetch-rohfolgen.ts', 'utf8')
  pruefe(
    'der gemeldete Name wird am Gedankenstrich geschnitten',
    /titelSchluessel\(name\.split\(' — '\)\[0\]!\)/.test(roh),
    'ohne den Schnitt bleibt „… — Kauftitel (FSK 16)" ein unbekannter Titel',
  )
  pruefe(
    'unzuordenbare Folgen belegen den Titel nur bei starker Herkunft und einheitlicher Sprache',
    /const belastbar = \(ausBestand \|\| nameGenau\) && sprachen\.size === 1/.test(roh),
    'die Bedingung fehlt oder ist gelockert — ein Namensanfang würde ungeprüft zum Beleg',
  )

  /*
    **Was ausgelassen wird, wird abgehakt — sonst wächst der Briefkasten ewig.**

    `fetch-pruefungen.ts` hakt am Ende nur ab, wer etwas geschrieben hat. Eine
    Kanal-Meldung ohne Aussage schreibt nichts und blieb deshalb liegen: Am
    05.09.2026 lagen 16 Meldungen auf 13 Adressen im Briefkasten, die jeder Lauf
    holte, ausließ und liegen ließ. Die Entscheidung ist endgültig (Kanal-Titel,
    Adresse bekannt, kein Folgenbefund) — morgen käme dasselbe heraus.
  */
  pruefe(
    'ein dritter Prime-Verweis aus einer Meldung wird nicht angelegt',
    /if \(title\.streams\.filter\(\(x\) => x\.platform === plattform\)\.length >= 2\) \{/.test(bau),
    'ohne den Deckel wächst ein Titel auf 52 Verweise bei einem Anbieter — je Folge einen, wie im Verlauf von prime-zugeordnet.json',
  )

  /*
    **Und die Zuordnungen sammeln sich, statt sich zu ersetzen.**

    `fetch-rohfolgen.ts` schrieb nur die Zuordnungen des laufenden Laufs und
    hakte den Briefkasten danach ab — was gestern zugeordnet war, war heute weg.
    Der Verlauf der Datei zeigt es: 0, 1, 2, 0, 1 Adressen, nie mehr. `build.ts`
    legt aus dieser Datei die Prime-Verweise an, ein solcher Verweis hielt also
    genau einen Bau.
  */
  pruefe(
    'die Zuordnungen werden mit dem alten Stand zusammengeführt',
    /const bisher = readJson<typeof zugeordnet>\('data\/prime-zugeordnet\.json', \{\}\)/.test(roh) &&
      /writeJson\('data\/prime-zugeordnet\.json', \{ \.\.\.bisher, \.\.\.zugeordnet \}\)/.test(roh),
    'die Datei wird wieder überschrieben — jede Zuordnung hält dann einen Bau',
  )

  /*
    **Der Verweis gehört dem Anbieter, der gemeldet hat.**

    `Rohfolge.plattform` gibt es seit dem 01.09.2026 und kam im ganzen
    Zuordner genau einmal vor: in seiner eigenen Deklaration. Geschrieben wurde
    in eine Prime-Datei, `build.ts` legte daraus einen Verweis mit fest
    verdrahtetem `platform: 'primevideo'` an. Sobald Netflix oder Disney+
    dieselbe Route gehen, wäre eine Netflix-Meldung als Prime-Weg gelandet —
    ein Verweis auf eine Seite, die es beim genannten Anbieter nicht gibt.

    Derselbe Fehlgriff wie bei `titelId` am 28.08.2026: ein Feld, das gesendet,
    aber nie gelesen wird.
  */
  pruefe(
    'die Zuordnung schreibt mit, wer gemeldet hat',
    /plattform: liste\[0\]!\.plattform \?\? 'primevideo'/.test(roh),
    'ohne die Plattform kann der Bau nur raten — und riet bisher immer Prime',
  )
  pruefe(
    'der Bau legt den Verweis beim gemeldeten Anbieter an',
    /const plattform = eintrag\.plattform as PlatformId/.test(bau) &&
      /title\.streams\.push\(\{ platform: plattform, url: seite, dub: true \}\)/.test(bau),
    'die Plattform ist wieder fest verdrahtet',
  )
  pruefe(
    'Amazon-Eigenes bleibt an Prime gebunden',
    /plattform !== 'primevideo'\n\s+\? gemeldeteAdresse/.test(bau),
    'die Seite aus der ASIN gilt nur bei Amazon — bei Netflix ist die gemeldete Adresse die Seite',
  )

  /*
    **Eine ADN-Adresse wird geschärft — aber nur, wo es belegt ist.**

    Ohne Serienkennung findet das Archiv nichts (33 von 135 Verweisen am
    06.09.2026), ohne Staffel antwortet es „gemischt" (weitere 25). Beides
    kommt von außen: die Kennung aus dem Katalog, die Staffel aus dem
    Release-Slug.

    Die Gegenrichtungen sind die eigentlichen Zusicherungen. Wer auch
    Folgenverweise umschreibt, hängt eine Folgen-Id aus ADNs alter Ablage an
    eine neue Serienkennung und erfindet eine Adresse, die niemand geprüft hat;
    wer eine fremde Kennung überschreibt, macht aus einem Widerspruch eine
    scheinbare Verbesserung.
  */
  pruefe(
    'eine alte ADN-Serienadresse bekommt die Kennung',
    adnAdresseSchaerfen('https://animationdigitalnetwork.de/video/50-nuances-de-gras', { kennung: 1234 }) ===
      'https://animationdigitalnetwork.com/de/video/1234',
    'ohne Kennung bleibt der Verweis stumm',
  )
  pruefe(
    'die Staffel aus dem Release-Slug kommt an die Adresse',
    adnAdresseSchaerfen('https://animationdigitalnetwork.com/de/video/461-haikyu', { staffel: '3' }) ===
      'https://animationdigitalnetwork.com/de/video/461-haikyu?s=3',
    'ohne Staffel bleibt der Befund „gemischt" — richtig und unbrauchbar',
  )
  pruefe(
    'eine Staffel in der Adresse gewinnt gegen den Slug',
    adnAdresseSchaerfen('https://animationdigitalnetwork.com/de/video/1160-dan-da-dan?s=2', { staffel: '1' }) ===
      undefined,
    'was in der Adresse steht, hat jemand gesetzt — ein Release-Slug ist schwächer',
  )
  pruefe(
    'eine fremde Kennung wird nicht überschrieben',
    adnAdresseSchaerfen('https://animationdigitalnetwork.com/de/video/1160-dan-da-dan', { kennung: 444 }) ===
      undefined,
    'zwei verschiedene Serien sind ein Widerspruch, keine Verbesserung',
  )
  pruefe(
    'ein Folgenverweis bleibt unangetastet',
    adnAdresseSchaerfen('https://animationdigitalnetwork.de/video/clannad/12851-folge-24-das-tomoyo-kapitel', {
      kennung: 655,
    }) === undefined,
    'eine Folgen-Id der alten Ablage gehört nicht an eine neue Serienkennung',
  )
  pruefe(
    'ohne Kennung und ohne Staffel passiert nichts',
    adnAdresseSchaerfen('https://animationdigitalnetwork.de/video/haikyuu', {}) === undefined,
    'eine alte Adresse ohne Anhaltspunkt bleibt, wie sie ist',
  )

  /*
    **Die Bezugsquellen aus aniSearch und ihre vier Riegel.**

    Der Bau ergänzt seit dem 06.09.2026 Anbieter, die aniSearch zu einem Titel
    nennt und die im Bestand fehlen — der Anlass war Detektiv Conan, das bei
    Crunchyroll 405 deutsche Folgen hat und dort keinen Weg im Kalender
    (CLAUDE.md, 25.08.2026). Jeder Riegel hat einen belegten Anlass, und jeder
    einzelne kann still wegfallen, ohne dass ein Test es merkt.
  */
  pruefe(
    'ergänzt wird nach dem Entfernen der belegten Neins',
    bau.indexOf('Anbieter-Verweise aus aniSearch ergänzt') >
      bau.indexOf('Verweise ohne deutsche Synchro entfernt'),
    'weiter oben sind die Anbieter noch besetzt — dann ergänzt der Block fast nichts',
  )
  /*
    **Ein belegtes Nein hat eine Frist.**

    Der Riegel hielt einen entfernten Verweis dauerhaft draußen. Bei „Kill Blue"
    hieß das: Am 24.08.2026 null deutsche Folgen bei Crunchyroll, Verweis zu
    Recht entfernt — am 06.09. erschienen die Folgen 1–8 auf Deutsch, und der
    Kalender zeigte weiter keinen Weg. Er behauptete damit das Gegenteil der
    Wirklichkeit.

    Dieselbe Regel gilt seit dem 15.08.2026 für Warteschlangen; das Gedächtnis
    war die Stelle, an der sie nie angewandt wurde.
  */
  pruefe(
    'ein belegtes Nein veraltet nach einer Frist',
    bau.includes('const NEIN_GILT_TAGE = 28') && bau.includes("(e.entferntAm ?? '') >= neinGrenze"),
    'ohne Frist bleibt ein Verweis draußen, auch wenn der Anbieter die Synchro aufnimmt',
  )
  pruefe(
    'jeder entfernte Verweis bekommt ein Datum',
    bau.includes('entferntAm: todayIso()'),
    'ohne Datum ist die Frist nicht messbar',
  )
  pruefe(
    'das Gedächtnis über Läufe hinweg wird gefragt',
    bau.includes("'data/verweise-entfernt.json'") &&
      bau.includes('frueherEntfernt.has(adressKern(url), title.id)'),
    'ohne den Riegel legt jeder Bau wieder an, was der Prüflauf gerade verworfen hat',
  )
  /*
    **Ein verneinender Handbeleg sperrt den Anbieter — ein bejahender öffnet ihn.**

    Bis zum 06.09.2026 stand hier `checks.has(...)`, also die Frage, **ob**
    jemand hingesehen hat. Für ein Nein ist das richtig (am 25.08.2026 hat ein
    Lauf so fünf geprüfte Neins überschrieben), für ein Ja verkehrt herum: Bei
    „Sword Art Online II" sagten zwei Handbelege `dub: true` für die Folgen
    1–24, und im Datensatz stand kein Netflix-Weg.

    Beide Hälften stehen hier, weil die eine ohne die andere wieder in einen der
    zwei Fehler läuft.
  */
  pruefe(
    'ein verneinender Handbeleg sperrt den Anbieter',
    bau.includes('if (beleg && (beleg.dub !== true || beleg.available === false)) continue'),
    'am 25.08.2026 hat ein Lauf so fünf geprüfte Neins überschrieben',
  )
  pruefe(
    'ein bejahender Handbeleg sperrt ihn nicht',
    !bau.includes('if (checks.has(dubKey(title.id, ziel))) continue'),
    'wer geprüft hat, dass es dort auf Deutsch läuft, hat den besten Grund geliefert, den Weg anzulegen',
  )
  pruefe(
    'bei Amazon zählt nur, was als Video belegt ist',
    bau.includes("if (ziel === 'primevideo' && linkBefunde[url]?.prime !== true) continue"),
    'hinter /dp/ kann eine DVD liegen — eine Disc als Stream wäre schlimmer als kein Weg',
  )
  /*
    Der Handbeleg gehört in dieselbe Nachrunde: Er ist der Grund, warum ein
    bejahter Weg überhaupt angelegt wird, und die Runde, die Handbelege
    anwendet, läuft weiter oben. Ohne ihn trug „Sword Art Online II" seinen
    frisch entstandenen Netflix-Weg mit `dub: undefined` (06.09.2026).
  */
  /*
    **Die Teilen-Seiten verlinken einander — und zwar über saubere Adressen.**

    Stand der Search Console am 07.09.2026: 62 Seiten indexiert, 562 als
    „Gefunden – zurzeit nicht indexiert". Das ist der Fall vom 17.08.2026 in
    größer (damals 171): Eine Seite, auf die nur eine Sammelliste zeigt, bleibt
    für Google ein Blatt am Ende eines Astes. Der Geschwister-Block legt
    Querverbindungen zwischen den Ausgaben desselben Titels — 149 der 662
    Adressen haben welche.

    Der zweite Teil ist die Falle, in die der erste Versuch gelaufen ist:
    `SITE` endet bauartbedingt auf einen Schrägstrich (`.replace(/\/?$/, '/')`).
    Ein `'/r/'` dahinter ergibt `anime-kalender.de//r/...` — abrufbar, aber eine
    andere Adresse als die in der Sitemap, und damit genau das Duplikat, das
    hier vermieden werden soll.
  */
  {
    const seiten = readFileSync('pipeline/build-share-pages.ts', 'utf8')
    /*
      **Strukturierte Daten sind das Signal, das Google direkt versteht.**

      Am 07.09.2026 trug keine einzige Seite einen `ld+json`-Block — bei einer
      Seite, deren Kern ein Termin ist, die naheliegendste Auskunft überhaupt.
      Gleichzeitig standen 562 Seiten als „Gefunden – zurzeit nicht indexiert".

      Der Typ folgt dem Werk: ein Film ist `Movie`, alles andere `TVSeries`.
      Ein Typ für beides behauptet für eine Blu-ray-Box dasselbe wie für eine
      wöchentliche Ausstrahlung.
    */
    pruefe(
      'die Teilen-Seiten tragen strukturierte Daten',
      seiten.includes('application/ld+json') && seiten.includes('function strukturierteDaten('),
      'ohne JSON-LD fehlt die Auskunft, was die Seite überhaupt ist',
    )
    pruefe(
      'ein Film bekommt Movie, eine Serie TVSeries',
      seiten.includes("istFilm ? 'Movie' : 'TVSeries'"),
      'ein Typ für beides behauptet für eine Disc dasselbe wie für eine Ausstrahlung',
    )
    pruefe(
      'die Teilen-Seiten verlinken die anderen Ausgaben desselben Titels',
      seiten.includes('Weitere Ausgaben von') && seiten.includes('const jeTitel = new Map<number, Release[]>()'),
      'ohne Querverbindungen zeigt nur die Sammelliste auf eine Teilen-Seite',
    )
    pruefe(
      'keine doppelten Schrägstriche in den erzeugten Adressen',
      !/esc\(SITE\)\s*\+\s*\n?\s*'\//.test(seiten),
      'SITE endet bereits auf einen Schrägstrich',
    )
  }
  /*
    **Die Nachrunde schärft die ADN-Adresse, bevor sie sie beurteilt.**

    Ein hier ergänzter ADN-Verweis trägt die Adresse aus aniSearch — oft eine
    Slug-Adresse ohne Serienkennung, teils mit französischem Namensteil. Die
    Schärfungsrunde läuft rund 400 Zeilen weiter oben, also bevor dieser Block
    überhaupt Verweise anlegt.

    Gemessen am 07.09.2026: sieben Verweise blieben deshalb ohne Urteil, sechs
    davon mit einer Kennung, die seit dem Vortag in `data/adn-adressen.yaml`
    stand — die Datei war gepflegt und wirkungslos. Dieselbe Klasse Fehler wie
    beim Handbeleg einen Tag zuvor, und deshalb steht die Zusicherung direkt
    daneben.
  */
  /*
    **Kein Verweis zeigt mehr auf die abgeschaltete Domain tvnow.de.**

    RTL+ hieß früher TVNow; die alten Adressen leiten auf die **Startseite** um,
    nicht auf die Serie (gemessen 07.09.2026, alle zehn). Wer im Kalender darauf
    klickt, steht vor dem ganzen Katalog. Die neuen Adressen stehen in
    `data/rtlplus-adressen.yaml`, je Titel über RTL+' Sitemaps belegt.

    `data/rtlplus-befunde.json` wusste es seit dem 22.08.2026 für zwei davon —
    der Befund wurde nur nie angewandt. Diese Zusicherung sorgt dafür, dass die
    Umstellung nicht wieder still herausfällt.
  */
  /*
    **Die Serienkennung schlägt den Namensabgleich.**

    Wo ein Crunchyroll-Verweis eine Kennung trägt (`/series/GXXXXXXXX/`), wird
    sie direkt gegen `data/cr-katalog-de.json` gehalten — Zeichenkette gegen
    Zeichenkette. Der Namensabgleich eine Runde davor braucht dagegen einen
    strengen Filter, weil ein Namensteil immer den Reihennamen trifft (von 16
    Zuordnungen waren am 29.08.2026 fünfzehn falsch).

    Der Katalog ist der **deutsche**; aus ihm ist auch ein fehlendes `de-DE`
    ein Beleg. Deshalb steht daneben die Bedingung `folgen`: Ein Eintrag ohne
    abrufbare Folgen sagt über Tonspuren nichts.
  */
  /*
    **Die Wache meldet nur, was das Gedächtnis nicht erklärt.**

    Am 06.09.2026 stand in ihrem Befund „78 Verweise entfernt" als
    Auffälligkeit — während `data/verweise-entfernt.json` im selben Lauf um 78
    Einträge wuchs. Das war der Normalfall: Die aniSearch-Ergänzung legt
    Verweise an und entfernt die belegten Neins im selben Durchgang wieder.

    Eine Warnung, die zuverlässig zu Unrecht kommt, ist schlimmer als keine —
    man hört auf hinzusehen, und die echte Störung geht darin unter.
  */
  {
    const wache = readFileSync('pipeline/bestand-historie.ts', 'utf8')
    pruefe(
      'die Wache rechnet begründet entfernte Verweise heraus',
      wache.includes('entferntProtokolliert') && wache.includes('wegUnerklaert'),
      'sonst meldet sie den Normalfall als Verlust',
    )
  }
  /*
    **Der Katalog legt einen Weg an, nicht nur ein Urteil.**

    „Kill Blue" hatte am 24.08.2026 null deutsche Folgen bei Crunchyroll, der
    Verweis flog zu Recht heraus. Am 06.09. erschienen die Folgen 1–8 auf
    Deutsch — und kein einziger Lauf konnte das finden: Der Sendekalender führt
    nachgereichte Katalog-Synchros nicht, und der Dub-Lauf prüft nur Serien mit
    vorhandenem Verweis.
  */
  pruefe(
    'der deutsche Katalog legt fehlende Crunchyroll-Wege an',
    bau.includes('Crunchyroll-Wege neu angelegt') && bau.includes('const asCr ='),
    'sonst findet niemand eine Synchro, die nach dem Entfernen des Verweises erscheint',
  )
  pruefe(
    'die Katalog-Runde greift nur bei genau einer Staffel',
    bau.includes('if ((eintrag.staffeln ?? 0) !== 1) continue'),
    'eine Serienkennung ist ein Franchise — Free! führt neun Staffeln unter einer',
  )
  pruefe(
    'die Serienkennung wird gegen den deutschen Katalog gehalten',
    bau.includes('über die Serienkennung im deutschen Katalog belegt') &&
      bau.includes('if (!eintrag || !eintrag.folgen) continue'),
    'ohne die Folgenbedingung würde ein leerer Katalogeintrag ein Nein erzeugen',
  )
  pruefe(
    'RTL+-Adressen werden von tvnow.de umgestellt',
    bau.includes('RTL+-Adressen von der abgeschalteten Domain tvnow.de umgestellt'),
    'sonst zeigen zehn Verweise weiter auf die Startseite statt auf die Serie',
  )
  /*
    **Wo kein ADN-Release die Staffel nennt, tut es die Zuordnungsdatei.**

    Eine ADN-Serienkennung ist ein Franchise: 444 führt alle vier
    JoJo-Blöcke. Ohne Staffel bekommt der Verweis den Befund „gemischt" —
    richtig und unbrauchbar. Normalerweise steht sie im Release-Slug;
    `data/adn-staffelzuordnung.yaml` schließt die Lücke für Titel, zu denen es
    kein ADN-Release gibt.

    Belegt wird dort über die **Folgenzahl** und nur, wo sie eindeutig ist:
    Bei JoJo hat Staffel 1 sechsundzwanzig Folgen, Staffel 2 achtundvierzig,
    Staffel 3 und 4 je neununddreißig — und von den beiden 39ern ist eine
    vollständig deutsch, die andere gar nicht. Die zwei Titel dazu bleiben
    deshalb offen.
  */
  /*
    **Ein Bezugsweg aus dem Sprachblock braucht Verlag und erschienenen Status.**

    aniSearchs deutscher Sprachblock nennt Zeitraum, Status und Verlag. Ohne
    Verlag kann er eine Ankündigung sein; mit Status „Zukünftig" ist er ein
    Termin und kein Weg. Beide Riegel zusammen machen aus der Angabe einen
    Beleg — sie halbiert die Zahl der Titel ohne Weg (489 auf 243, gemessen
    07.09.2026).

    Und der Weg trägt **keine** Sprachaussage, obwohl der Block `dubbed`
    führt: eine Auskunft nach der anderen, sonst ist hinterher nicht mehr
    erkennbar, worauf ein Urteil beruht.
  */
  pruefe(
    'der Bezugsweg aus dem Sprachblock verlangt Verlag und erschienenen Status',
    bau.includes('if (!block?.publisher?.length) continue') &&
      bau.includes("['Abgeschlossen', 'Abgebrochen', 'Laufend'].includes(String(block.status))"),
    'ohne die Riegel wird aus einer Ankündigung ein Bezugsweg',
  )
  pruefe(
    'er trägt keine Sprachangabe',
    !/name: 'Deutsche Ausgabe bei aniSearch'[\s\S]{0,200}dub:/.test(bau),
    'der Block sagt, dass es die Ausgabe gab — nicht, in welcher Sprache sie lief',
  )
  pruefe(
    'die ADN-Staffelzuordnung wird gelesen, der Release-Slug geht vor',
    bau.includes('data/adn-staffelzuordnung.yaml') &&
      bau.includes('ausSlug?.staffel ?? adnStaffeln[titleId]'),
    'die Datei ist die Rückfallebene, nicht die erste Quelle',
  )
  pruefe(
    'die Nachrunde schärft die ADN-Adresse vor der Beurteilung',
    bau.includes('adnStreamSchaerfen(title.id, stream)'),
    'ein ergänzter ADN-Verweis ohne Serienkennung bleibt sonst stumm',
  )
  pruefe(
    'auch der Handbeleg wird in der Nachrunde angewandt',
    /*
      Seit dem 07.09.2026 über `belegFuer(...)` statt über die Map: Der Beleg
      wird zur **Adresse** des Verweises gesucht, nicht nur zur Plattform —
      sonst färbt ein Ja für die eine Prime-Ausgabe die andere.
    */
    bau.includes('const handBeleg = belegFuer(title.id, stream.platform, stream.url'),
    'sonst steht ein bejahter Weg ohne das Urteil da, das ihn ausgelöst hat',
  )
  pruefe(
    'ein frisch ergänzter Verweis wird im selben Lauf beurteilt',
    bau.includes('const crNachUrl = new Map(crDub.serien.map((serie) => [serie.url, serie] as const))') &&
      bau.includes('beurteileAdnVerweis(stream.url, adnArchiv)'),
    'sonst steht der Fall, der die Ergänzung ausgelöst hat, einen Bau lang unverändert da',
  )
  pruefe(
    'auch die Nachrunde entfernt ein belegtes Nein',
    bau.includes('frisch ergänzte Verweise gleich wieder entfernt'),
    'im ausgelieferten Datensatz steht bei keinem Verweis ein dub: false — das gilt auch hier unten',
  )
  pruefe(
    'das Gedächtnis reicht bis in diesen Lauf hinein',
    bau.includes('...verweiseEntfernt.map(merkeSchluessel)'),
    'ohne das legt derselbe Lauf wieder an, was er selbst eben verworfen hat',
  )
  /*
    **Eine Amazon-Regel darf Netflix nicht ausblenden.**

    `melder.css` gilt laut Manifest für Netflix, Amazon und Disney+ — eine
    Datei, drei Anbieter. Die Regel, die einen Knopf unsichtbar hält, solange
    er nicht in Amazons Hinweiskasten eingezogen ist, traf deshalb auch die
    beiden anderen, wo es diesen Kasten gar nicht gibt. Der Prüflisten-Knopf
    war auf Netflix vier Tage lang `visibility: hidden` — im Dokument, an der
    richtigen Stelle, mit oberstem z-index.
  */
  {
    const css = readFileSync('extension/melder.css', 'utf8')
    const versteckt = css
      .split('}')
      .filter((block) => /visibility:\s*hidden/.test(block))
      /* Nur der Selektor, nicht der Kommentarblock davor — sonst ist die
         Fehlermeldung zwei Bildschirme lang und niemand liest sie. */
      .map((block) => (block.split('{')[0] ?? '').split('*/').pop()?.trim() ?? '')
    const ohneAnbieter = versteckt.filter(
      (wahl) => /\.ak-(uebersicht|melder|amazon-knopf)/.test(wahl) && !/\.ak-amazon\s/.test(wahl),
    )
    pruefe(
      'kein Knopf wird ohne Anbieter-Anker unsichtbar geschaltet',
      ohneAnbieter.length === 0,
      ohneAnbieter,
    )
  }

  pruefe(
    'ein Kanal-Angebot wird kein Prime-Verweis',
    bau.includes("kanal") &&
      bau.includes("{ name: kanal, url, kind: 'stream' as const, zugang: 'abo' as const }"),
    'bei einem Kanal-Titel zeigt Amazon die Sprachen des Kanals — als Stream wäre das eine Frage, die dort niemand beantworten kann',
  )
  pruefe(
    'ein unbekannter Kanal wird übersprungen, nicht benannt',
    bau.includes('if (!kanal && !istShop) continue'),
    'ein geratener Anbietername sieht aus wie eine Auskunft',
  )
  pruefe(
    'ein Amazon-Shop-Verweis bleibt ein Kaufweg',
    bau.includes("{ name: 'Amazon', url, kind: 'buy' as const, zugang: 'kauf' as const }"),
    'hinter /dp/ kann eine DVD liegen — „kaufen“ ist die vorsichtige und richtige Auskunft',
  )
  pruefe(
    'der Partner-Parameter von aniSearch wandert nicht mit',
    bau.includes("const url = (quelle.url ?? '').split('?')[0]"),
    'tag=anisearch.de-21 gehört aniSearch, nicht uns',
  )

  const pruef = readFileSync('pipeline/fetch-pruefungen.ts', 'utf8')
  const auslass = /if \(ohneAussage\) \{[\s\S]{0,2000}?\n    \}/.exec(pruef)?.[0] ?? ''
  pruefe(
    'eine ausgelassene Kanal-Meldung wird abgehakt',
    /for \(const x of gruppe\) erledigteIds\.add\(x\.id\)/.test(auslass),
    'ohne das Abhaken holt jeder Lauf dieselbe Meldung erneut — der Briefkasten leert sich nie',
  )
}

/**
 * **Eine Frage über die Synchro ist keine Zusage.**
 *
 * Gefunden am 07.09.2026 an „Fool Night" (Anime2You 1043399): Der Artikel
 * schreibt „Ob auch eine deutsche Synchronisation angeboten wird, ist zum
 * aktuellen Zeitpunkt noch offen" — und der Vorschlag stand als **✅ zugesagt**
 * im Kuratierungsbericht. Das alte Muster traf die Wortfolge „deutsche
 * Synchronisation" und wertete sie als Bestätigung.
 *
 * Für dieses Projekt ist das der teuerste Fehlertyp überhaupt: Ein Termin mit
 * falscher Sprachzusage ist schlimmer als kein Termin.
 */
{
  const { dubBefund } = await import('./scrape-anime2you.ts')
  pruefe(
    'eine Frage über die Synchro gilt als offen, nicht als Zusage',
    dubBefund('Ob auch eine deutsche Synchronisation angeboten wird, ist zum aktuellen Zeitpunkt noch offen.') ===
      'offen',
    'so stand es wörtlich im Fool-Night-Artikel, und der Vorschlag meldete „zugesagt"',
  )
  pruefe(
    'eine echte Zusage bleibt eine Zusage',
    dubBefund('Die Serie erscheint mit deutscher Synchronfassung am 26. November 2026.') === 'ja',
    'sonst hätte die Schärfung jede Zusage mitgenommen — die Gegenprobe zur Zeile darüber',
  )
  pruefe(
    'ein Satz mit Zweifel hebt eine Zusage im Nachbarsatz nicht auf',
    dubBefund(
      'Die Serie erscheint mit deutscher Synchronfassung. Ob es eine zweite Staffel gibt, ist noch offen.',
    ) === 'ja',
    'gewertet wird je Satz, nicht über den ganzen Artikel',
  )
  pruefe(
    'ohne jeden Synchro-Bezug bleibt es unklar',
    dubBefund('Die Serie startet am 26. November 2026 auf Netflix.') === 'unklar',
    'das ist die Mehrheit der Artikel, und „unklar" ist dort die ehrliche Antwort',
  )
}

/**
 * **Prime Video führen wir über amazon.de, nicht über primevideo.com.**
 *
 * Daniel am 07.09.2026 an „City The Animation": Der Titel stand zweimal mit
 * Prime Video in der „Wo sehen?"-Liste, einmal als „DE ✓" und einmal als
 * „DE ?" — die zweite Zeile war ein Bezugsweg auf `primevideo.com`.
 *
 * Die Regel gilt seit dem 08.08.2026 für Verweise (`isUnusablePrimeLink`); die
 * Bezugswege liefen daran vorbei, weil sie aus aniSearchs Quellenliste
 * stammen und die beide Domains führt.
 */
{
  /*
    **Geprüft wird die Filterstelle, nicht der Datenbestand.**

    Der erste Anlauf las `public/data/titles.json` und wurde rot — zu Recht,
    denn der ausgelieferte Stand trägt die sechs Wege noch, und der Bau, der
    sie entfernt, läuft erst danach. Eine Zusicherung, die zwischen zwei
    richtigen Zuständen rot ist, misst den Zeitpunkt statt die Sache; die
    Lehre steht seit dem 02.09.2026 in `CLAUDE.md`.
  */
  const bau = readFileSync('pipeline/build.ts', 'utf8')
  pruefe(
    'Bezugswege auf primevideo.com werden entfernt',
    bau.includes('Bezugswege auf primevideo.com entfernt') && bau.includes('.test(w.url))'),
    'eine ASIN gilt nicht marktübergreifend, und zwei Prime-Zeilen sehen aus wie zwei Angebote',
  )
}

/**
 * **Die vier Riegel vom 07.09.2026 — jeder mit seinem Anlass.**
 *
 * Alle vier sind an einem Tag entstanden, alle vier aus einer Meldung von
 * Daniel, und alle vier hingen bis hierher an einem Kommentar. Ein Kommentar
 * hält niemanden auf, der die Stelle umbaut; eine Zusicherung steht im Weg.
 *
 * Geprüft wird jeweils die **Stelle im Bau**, nicht der Datenbestand: Eine
 * Prüfung, die zwischen zwei richtigen Zuständen rot wird, misst den Zeitpunkt
 * statt die Sache (siehe 02.09.2026).
 */
{
  const bau = readFileSync('pipeline/build.ts', 'utf8')
  /*
    **Die Zusicherung ist mit ihrer Regel gewandert.**

    Sie hieß bis zum Abend des 07.09.2026 „ohne belegte Synchro wird entfernt"
    und prüfte auf die Zählung `belegt > 1`. Am selben Abend präzisierte Daniel
    die Vorgabe an einem Gegenbeispiel: „season 1 ep 1 date a live, deutsch
    komplett. füg es hinzu, schreib auch das es nur diese ep unter diesem
    verweis gibt, sodass kein falscher eindruck entsteht."

    Damit entscheidet nicht mehr die Zahl der Folgen, sondern ob der **Umfang
    ausgewiesen** ist — reichen die Bereiche bis zur letzten Folge, steht er in
    der Pille. Die Prüfung greift jetzt an genau dieser Stelle: Fällt der
    Vergleich `bisWohin >= gesamt` weg, ist die Regel weg.
  */
  pruefe(
    'ein YouTube-Verweis bleibt nur, wenn sein Umfang ausgewiesen ist',
    bau.includes('bisWohin >= gesamt') && bau.includes('YouTube-Verweise entfernt, deren Umfang unbekannt bleibt'),
    'sonst behauptet eine Pille alle Folgen, wo der Kanal nur die erste hat',
  )
  /*
    **Amazons Fehlerseite kommt auch mit HTTP 200 — und ein leeres 200 ist kein Ja.**

    Daniel meldete am 07.09.2026 vier tote Aniverse-Verweise an „Date a Live"
    und stellte die Frage, um die es hier geht: „kannst du das auch selbst
    mitbekommen und evtl generisch fixen? weil ich nicht alle manuell prüfen
    kann."

    Die Ursache stand im eigenen Bestand: `amazon.de/dp/B0C9VS255F` war am
    24.08.2026 als **HTTP 200** gebucht; derselbe Abruf am 07.09.2026 antwortete
    mit 404. Amazon hatte beim Massenlauf eine Zwischenseite geliefert, 200 und
    ohne Inhalt — und damit war die Adresse dreißig Tage lang nicht mehr fällig.

    Ohne beide Riegel zusammen bleibt die Lücke offen: `PRODUKTSEITE` erkennt
    das leere 200, und `unklar` in der Fälligkeit sorgt dafür, dass es beim
    nächsten Lauf wieder drankommt. Fehlt der zweite, ist der erste nur eine
    andere Schreibweise für denselben Falschbefund.
  */
  const linkPruefer = readFileSync('pipeline/check-links.ts', 'utf8')
  pruefe(
    'ein Amazon-200 ohne Produktseite gilt nicht als lebende Adresse',
    linkPruefer.includes('if (!PRODUKTSEITE.test(text)) return { status: \'unklar\'') &&
      linkPruefer.includes("alt.status === 'unklar'"),
    'sonst bucht ein misslungener Abruf eine tote ASIN für dreißig Tage als lebend',
  )
  /*
    **Und der Lauf hält an, wenn die Abwehr zumacht.**

    Im ersten Lauf mit dem Riegel (07.09.2026) kamen nach 668 verwertbaren
    Befunden **623 `unklar` am Stück** — Amazon hatte gesperrt, und der Lauf
    klopfte weitere zwanzig Minuten dagegen. Die Gegenprobe im Einzelabruf:
    Auch eine lebende Adresse kam nur noch als 3.815-Zeichen-Seite zurück.

    Weiterlaufen bringt keinen Befund und verlängert die Sperre. Die Adressen
    bleiben fällig und kommen im nächsten Lauf dran — dafür ist `unklar` da.
  */
  /*
    **Ein Adressbeleg ist kein Sprachbeleg.**

    `dub-confirmed.yaml` führt zweierlei: Sprachurteile (`dub: true|false`) und
    Zeilen, die nur die Herkunft einer Adresse festhalten — mit `url`, ohne
    `dub`. Seit die Belege je Ausgabe getrennt stehen (07.09.2026), lagen beide
    in derselben Liste, und der Adressbeleg gewann gegen das Urteil, weil er die
    passende Adresse trug.

    Folge: Fünf Staffeln „My Hero Academia", auf Netflix als „ohne deutsche
    Tonspur" geprüft, standen weiter im Datensatz. `check:handbelege` hat es
    gemeldet und den Datenlauf rot gemacht — die Prüfung hat also gehalten, was
    sie soll. Diese Zusicherung hält die Ursache fest, nicht nur die Wirkung.
  */
  pruefe(
    'nur Einträge mit einer Aussage zählen als Beleg — Adressbelege nicht',
    bau.includes("if (typeof c.dub !== 'boolean' && typeof c.available !== 'boolean') continue"),
    'ein Adressbeleg trägt url und keine Aussage; available gehört dazu, sonst fallen 262 „nicht verfügbar" weg',
  )
  /*
    **Und der jüngste Beleg steht vorn.** `belegFuer()` greift in jeder Stufe
    den ersten passenden Eintrag; ohne Sortierung ist das der erste der Datei.
    Bei 26 Verweisen war das am 07.09.2026 ein Beleg, den ein jüngerer längst
    überholt hatte — `check:handbelege` meldet solche Fälle namentlich.
  */
  pruefe(
    'bei mehreren Belegen gilt der jüngste',
    bau.includes("liste.sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''))"),
    'sonst entscheidet die Reihenfolge in der Datei, nicht das Prüfdatum',
  )
  /*
    **Eine Nichtauskunft löscht keinen Befund.**

    Am 07.09.2026 zweimal hintereinander gemessen: Zwei als 404 belegte
    Aniverse-Adressen standen im Bestand, ein Lauf zwanzig Minuten später lief
    gegen Amazons Abwehr, und danach stand dort wieder `unklar` — die beiden
    toten Verweise waren zurück auf der Seite. `unklar` heißt „uns wurde nichts
    gezeigt"; das ersetzt keine Messung.
  */
  /*
    **Eine tote Crunchyroll-Serie kommt auch ohne Kennung nicht zurück.**

    Der Riegel in der aniSearch-Ergänzungsrunde fragte nur nach
    `/series/<Kennung>`. Adressen im alten Format tragen keine, und
    `crunchyroll.com/inuyashiki-last-hero` kam am 07.09.2026 genau so durch:
    als tot entfernt, im selben Lauf neu ergänzt, Zusicherung rot
    (Lauf 34160329089, Issue #54).
  */
  pruefe(
    'die Befunde aus fetch-crunchyroll-offene.ts werden im Bau auch gelesen',
    bau.includes("'data/crunchyroll-offene.json'") && bau.includes("if (b.herkunft === 'tot')"),
    'eine Datei zu schreiben ist nicht dasselbe wie sie zu benutzen — fünf solcher Fälle in zwei Tagen (CLAUDE.md, 07.09.2026)',
  )
  pruefe(
    'ein abgelaufener Verweis wird dort nicht zum Sprachurteil',
    bau.includes('toteOffene++') && !/herkunft === 'tot'[\s\S]{0,120}stream\.dub = /.test(bau),
    'ein fehlendes Angebot ist kein „ohne deutschen Ton" — die Unterscheidung von DubCheck.available',
  )
  pruefe(
    'eine tote Crunchyroll-Adresse wird auch ohne Kennung nicht neu ergänzt',
    bau.includes('toteCrAdressen.has(adressKern(url))'),
    'Adressen im alten Format tragen keine Serienkennung — der Kennungs-Riegel greift bei ihnen nicht',
  )
  pruefe(
    'ein „unklar" überschreibt keinen echten Befund',
    linkPruefer.includes("neu.status === 'unklar' && altStatus !== undefined && altStatus !== 'unklar'"),
    'sonst macht eine Abwehrseite aus einem gemessenen 404 wieder eine offene Frage',
  )
  pruefe(
    'der Lauf bricht ab, wenn Amazon in Serie Zwischenseiten schickt',
    linkPruefer.includes('SPERR_SCHWELLE') && linkPruefer.includes('inFolgeUnklar'),
    'gegen eine laufende Sperre zu klopfen bringt keinen Befund und verlängert sie',
  )
  pruefe(
    'ein Bezugsweg auf dieselbe Adresse wie ein Verweis fliegt raus',
    bau.includes('die auf dieselbe Adresse zeigen wie ein Verweis desselben Titels'),
    'zwei Zeilen auf eine Adresse sind keine zwei Auskünfte — der Verweis gewinnt',
  )
  pruefe(
    /*
      **Umgekehrt seit dem 10.09.2026.** Bis dahin hielt diese Zusicherung fest,
      dass aus einer nackten Domain eine Suche wird — der Gedanke war, dem
      Besucher wenigstens etwas zu geben. Crunchyroll antwortet auf diese Suche
      mit „Es konnte nichts gefunden werden" (Daniel, mit Bild), und seine
      Ansage lautet: „alle links die auf such query gehen, statt direkt auf
      treffer, müssen entfernt werden von der webseite."

      Was bleibt, ist der Satz darunter — ein Verweis auf eine Startseite sieht
      aus wie eine Auskunft und ist keine. Nur ist die Antwort darauf jetzt die
      echte Adresse aus dem Katalog, und wo die fehlt, gar keine.
    */
    'eine nackte Domain wird zur Serienadresse oder zu gar nichts',
    bau.includes('über den deutschen Katalog auf ihre Serienadresse gesetzt') &&
      bau.includes('eine nackte Domain ist kein Weg zu einem Titel'),
    'ein Verweis auf eine Startseite sieht aus wie eine Auskunft und ist keine',
  )
  pruefe(
    'die Crunchyroll-Kennung wird notfalls im Gedächtnis nachgeschlagen',
    bau.includes("readJson<{ adressen?: Record<string, { seriesId?: string }> }>(\n        'data/crunchyroll-series-ids.json'"),
    '43 der 44 offenen Verweise standen in der alten Slug-Form ohne Kennung in der Adresse',
  )

  const roh = readFileSync('pipeline/fetch-rohfolgen.ts', 'utf8')
  pruefe(
    'eine Meldung ab Staffel 2 landet nicht am Reihenkopf',
    roh.includes('gemeldeteStaffel > 1 && istReihenkopf(titel, titles)'),
    'Amazon nennt jede Staffel gleich; der beste Namenstreffer ist der Reihenkopf',
  )
}

/**
 * **Die Überschrift einer aniSearch-Seite ist kein deutscher Titel.**
 *
 * Anlass: Der Katalog führte „Tensei Kizoku, Kantei Skill de Nariagaru Dai 3
 * Ki" als `titleDe`, während aniSearch unter „Synonyme" „…: Staffel 3" nennt
 * (Daniel, 08.09.2026). Die `<h1 id="htitle">` trägt keine Sprachkennzeichnung.
 *
 * Geprüft wird an einer **Kulisse**, nicht am Bestand: Was hier steht, gilt
 * unabhängig davon, welche Seiten ein Lauf gerade geholt hat.
 */
{
  const seite = (blocke: string, synonyme: string, h1 = 'Tensei Kizoku, Kantei Skill de Nariagaru Dai 3 Ki') =>
    `<h1 id="htitle">${h1}</h1><section id="information"><ul class="cols"><li><ul class="xlist">` +
    blocke +
    (synonyme
      ? `<li><div class="synonyms"><span class="header">Synonyme:</span> ${synonyme}</div></li>`
      : '') +
    '</ul><div class="showall"><button type="button">Alle anzeigen</button></div></li></ul></section>'

  const block = (land: string, sprache: string, titel: string) =>
    `<li><div class="title" lang="${land}"><img src="x" class="flag" alt="${sprache}" title="${sprache}">` +
    `<strong class="f16">${titel}</strong></div>` +
    `<div class="status"><span class="header">Status:</span> Abgeschlossen</div></li>`

  const jaBlock = block('ja', 'Japanisch', 'Tensei Kizoku, Kantei Skill de Nariagaru Dai 3 Ki')
  const deBlock = block('de', 'Deutsch', 'Die rothaarige Schneeprinzessin: Staffel 2')

  const nurJa = titelAus(seite(jaBlock, 'Appraisal Skill 3rd Season, Appraisal Skill: Staffel 3'))
  pruefe(
    'ein deutsches Synonym schlägt die japanische Überschrift',
    nurJa?.titel === 'Appraisal Skill: Staffel 3' && nurJa.quelle === 'synonym',
    `„Staffel" steht in keinem japanischen Synonym — gelesen wurde stattdessen „${nurJa?.titel}"`,
  )

  const mitDe = titelAus(seite(jaBlock + deBlock, 'Snow White with the Red Hair (Staffel 2)'))
  pruefe(
    'der deutsche Sprachblock schlägt das Synonym',
    mitDe?.titel === 'Die rothaarige Schneeprinzessin: Staffel 2' && mitDe.quelle === 'sprachblock',
    'über alle 3.179 Archivseiten weicht der Block in 97 von 98 Fällen ab — zu seinen Gunsten',
  )

  const ohne = titelAus(seite(jaBlock, 'Kanteiskill, Appraisal Skill 3rd Season'))
  pruefe(
    'ohne deutschen Beleg wird die Überschrift als solche vermerkt',
    ohne?.quelle === 'ueberschrift',
    'sonst behauptet der Katalog einen deutschen Namen, den niemand belegt hat',
  )

  pruefe(
    'der Knopf „Alle anzeigen" hängt nicht am letzten Synonym',
    !/Alle anzeigen/.test(
      titelAus(seite(jaBlock, 'Erstes Synonym, Zweites: Staffel 3'))?.titel ?? 'Alle anzeigen',
    ),
    'Synonyme sind das letzte Feld der Infobox; der Wert lief bis zum Abschnittsende',
  )

  const bau = readFileSync('pipeline/build.ts', 'utf8')
  pruefe(
    'aus einer Überschrift macht der Bau kein titleDe',
    bau.includes("eintrag?.quelle === 'ueberschrift' ? undefined : eintrag?.titel"),
    'die Überschrift trägt keine Sprachkennzeichnung — titleRomaji sagt ohnehin dasselbe',
  )

  const holer = readFileSync('pipeline/fetch-anisearch-titel.ts', 'utf8')
  pruefe(
    'die Warteschlange bildet sich über das Alter, nicht über „fehlt noch"',
    holer.includes('const faellig =') && holer.includes("e.quelle === 'ueberschrift'"),
    'ein Filter „hole, was fehlt" macht jede Antwort endgültig — auch die falsche',
  )
}

/**
 * **Drei ADN-Serienkennungen, die ein Datenlauf schon einmal weggeräumt hat.**
 *
 * Am 09.09.2026 sind sie über `/show?limit=100&offset=…` belegt und in
 * `data/adn-adressen.yaml` eingetragen worden. Eine Stunde später standen sie
 * nicht mehr da: `tools/commit-data.sh` rettet die Quellen aus dem
 * Arbeitsverzeichnis des Laufs, setzt hart auf `origin/main` zurück und spielt
 * sie wieder ein — ein Lauf, der vor der Korrektur startete, schreibt damit
 * seinen alten Stand zurück (CLAUDE.md, 29.08.2026, damals 19 Handbelege).
 *
 * Genau dafür steht hier eine Zusicherung und nicht nur ein Kommentar: Die
 * Korrektur allein hält keinen Lauf aus, die Zusicherung meldet sich, wenn sie
 * verlorengeht.
 */
{
  const adressen = readFileSync('data/adn-adressen.yaml', 'utf8')
  for (const [anilist, show, name] of [
    ['462', '906', 'One Piece Film 4 (vde)'],
    ['4155', '948', 'One Piece Film 10 — Strong World (vde)'],
    ['173388', '1171', 'Plus-Sized Elf (nur vostde)'],
    ['21158', '1181', 'High Speed! Free! Starting Days (vde) — über JustWatch gefunden'],
  ]) {
    pruefe(
      `ADN-Kennung ${anilist} → ${show} steht in adn-adressen.yaml (${name})`,
      new RegExp(`^${anilist}: ${show}\\b`, 'm').test(adressen),
      'gemessen am 09.09.2026; ein Datenlauf hat sie schon einmal überschrieben',
    )
  }
}

/**
 * **Ein toter Crunchyroll-Verweis wird entfernt, nicht gezählt.**
 *
 * `fetch-crunchyroll-offene.ts` belegt eine Adresse als tot — abgelaufene
 * Videokennung, oder im deutschen Katalog nicht geführt und von JustWatch
 * gegengeprüft. Der Bau zählte diese Befunde nur und schrieb daneben, der
 * Verweis fliege „weiter unten über dieselbe Regel wie jede andere tote
 * Adresse". Die Regel gibt es, nur läuft sie über `crDub.serien` und kennt
 * diese Adressen nicht.
 *
 * Gemessen am 10.09.2026: 28 Crunchyroll-Verweise ohne Sprachurteil, 17 beim
 * Lauf offen — und **11 als tot beurteilt**, ohne jede Wirkung.
 */
{
  const bau = readFileSync('pipeline/build.ts', 'utf8')
  const anfang = bau.indexOf("'data/crunchyroll-offene.json'")
  const block = bau.slice(anfang, bau.indexOf('Neunte Runde', anfang))
  pruefe(
    'ein toter Crunchyroll-Befund entfernt den Verweis',
    block.includes("b.herkunft === 'tot'") &&
      block.includes('title.streams.filter((s) => s !== stream)') &&
      block.includes('verweiseEntfernt.push'),
    'sonst wird der Befund gezählt und nichts passiert — elf Verweise am 10.09.2026',
  )
}

/**
 * **Wer über einen Index zugreift, braucht die Staffelliste.**
 *
 * `staffelnDerAdresse()` führt seit dem 10.09.2026 OVAs und Specials mit —
 * richtig für `ordneNachStaffelliste()`, das über Folgenzahlen rechnet und sie
 * braucht, weil der Anbieter sie als Folgen seiner Staffeln mitzählt.
 *
 * Ein zweiter Block liest dieselbe Liste als **Staffelfolge**
 * (`reihe.slice(staffelNr - 1)`), und dort verschiebt jede Nebenausgabe den
 * Index um eins. Am selben Tag hat das vier falsche Belege erzeugt: Die
 * Prime-Seite `B0D2NL5GYX` (Haikyu!! Staffel 4, 27 Folgen) wurde an fünf Titel
 * verteilt, deren Summe **ebenfalls** 27 ergibt (1+10+1+13+2). Die
 * Folgenzahl-Kontrolle merkte nichts — sie prüft, dass es aufgeht, nicht
 * welche Titel es sind.
 *
 * Diese Zusicherung hält die Kopplung fest, damit sie beim nächsten Umbau
 * auffällt statt lautlos zu kippen.
 */
{
  const quelle = readFileSync('pipeline/fetch-pruefungen.ts', 'utf8')
  const anfang = quelle.indexOf('const reihe = staffelnDerAdresse(')
  const block = anfang >= 0 ? quelle.slice(anfang, anfang + 400) : ''
  pruefe(
    'die Staffel-über-Franchise-Zuordnung bekommt die gefilterte Liste',
    anfang >= 0 && /staffelnDerAdresse\([\s\S]*?,\s*true,?\s*\)/.test(block),
    'ohne den Schalter zeigt reihe.slice(staffelNr - 1) auf eine Nebenausgabe — vier falsche Belege am 10.09.2026',
  )
  pruefe(
    'und sie greift weiterhin über die Staffelnummer zu',
    block.includes('reihe.slice(staffelNr - 1)'),
    'ändert sich der Zugriff, gilt die Zusicherung darüber einer Sache, die es nicht mehr gibt',
  )
  pruefe(
    'staffelnDerAdresse() kennt beide Fassungen',
    quelle.includes('function staffelnDerAdresse(ids: number[], nurStaffeln = false)'),
    'wer rechnet, braucht alle Einträge; wer zählt, nur die Staffeln',
  )
}

/**
 * **Eine Suchadresse ist kein Weg — und der Katalog kennt die echte.**
 *
 * Am 10.09.2026 stand für „Kaiju No. 8 Narumi's Week at Work" ein Verweis auf
 * `crunchyroll.com/de/search?q=…` im Datensatz. Crunchyroll antwortet darauf
 * mit „Es konnte nichts gefunden werden" (Daniel, mit Bild); die richtige
 * Adresse steht seit dem 22.08.2026 im deutschen Katalog.
 *
 * Geprüft wird an genau diesen beiden Fällen — und an den Gegenproben, die die
 * Regel eng halten müssen: „Kaiju" darf nicht „Kaiju Girls" treffen, und wo
 * zwei Serien denselben Namen tragen, gibt es keine Adresse.
 */
{
  const index = crNamensindexAusDatei()
  pruefe(
    'der Katalog ist geladen',
    index.size > 500,
    `nur ${index.size} Namen im Index — ohne Katalog prüft der Rest nichts`,
  )
  pruefe(
    'Daniels Fall löst sich auf die Serienadresse auf',
    crAdresseZu(index, "Kaiju No. 8 Narumi's Week at Work") ===
      'https://www.crunchyroll.com/de/series/GG5H5XQ7D/kaiju-no-8',
    `bekommen: ${crAdresseZu(index, "Kaiju No. 8 Narumi's Week at Work")}`,
  )
  pruefe(
    'und die zweite Suchadresse ebenso',
    crAdresseZu(index, 'Black Clover: Staffel 2') === 'https://www.crunchyroll.com/de/series/GRE50KV36/black-clover',
    `bekommen: ${crAdresseZu(index, 'Black Clover: Staffel 2')}`,
  )
  /* Die Wortgrenze ist der ganze Riegel: ohne sie träfe „Kaiju" auch „Kaiju Girls". */
  pruefe(
    'ein Namensanfang ohne Wortgrenze trifft nicht',
    crAdresseZu(crNamensindex([{ id: 'G1', titel: 'Kaiju', slug: 'kaiju' }]), 'Kaijuu Girls') === undefined,
    'sonst erbt eine fremde Serie die Adresse einer anderen',
  )
  pruefe(
    'zwei Serien gleichen Namens ergeben keine Adresse',
    crAdresseZu(
      crNamensindex([
        { id: 'G1', titel: 'Doppelt', slug: 'a' },
        { id: 'G2', titel: 'Doppelt', slug: 'b' },
      ]),
      'Doppelt',
    ) === undefined,
    'ein mehrdeutiger Name entscheidet nichts',
  )
  /* Und der Bau muss die Funktion wirklich rufen — an beiden Stellen. */
  const bau = readFileSync('pipeline/build.ts', 'utf8')
  pruefe(
    'der Bau repariert Suchadressen, statt sie zu erzeugen',
    !bau.includes('crunchyroll.com/de/search?q=') && (bau.match(/crAdresseZu\(/g) ?? []).length >= 2,
    'die Erzeugung ist zurück oder die Reparatur fehlt an einer der beiden Stellen',
  )
}

/*
  **Das Gedächtnis entfernter Verweise unterscheidet Adresse und Titel.**
  Am 11.09.2026 flatterte Sword Art Online von Bau zu Bau: „kein Platz" für War
  of Underworld sperrte die Adresse, und damit auch SAO II, dem sie gehört.
  Gegenprobe gefahren: mit dem alten Schlüssel legt der zweite Lauf SAO II nicht
  mehr an, mit dem neuen schon.
*/
{
  const bau = readFileSync('pipeline/build.ts', 'utf8')
  pruefe(
    'ein Titel-Grund („kein Platz") sperrt nur diesen Titel, nicht die ganze Adresse',
    /NUR_DIESER_TITEL = \/\^der Anbieter führt /.test(bau) &&
      (bau.match(/frueherEntfernt\.has\(adressKern\(url\), title\.id\)/g) ?? []).length >= 2,
    'das Gedächtnis fragt wieder nur nach der Adresse',
  )
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
