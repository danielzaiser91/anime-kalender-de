import type { Zugangsart } from './zugangsart.ts'
/** Gemeinsame Typen für Pipeline, Web-App und Newsletter-Worker. */

export type PlatformId =
  | 'crunchyroll'
  | 'netflix'
  | 'primevideo'
  | 'disneyplus'
  | 'adn'
  | 'aniverse'
  | 'wow'
  | 'joyn'
  | 'rtlplus'
  | 'youtube'
  | 'disc'
  | 'kino'
  | 'unbekannt'

/**
 * Art des Releases — bestimmt die Farbkodierung im Kalender.
 * weekly = Folge für Folge (Simuldub)
 * batch  = Katalogtitel, ganze Staffel auf einen Schlag
 * movie  = Film (Stream- oder Kinostart)
 * disc   = DVD/Blu-ray, kaufbar
 */
export type ReleaseType = 'weekly' | 'batch' | 'movie' | 'disc'

/**
 * Wird nie gespeichert, sondern immer aus den Daten + heutigem Datum berechnet.
 * `unbekannt` gibt es für Titel, bei denen eine deutsche Synchro belegt ist,
 * aber kein deutscher Termin — lieber ehrlich als geraten.
 */
export type ReleaseStatus = 'airing' | 'abgeschlossen' | 'tba' | 'erschienen' | 'unbekannt'

/**
 * Was das Datum eines Releases aussagt.
 *
 * `premiere`       — an diesem Tag erschien die deutsche Fassung.
 * `available-from` — an diesem Tag stand sie dort im Angebot. Ob sie
 *                    anderswo längst zu haben war, sagt das Datum nicht.
 *
 * Der Unterschied ist der Kern des schwersten Fehlers, den die Seite hatte
 * (12.08.2026). ADN nahm „Sword Art Online" am 11.06.2025 ins Angebot — die
 * deutsche Fassung von Staffel 1 gibt es seit 2013, die von „Alicization" seit
 * August 2019 auf Disc. Der Kalender schrieb trotzdem „Start: 11.06.2025" und
 * lag damit um bis zu zwölf Jahre daneben.
 *
 * Fehlt das Feld, gilt `premiere` — so ist es für jeden Simulcast und jede
 * kuratierte Disc richtig. Gesetzt wird es dort, wo wir es **nicht** besser
 * wissen: bei einem Komplettabwurf aus einem Plattformkatalog. „Seit dem X.
 * dort im Angebot" ist immer wahr, „erschienen am X." wäre eine Behauptung.
 */
export type DateMeaning = 'premiere' | 'available-from'

export type Fsk = 0 | 6 | 12 | 16 | 18

export type DubConfidence = 'low' | 'normal' | 'high' | 'very-high'

export interface Schedule {
  /** ISO-Datum der ersten Folge mit deutscher Synchro. */
  firstEpisodeDate: string
  /** "HH:MM" in Europe/Berlin. Fehlt, wenn die Uhrzeit nicht belegt ist. */
  time?: string
  episodeCount?: number
  /**
   * Nummer der ersten Folge dieses Releases. Fehlt, wenn es bei 1 anfängt.
   *
   * Netflix und Crunchyroll teilen Staffeln gern auf: „Steel Ball Run"
   * startete am 19.03.2026 mit einer einzelnen 47-Minuten-Folge, der Rest kam
   * ein halbes Jahr später als „2nd & 3rd STAGE". Beides sind eigene Releases
   * mit eigenem Termin — aber die Folgen laufen durch. Ohne dieses Feld begann
   * die Terminliste des zweiten Teils wieder bei „1.", und wer das las, hielt
   * den 25.09. für den Termin der Auftaktfolge.
   */
  firstEpisodeNumber?: number
  /** Explizites Enddatum; sonst aus firstEpisodeDate + episodeCount berechnet. */
  lastEpisodeDate?: string
  /** ISO-Daten, an denen wegen Sendepause keine Folge läuft. */
  skipDates?: string[]
  /**
   * Tatsächlich beobachtete Termine einzelner Folgen, `{ "1": "2026-07-04" }`.
   *
   * Der Wochenrhythmus ist eine Rechenregel, kein Naturgesetz: „Skeleton
   * Knight" startete an einem Samstag und lief danach montags weiter — neun
   * Tage Abstand. Wer solche Fälle in Siebener-Schritten erzwingt, verschiebt
   * entweder den Start oder alle Folgetermine.
   *
   * Was hier steht, ist im Kalender gesehen worden und schlägt jede Rechnung.
   */
  observed?: Record<number, string>
  /**
   * **Termine, die der Anbieter nicht eingehalten hat — je Folgennummer.**
   *
   * Ein geschätzter Termin verstrich bis zum 31.08.2026 spurlos: Der Kalender
   * behauptete „Mushoku Tensei Staffel 3, Folge 6, 30.08.", nichts erschien,
   * und am nächsten Tag stand es unverändert da. Daniel: „falsche infos auf der
   * webseite sind unbedingt zu vermeiden."
   *
   * `pipeline/termine-pruefen.ts` füllt das Feld, sobald ein Termin mehr als
   * fünfzehn Minuten überfällig ist und im gelesenen Kalenderfenster keine
   * Beobachtung dazu steht. Der Termin verschwindet dann **nicht** — er sagt,
   * dass er nicht eingehalten wurde, wie viele Folgen der Anbieter wirklich
   * zeigt und wann wir das nächste Mal nachsehen.
   */
  verpasst?: Record<
    number,
    {
      /** Wann es hätte sein sollen. */
      erwartetAm: string
      /** Wann die Folge wirklich kam — leer, solange sie aussteht. */
      erschienenAm?: string
      /** Verzug in Stunden, sobald beides bekannt ist. */
      verzugStunden?: number
      /** Wie viele Folgen der Anbieter zu diesem Zeitpunkt zeigte. */
      folgenVerfuegbar?: number
      /** Der neue erwartete Termin aus der Handrecherche. */
      neuErwartet?: string
      /** Was die Recherche ergeben hat. */
      recherche?: string
    }
  >
  /** true, wenn das Datum abgeleitet statt bestätigt ist. */
  estimated?: boolean
  /** true, wenn die Folgenzahl nicht belegt ist und angenommen wurde. */
  episodeCountAssumed?: boolean
  /**
   * Woher eine vorläufige Folgenzahl stammt.
   *
   * Der Unterschied zählt: „zwölf, weil das die übliche Länge ist" ist unsere
   * eigene Annahme, „zwölf laut aniSearch, dort als vorläufig gekennzeichnet"
   * ist eine gepflegte Angabe mit Vorbehalt. Beides trägt das ≈, aber der
   * Hinweis daneben soll nicht dasselbe behaupten.
   */
  episodeCountSource?: 'anisearch'
}

export interface StreamLink {
  platform: PlatformId
  url: string
  /**
   * true  — deutsche Synchro dort belegt
   * false — dort ausdrücklich nur Originalton mit Untertiteln
   * fehlt — nicht geprüft
   */
  dub?: boolean
  /**
   * Wo in dieser Staffel der deutsche Ton liegt — wenn er nicht überall liegt.
   *
   * Bei Black Clover auf Netflix sind die Folgen 1 bis 155 deutsch, 156 bis 171
   * nicht. `dub` allein kann das nicht sagen; es steht dann auf `true` und
   * bedeutet „irgendwo hier gibt es deutschen Ton", die Bereiche sagen, wo.
   *
   * Die Nummern zählen **innerhalb dieser Staffel**, nicht durch: Netflix zählt
   * Jujutsu Kaisen bis 59 durch, unsere dritte Staffel hat die Folgen 1 bis 12.
   * Umgerechnet wird beim Einlesen der Prüfungen, nicht hier.
   */
  dubRanges?: Array<{ from: number; to: number; dub: boolean }>
  /** Was es kostet — siehe `shared/zugangsart.ts`. */
  zugang?: Zugangsart
  /**
   * Wie viele unserer Einträge diese eine Adresse bedient.
   *
   * Fehlt, wenn es nur einer ist. Steht dort eine Zahl, führt die Plattform
   * mehrere unserer Staffeln unter derselben Seite — und teilt sie dort oft
   * anders ein als wir: Crunchyroll zeigt „The Café Terrace and Its Goddesses"
   * als **eine** Staffel mit 24 Folgen, während AniList zwei Staffeln zu je
   * zwölf führt; dasselbe bei „The Case Study of Vanitas" (Daniel, 12.08.2026).
   *
   * Das ist keine Nebensächlichkeit, sondern der Grund für ein Missverständnis:
   * Wer bei uns „Staffel 2" anklickt und dort eine Liste mit 24 Folgen
   * vorfindet, hält entweder unsere Angabe oder die der Plattform für falsch.
   * Beide zählen bloß anders. 344 Adressen bedienen so 655 unserer Einträge.
   */
  sharedWith?: number
  /**
   * **Wo unsere Staffel in der Zählung des Anbieters liegt.**
   *
   * `sharedWith` sagt, *dass* eine Seite mehrere unserer Einträge bedient.
   * Dieses Feld sagt, *welchen Teil davon dieser Eintrag meint* — in den
   * Nummern des Anbieters, nicht in unseren.
   *
   * Prime führt „Captain Tsubasa (2018)" als eine Liste von 91 Folgen. Unser
   * Eintrag „Staffel 2 — Die Junioren" sind davon die letzten 39: dort die
   * Nummern 53 bis 91, bei uns 1 bis 39. Ohne diese Angabe meldet ein Blick
   * auf die Seite 91 Folgen für eine Staffel, die 39 hat, und der deutsche
   * Ton der ersten 52 landet auf dem falschen Eintrag (Daniel, 27.08.2026,
   * mit fünf Bildern; dieselbe Bündelung bei „Junior Youth Arc").
   *
   * Fehlt das Feld, deckt die Seite genau diesen einen Eintrag ab — der
   * Normalfall.
   */
  teilBereich?: { von: number; bis: number }
}

/** Ein Anime (genauer: ein AniList-Eintrag) mit belegter deutscher Synchro. */
/**
 * Ein Weg, den Titel zu sehen oder zu kaufen — jenseits der Plattformen, die
 * dieses Projekt selbst kennt.
 *
 * `PlatformId` ist eine geschlossene Liste der großen Anbieter. Für einen alten
 * Katalogtitel steht der einzige deutsche Weg aber oft bei Maxdome, Videobuster
 * oder schlicht als DVD bei Amazon. Diese Angebote hier zu verschweigen, nur
 * weil sie nicht in die Liste passen, wäre die schlechtere Antwort.
 */
export interface WatchLink {
  /** Anzeigename, wie ihn ein Mensch erwartet: „Amazon", „Videobuster". */
  name: string
  url: string
  /** Ansehen oder erwerben — Streams stehen in der Oberfläche zuerst. */
  kind: 'stream' | 'buy'
  /**
   * Was es kostet: nichts, ein Abo, oder Geld pro Titel.
   *
   * `kind` trennt Ansehen von Erwerben, aber nicht Abo von kostenlos — und für
   * einen Besucher ist genau das der Unterschied (Daniel, 23.08.2026). Wird
   * beim Bauen aus Name und Adresse bestimmt, siehe `shared/zugangsart.ts`.
   */
  zugang?: Zugangsart
}

export interface Title {
  id: number
  malId?: number
  slug: string
  titleDe?: string
  titleRomaji?: string
  titleEn?: string
  titleNative?: string
  format?: string
  episodes?: number
  /**
   * true, wenn zu diesem Titel deutsche Sprechrollen vorliegen.
   *
   * Nur ein Merker, keine Daten: Die Rollen selbst liegen in einer eigenen
   * Datei je Titel und werden erst beim Aufklappen geholt. Ohne diesen Merker
   * müsste die Oberfläche den Bereich bei jedem Titel anbieten und könnte erst
   * nach dem Klick sagen, dass es nichts zu sehen gibt.
   */
  hasVoices?: boolean
  /**
   * Kennung bei aniSearch — nur dafür da, den Titel dort verlinken zu können.
   *
   * Die Quellenübersicht im Detail-Panel nennt aniSearch als Herkunft des
   * deutschen Titels und der Beschreibung, konnte aber nicht dorthin führen:
   * Die 2.615 Kennungen lagen in `data/anisearch.json` und erreichten die
   * Seite nie. Daniels Vorgabe vom 29.08.2026 lautet „beschrieben und verlinkt,
   * wo möglich" — hier ist es möglich.
   */
  anisearchId?: number
  /** Dasselbe für Anime News Network, die Quelle der deutschen Sprechrollen. */
  annId?: number
  /** Jahr der japanischen Erstausstrahlung. */
  jpYear?: number
  jpSeason?: string
  /** Ende der japanischen Ausstrahlung als ISO-Datum, falls bekannt. */
  jpEnd?: string
  /**
   * Kleinste AniList-ID der zusammenhängenden Reihe (Vorgänger/Nachfolger).
   * Dient dazu, Staffeln derselben Serie zu einer Karte zu bündeln.
   */
  franchiseId?: number
  genres: string[]
  keywords: string[]
  coverImage?: string
  bannerImage?: string
  synopsis?: string
  studios?: string[]
  score?: number
  fsk?: Fsk
  dubConfidence: DubConfidence
  /**
   * true bei Titeln **ohne** belegte deutsche Synchro.
   *
   * Sie stehen nicht im Hauptbestand, sondern in `ohne-synchro.json`, und
   * werden erst geladen, wenn jemand den Schalter in der Datenbank umlegt.
   * Ihr Zweck ist das Merken: Wer auf eine Synchro wartet, hört damit auf,
   * von Hand nachzusehen — die Seite meldet sich, sobald es eine gibt
   * (Daniel, 13.08.2026).
   *
   * Zu ihnen ist fast nichts bekannt und soll auch nichts bekannt sein: keine
   * Termine, keine Verweise, keine Sprecher. Alles Weitere entsteht in dem
   * Moment, in dem eine deutsche Fassung auftaucht — dann ist es ein ganz
   * normaler Titel und dieses Feld verschwindet.
   */
  ohneSynchro?: boolean
  streams: StreamLink[]
  /** Weitere Wege zum Ansehen oder Kaufen, die keine eigene Plattform sind. */
  watchLinks?: WatchLink[]
  /**
   * Seit wann der Anbieter den Titel fuehrt — fuer Titel ohne jeden Termin.
   *
   * Nicht das Erscheinungsdatum der deutschen Fassung, sondern die Angabe des
   * Anbieters, seit wann er ihn listet (`availableSince` der Streaming
   * Availability API). Die Oberflaeche schreibt „Im Angebot seit".
   *
   * Steht an jedem Titel, der sonst keine Zeitangabe haette; ein
   * Kalendereintrag entsteht daraus nur fuer 2026 und spaeter.
   */
  angebotSeit?: { platform: PlatformId; date: string }
}

/**
 * Eine Quelle mit Herkunftsangabe — nicht bloß eine Adresse.
 *
 * Nach zwei Vorbildern gebaut (14.08.2026):
 *
 * - **W3C PROV-DM**: Herkunft ist eigene Information, kein Feld am Rand. Wer
 *   hat wann was behauptet.
 * - **Wikipedia:Link rot**: „Do not delete cited information solely because the
 *   URL to the source does not work." Eine überholte Quelle wird **markiert,
 *   nicht entfernt** — dort über `url-status`, hier über `stand`.
 *
 * Der Grund ist nicht Ordnungsliebe: Wer nur die neueste Quelle führt, verliert
 * die Spur, sobald sich zwei widersprechen. Genau das ist bei „Inazuma Eleven"
 * passiert — die ältere Angabe verschwand, und niemand konnte mehr sagen,
 * woher die neue kam.
 */
export interface Quelle {
  url: string
  /** Anzeigename, meist der Hostname: „anime2you.de". */
  name: string
  /** Wann ein Lauf diese Aussage in dieser Quelle zuletzt gesehen hat. */
  gesehenAm: string
  /** Was die Quelle sagt, sofern auslesbar — etwa ein Datum. */
  sagt?: string
  /**
   * `aktuell`              — deckt sich mit dem geführten Stand.
   * `ueberholt`            — eine neuere Quelle widerspricht, und wir sind sicher.
   * `vermutlich-ueberholt` — sie widerspricht, aber wir sind es nicht.
   */
  stand?: 'aktuell' | 'ueberholt' | 'vermutlich-ueberholt'
  /** Warum überholt — steht in der Oberfläche hinter der ausgegrauten Quelle. */
  grund?: string
}

/**
 * Eine Meldung, aus der sich **kein** genauer Termin herauslesen ließ.
 *
 * Der Anlass ist eine Messung, keine Vermutung (14.08.2026): Von 29 aktuellen
 * Anime2You-Meldungen enthielt **keine einzige** ein Datum auf den Tag genau,
 * 27 nannten nur einen Monat. Für die halbe Anbieterlandschaft — Netflix,
 * Disney+, Prime Video, WOW, Joyn, RTL+, Kino, Disc — ist Anime2You aber die
 * einzige Quelle.
 *
 * Solche Funde verschwinden bisher in `data/proposals/` und warten auf einen
 * Menschen. Stattdessen werden sie jetzt gezeigt: „Diese Quelle sagt etwas über
 * einen Termin, wir konnten ihn nicht sicher auslesen — hier steht es." Das ist
 * ehrlicher als Schweigen und nützlicher als ein leerer Kalender.
 */
export interface Meldung {
  titleId: number
  quelle: Quelle
  /** Überschrift der Meldung. */
  titel: string
  /** Der Textausschnitt mit der Terminangabe — zum Selbstnachlesen. */
  zitat?: string
  /** „2026-09", wenn nur ein Monat genannt wurde. */
  monat?: string
  /** Erscheinungstag der Meldung. */
  datum: string
}

/** Eine konkrete deutsche Veröffentlichung — das, was im Kalender steht. */
export interface Release {
  slug: string
  titleId: number
  /** Anzeigename inklusive Staffel- oder Volume-Angabe. */
  name: string
  platform: PlatformId
  platformUrl?: string
  buyUrl?: string
  releaseType: ReleaseType
  /** Bedeutung des Datums; fehlt = `premiere`. Siehe `DateMeaning`. */
  dateMeaning?: DateMeaning
  fsk?: Fsk
  publisher?: string
  edition?: string
  note?: string
  /**
   * Letzter belegter Kinotag — nur bei `platform: 'kino'`.
   *
   * Gefüllt aus `data/cinestar.json`, also aus echten Vorstellungsterminen über
   * 43 Standorte. Ein Kinostart hat kein angekündigtes Ende; wie lange ein Film
   * läuft, steht nirgends geschrieben, es ergibt sich aus dem Programm.
   *
   * **Wofür das Feld da ist:** Solange ein Film läuft, wäre „Kein Anbieter
   * bekannt" eine Irreführung — der Anbieter ist das Kino. Danach wird derselbe
   * Satz zur richtigen Auskunft. Ohne dieses Datum ließe sich das eine nicht
   * vom anderen unterscheiden (Daniel, 25.08.2026: „erst wenn der film in
   * keinem kino mehr läuft, dann").
   *
   * **Bewusst nicht `schedule.lastEpisodeDate`:** Das Feld steuert die
   * Statusberechnung und das Auffalten der Termine. Ein Kinofilm hat eine
   * Folge; ein Enddatum dort hätte Nebenwirkungen, die mit der Frage nichts zu
   * tun haben.
   *
   * Es sagt **nichts** über Streams: Ein Film kann im Kino laufen und
   * gleichzeitig auf Disc erscheinen (Daniel, 25.08.2026). Beide Auskünfte
   * stehen nebeneinander, keine schließt die andere aus.
   */
  cinemaUntil?: string
  /**
   * Ein **zweiter** Termin, den eine andere Quelle nennt.
   *
   * Wenn zwei Quellen unterschiedliche Tage angeben und keine von beiden sich
   * belegen lässt, wird nicht heimlich eine gewählt: Beide stehen da, mit ihrer
   * Quelle, und der Leser entscheidet selbst (Daniels Regel, 13.08.2026).
   *
   * Warum trotzdem nur **ein** Termin im Kalender steht: Zwei Einträge würden
   * behaupten, es gebe zwei Veröffentlichungen — das wäre eine andere und
   * schlimmere Falschaussage als ein Tag, der um drei Wochen danebenliegt. Der
   * Zweitkandidat erscheint deshalb im Detail-Panel neben dem ersten, samt
   * Hinweis, dass wir uns nicht sicher sind.
   *
   * Der Anlass: „Inazuma Eleven – Staffel 1". Anime2You nennt den 04.09.2026,
   * aniSearch den 25.09.2026 für dieselbe AniMoon-Ausgabe, und der Verlag
   * selbst schreibt nur „September 2026". Fünf Händler geprüft, keiner nennt
   * einen Tag.
   */
  disputedDates?: { date: string; source: string }[]
  schedule: Schedule
  /** Jahr der ersten Folge im deutschen Dub. */
  year: number
  /**
   * Die Quellen, aus denen dieser Termin stammt — **alle**, auch überholte.
   *
   * Bleibt ein Feld aus Adressen, damit nichts bricht, was es liest; die
   * Herkunftsangaben stehen daneben in `quellen`. Beide werden vom Build
   * gefüllt, `sources` bleibt die schlichte Liste für Prüfungen und Feeds.
   */
  sources: string[]
  /** Dieselben Quellen mit Herkunftsangabe. Siehe `Quelle`. */
  quellen?: Quelle[]
  /**
   * Vom Bot übernommen, nicht von Hand geprüft.
   *
   * Das wird in der Oberfläche gezeigt, statt es zu verschweigen: Der Termin
   * ist belegt (die Quelle steht daneben), aber niemand hat gegengelesen, ob
   * die Meldung den richtigen Titel meint. Wer es weiß, kann widersprechen.
   */
  automatisch?: boolean
}

export interface ReleaseEvent {
  id: string
  releaseSlug: string
  titleId: number
  /** ISO-Datum "YYYY-MM-DD" in Europe/Berlin. */
  date: string
  /** "HH:MM" in Europe/Berlin, falls bekannt. */
  time?: string
  episode?: number
  episodeCount?: number
  releaseType: ReleaseType
  platform: PlatformId
  name: string
  estimated?: boolean
  /**
   * Gesetzt, wenn der Anbieter diesen Termin nicht eingehalten hat.
   *
   * Kommt aus `schedule.verpasst` und trägt dieselben Felder — die Karte kann
   * damit sagen, was los ist, statt einen Termin zu behaupten, an dem nichts
   * erschienen ist.
   */
  verpasst?: {
    erwartetAm: string
    erschienenAm?: string
    verzugStunden?: number
    folgenVerfuegbar?: number
    neuErwartet?: string
    recherche?: string
  }
}

/**
 * In wie viele Gruppen die Handlungsbeschreibungen aufgeteilt sind.
 *
 * Die Zahl teilen sich Pipeline und Web-App: Die eine schreibt danach, die
 * andere rechnet aus einer Titel-ID die Datei aus. Wird sie geändert, müssen
 * beide Seiten neu gebaut werden — sonst sucht die App in einer Datei, die es
 * nicht gibt. Deshalb steht sie hier und nicht zweimal.
 */
export const SYNOPSIS_GROUPS = 32

/**
 * Ein Eintrag einer Reihe, wie ihn `franchises.json` führt.
 *
 * Bewusst knapp: Die Datei beantwortet nur „welche Staffeln, Filme und
 * Specials gehören zusammen und in welcher Reihenfolge". Cover, Genres und
 * Beschreibungen stehen bereits in `titles.json` — sie hier zu wiederholen
 * würde die Datei verdoppeln, ohne eine Frage zu beantworten.
 */
export interface FranchiseMember {
  id: number
  name: string
  format?: string
  jpYear?: number
  episodes?: number
  /**
   * Cover **ohne** Adressvorsatz — `ANILIST_COVER_BASIS` kommt beim Laden dazu.
   *
   * Stand hier bis zum 13.08.2026 bewusst nicht drin: „Sie würden die Datei
   * verdoppeln, und für eine Auswahlliste braucht es sie nicht." Aus der
   * Auswahlliste ist ein Karussell aus Vorschaukarten geworden, und eine Karte
   * ohne Bild ist keine. Die Begründung von damals gilt also nicht mehr — der
   * Preis dafür steht in der Zeile, in der `franchises.json` geschrieben wird.
   */
  cover?: string
}

/** franchiseId → alle Einträge der Reihe, in Ausstrahlungsreihenfolge. */
export type Franchises = Record<number, FranchiseMember[]>

export interface DataMeta {
  generatedAt: string
  titleCount: number
  releaseCount: number
  eventCount: number
  genres: string[]
  keywords: string[]
  platforms: PlatformId[]
  /**
   * Bezugsquellen jenseits der bekannten Plattformen — maxdome, Apple TV,
   * Videobuster, die Prime-Video-Kanäle. Nach Häufigkeit sortiert.
   */
  providers: string[]
  years: number[]
  attribution: string[]
}

export const PLATFORMS: Record<PlatformId, { name: string; color: string; home: string }> = {
  crunchyroll: { name: 'Crunchyroll', color: '#f47521', home: 'https://www.crunchyroll.com/de/' },
  netflix: { name: 'Netflix', color: '#e50914', home: 'https://www.netflix.com/de/' },
  primevideo: { name: 'Prime Video', color: '#00a8e1', home: 'https://www.primevideo.com/' },
  disneyplus: { name: 'Disney+', color: '#0063e5', home: 'https://www.disneyplus.com/de-de' },
  adn: { name: 'ADN', color: '#f92e6a', home: 'https://animationdigitalnetwork.com/de' },
  aniverse: { name: 'Aniverse', color: '#7c3aed', home: 'https://www.aniverse.de/' },
  wow: { name: 'WOW', color: '#00b1ff', home: 'https://www.wowtv.de/' },
  joyn: { name: 'Joyn', color: '#fa1b5a', home: 'https://www.joyn.de/' },
  rtlplus: { name: 'RTL+', color: '#e2001a', home: 'https://plus.rtl.de/' },
  youtube: { name: 'YouTube', color: '#ff0000', home: 'https://www.youtube.com/' },
  disc: { name: 'DVD / Blu-ray', color: '#16a34a', home: 'https://www.amazon.de/' },
  kino: { name: 'Kino', color: '#eab308', home: '' },
  unbekannt: { name: 'Unbekannt', color: '#6b7280', home: '' },
}

export const RELEASE_TYPES: Record<
  ReleaseType,
  { name: string; short: string; color: string; hint: string }
> = {
  weekly: {
    name: 'Wöchentlich (Simuldub)',
    short: 'Wöchentlich',
    color: '#3b82f6',
    hint: 'Folge für Folge, fester Wochentag',
  },
  batch: {
    name: 'Katalogtitel',
    short: 'Katalog',
    color: '#a855f7',
    hint: 'Ganze Staffel auf einen Schlag',
  },
  movie: { name: 'Film', short: 'Film', color: '#eab308', hint: 'Filmstart (Stream oder Kino)' },
  disc: { name: 'DVD / Blu-ray', short: 'Disc', color: '#22c55e', hint: 'Kaufbarer Datenträger' },
}

export const STATUS_LABEL: Record<ReleaseStatus, string> = {
  airing: 'Läuft',
  abgeschlossen: 'Abgeschlossen',
  tba: 'TBA',
  erschienen: 'Erschienen',
  unbekannt: 'Termin unbekannt',
}

export const FSK_COLORS: Record<Fsk, string> = {
  0: '#ffffff',
  6: '#ffd400',
  12: '#009d3e',
  16: '#0075bf',
  18: '#e30613',
}
