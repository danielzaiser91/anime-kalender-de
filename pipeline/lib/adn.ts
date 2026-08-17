/**
 * ADN-Datenformat und die Regeln, nach denen aus einer ADN-Serie Releases
 * werden.
 *
 * Warum das hier steht und nicht in `fetch-adn.ts`: Jene Datei ruft beim Laden
 * ihr `main()` auf. `build.ts` braucht die Einstufungsregeln, darf die Datei
 * aber nur als **Typ** importieren — sonst startet jeder Build einen Abruf.
 */
import type { Title } from '../../shared/types.ts'
import { diffDays } from '../../shared/time.ts'

export interface AdnEpisode {
  /** ISO-Datum in Europe/Berlin. */
  date: string
  /** "HH:MM" in Europe/Berlin. */
  time: string
  episode?: number
  url: string
  /**
   * Staffel laut ADN — der Grund, warum es dieses Feld gibt.
   *
   * Eine ADN-Serienkennung ist ein **Franchise**, keine Staffel: Unter 442
   * liegen alle drei Staffeln von „Sword Art Online", unter 427 alle fünf von
   * „Sailor Moon", unter 461 acht Blöcke von „Haikyu!!". Ohne dieses Feld
   * verschmelzen sie zu einer Reihe, deren Folgennummern mehrfach bei 1 neu
   * anfangen — und dann behauptet der Kalender 96 Folgen am Stück statt
   * 25 + 24 + 47.
   *
   * Es stand die ganze Zeit in der Antwort und wurde bis zum 12.08.2026
   * weggeworfen. Genau davor warnt die Projektregel „Beim Scrapen nichts
   * wegwerfen".
   */
  season?: string
  /**
   * ADN-Kennung der Staffel ohne Folgennummer: "swordartonline_tv3".
   *
   * Aussagekräftiger als die bloße Zahl, weil sie die Staffel benennt —
   * „sailormoonstars_tv" statt „5".
   */
  seasonReference?: string
  /** Laufende Nummer über die gesamte Serie hinweg (Folge 47 der S3 = order 96). */
  order?: number
  /** "EPS" (Folge), "OAV", "FLM" … — OAVs tragen keine brauchbare Nummer. */
  type?: string
  /** Laufzeit in Sekunden. Trennt eine 24-Minuten-Folge von einem Film. */
  duration?: number
  /** Folgentitel, wie ADN ihn führt. */
  title?: string
  image?: string
}

export interface AdnShow {
  showId: number
  title: string
  originalTitle?: string
  /** Altersfreigabe, wie ADN sie schreibt ("12+"). */
  age?: string
  url: string
  episodes: AdnEpisode[]
  /**
   * true, wenn die Serie **nicht** in einem Wochentakt erschienen ist — siehe
   * `bestimmeRhythmus()`.
   *
   * Über die ganze Serie gerechnet ist das nur eine grobe Auskunft: Eine Serie
   * mit fünf Staffeln hat fünf Rhythmen. Verbindlich ist die Einstufung je
   * Staffelblock, die `staffelBloecke()` vornimmt.
   */
  batch: boolean
  /**
   * true, wenn der Eintrag aus dem Katalogdurchlauf stammt statt aus dem
   * Kalender.
   *
   * Der Unterschied zählt beim Bauen: Der Katalog-Endpunkt führt den
   * **französischen** Bestand — der Ton ist deutsch (sonst stünde der Titel
   * hier gar nicht), aber der Name ist es oft nicht: „One Piece Film 3 • Le
   * Royaume de Chopper" heißt auf Deutsch „One Piece – Chopper auf der Insel
   * der seltsamen Tiere". Deshalb wird für Katalogtitel der Name aus dem
   * zugeordneten Anime-Eintrag genommen, nicht der von ADN.
   */
  fromCatalog?: boolean
  /** AniList-Kennung, im Katalog-Lauf über den Originaltitel nachgeschlagen. */
  anilistId?: number
}

export interface AdnData {
  scrapedAt: string
  window: { from: string; to: string }
  shows: AdnShow[]
}

/**
 * Wie ein Block veröffentlicht wurde: Folge für Folge oder auf einen Schlag.
 *
 * Hier stand bis zum 12.08.2026 nur `batch: dates.size === 1` — „ein einziger
 * Termin heißt Komplettabwurf, alles andere ist wöchentlich". Der Umkehrschluss
 * ist falsch, und er hat den schwersten Fehler der Seite verursacht: ADN nahm
 * „Sword Art Online" in **zwei** Wellen ins Angebot (11.06. und 17.07.2025,
 * 49 und 47 Folgen). Zwei Termine sind nicht eins, also galt der Eintrag als
 * Wochenserie — und der Kalender rechnete daraus 96 Wochentermine bis
 * 07.04.2027. Sailor Moon dasselbe mit 100 Terminen bis 16.11.2027.
 *
 * Die richtige Frage ist nicht „wie viele Termine?", sondern „welcher Abstand,
 * und wie viele Folgen je Termin?". Wöchentlich heißt: rund sieben Tage
 * dazwischen **und** ungefähr eine Folge pro Termin.
 */
export function bestimmeRhythmus(episodes: AdnEpisode[]): 'weekly' | 'batch' | 'single' {
  if (episodes.length <= 1) return 'single'
  const termine = [...new Set(episodes.map((e) => e.date))].sort()
  if (termine.length === 1) return 'batch'

  // Mehr als anderthalb Folgen je Termin: Das ist ein Abwurf, kein Sendeplan.
  // Ein Doppelstart („Folge 1 und 2 zum Auftakt") bleibt damit erlaubt.
  if (episodes.length > termine.length * 1.5) return 'batch'

  const abstaende: number[] = []
  for (let i = 1; i < termine.length; i++) abstaende.push(diffDays(termine[i - 1], termine[i]))
  abstaende.sort((a, b) => a - b)
  const median = abstaende[Math.floor(abstaende.length / 2)]
  // Fünf bis zehn Tage deckt den Wochentakt samt Verschiebungen ab
  // („Skeleton Knight" startete samstags und lief montags weiter). Alles
  // darüber ist eine neue Staffel oder eine neue Welle, kein Sendeplan.
  return median >= 5 && median <= 10 ? 'weekly' : 'batch'
}

/** Ein zusammenhängender Veröffentlichungsblock einer ADN-Serie. */
export interface AdnBlock {
  showId: number
  /** ADN-Staffelnummer, falls die Quelle sie nennt. */
  season?: string
  /** ADN-Staffelkennung ohne Folgennummer, z. B. "swordartonline_tv3". */
  seasonReference?: string
  episodes: AdnEpisode[]
  rhythm: 'weekly' | 'batch' | 'single'
  firstDate: string
  lastDate: string
  /** Eindeutige Folgennummern im Block, aufsteigend. */
  nummern: number[]
}

/**
 * Zerlegt eine ADN-Serie in Blöcke, die man ehrlich als je einen Termin
 * darstellen kann.
 *
 * Zwei Schnitte, in dieser Reihenfolge:
 *
 *  1. **nach Staffel.** Eine Serienkennung ist ein Franchise (siehe
 *     `AdnEpisode.season`). Ohne diesen Schnitt trägt der Kalender „Sword Art
 *     Online, Folge 62" ein — eine Nummer, die es in keiner Staffel gibt.
 *  2. **nach Termin, sofern kein Wochentakt.** Kommt eine Staffel in zwei
 *     Wellen ins Angebot, sind das zwei Ereignisse. Bei einem echten Simuldub
 *     bleibt die Staffel dagegen ein Block — dort ist die Terminfolge ja
 *     gerade der Inhalt.
 *
 * Fehlt die Staffelangabe (Bestände, die vor dem 12.08.2026 geholt wurden),
 * bleibt es bei einem Block je Serie. Das ist dann nicht besser als vorher,
 * aber auch nicht schlechter.
 */
export function staffelBloecke(show: AdnShow): AdnBlock[] {
  const nachStaffel = new Map<string, AdnEpisode[]>()
  for (const e of show.episodes) {
    const key = e.seasonReference ?? (e.season ? `s${e.season}` : '_')
    const liste = nachStaffel.get(key) ?? []
    liste.push(e)
    nachStaffel.set(key, liste)
  }

  const bloecke: AdnBlock[] = []
  for (const [, folgen] of nachStaffel) {
    const rhythm = bestimmeRhythmus(folgen)
    const gruppen =
      rhythm === 'weekly'
        ? [folgen]
        : [...new Map<string, AdnEpisode[]>(
            folgen.map((e) => [e.date, folgen.filter((f) => f.date === e.date)]),
          ).values()]
    for (const gruppe of gruppen) {
      const daten = gruppe.map((e) => e.date).sort()
      bloecke.push({
        showId: show.showId,
        season: gruppe[0].season,
        seasonReference: gruppe[0].seasonReference,
        episodes: gruppe,
        rhythm: rhythm === 'weekly' ? 'weekly' : gruppe.length > 1 ? 'batch' : 'single',
        firstDate: daten[0],
        lastDate: daten[daten.length - 1],
        nummern: [...new Set(gruppe.map((e) => e.episode).filter((n): n is number => !!n))].sort(
          (a, b) => a - b,
        ),
      })
    }
  }
  bloecke.sort(
    (a, b) => (a.season ?? '').localeCompare(b.season ?? '') || a.firstDate.localeCompare(b.firstDate),
  )
  return bloecke
}

/**
 * Fasst eine ganze ADN-Serie wieder zu einem einzigen Block zusammen.
 *
 * `staffelBloecke` schneidet nach Staffel und Lieferwelle — richtig, solange die
 * Schnitte etwas bedeuten. Bei One Piece bedeuten sie nichts: ADN teilt die 515
 * deutschen Folgen in zwölf Blöcke mit Namen wie „Saga 2 : Alabasta", und AniList
 * führt für die ganze Serie **einen** Eintrag. Kein Block lässt sich also einer
 * eigenen Staffel zuordnen, alle zwölf zeigen auf denselben Titel, und die Sperre
 * gegen doppelte Titel warf elf davon weg — 505 belegte Folgen für nichts
 * (17.08.2026).
 *
 * Findet die Staffelsuche für **keinen** Block einen eigenen Teil, waren die
 * Schnitte Lieferwellen und keine Staffeln. Dann ist ein Release über alles die
 * ehrlichere Auskunft als eines über den ersten Zehntel.
 */
export function alsEinBlock(show: AdnShow): AdnBlock {
  const daten = show.episodes.map((e) => e.date).sort()
  return {
    showId: show.showId,
    episodes: show.episodes,
    rhythm: bestimmeRhythmus(show.episodes),
    firstDate: daten[0],
    lastDate: daten[daten.length - 1],
    nummern: [...new Set(show.episodes.map((e) => e.episode).filter((n): n is number => !!n))].sort(
      (a, b) => a - b,
    ),
  }
}

const JAHRESZEIT: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }

/**
 * Die Staffeln eines Franchise in Ausstrahlungsreihenfolge — nur das, was eine
 * Staffel sein kann.
 *
 * Filme und Specials fliegen raus: Sie stehen chronologisch zwischen den
 * Staffeln und würden jede Folgenzahl-Rechnung sprengen. „Sword Art Online
 * EXTRA EDITION" ist eine einzelne Sonderfolge von 2013 — nähme man sie mit,
 * ergäbe die zweite ADN-Staffel (24 Folgen) rechnerisch 25.
 */
export function staffelnDesFranchise(alle: Iterable<Title>, franchiseId: number): Title[] {
  return [...alle]
    .filter((t) => t.franchiseId === franchiseId)
    .filter((t) => t.format === 'TV' || t.format === 'TV_SHORT' || t.format === 'ONA')
    .filter((t) => (t.episodes ?? 0) > 0)
    .sort(
      (a, b) =>
        (a.jpYear ?? 0) - (b.jpYear ?? 0) ||
        (JAHRESZEIT[a.jpSeason ?? ''] ?? 9) - (JAHRESZEIT[b.jpSeason ?? ''] ?? 9) ||
        a.id - b.id,
    )
}

/** Welche AniList-Staffeln ein ADN-Block abdeckt. */
export interface Blockzuordnung {
  block: AdnBlock
  /**
   * Die abgedeckten Staffeln in Reihenfolge, mit dem Nummernbereich, unter dem
   * ADN sie führt. Leer, wenn die Rechnung nicht aufgeht.
   */
  teile: { title: Title; adnVon: number; adnBis: number }[]
  /**
   * true, wenn die Zuordnung über eine **ungefähre** Folgenzahl lief.
   *
   * Kommt vor, weil beide Seiten anders zählen: ADN führt 42 Folgen von
   * „Sailor Moon R" mit deutschem Ton, AniList nennt 43 — eine Folge hat bei
   * ADN keine deutsche Fassung. Ohne diese Toleranz bliebe die Staffel
   * unzugeordnet und fiele auf den Serientitel zurück, womit „Sailor Moon"
   * zweimal im Datensatz stünde.
   */
  unscharf?: boolean
}

/**
 * Ordnet die Blöcke einer ADN-Serie den AniList-Staffeln zu.
 *
 * Der Ansatz ist bewusst arithmetisch statt namensbasiert: ADN benennt seine
 * Staffeln „1", „2", „3", AniList benennt sie „Alicization" und „Alicization -
 * War of Underworld". Über den Namen kommt man da nicht hin — über die
 * Folgenzahl schon, und zwar eindeutig:
 *
 *   ADN-Staffel 3 von SAO hat 47 Folgen.
 *   AniList: Alicization 24 + War of Underworld 12 + WoU Part 2 11 = 47.
 *
 * Deshalb wird für jeden Block der **zusammenhängende Lauf** aus der
 * chronologischen Staffelliste gesucht, dessen Folgenzahlen sich genau auf die
 * Blockgröße summieren. Gesucht wird ab dem Punkt, an dem der vorige Block
 * aufhörte — sonst wäre „24" bei SAO doppeldeutig (Staffel 2 und Alicization
 * haben beide 24 Folgen).
 *
 * Geht die Summe nicht exakt auf, bleibt der Block **ohne** Zuordnung. Das ist
 * Absicht: Eine halb passende Staffel ist schlechter als keine — sie bringt
 * Cover, Beschreibung und Folgenzahl eines fremden Werks mit. Der Aufrufer
 * fällt dann auf die Namenszuordnung der Serie zurück.
 */
export function ordneBloeckeZuStaffeln(bloecke: AdnBlock[], staffeln: Title[]): Blockzuordnung[] {
  const out: Blockzuordnung[] = []
  let zeiger = 0
  for (const block of bloecke) {
    const gesucht = block.nummern.length || block.episodes.length
    let treffer: { title: Title; adnVon: number; adnBis: number }[] = []
    let unscharf = false

    const belegen = (start: number, laenge: number) => {
      let offset = block.nummern[0] ?? 1
      treffer = staffeln.slice(start, start + laenge).map((title) => {
        const von = offset
        offset += title.episodes ?? 0
        return { title, adnVon: von, adnBis: offset - 1 }
      })
      zeiger = start + laenge
    }

    suche: for (let start = zeiger; start < staffeln.length; start++) {
      let summe = 0
      // Mehr als sechs Staffeln in einem Block gibt es nicht; alles darüber
      // wäre eine zufällig passende Summe, kein Befund.
      for (let laenge = 1; laenge <= 6 && start + laenge <= staffeln.length; laenge++) {
        summe += staffeln[start + laenge - 1].episodes ?? 0
        if (summe > gesucht) break
        if (summe === gesucht) {
          belegen(start, laenge)
          break suche
        }
      }
    }

    /**
     * Zweiter Anlauf mit Spielraum — für den Fall, dass beide Seiten schlicht
     * anders zählen.
     *
     * ADN führt 42 Folgen „Sailor Moon R" mit deutschem Ton, AniList nennt 43;
     * bei „Gunslinger Girl -Il Teatrino-" stehen 15 gegen 13, weil ADN die
     * OVA-Folgen mitzählt. Die exakte Summe geht in beiden Fällen nicht auf.
     *
     * Ohne diesen Anlauf fiel der Block auf den **Serientitel** zurück — und
     * damit stand „Sailor Moon" (46 Folgen) zweimal im Datensatz, einmal mit
     * 46 und einmal mit 42 Folgen. Eine um eine Folge danebenliegende
     * Zuordnung ist deutlich weniger falsch als eine doppelte.
     *
     * Nur ein einzelner Titel, nur ab dem Zeiger, und die Abweichung wird
     * mitgeführt, damit der Aufrufer sie benennen kann.
     */
    if (!treffer.length) {
      const spielraum = Math.max(2, Math.round(gesucht * 0.1))
      for (let start = zeiger; start < staffeln.length; start++) {
        if (Math.abs((staffeln[start].episodes ?? 0) - gesucht) <= spielraum) {
          belegen(start, 1)
          unscharf = true
          break
        }
      }
    }

    out.push({ block, teile: treffer, unscharf: unscharf || undefined })
  }
  return out
}

// --- Zuordnung einer ADN-Serie zu einem AniList-Eintrag ---------------------
//
// Diese drei Funktionen gehören zum Abruf, stehen aber hier, damit
// `check-logic.ts` sie prüfen kann, ohne `fetch-adn.ts` zu importieren — jene
// Datei ruft beim Laden ihr `main()` auf, ein Import wäre ein Abruf.

/** Nur die Titelschreibweisen, die für die Zuordnung gebraucht werden. */
export interface TrefferTitel {
  title: { romaji?: string | null; english?: string | null; native?: string | null }
}

/** Was von einer ADN-Serie in die Zuordnung eingeht. */
export interface AdnName {
  title: string
  originalTitle?: string
}

/**
 * Kurze Wörter, die trotzdem zählen.
 *
 * Die Vier-Zeichen-Grenze hält Füllwörter draußen („no", „the", „to") und traf
 * dabei genau die Kürzel, die eine Nebenausgabe von der Hauptserie
 * unterscheiden. „Wolf's Rain OVA" sah damit wie „Wolf's Rain" aus, wurde als
 * vollständige Deckung gewertet, und der Build brach ab: 30 Folgen für einen
 * Eintrag, der vier hat (17.08.2026).
 *
 * Die Liste bleibt absichtlich kurz. Jedes weitere Kürzel muss ein Werktyp sein,
 * kein Füllwort — sonst kippt die Grenze in ihr Gegenteil.
 */
const KURZ_ABER_WICHTIG = new Set(['ova', 'ona', 'oad', 'tv'])

function woerterVon(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 || KURZ_ABER_WICHTIG.has(w)),
  )
}

/**
 * Gegenprobe für einen Suchtreffer — greift die kurzen Varianten ab.
 *
 * Die Kürzung auf den Namenskern rettet Fälle wie „Chinjuu Shima" gegen
 * „Chinjuu-jima", trifft mit zwei Wörtern aber auch beliebiges: „no Bouken"
 * fand „The Enchanted Journey", „to Kaizoku Tachi" fand „Galactic Pirates" —
 * beides keine One-Piece-Filme. Ein falsch zugeordneter Titel ist schlimmer
 * als ein fehlender: Er bringt Cover, Beschreibung und Genres eines fremden
 * Werks mit.
 *
 * Deshalb muss der Treffer ein aussagekräftiges Wort mit dem ADN-Titel teilen.
 * Kurze Füllwörter zählen nicht — sonst genügte „no" oder „the".
 */
export function passtZuSerie(show: AdnName, media: TrefferTitel): boolean {
  const unsere = new Set([...woerterVon(show.title), ...woerterVon(show.originalTitle ?? '')])
  const ihre = woerterVon(
    [media.title.romaji, media.title.english, media.title.native].filter(Boolean).join(' '),
  )
  for (const wort of unsere) if (ihre.has(wort)) return true
  return false
}

/**
 * Wie gut ein Treffer passt — nicht nur, ob er passt.
 *
 * `passtZuSerie` ist ein Türsteher, kein Schiedsrichter: Es lässt jeden Treffer
 * durch, der **ein** aussagekräftiges Wort teilt. Für eine Reihe mit mehreren
 * Staffeln ist das zu wenig. „Motto To Love-Ru" (ADN 684, 12 Folgen) landete am
 * 17.08.2026 auf AniList 13663 „To LOVE-Ru Darkness" statt auf 9181 „Motto To
 * LOVE-Ru" — geteilt war „love", und der erste zulässige Treffer gewann. Beide
 * haben 12 Folgen, die Stückzahl trennt sie also nicht.
 *
 * Gewertet wird je Titelschreibweise einzeln, nicht über alle zusammen: Ein
 * englischer Zweitname bringt sonst lauter fremde Wörter mit, die nichts über
 * die Passung sagen. Geteilte Wörter zählen doppelt, fremde einfach dagegen —
 * „Darkness" ist genau das Wort, das den falschen Treffer verrät.
 *
 * **Und was der Treffer von unserem Namen nicht abdeckt, zählt ebenfalls
 * dagegen.** Ohne diesen Teil war „ONE PIECE" für „One Piece" und für „One Piece
 * • Le Film" gleich gut: In beiden Fällen ein geteiltes Wort, kein fremdes. Bei
 * Gleichstand entschied die Reihenfolge im Katalog, der Film bekam die Serie, und
 * One Piece stand am Ende ohne jede Zuordnung da (17.08.2026). „Film" ist das
 * Wort, das dem Treffer fehlt — also muss es ihn etwas kosten.
 *
 * Der **japanische** Titel bleibt hier außen vor, obwohl `passtZuSerie` ihn
 * benutzt. Er besteht aus Zeichen, die die Wortzerlegung wegwirft, und was übrig
 * bleibt, ist zufällig: „To LOVEる -とらぶる- ダークネス" schrumpft auf „love"
 * zusammen — das verräterische „Darkness" verschwindet, und der falsche Treffer
 * sieht plötzlich sauber aus. Als Türsteher taugt er, als Schiedsrichter nicht.
 */
export function bewerteTreffer(show: AdnName, media: TrefferTitel): number {
  const unsere = new Set([...woerterVon(show.title), ...woerterVon(show.originalTitle ?? '')])
  // Für die Deckung zählt der **Anzeigename**, nicht die Vereinigung beider
  // Schreibweisen: Der Originaltitel bringt oft eine zweite Zerlegung derselben
  // Wörter mit, und die wäre nie vollständig abdeckbar.
  const zuDecken = woerterVon(show.title)
  let beste = Number.NEGATIVE_INFINITY
  for (const name of [media.title.romaji, media.title.english]) {
    if (!name) continue
    const ihre = woerterVon(name)
    if (!ihre.size) continue
    let geteilt = 0
    let fremd = 0
    for (const wort of ihre) {
      if (unsere.has(wort)) geteilt++
      else fremd++
    }
    let fehlend = 0
    for (const wort of zuDecken) if (!ihre.has(wort)) fehlend++
    beste = Math.max(beste, geteilt * 2 - fremd - fehlend)
  }
  return beste === Number.NEGATIVE_INFINITY ? 0 : beste
}

/**
 * Deckt der Treffer den ADN-Namen vollständig und ohne Zutaten?
 *
 * Nur dann wird die Suche abgebrochen. Das hält die Kosten dort, wo sie liegen —
 * ein Abruf je Serie im Normalfall — und lässt die zweifelhaften Fälle
 * weitersuchen, statt den ersten Halbtreffer zu nehmen.
 */
export function volltreffer(show: AdnName, media: TrefferTitel): boolean {
  const unsere = woerterVon(show.title)
  if (!unsere.size) return false
  // Ohne den japanischen Titel, aus demselben Grund wie bei `bewerteTreffer`:
  // Sein lateinischer Rest deckt sich zufällig mit fast jedem Reihennamen.
  for (const name of [media.title.romaji, media.title.english]) {
    if (!name) continue
    const ihre = woerterVon(name)
    if (!ihre.size) continue
    if ([...unsere].every((w) => ihre.has(w)) && [...ihre].every((w) => unsere.has(w))) return true
  }
  return false
}
