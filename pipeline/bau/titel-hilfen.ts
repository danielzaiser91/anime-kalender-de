import { type KatalogEintrag, type AniListMedia } from '../lib/anilist.ts'
import { type Fsk, type Title, type StreamLink, type DubConfidence, type PlatformId } from '../../shared/types.ts'
import { type AdnBlock } from '../lib/adn.ts'
import {
  TAG_AS_GENRE_MIN_RANK,
  TAG_AS_GENRE,
  KEYWORD_BLOCKLIST,
  platformFromSite,
  isUnusablePrimeLink,
  primeVideoSearchUrl,
  germanizeUrl,
  PLATFORM_PRIORITY,
  platformSearchUrl,
} from '../../shared/mappings.ts'
import { KEYWORD_MIN_RANK, KEYWORD_MAX } from './grundlagen.ts'
import { entwirreWeiterleitung } from '../../shared/adresse-passt.ts'
import { slugify } from '../lib/util.ts'
import { addDays } from '../../shared/time.ts'
import { type CrunchyrollEntry } from '../lib/crunchyroll.ts'
import { type CuratedEntry } from '../lib/curated.ts'

/**
 * Reihen über den **gesamten** AniList-Katalog, nicht nur über den Bestand.
 *
 * Warum das nicht einfach ein zweites Union-Find ist: Eine Reihe kann die
 * Grenze überschreiten. „Attack on Titan" hat eine deutsche Synchro, ein
 * Special daraus vielleicht nicht — beide gehören trotzdem zusammen. Liefe die
 * Zusammenführung getrennt, bekäme das Special eine andere Reihen-Kennung als
 * die Serie, und in der Datenbank stünden zwei Kacheln nebeneinander, die
 * dieselbe Sache meinen.
 *
 * Deshalb zwei Schritte:
 *
 * 1. Alles zusammenführen — die Beziehungen aus dem Katalog **und** die bereits
 *    berechneten Reihen des gepflegten Bestands.
 * 2. Für jede so entstandene Gruppe die Kennung des gepflegten Bestands
 *    übernehmen, sofern ein Mitglied dort bekannt ist. Sonst wandert der
 *    Katalog-Titel in eine eigene Reihe, deren Kennung aber nicht zu der der
 *    Serie passen würde — und das Bündeln bräche genau an der Stelle, an der
 *    es am meisten auffällt.
 */
export function reihenFuerKatalog(
  eintraege: KatalogEintrag[],
  bekannt: Map<number, number>,
): Map<number, number> {
  const parent = new Map<number, number>()
  const find = (id: number): number => {
    let root = id
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!
    let cur = id
    while (parent.get(cur) !== undefined && parent.get(cur) !== cur) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    // Kleinere Kennung gewinnt — in aller Regel die erste Staffel.
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }

  /*
    **Ein Crossover verbindet keine Reihen — auch im Katalog nicht.**

    Der gepflegte Bestand kennt die Regel seit dem 12.08.2026: Wer zwei
    `PARENT`-Kanten trägt, gehört zu zwei Werken und darf ihre Reihen nicht
    zusammenziehen. Der Katalog kannte sie nicht — dort standen bis zum
    03.09.2026 nur die Kennungen der Nachbarn, nicht die Art der Kante.

    Was das gekostet hat, stand an dem Tag im Panel: „Dragon Ball: Annecy
    Festival 60th Anniversary" hängt an Dragon Ball Super **und** am
    One-Piece-Beitrag desselben Festivals. Über diese eine Kante standen **elf
    Dragon-Ball-Titel** in der One-Piece-Reihe, und weil zwei davon ONAs sind
    (also als Staffeln zählen), war One Piece selbst plötzlich „Staffel 4"
    (Daniel, mit Bild: „64 titel in reihe komplett unsortiert … Totale müll
    info. Kritisch.").

    **Der Eintrag fällt nicht weg**, er verbindet nur nichts: Seine Kanten
    bleiben ungenutzt, und er erbt unten die Reihe seines ersten Elternteils.
  */
  const kandidaten = new Map<number, number[]>()
  for (const e of eintraege) {
    if ((e.eltern?.length ?? 0) >= 2) kandidaten.set(e.id, e.eltern!)
  }

  for (const e of eintraege) {
    parent.set(e.id, parent.get(e.id) ?? e.id)
    if (kandidaten.has(e.id)) continue
    for (const anderer of e.rel ?? []) {
      if (kandidaten.has(anderer)) continue
      parent.set(anderer, parent.get(anderer) ?? anderer)
      union(e.id, anderer)
    }
  }
  // Die fertigen Reihen des gepflegten Bestands mit einhängen.
  for (const [id, franchiseId] of bekannt) {
    parent.set(id, parent.get(id) ?? id)
    parent.set(franchiseId, parent.get(franchiseId) ?? franchiseId)
    union(id, franchiseId)
  }

  // Je Gruppe die Kennung des gepflegten Bestands, falls es dort eine gibt.
  const ausBestand = new Map<number, number>()
  for (const [id, franchiseId] of bekannt) {
    const wurzel = find(id)
    const bisher = ausBestand.get(wurzel)
    if (bisher === undefined || franchiseId < bisher) ausBestand.set(wurzel, franchiseId)
  }

  /*
    Ein Crossover erbt die Reihe seines **ersten** Elternteils — dieselbe Regel
    wie im gepflegten Bestand. Verworfen wird er nicht: Er ist ein Werk und
    gehört in eine Reihe, nur eben in genau eine.
  */
  for (const [id, eltern] of kandidaten) {
    parent.set(id, parent.get(id) ?? id)
    const erster = eltern[0]
    if (erster !== undefined) {
      parent.set(erster, parent.get(erster) ?? erster)
      parent.set(find(id), find(erster))
    }
  }

  const reihe = new Map<number, number>()
  for (const e of eintraege) {
    const wurzel = find(e.id)
    reihe.set(e.id, ausBestand.get(wurzel) ?? wurzel)
  }
  return reihe
}

/**
 * **Ein Synonym, das mit dem deutschen Reihennamen beginnt, ist deutsch.**
 *
 * AniList kennzeichnet Synonyme nicht nach Sprache — „Die Tagebücher der
 * Apothekerin: Der Film" steht dort neben „Les Carnets de l'Apothicaire : Le
 * Film" und „Los diarios de la boticaria: La película". Ein Sprachdetektor
 * wäre Raten; der Abgleich gegen einen **belegten** Namen ist keiner: Heißt
 * die Reihe im Bestand „Die Tagebücher der Apothekerin", dann ist ein Synonym
 * mit genau diesem Anfang die deutsche Fassung dieses Titels.
 *
 * Anlass (Daniel, 12.09.2026): Im Panel stand „Kusuriya no Hitorigoto: Bouhi
 * no Hihou" — „Die Tagebücher der Apothekerin: Der Film muss da stehen".
 *
 * Die Grenze ist dieselbe wie überall hier: Der Reihenname muss **belegt**
 * sein (er stammt aus aniSearchs Sprachblock oder einem Handbeleg), und das
 * Synonym muss über den bloßen Namen hinausgehen — sonst wäre es nur der
 * Reihenname noch einmal und sagt über diesen Teil nichts.
 */
export function deutschAusSynonymen(
  synonyme: string[] | null | undefined,
  reihenName: string | undefined,
): string | undefined {
  if (!synonyme?.length || !reihenName || reihenName.length < 4) return undefined
  const vorsatz = reihenName.toLowerCase()
  const treffer = synonyme
    .map((x) => x.trim())
    .filter((x) => x.toLowerCase().startsWith(vorsatz) && x.length > reihenName.length + 2)
  /* Der kürzeste ist der knappste Zusatz — „: Der Film" schlägt „: Der Film (2026)". */
  return treffer.sort((x, y) => x.length - y.length)[0]
}

/** ADN schreibt die Freigabe als "12+"; unser Datensatz kennt die FSK-Stufen. */
export function fskFromAdnAge(age: string | undefined): Fsk | undefined {
  const value = Number((age ?? '').replace(/\D+/g, ''))
  return ([0, 6, 12, 16, 18] as const).includes(value as Fsk) ? (value as Fsk) : undefined
}

/**
 * Kennung eines ADN-Releases.
 *
 * Bleibt es bei einem einzigen Block, behält das Release seinen alten Slug
 * `adn-<id>` — geteilte Links und Merklisten sollen nicht ins Leere laufen.
 * Sobald eine Serie in Staffeln zerfällt, muss der Slug sie unterscheiden;
 * dann kommt Staffel und Termin dazu, und bei einem Block über mehrere
 * AniList-Staffeln zusätzlich deren Kennung.
 */
/**
 * Die Staffelangabe von ADN ist ein **Text**, keine Zahl.
 *
 * Bei den meisten Serien steht dort „1" oder „2", und solange das so war, ging
 * die Angabe ungefiltert in den Slug. Dann kam One Piece in den Katalog, und
 * seine Staffeln heißen „Saga 1 : East Blue". Daraus wurde der Slug
 * `adn-561-sSaga 1 : East Blue-20190520`, und der Bau der Teilen-Seiten brach ab:
 * Ein Doppelpunkt ist unter Windows kein gültiger Dateiname (17.08.2026).
 *
 * Auch ohne diesen Abbruch wäre es falsch. Aus einem Slug wird `/r/<slug>/` —
 * eine echte Adresse, und die verträgt keine Leerzeichen und keinen Doppelpunkt,
 * sondern bekäme Prozentzeichen an Stellen, an denen niemand sie lesen will.
 *
 * Rein numerische Angaben bleiben unverändert, damit keine bestehende Adresse
 * stirbt: `s2` bleibt `s2`.
 */
function slugTeil(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function adnSlug(showId: number, block: AdnBlock, titleId: number | undefined, einBlock: boolean): string {
  if (einBlock && titleId === undefined) return `adn-${showId}`
  const teile = [`adn-${showId}`, block.season ? `s${slugTeil(block.season)}` : 'x', block.firstDate.replace(/-/g, '')]
  if (titleId !== undefined) teile.push(String(titleId))
  return teile.join('-')
}

/**
 * Anzeigename eines Blocks, wenn kein AniList-Titel dahintersteht.
 *
 * „Sword Art Online" dreimal untereinander ist keine Auskunft. Ohne
 * zugeordnete Staffel bleibt nur die Zählung, die ADN selbst verwendet — die
 * ist zwar nicht die von Crunchyroll, aber sie stimmt wenigstens mit dem
 * überein, was der Nutzer auf der verlinkten Seite vorfindet.
 */
export function adnBlockName(showTitle: string, block: AdnBlock, blockAnzahl: number): string {
  if (blockAnzahl <= 1 || !block.season) return showTitle
  // Trägt der Block einen eigenen Namen, wird er genannt statt gezählt: One
  // Piece heißt bei ADN „Saga 1 : East Blue", und „ADN-Staffel Saga 1 : East
  // Blue" wäre eine Zählung vor einem Namen, der schon eine ist.
  if (!/^\d+$/.test(block.season)) return `${showTitle} – ${block.season.replace(/\s*:\s*/, ': ')}`
  return `${showTitle} – ADN-Staffel ${block.season}`
}

/**
 * Macht aus dem Namen eines Releases den Namen des Werks.
 *
 * Ein kuratierter Eintrag heißt „Bocchi the Rock! – Vol. 1", weil genau diese
 * Blu-ray so heißt. Der Anime heißt „Bocchi the Rock!". Weil der deutsche
 * Titel eines Werks aber aus dem ersten Release übernommen wird, das ihn
 * nennt, hieß der Anime bei uns ebenfalls „– Vol. 1" — und zwar überall:
 * Kachel, Suche, Teilen-Seite, Kalendereintrag. 32 Titel trugen am 12.08.2026
 * die Ausgabennummer irgendeiner Disc im Namen.
 *
 * Die Staffelangabe bleibt stehen: „Re:ZERO – Staffel 3" ist der Titel des
 * Werks, „– Vol. 1" ist es nicht.
 */
export function werkTitel(name: string): string {
  return (
    name
      .replace(/\s*[–—-]\s*(vol\.?|volume|part|teil)\s*\d+\s*$/i, '')
      .replace(/\s*\((vol\.?|volume|part|teil)\s*\d+\)\s*$/i, '')
      /**
       * **Auch eine Staffelnummer beschreibt einen Teil, nicht das Werk.**
       *
       * Bei Yu-Gi-Oh zeigte die Kalenderkarte "Staffel 3", das Detail-Panel
       * darunter "Staffel 2" — dieselbe Serie, dieselbe Sekunde (Daniel,
       * 24.08.2026, mit zwei Bildern).
       *
       * Der Grund: Beide Disney+-Ausgaben gehören zu **einer** AniList-Serie
       * (224 Folgen, id 481), und der zuerst gelesene kuratierte Eintrag
       * setzte seinen Namen als Werktitel. "Yu-Gi-Oh! – Staffel 2" ist aber
       * der Name eines Blocks; das Werk heißt "Yu-Gi-Oh!".
       *
       * Beim Release bleibt die Nummer stehen — dort gehört sie hin, sie
       * sagt ja, welcher Teil erscheint. Nur der Titel darüber trägt sie
       * nicht.
       */
      .replace(/\s*[–—-]\s*(staffel|season|serie|series)\s*\d+\s*$/i, '')
      .replace(/\s*\((staffel|season)\s*\d+\)\s*$/i, '')
      .trim()
  )
}

/**
 * Der Satz unter einem ADN-Release, der die Zählung erklärt.
 *
 * Zwei Dinge sind erklärungsbedürftig, und beide hat Daniel am 12.08.2026 als
 * „schwer zu verstehen, worauf sich die Episoden beziehen" gemeldet:
 *
 *  1. **ADN zählt anders als Crunchyroll.** Was ADN als Folge 25 der dritten
 *     Staffel führt, ist bei Crunchyroll Folge 1 von „Alicization – War of
 *     Underworld". Wer über unseren Link dorthin geht, muss wissen, wonach er
 *     scrollt.
 *  2. **Die Folgenzahlen weichen ab.** ADN hat 42 Folgen „Sailor Moon R" mit
 *     deutschem Ton, der Eintrag nennt 43. Diese Lücke stillschweigend zu
 *     schlucken hieße, eine der beiden Zahlen zur Wahrheit zu erklären.
 */
export function adnHinweis(
  block: AdnBlock,
  abschnitt: { adnVon: number; adnBis: number },
  teileAnzahl: number,
  folgenzahl: number,
  title: Title | undefined,
  unscharf: boolean | undefined,
): string | undefined {
  const saetze: string[] = []
  if (teileAnzahl > 1) {
    saetze.push(
      `ADN führt diese Staffel als Folgen ${abschnitt.adnVon}–${abschnitt.adnBis} der ADN-Staffel ${block.season ?? '?'}.`,
    )
  }
  if (unscharf && title?.episodes && title.episodes !== folgenzahl) {
    saetze.push(
      `ADN listet ${folgenzahl} Folgen mit deutschem Ton, die Serie hat ${title.episodes} — die Zuordnung ist über die Folgenzahl erschlossen.`,
    )
  }
  return saetze.length ? saetze.join(' ') : undefined
}

function cleanSynopsis(raw: string | null): string | undefined {
  if (!raw) return undefined
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Genres bleiben im Datensatz englisch — übersetzt wird erst in der
 * Oberfläche, sonst könnte sie nicht zwischen Sprachen umschalten.
 * Prägende Tags wie „Isekai" zählen mit als Genre.
 */
function mapGenres(media: AniListMedia): string[] {
  const fromTags = (media.tags ?? [])
    .filter((t) => !t.isMediaSpoiler && !t.isAdult && t.rank >= TAG_AS_GENRE_MIN_RANK)
    .filter((t) => t.name in TAG_AS_GENRE)
    .map((t) => t.name)
  return [...new Set([...(media.genres ?? []), ...fromTags])]
}

function mapKeywords(media: AniListMedia): string[] {
  return (media.tags ?? [])
    .filter((t) => !t.isMediaSpoiler && !t.isAdult && t.rank >= KEYWORD_MIN_RANK)
    .filter((t) => !KEYWORD_BLOCKLIST.has(t.name))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, KEYWORD_MAX)
    .map((t) => t.name)
}

export function isoDate(d: { year: number | null; month: number | null; day: number | null } | undefined) {
  if (!d?.year) return undefined
  const p = (n: number | null, fallback: string) => (n ? String(n).padStart(2, '0') : fallback)
  return `${d.year}-${p(d.month, '12')}-${p(d.day, '31')}`
}

/**
 * **Das Datum so genau, wie die Quelle es kennt — für die Anzeige.**
 *
 * `isoDate()` füllt fehlende Angaben mit dem spätesten Wert auf: Für die Frage
 * „lief das in Japan schon?" ist das die vorsichtige Richtung. Als Anzeige wird
 * daraus eine erfundene Angabe — Black Clover Staffel 2 stand mit „JP
 * 31.10.2026" im Panel, weil AniList nur „Oktober 2026" kannte (Daniel,
 * 15.09.2026; der Start ist der 03.10.2026). Hier bleibt es bei `2026-10`.
 */
export function isoDatumGenau(d: { year: number | null; month: number | null; day: number | null } | undefined) {
  if (!d?.year) return undefined
  const p = (n: number) => String(n).padStart(2, '0')
  if (!d.month) return String(d.year)
  if (!d.day) return `${d.year}-${p(d.month)}`
  return `${d.year}-${p(d.month)}-${p(d.day)}`
}

function mapStreams(media: AniListMedia): StreamLink[] {
  const out: StreamLink[] = []
  const displayTitle = media.title.english ?? media.title.romaji ?? ''

  for (const roh of media.externalLinks ?? []) {
    if (roh.type !== 'STREAMING') continue
    /**
     * Auch AniList führt Weiterleitungen statt Zielen.
     *
     * Bei „NANA" stand dort eine Google-Trefferadresse, die auf Crunchyroll
     * zeigt (22.08.2026). Unverändert gespeichert ist das ein Verweis auf eine
     * Suchmaschine — der Abruflauf fand hinter ihr nie eine Serienkennung.
     */
    const link = { ...roh, url: entwirreWeiterleitung(roh.url) }
    const platform = platformFromSite(link.site)
    if (!platform) continue
    if (out.some((s) => s.platform === platform)) continue

    // Prime Video läuft grundsätzlich über amazon.de. Ein Deeplink von AniList
    // zeigt auf einen fremden Marktplatz und endet in Deutschland auf einer
    // Fehlerseite — dann lieber zur Suche schicken als ins Nichts.
    const url =
      platform === 'primevideo' && isUnusablePrimeLink(link.url)
        ? primeVideoSearchUrl(displayTitle)
        : germanizeUrl(platform, link.url)
    out.push({ platform, url })
  }
  return out.sort(
    (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
  )
}

export function titleFromMedia(media: AniListMedia, confidence: DubConfidence): Title {
  const display = media.title.english ?? media.title.romaji ?? media.title.native ?? `#${media.id}`
  return {
    id: media.id,
    malId: media.idMal ?? undefined,
    slug: `${slugify(display)}-${media.id}`,
    titleRomaji: media.title.romaji ?? undefined,
    titleEn: media.title.english ?? undefined,
    titleNative: media.title.native ?? undefined,
    format: media.format ?? undefined,
    episodes: media.episodes ?? undefined,
    jpYear: media.seasonYear ?? media.startDate?.year ?? undefined,
    jpSeason: media.season ?? undefined,
    jpEnd: isoDate(media.endDate) ?? isoDate(media.startDate),
    genres: mapGenres(media),
    keywords: mapKeywords(media),
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined,
    bannerImage: media.bannerImage ?? undefined,
    synopsis: cleanSynopsis(media.description),
    /*
      **Ohne Dubletten.** AniList führt dasselbe Studio mehrfach, wenn es
      verschiedene Rollen hatte — im Detail-Panel stand deshalb „WIT STUDIO, WIT
      STUDIO" (gesehen am 29.08.2026 beim Prüfen der Quellenübersicht). Gemessen
      betraf das **141 von 2.763** Titeln, darunter Detektiv Conan, Yū Yū Hakusho
      und ufotable-Filme.
    */
    studios: [
      ...new Set(
        (media.studios?.nodes ?? []).filter((s) => s.isAnimationStudio !== false).map((s) => s.name),
      ),
    ].slice(0, 3),
    score: media.averageScore ?? undefined,
    dubConfidence: confidence,
    streams: mapStreams(media),
  }
}

/**
 * TMDB-Anbietername → unsere Plattform. Dieselbe Zuordnung wie im Abrufskript,
 * hier noch einmal gebraucht, weil der Build entscheidet, was als Plattform
 * und was als schlichter Verweis erscheint.
 */
export function providerToPlatform(name: string): PlatformId | undefined {
  const n = name.toLowerCase()
  if (n.includes('crunchyroll')) return 'crunchyroll'
  if (n.includes('netflix')) return 'netflix'
  if (n.includes('disney')) return 'disneyplus'
  if (n.includes('amazon') || n.includes('prime video')) return 'primevideo'
  if (n.includes('animation digital network') || n === 'adn') return 'adn'
  if (n.includes('wow')) return 'wow'
  if (n.includes('joyn')) return 'joyn'
  if (n.includes('rtl')) return 'rtlplus'
  if (n.includes('aniverse')) return 'aniverse'
  return undefined
}

/**
 * Müsste diese Serie im abgesuchten Crunchyroll-Zeitraum laufen?
 *
 * Die Frage entscheidet, ob das Fehlen im Kalender etwas beweist. Vorher wurde
 * nur geprüft, ob der **Starttermin** im Fenster liegt — und das ging schief,
 * sobald das Fenster weiterwanderte:
 *
 *   Fenster 03.08.–23.08., Mushoku Tensei S3 startet angeblich am 05.07.
 *   → Start liegt davor → keine Prüfung → der Eintrag bleibt stehen.
 *
 * Im Juli war derselbe Eintrag korrekt verworfen worden. Der Fehler reparierte
 * sich also von selbst wieder kaputt, und niemand hätte es gemerkt (gemeldet
 * von Daniel am 10.08.2026: „gibt es noch nicht auf Deutsch, nicht mal die
 * erste Folge").
 *
 * Richtig ist: Wenn eine wöchentliche Serie am 05.07. beginnt und vierzehn
 * Folgen hat, müssen im August Folgen im Kalender stehen. Stehen dort keine,
 * gibt es die deutsche Fassung nicht. Nur bei Serien, die vor dem Fenster
 * abgeschlossen waren, beweist das Fehlen nichts.
 */
export function overlapsWindow(
  schedule: { firstEpisodeDate: string; episodeCount?: number; lastEpisodeDate?: string },
  window: { from: string; to: string },
): boolean {
  const start = schedule.firstEpisodeDate
  const ende =
    schedule.lastEpisodeDate ??
    addDays(start, 7 * Math.max(0, (schedule.episodeCount ?? 12) - 1))
  return start <= window.to && ende >= window.from
}

/** Wochentag eines ISO-Datums, 0 = Montag. */
function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/**
 * Rechnet aus dem beobachteten Sendeplan den Start der deutschen Fassung.
 *
 * Der Kalender zeigt nur ein Fenster von wenigen Wochen. Lief die früheste dort
 * gesehene Folge als Nummer 5, lag Folge 1 vier Wochen davor — das ist Rechnen,
 * kein Raten, solange der Wochentakt stimmt.
 *
 * Entscheidend ist, **welcher** Beobachtung man dabei glaubt. Die erste Fassung
 * nahm die früheste und lag bei „Skeleton Knight" zwei Tage daneben: Dort stand
 * eine einzelne Kachel am Samstag, 04.07., als Folge 1 im Kalender, während vier
 * spätere Termine einträchtig montags lagen. Aus dem Samstag hochgerechnet war
 * anschließend **jeder** Termin der Staffel falsch.
 *
 * Deshalb entscheidet jetzt die Mehrheit:
 *  1. Der Wochentag, auf dem die meisten Beobachtungen liegen, ist der
 *     Sendeplatz. Alles daneben fliegt raus — auch wenn es früher liegt.
 *  2. Jede verbliebene Beobachtung rechnet ihren eigenen Staffelstart aus.
 *     Der häufigste gewinnt; bei Gleichstand der aus dem jüngsten Termin,
 *     weil ein aktueller Sendeplan mehr über den laufenden Plan sagt.
 *
 * `assumed` bleibt gesetzt, solange nur eine einzige Stimme hinter dem
 * Ergebnis steht — dann ist es eine plausible Rechnung, aber kein Beleg.
 */
export function derivedStart(slot: CrunchyrollEntry): { date: string; assumed: boolean } | undefined {
  const observations = slot.observations?.length
    ? slot.observations
    : slot.earliest
      ? [slot.earliest]
      : []
  if (!observations.length) return undefined

  // 1. Der Sendeplatz ist der Wochentag mit den meisten Beobachtungen.
  const perWeekday = new Map<number, number>()
  for (const o of observations) {
    const day = weekdayOf(o.date)
    perWeekday.set(day, (perWeekday.get(day) ?? 0) + 1)
  }
  const slotDay = [...perWeekday.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
  const onSlot = observations.filter((o) => weekdayOf(o.date) === slotDay)

  // 2. Jede Beobachtung mit Folgennummer rechnet ihren Staffelstart aus.
  const votes = new Map<string, { count: number; latest: string }>()
  for (const o of onSlot) {
    if (!o.episode || o.episode < 1) continue
    const start = addDays(o.date, -7 * (o.episode - 1))
    const entry = votes.get(start)
    if (entry) {
      entry.count++
      if (o.date > entry.latest) entry.latest = o.date
    } else {
      votes.set(start, { count: 1, latest: o.date })
    }
  }

  if (!votes.size) {
    // Keine einzige Folgennummer: Dann bleibt nur der früheste Termin auf dem
    // Sendeplatz, und das ist ausdrücklich eine Annahme.
    const fallback = onSlot.map((o) => o.date).sort()[0]
    return fallback ? { date: fallback, assumed: true } : undefined
  }

  const [date, winner] = [...votes.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].latest.localeCompare(a[1].latest),
  )[0]
  return { date, assumed: winner.count < 2 }
}

/**
 * Die im Kalender tatsächlich gesehenen Termine je Folgennummer.
 *
 * Nur was eine Nummer trägt, lässt sich einer Folge zuordnen. Alles andere
 * bleibt der Hochrechnung überlassen.
 */
export function observedEpisodes(slot: CrunchyrollEntry): Record<number, string> {
  const out: Record<number, string> = {}
  for (const o of slot.observations ?? []) {
    if (o.episode && o.episode > 0) out[o.episode] = o.date
  }
  return out
}

export function pickPlatformUrl(entry: CuratedEntry, title: Title | undefined): string | undefined {
  if (entry.platformUrl) return entry.platformUrl
  const match = title?.streams.find((s) => s.platform === entry.platform)
  if (match) return match.url
  // Kein Deeplink bekannt: lieber zur Suche des Anbieters schicken als die
  // Plattform als toten Text stehen lassen. Bei `kino` gibt es keine, dann
  // bleibt es leer.
  const query = searchableName(entry.titleDe ?? title?.titleEn ?? title?.titleRomaji ?? entry.search)
  return query ? platformSearchUrl(entry.platform, query) : undefined
}

/**
 * Reduziert einen Anzeigenamen auf den Serientitel.
 *
 * „Yu-Gi-Oh! – Staffel 2" findet bei Disney+ nichts, „Yu-Gi-Oh!" schon: Die
 * Suchfelder der Anbieter sind keine Volltextsuche, jeder Zusatz kostet Treffer.
 * Staffel-, Volume- und Part-Angaben fliegen deshalb raus.
 */
function searchableName(name: string | undefined): string | undefined {
  if (!name) return undefined
  const trimmed = name
    .replace(/\s*[–—-]\s*(Staffel|Season|Vol\.?|Part|Box)\s*\d+.*$/i, '')
    .replace(/\s*\((\d{4}|Remaster|2K-Remaster)\)\s*$/i, '')
    /*
      **Ein alternativer Titel in Bindestrichen findet nichts.**

      `Doukyuusei -Classmates-` und `Free! -Dive to the Future-` liefern bei
      Prime null Treffer, `Doukyuusei` und `Free!` finden die Serie sofort
      (Daniel, 27.08.2026, beide mit Bild). Die Schreibweise stammt aus der
      japanischen Titelkonvention und steht bei keinem Anbieter so im Katalog.

      Der Doppelpunkt-Zusatz bleibt: „Horimiya: The Missing Pieces" ist ein
      eigenes Werk, kein Beiwerk zum Haupttitel.
    */
    .replace(/\s-[^-]+-\s*$/, '')
    .trim()
  return trimmed || name
}
