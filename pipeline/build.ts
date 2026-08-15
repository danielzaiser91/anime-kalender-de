/**
 * Setzt aus Cache + kuratierten Daten die Dateien zusammen, die die Web-App lädt.
 * Ausgabe landet in public/data/ und wird mit ins Repo committet.
 */
import { type AniListMedia, type KatalogEintrag } from './lib/anilist.ts'
import {
  crunchyrollSeriesId,
  normalizeTitle,
  type CrunchyrollData,
  type CrunchyrollEntry,
} from './lib/crunchyroll.ts'
import { loadCurated, loadWatchLinks, type CuratedEntry } from './lib/curated.ts'
import { dubKey, loadDubChecks } from './lib/dub-confirmed.ts'
import { beurteile, type CrDubData } from './lib/crunchyroll-dub.ts'
import type { TmdbInfo } from './lib/tmdb.ts'
import {
  ordneBloeckeZuStaffeln,
  staffelBloecke,
  staffelnDesFranchise,
  type AdnBlock,
  type AdnData,
} from './lib/adn.ts'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { clearDir, log, readJson, slugify, warn, writeJson, writeText } from './lib/util.ts'
import { SYNOPSIS_GROUPS } from '../shared/types.ts'
import type {
  DataMeta,
  FranchiseMember,
  DubConfidence,
  Fsk,
  PlatformId,
  Quelle,
  Release,
  ReleaseEvent,
  StreamLink,
  Title,
  WatchLink,
} from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { eindeutschenStaffel, nachAusstrahlung } from '../shared/titles.ts'
import { addDays, todayIso } from '../shared/time.ts'
import { buildIcs } from '../shared/ics.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'
import {
  meldungenAus,
  quellenName,
  quellenZusammenfuehren,
  releasesAus,
  type Vorschlag,
} from './lib/meldungen.ts'
import {
  KEYWORD_BLOCKLIST,
  PLATFORM_PRIORITY,
  TAG_AS_GENRE,
  TAG_AS_GENRE_MIN_RANK,
  amazonSearchUrl,
  anisearchPlatform,
  providerKind,
  providerName,
  stripAffiliate,
  isUnusablePrimeLink,
  primeVideoSearchUrl,
  platformSearchUrl,
  germanizeUrl,
  platformFromSite,
  ANILIST_COVER_BASIS,
  FRANCHISE_RELATIONS,
} from '../shared/mappings.ts'

const OUT = 'public/data'
/** Deutsche Sprechrollen, eine Datei je Titel — gefüllt von `data:voices`. */
const VOICES_DIR = `${OUT}/voices`
const KEYWORD_MIN_RANK = 55
const KEYWORD_MAX = 24
const CR_CALENDAR_URL = 'https://www.crunchyroll.com/de/simulcastcalendar'
const ADN_CALENDAR_URL = 'https://animationdigitalnetwork.com/de/'

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
function reihenFuerKatalog(
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

  for (const e of eintraege) {
    parent.set(e.id, parent.get(e.id) ?? e.id)
    for (const anderer of e.rel ?? []) {
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

  const reihe = new Map<number, number>()
  for (const e of eintraege) {
    const wurzel = find(e.id)
    reihe.set(e.id, ausBestand.get(wurzel) ?? wurzel)
  }
  return reihe
}

/**
 * Schreibt die Anime **ohne** belegte deutsche Synchro als eigene Datei.
 *
 * Warum eine eigene Datei und nicht `titles.json`: Es sind rund zehnmal so
 * viele wie im gepflegten Bestand, und die überwältigende Mehrheit der Besucher
 * braucht sie nie. Sie in die Hauptdatei zu legen hieße, jedem Aufruf ein
 * Vielfaches an Ladelast aufzubürden für eine Liste, die nur sieht, wer den
 * Schalter in der Datenbank ausdrücklich umlegt (ARCHITEKTUR.md: „Ein neues
 * Feld gehört nur dann in `titles.json`, wenn es die Mehrheit der Besucher
 * braucht").
 *
 * Was schon im gepflegten Bestand steht, fällt hier heraus — sonst stünde ein
 * Titel zweimal in der Liste, einmal mit und einmal ohne Synchro.
 *
 * `bekannt` bildet die Kennung eines gepflegten Titels auf seine `franchiseId`
 * ab. Beides wird gebraucht: die Kennung zum Aussortieren, die Reihe zum
 * Zusammenführen — siehe `reihenFuerKatalog`.
 */
function schreibeOhneSynchro(bekannt: Map<number, number>): void {
  const katalog = readJson<{ eintraege?: KatalogEintrag[] }>('data/cache/anilist-katalog.json', {})
  const eintraege = katalog.eintraege ?? []
  if (!eintraege.length) {
    /**
     * Kein Katalog — dann bleibt die zuletzt gebaute Datei **stehen**.
     *
     * Das ist Absicht und nicht bloß Bequemlichkeit: `data/cache/` liegt nicht
     * im Repo, ein CI-Lauf ohne warmen Cache hätte den Katalog also nicht. Eine
     * leere Datei zu schreiben hieße, die 15.000 Titel bei jedem solchen Lauf
     * von der Seite verschwinden zu lassen — und mit ihnen die Möglichkeit,
     * einen davon zu merken.
     */
    warn(
      'Kein AniList-Katalog im Cache — ohne-synchro.json bleibt auf dem letzten Stand. ' +
        'Frisch holen mit "npm run data:katalog".',
    )
    return
  }

  const reihe = reihenFuerKatalog(eintraege, bekannt)

  /**
   * Drei Pflichtfelder von `Title` fehlen hier absichtlich: `slug`, `keywords`
   * und `streams`. Sie wären für jeden dieser Titel leer beziehungsweise ohne
   * Verwendung — es gibt zu ihnen keine Teilen-Seite, keine gepflegten
   * Schlagwörter und keinen Anbieter. Ausgeschrieben kosteten die leeren Werte
   * bei achtzehntausend Titeln rund 900 KB. `loadOhneSynchro` setzt sie beim
   * Laden, sodass der Rest der Anwendung sie wie gewohnt vorfindet.
   */
  const ohne = eintraege
    .filter((e) => !bekannt.has(e.id))
    .map((e) => {
      const [romaji, englisch, japanisch] = e.t
      return {
        id: e.id,
        titleRomaji: romaji ?? undefined,
        titleEn: englisch ?? undefined,
        titleNative: japanisch ?? undefined,
        format: e.format ?? undefined,
        episodes: e.folgen ?? undefined,
        jpYear: e.jahr ?? undefined,
        genres: e.genres,
        /**
         * **Ohne** Adressvorsatz — der wird erst im Browser angehängt. Bei
         * achtzehntausend Titeln spart das über ein Megabyte an Ladelast.
         *
         * Gekürzt wird hier und nicht beim Abrufen, obwohl es dort naheläge:
         * Der Zwischenspeicher überdauert viele Läufe, und Einträge aus einem
         * früheren Lauf tragen noch die volle Adresse. Beim Bauen greift die
         * Kürzung dagegen auf jeden Eintrag, auch auf alte. Passt der Vorsatz
         * nicht (AniList liefert gelegentlich einen anderen Hostnamen), bleibt
         * die Adresse unangetastet — der Browser erkennt das am `http`.
         */
        coverImage: e.cover?.startsWith(ANILIST_COVER_BASIS)
          ? e.cover.slice(ANILIST_COVER_BASIS.length)
          : (e.cover ?? undefined),
        score: e.score ?? undefined,
        /**
         * Fehlt, wenn der Titel allein steht — dann greift in der Oberfläche
         * ohnehin der Rückfall auf die eigene Kennung, und die Zahl wäre
         * fünfzehntausendmal umsonst übertragen.
         */
        franchiseId: reihe.get(e.id) === e.id ? undefined : reihe.get(e.id),
        /**
         * `low` ist hier keine schwache Angabe, sondern die einzig ehrliche:
         * Es gibt nichts zu belegen. Das Feld ist Pflicht, weil dieselbe
         * Oberfläche beide Sorten anzeigt.
         */
        dubConfidence: 'low' as const,
        ohneSynchro: true,
      }
    })

  writeJson(`${OUT}/ohne-synchro.json`, ohne)
  log(`Ohne deutsche Synchro: ${ohne.length} Titel (aus ${eintraege.length} im AniList-Katalog)`)
}

/** Wo die Quellen jedes Termins über Läufe hinweg aufbewahrt werden. */
const QUELLEN_HISTORIE = 'data/quellen-historie.json'

/**
 * Gibt jedem Termin seine Quellen — und **behält die überholten**.
 *
 * Die Regel stammt von Wikipedia (`Wikipedia:Link rot`): „Do not delete cited
 * information solely because the URL to the source does not work." Übertragen
 * auf Termine heißt das: Wird ein Termin verschoben, verschwindet die Quelle
 * des alten Termins nicht. Sonst lässt sich die Frage „woher kam eigentlich der
 * 20.08.?" später nicht mehr beantworten — und genau die stellt sich, sobald
 * zwei Quellen sich widersprechen. Beim Inazuma-Fall am 13.08.2026 kostete
 * genau diese fehlende Spur einen halben Tag Nachrecherche.
 *
 * Deshalb liegt neben dem Datensatz eine Historie: Jede Adresse, die je zu
 * einem Termin geführt hat, bleibt dort stehen. Nennt sie inzwischen einen
 * anderen Tag als der geltende Termin, wird sie als überholt **markiert**, aber
 * weiter ausgeliefert.
 */
function quellenPflegen(releases: Release[]): void {
  const historie = readJson<Record<string, Quelle[]>>(QUELLEN_HISTORIE, {})
  const heute = todayIso()

  for (const release of releases) {
    const termin = release.schedule.firstEpisodeDate
    /**
     * Kuratierte Termine tragen nur nackte Adressen in `sources`. Daraus wird
     * hier eine vollwertige Herkunftsangabe — sonst hätten ausgerechnet die von
     * Hand geprüften Termine die schlechtere Belegkette als die automatischen.
     */
    const neu: Quelle[] =
      release.quellen ??
      release.sources.map((url) => ({
        url,
        name: quellenName(url),
        gesehenAm: heute,
        sagt: termin,
        stand: 'aktuell' as const,
      }))

    const aktuelleAdressen = new Set(neu.map((q) => q.url))
    const alt = (historie[release.slug] ?? []).map((q) => {
      if (aktuelleAdressen.has(q.url)) return q
      /**
       * Die Quelle steht nicht mehr hinter dem geltenden Termin. Ob sie
       * *widerlegt* ist, wissen wir nur, wenn sie selbst einen Tag genannt hat
       * — sonst bleibt es bei „vermutlich", und das steht dann auch so da.
       */
      return q.sagt && q.sagt !== termin
        ? {
            ...q,
            stand: 'ueberholt' as const,
            grund: `Nennt den ${q.sagt}; geltender Termin ist der ${termin}.`,
          }
        : { ...q, stand: 'vermutlich-ueberholt' as const }
    })

    const zusammen = quellenZusammenfuehren(alt, neu)
    historie[release.slug] = zusammen
    release.quellen = zusammen
  }

  writeJson(QUELLEN_HISTORIE, historie, true)
  const ueberholt = Object.values(historie)
    .flat()
    .filter((q) => q.stand !== 'aktuell').length
  log(`Quellenhistorie: ${Object.keys(historie).length} Termine, davon ${ueberholt} überholte Belege`)
}

/**
 * Veröffentlicht die Fundstellen der Nachrichtenquellen als **Meldungen**.
 *
 * Bis zum 14.08.2026 endete jeder Scraper-Lauf in `data/proposals/` und wartete
 * auf einen Menschen. Von 29 Funden nannte **keiner** einen Tag, 27 nur einen
 * Monat — auf eine Handübertragung zu warten hieß also, dauerhaft zu warten.
 * Seitdem erscheint die Fundstelle selbst auf der Seite: mit Zitat, mit Quelle,
 * und mit der Ansage, dass wir den Termin nicht auslesen konnten.
 *
 * Titel **ohne** Synchro werden mit einbezogen, denn gerade dort ist eine
 * Meldung die einzige Information, die es überhaupt gibt.
 */
function schreibeMeldungen(slim: Title[]): void {
  const roh = readJson<{ proposals?: Vorschlag[] }>('data/proposals/anime2you.json', {})
  const vorschlaege = roh.proposals ?? []
  if (!vorschlaege.length) {
    warn('Keine Vorschläge in data/proposals/anime2you.json — meldungen.json bleibt leer.')
    writeJson(`${OUT}/meldungen.json`, [])
    return
  }

  const ohne = readJson<Title[]>(`${OUT}/ohne-synchro.json`, [])
  const meldungen = meldungenAus(vorschlaege, [...slim, ...ohne], todayIso())
  writeJson(`${OUT}/meldungen.json`, meldungen)
  log(`${meldungen.length} Meldungen aus ${vorschlaege.length} Vorschlägen zugeordnet`)
}

/**
 * Führt Buch darüber, seit wann ein Titel eine belegte deutsche Synchro hat —
 * und meldet die Neuzugänge.
 *
 * Ohne dieses Gedächtnis kann niemand sagen, dass ein Titel **neu** dazukam:
 * Der gebaute Datensatz beschreibt immer nur den Jetzt-Zustand. `data/
 * synchro-historie.json` hält deshalb je Titel den Tag fest, an dem er zum
 * ersten Mal im Bestand auftauchte. Die Datei gehört ins Repo — geht sie
 * verloren, gelten beim nächsten Lauf alle 2.700 Titel als neu, und jeder
 * Abonnent bekommt eine Mail über Serien, die er längst kennt.
 *
 * Genau diese Angabe trägt das Feature, um das Daniel gebeten hat (13.08.2026):
 * Wer einen Titel ohne Synchro merkt, will erfahren, **sobald** es eine gibt —
 * nicht erst, wenn ein Termin im Wochenfenster des Newsletters liegt. Eine
 * Ankündigung ohne Datum wäre sonst nie eine Mail wert, und gerade sie ist die
 * Nachricht, auf die jemand monatelang wartet.
 */
function schreibeNeuMitSynchro(titles: Title[], releases: Release[]): void {
  const HISTORIE = 'data/synchro-historie.json'
  /** Wie lange ein Zugang als „neu" gilt. */
  const FENSTER_TAGE = 60

  /**
   * `angelegtAm` ist keine Zierde, sondern die Sperre gegen eine Massenmail.
   *
   * Ohne sie war der Fehler unmittelbar da (gemessen 13.08.2026): Der erste
   * Lauf schreibt für **alle** 2.753 Titel das heutige Datum. Der zweite Lauf
   * sieht 2.753 Einträge, die jünger als 60 Tage sind, und hält jeden einzelnen
   * für einen Neuzugang — jeder Abonnent bekäme eine Mail über Serien, die er
   * längst kennt. Der Vergleich mit `angelegtAm` nimmt genau diesen
   * Ausgangsstand dauerhaft aus der Meldung heraus.
   *
   * Ein Titel, der zufällig am selben Tag wirklich neu dazukommt, fällt damit
   * einmalig unter den Tisch. Das ist der richtige Tausch: eine verpasste
   * Meldung gegen tausende falsche.
   */
  interface Historie {
    angelegtAm: string
    seit: Record<string, string>
  }

  const heute = todayIso()
  const historie = readJson<Historie>(HISTORIE, { angelegtAm: heute, seit: {} })
  const erstlauf = Object.keys(historie.seit).length === 0

  for (const t of titles) {
    if (!historie.seit[t.id]) historie.seit[t.id] = heute
  }
  writeJson(HISTORIE, historie, true)

  if (erstlauf) {
    log(`Synchro-Historie angelegt: ${titles.length} Titel als Ausgangsstand, keine Neuzugänge gemeldet`)
    writeJson(`${OUT}/neu-mit-synchro.json`, [])
    return
  }

  const ersterTermin = new Map<number, string>()
  for (const r of releases) {
    const bisher = ersterTermin.get(r.titleId)
    if (!bisher || r.schedule.firstEpisodeDate < bisher) ersterTermin.set(r.titleId, r.schedule.firstEpisodeDate)
  }

  const grenze = addDays(heute, -FENSTER_TAGE)
  const neu = titles
    .filter((t) => {
      const seit = historie.seit[t.id]
      // Der Ausgangsstand ist kein Neuzugang, egal wie jung sein Datum ist.
      return seit >= grenze && seit !== historie.angelegtAm
    })
    .map((t) => ({
      id: t.id,
      name: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
      slug: t.slug,
      /** Tag, an dem der Titel erstmals mit belegter Synchro im Bestand stand. */
      seit: historie.seit[t.id],
      /** Erster bekannter deutscher Termin, falls es schon einen gibt. */
      termin: ersterTermin.get(t.id),
    }))
    .sort((a, b) => b.seit.localeCompare(a.seit))

  writeJson(`${OUT}/neu-mit-synchro.json`, neu)
  log(`Neu mit deutscher Synchro (${FENSTER_TAGE} Tage): ${neu.length} Titel`)
}

/** ADN schreibt die Freigabe als "12+"; unser Datensatz kennt die FSK-Stufen. */
function fskFromAdnAge(age: string | undefined): Fsk | undefined {
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
function adnSlug(showId: number, block: AdnBlock, titleId: number | undefined, einBlock: boolean): string {
  if (einBlock && titleId === undefined) return `adn-${showId}`
  const teile = [`adn-${showId}`, block.season ? `s${block.season}` : 'x', block.firstDate.replace(/-/g, '')]
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
function adnBlockName(showTitle: string, block: AdnBlock, blockAnzahl: number): string {
  if (blockAnzahl <= 1 || !block.season) return showTitle
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
function werkTitel(name: string): string {
  return name
    .replace(/\s*[–—-]\s*(vol\.?|volume|part|teil)\s*\d+\s*$/i, '')
    .replace(/\s*\((vol\.?|volume|part|teil)\s*\d+\)\s*$/i, '')
    .trim()
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
function adnHinweis(
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

function isoDate(d: { year: number | null; month: number | null; day: number | null } | undefined) {
  if (!d?.year) return undefined
  const p = (n: number | null, fallback: string) => (n ? String(n).padStart(2, '0') : fallback)
  return `${d.year}-${p(d.month, '12')}-${p(d.day, '31')}`
}

function mapStreams(media: AniListMedia): StreamLink[] {
  const out: StreamLink[] = []
  const displayTitle = media.title.english ?? media.title.romaji ?? ''

  for (const link of media.externalLinks ?? []) {
    if (link.type !== 'STREAMING') continue
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

function titleFromMedia(media: AniListMedia, confidence: DubConfidence): Title {
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
    studios: (media.studios?.nodes ?? []).filter((s) => s.isAnimationStudio !== false).map((s) => s.name).slice(0, 3),
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
function providerToPlatform(name: string): PlatformId | undefined {
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
function overlapsWindow(
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
function derivedStart(slot: CrunchyrollEntry): { date: string; assumed: boolean } | undefined {
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
function observedEpisodes(slot: CrunchyrollEntry): Record<number, string> {
  const out: Record<number, string> = {}
  for (const o of slot.observations ?? []) {
    if (o.episode && o.episode > 0) out[o.episode] = o.date
  }
  return out
}

function pickPlatformUrl(entry: CuratedEntry, title: Title | undefined): string | undefined {
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
    .trim()
  return trimmed || name
}

function main(): void {
  const confidenceRaw = readJson<Record<string, DubConfidence>>('data/cache/dub-confidence.json', {})
  const byMal = readJson<Record<string, AniListMedia>>('data/cache/anilist-media.json', {})
  const byAniId = readJson<Record<string, AniListMedia>>('data/cache/anilist-by-id.json', {})
  const curatedIds = readJson<Record<string, number>>('data/curated-ids.json', {})
  // Liegt bewusst im Repo statt im Cache: ohne TMDB-Key soll ein Build die
  // bereits ermittelten FSK-Angaben nicht wieder verlieren.
  const tmdb = readJson<Record<string, TmdbInfo>>('data/tmdb.json', {})
  // Je AniList-ID: deutsche Handlung, FSK und Anbieter — für alle Titel, nicht
  // nur die kuratierten.
  const tmdbTitles = readJson<
    Record<
      string,
      {
        overviewDe?: string
        fsk?: Fsk
        providers?: PlatformId[]
        offers?: { name: string; kind: 'flatrate' | 'rent' | 'buy' }[]
        justwatchUrl?: string
        /** Kennung und Art bei TMDB — nötig, um die Quelle verlinken zu können. */
        tmdbId?: number
        kind?: 'tv' | 'movie'
      }
    >
  >(
    'data/tmdb-titles.json',
    {},
  )
  // Deutsche Inhaltsangaben und Anbieter von aniSearch. Fehlt die Datei, läuft
  // alles wie zuvor — nur eben mit den schwächeren Texten.
  const anisearch = readJson<
    Record<
      string,
      {
        descriptionDe?: string
        streams: { provider: string; url: string }[]
        info?: { episodes?: number; episodesEstimated?: boolean }
      }
    >
  >('data/anisearch.json', {})
  const curated = loadCurated()

  /**
   * Die Folgenzahl laut aniSearch — samt deren eigener Einschätzung, ob sie
   * schon feststeht.
   *
   * Die bisherige Rückfallregel war „zwölf, weil das die übliche Cour-Länge
   * ist". Das ist geraten, und bei einer 24-teiligen Reihe fehlte der Kalender
   * ab Folge 13 einfach. aniSearch pflegt die Zahl redaktionell und schreibt
   * dazu, wenn sie vorläufig ist — beides übernehmen wir: die Zahl als
   * besseren Wert, die Kennzeichnung, damit aus fremder Unsicherheit keine
   * eigene Behauptung wird.
   *
   * Eine Jahresprüfung wie bei AniList braucht es hier nicht: Die Zuordnung
   * kommt aus der ID-Brücke und trifft damit genau diese Staffel.
   */
  const anisearchEpisodes = (
    titleId: number | undefined,
  ): { count: number; estimated: boolean } | undefined => {
    const info = titleId === undefined ? undefined : anisearch[titleId]?.info
    if (!info?.episodes || info.episodes < 1) return undefined
    return { count: info.episodes, estimated: info.episodesEstimated === true }
  }

  // Notbremse: Ohne den AniList-Cache baut dieser Lauf einen Datensatz ohne
  // einen einzigen Titel — und damit ohne Genres, Keywords, Cover und
  // Beschreibungen. Das sieht in der Ausgabe harmlos aus („Titel: 0") und
  // überschreibt trotzdem alles unter public/data/.
  //
  // Genau das ist am 08.08.2026 passiert: Der stündliche Workflow rief
  // `data:build` ohne vorheriges `data:fetch` auf, und `data/cache/` liegt
  // bewusst nicht im Repo. Der Kalender stand danach eine Stunde lang ohne
  // Genre- und Keyword-Filter da.
  if (!Object.keys(byMal).length && !Object.keys(byAniId).length) {
    console.error(
      'Abbruch: data/cache/ ist leer — ohne AniList-Daten gäbe es keinen einzigen Titel.\n' +
        'Erst `npm run data:fetch` laufen lassen. Der bestehende Datensatz bleibt unangetastet.',
    )
    process.exit(1)
  }

  // --- Titel aufbauen -------------------------------------------------------
  const titles = new Map<number, Title>()
  /**
   * Beginn der japanischen Ausstrahlung, nur für den Bau.
   *
   * Bewusst **nicht** in `Title`: Das Feld beantwortet genau eine Frage im
   * Build („lief das in Japan schon?") und wäre in `titles.json` bei 2.750
   * Einträgen Ladelast ohne Gegenwert — die Oberfläche zeigt das japanische
   * Startdatum nirgends.
   */
  const jpStart = new Map<number, string>()

  for (const [malId, media] of Object.entries(byMal)) {
    if (!media?.id) continue
    if (media.isAdult) continue
    const confidence = confidenceRaw[malId] ?? 'low'
    titles.set(media.id, titleFromMedia(media, confidence))
    const start = isoDate(media.startDate)
    if (start) jpStart.set(media.id, start)
  }

  // Kuratierte Titel können auf AniList-Einträge zeigen, die nicht über MyDubList kamen.
  for (const media of Object.values(byAniId)) {
    if (!media?.id || titles.has(media.id)) continue
    const confidence = media.idMal ? (confidenceRaw[media.idMal] ?? 'normal') : 'normal'
    titles.set(media.id, titleFromMedia(media, confidence))
    const start = isoDate(media.startDate)
    if (start) jpStart.set(media.id, start)
  }

  // --- Reihen zusammenführen -------------------------------------------------
  // Staffeln, Cours und Specials derselben Serie bekommen eine gemeinsame ID,
  // damit die Datenbank sie auf Wunsch zu einer Karte bündeln kann.
  // Welche Beziehungen zählen, steht in `shared/mappings.ts` — der
  // Katalog-Abruf braucht dieselbe Liste.
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
    // Die kleinere ID gewinnt — das ist in aller Regel die erste Staffel.
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }

  for (const media of [...Object.values(byMal), ...Object.values(byAniId)]) {
    if (!media?.id) continue
    parent.set(media.id, parent.get(media.id) ?? media.id)
    for (const edge of media.relations?.edges ?? []) {
      if (!FRANCHISE_RELATIONS.has(edge.relationType)) continue
      if (edge.node?.type !== 'ANIME') continue
      parent.set(edge.node.id, parent.get(edge.node.id) ?? edge.node.id)
      union(media.id, edge.node.id)
    }
  }
  for (const title of titles.values()) title.franchiseId = find(title.id)

  // FSK aus TMDB für alle Titel übernehmen, nicht nur für kuratierte.
  for (const title of titles.values()) {
    const extra = tmdbTitles[title.id]
    if (extra?.fsk !== undefined && title.fsk === undefined) title.fsk = extra.fsk
  }

  // Anbieter von aniSearch dazunehmen. Die decken genau die Lücke, die AniList
  // lässt: alte Katalogtitel, die nur noch als DVD oder bei einem kleinen
  // Dienst zu haben sind.
  for (const title of titles.values()) {
    const extra = anisearch[title.id]
    if (!extra?.streams?.length) continue
    const watchLinks: WatchLink[] = []
    for (const { provider, url: raw } of extra.streams) {
      const url = stripAffiliate(raw)
      const platform = anisearchPlatform(provider)
      if (platform) {
        // Kennt unsere Plattformliste den Dienst, gehört er zu den Streams —
        // aber nur, wenn dort nicht schon ein Link steht.
        if (!title.streams.some((s) => s.platform === platform)) {
          title.streams.push({ platform, url })
        }
        continue
      }
      // Ein Anbieter genügt einmal. Zwei Amazon-Zeilen nebeneinander sind
      // keine Auswahl, sondern Rauschen — aniSearch führt dort oft mehrere
      // Ausgaben desselben Titels.
      const name = providerName(provider)
      // Leerer Name heißt: der Anbieter gehört nicht auf eine deutsche Seite.
      if (!name) continue
      if (!watchLinks.some((w) => w.name === name)) {
        watchLinks.push({ name, url, kind: providerKind(provider) })
      }
    }
    if (watchLinks.length) {
      // Ansehen vor Kaufen — wer ein Abo hat, will nicht erst zur Kasse.
      title.watchLinks = watchLinks.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1))
    }
    title.streams.sort(
      (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
    )
  }

  // Angebote von TMDB (Datenbasis JustWatch) — dieselbe Quelle, aus der auch
  // werstreamt.es schöpft. Bisher behielten wir davon nur die Dienste mit
  // eigener Plattform und warfen Videobuster, maxdome, Sky Store und Apple TV
  // weg. Die Daten waren immer da.
  //
  // Einen Link je Anbieter liefert TMDB nicht, nur eine Übersichtsseite für
  // die Region. Also zeigt jede Zeile den Anbieternamen und führt dorthin —
  // besser als ein erfundener Deeplink, der ins Leere geht.
  for (const title of titles.values()) {
    const info = tmdbTitles[title.id]
    if (!info?.offers?.length || !info.justwatchUrl) continue
    const watchLinks = title.watchLinks ?? []
    for (const offer of info.offers) {
      if (providerToPlatform(offer.name)) continue
      // Denselben Weg über providerName wie die aniSearch-Angebote — sonst
      // stünden „maxdome" und „maxdome Store" als zwei Anbieter nebeneinander.
      const name = providerName(offer.name)
      if (!name) continue
      if (watchLinks.some((w) => w.name === name)) continue
      watchLinks.push({
        name,
        url: info.justwatchUrl,
        kind: offer.kind === 'flatrate' ? 'stream' : 'buy',
      })
    }
    if (watchLinks.length) {
      title.watchLinks = watchLinks.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1))
    }
  }

  // Von Hand gepflegte Bezugswege. Sie stehen vorn: Wer sie einträgt, hat
  // nachgesehen — das schlägt jede automatische Liste.
  for (const entry of loadWatchLinks()) {
    const title = titles.get(entry.anilistId)
    if (!title) {
      warn(`watch-links.yaml: AniList-ID ${entry.anilistId} (${entry.title ?? '?'}) ist unbekannt`)
      continue
    }
    const existing = title.watchLinks ?? []
    const curated = entry.links.filter((l) => !existing.some((e) => e.url === l.url))
    title.watchLinks = [...curated, ...existing].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1,
    )
  }

  for (const title of titles.values()) {
    title.streams.sort(
      (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
    )
  }

  // --- Crunchyroll-Sendeplätze indizieren ------------------------------------
  const crunchyroll = readJson<CrunchyrollData>('data/crunchyroll.json', {
    scrapedAt: '',
    german: {},
    slots: [],
  })
  const crBySeriesId = new Map<string, CrunchyrollEntry>()
  for (const entry of Object.values(crunchyroll.german)) {
    if (entry.seriesId) crBySeriesId.set(entry.seriesId, entry)
  }
  /**
   * AniList-Titel über ihre Crunchyroll-Serien-ID auffindbar machen.
   *
   * Bewusst eine Liste je Serie, kein einzelner Titel: Crunchyroll führt alle
   * Staffeln und Specials einer Reihe unter derselben Serien-ID. Wer hier nur
   * den ersten Treffer behält, ordnet jede Folge willkürlich irgendeiner
   * Staffel zu — so landete „I am a hero too" bei Staffel 6.
   */
  const titlesByCrSeries = new Map<string, Title[]>()
  for (const title of titles.values()) {
    for (const stream of title.streams) {
      const id = stream.platform === 'crunchyroll' ? crunchyrollSeriesId(stream.url) : undefined
      if (!id) continue
      const list = titlesByCrSeries.get(id)
      if (list) {
        if (!list.includes(title)) list.push(title)
      } else {
        titlesByCrSeries.set(id, [title])
      }
    }
  }

  /** AniList-Titel über ihren normalisierten Namen auffindbar machen. */
  const titleByName = new Map<string, Title>()
  for (const title of titles.values()) {
    for (const name of [title.titleRomaji, title.titleEn, title.titleNative]) {
      const key = name ? normalizeTitle(name) : ''
      if (key && !titleByName.has(key)) titleByName.set(key, title)
    }
  }

  /**
   * Einen AniList-Titel zu einem Kalendernamen finden.
   *
   * Crunchyroll setzt im Kalender gern zwei Namen hintereinander — den
   * deutschen und den englischen („Elainas Reise Wandering Witch: The Journey
   * of Elaina") oder die Serie und ihren Untertitel („Fruits Basket (2019)
   * Fruits Basket: The Final Season"). Ein Vergleich auf den ganzen String
   * findet dann nichts. Deshalb wird der Name von vorne verkürzt und der
   * längste Treffer genommen; unter zwei Wörtern wird nicht mehr gesucht,
   * sonst trifft irgendwann jedes „Season 2".
   */
  function titleForCalendarName(name: string): Title | undefined {
    const words = normalizeTitle(name).split(' ').filter(Boolean)
    for (let start = 0; start <= words.length - 2; start++) {
      const hit = titleByName.get(words.slice(start).join(' '))
      if (hit) return hit
    }
    return undefined
  }

  /** Staffelnummer aus einem Namen, sofern er eine nennt. */
  function seasonNumber(name: string | undefined): number | undefined {
    const match = name ? normalizeTitle(name).match(/\bs(\d+)\b/) : null
    return match ? Number(match[1]) : undefined
  }

  /**
   * Aus allen Staffeln einer Crunchyroll-Serie die gemeinte heraussuchen.
   *
   * Der Rückfall auf die Serien-ID greift, wenn der Name nichts findet — bei
   * deutschen Kalendernamen also fast immer. Nennt der Kalender eine
   * Staffelnummer, muss der Titel sie auch tragen: „Meine Wiedergeburt als
   * Schleim … Staffel 4" hing sonst an „Slime Season 3", mitsamt deren
   * Folgenzahl, Cover und Beschreibung. Passt keine, bleibt der Titel lieber
   * leer — eine falsche Zuordnung ist schlechter als keine.
   */
  function titleFromSeries(
    seriesId: string,
    calendarName: string,
    year: number,
  ): Title | undefined {
    const candidates = titlesByCrSeries.get(seriesId) ?? []
    if (!candidates.length) return undefined
    const wanted = seasonNumber(calendarName)
    if (wanted === undefined) return candidates[0]

    const numberOf = (t: Title) => seasonNumber(t.titleEn) ?? seasonNumber(t.titleRomaji)
    const exact = candidates.find((t) => numberOf(t) === wanted)
    if (exact) return exact
    // Die erste Staffel trägt ihre Nummer meist nicht im Titel.
    if (wanted === 1) {
      const plain = candidates.find((t) => numberOf(t) === undefined)
      if (plain) return plain
    }
    // Viele Reihen nummerieren gar nicht, sondern geben jeder Staffel einen
    // eigenen Untertitel („Ascendance of a Bookworm: Adopted Daughter of an
    // Archduke"). Dann entscheidet das Ausstrahlungsjahr — und nur, wenn es
    // genau einen Kandidaten trifft. Bei zweien wäre es wieder geraten.
    const sameYear = candidates.filter((t) => t.jpYear && Math.abs(t.jpYear - year) <= 1)
    return sameYear.length === 1 ? sameYear[0] : undefined
  }

  function findCrunchyroll(entryUrl: string | undefined, name: string): CrunchyrollEntry | undefined {
    const id = crunchyrollSeriesId(entryUrl)
    return (id ? crBySeriesId.get(id) : undefined) ?? crunchyroll.german[normalizeTitle(name)]
  }

  // --- Releases aufbauen ----------------------------------------------------
  const releases: Release[] = []
  const seenSlugs = new Set<string>()
  const usedCrKeys = new Set<string>()
  // Kuratierte Termine, die der Crunchyroll-Kalender nicht bestätigt.
  const unverified: string[] = []

  for (const entry of curated) {
    if (seenSlugs.has(entry.slug)) {
      warn(`Doppelter Slug "${entry.slug}" — zweiter Eintrag ignoriert`)
      continue
    }
    if (!entry.schedule?.firstEpisodeDate) {
      warn(`"${entry.slug}" hat kein firstEpisodeDate — übersprungen`)
      continue
    }
    seenSlugs.add(entry.slug)

    const titleId = entry.anilistId ?? curatedIds[entry.slug]
    const title = titleId ? titles.get(titleId) : undefined
    if (!title) warn(`"${entry.slug}": kein AniList-Titel verknüpft — läuft ohne Metadaten`)

    const info = tmdb[entry.slug]
    const schedule = { ...entry.schedule }
    const releaseYear = Number(entry.schedule.firstEpisodeDate.slice(0, 4))
    if (!schedule.episodeCount && entry.releaseType === 'weekly') {
      // Folgenzahl nur übernehmen, wenn der verknüpfte AniList-Eintrag zeitlich
      // zum deutschen Termin passt — sonst stammt sie aus der falschen Staffel.
      const jpYear = title?.jpYear
      if (title?.episodes && jpYear && Math.abs(jpYear - releaseYear) <= 1) {
        schedule.episodeCount = title.episodes
      } else if (title?.episodes) {
        warn(
          `"${entry.slug}": Folgenzahl von AniList verworfen (Titel von ${jpYear}, Release ${releaseYear})`,
        )
      }
      // Zweiter Versuch bei aniSearch, bevor geraten wird.
      const ausAnisearch = schedule.episodeCount ? undefined : anisearchEpisodes(title?.id)
      if (ausAnisearch) {
        schedule.episodeCount = ausAnisearch.count
        schedule.episodeCountSource = 'anisearch'
        if (ausAnisearch.estimated) schedule.episodeCountAssumed = true
      }
      // Ohne belegte Folgenzahl wird eine Standardstaffel angenommen — das steht
      // als Flag im Datensatz, damit die Oberfläche es nicht als Fakt ausgibt.
      if (!schedule.episodeCount) {
        schedule.episodeCount = 12
        schedule.episodeCountAssumed = true
      }
    }

    const name = entry.titleDe ?? title?.titleEn ?? title?.titleRomaji ?? entry.slug
    const fsk = entry.fsk ?? info?.fsk ?? title?.fsk
    const platformUrl = pickPlatformUrl(entry, title)

    // Angaben aus dem Crunchyroll-Kalender einsetzen. Sie kommen direkt vom
    // Anbieter und schlagen deshalb jede abgeleitete Angabe.
    const sources = [...(entry.sources ?? [])]
    if (entry.platform === 'crunchyroll') {
      const slot = findCrunchyroll(platformUrl, entry.titleDe ?? name)
      if (slot) {
        usedCrKeys.add(normalizeTitle(slot.rawTitle))
        if (!entry.schedule.time) schedule.time = slot.time

        // Der wichtigste Teil: Die deutsche Synchro startet oft Wochen NACH
        // dem Simulcast. Die kuratierten Daten stammen aus Saisonübersichten
        // und nennen nur den Simulcast-Start — real gemessen bis zu drei
        // Wochen zu früh (08.08.2026 vom Nutzer gemeldet: „Though I Am an
        // Inept Villainess" stand auf dem 12.07., Folge 1 lief am 02.08.).
        // Ist der Termin nur abgeleitet, gewinnt der beobachtete Sendeplan.
        const observed = derivedStart(slot)
        if (observed && entry.schedule.estimated) {
          schedule.firstEpisodeDate = observed.date
          schedule.estimated = observed.assumed
          if (!observed.assumed) delete schedule.estimated
        }
        // Gesehene Einzeltermine gewinnen gegen jede Hochrechnung.
        const seen = observedEpisodes(slot)
        if (Object.keys(seen).length) schedule.observed = seen
        sources.push(CR_CALENDAR_URL)
      } else if (entry.schedule.estimated && crunchyroll.window && overlapsWindow(schedule, crunchyroll.window)) {
        // Die Serie müsste im abgesuchten Zeitraum laufen, und der Kalender
        // führt dort keine deutsche Folge. Dann gibt es die Synchro nicht —
        // ein erfundener Sendeplan wäre schlimmer als gar keiner.
        warn(
          `"${entry.slug}": kein deutscher Eintrag bei Crunchyroll im Zeitraum ` +
            `${crunchyroll.window.from}…${crunchyroll.window.to} (Start ${schedule.firstEpisodeDate}) — verworfen`,
        )
        unverified.push(entry.slug)
        continue
      }
    }

    if (title && fsk !== undefined && title.fsk === undefined) title.fsk = fsk
    if (title && entry.titleDe && !title.titleDe) title.titleDe = werkTitel(entry.titleDe)

    releases.push({
      slug: entry.slug,
      titleId: titleId ?? -1,
      name,
      platform: entry.platform,
      platformUrl,
      buyUrl:
        entry.buyUrl ?? (entry.releaseType === 'disc' ? amazonSearchUrl(name) : undefined),
      releaseType: entry.releaseType,
      fsk,
      publisher: entry.publisher,
      edition: entry.edition,
      note: entry.note,
      disputedDates: entry.disputedDates,
      schedule,
      year: releaseYear,
      sources: [...new Set(sources)],
    })
  }

  // --- Automatisch ergänzte Crunchyroll-Simuldubs ----------------------------
  // Alles, was der Kalender von Crunchyroll als „(Deutsch)" führt und noch
  // nicht kuratiert ist, wird selbsttätig aufgenommen. Der Staffelstart wird
  // aus der frühesten gesehenen Folgennummer zurückgerechnet.
  let autoAdded = 0
  for (const [key, slot] of Object.entries(crunchyroll.german)) {
    if (usedCrKeys.has(key)) continue
    if (!slot.earliest?.date) continue

    const name = slot.rawTitle.replace(/\s*\(Deutsch\)\s*$/i, '').trim()
    // Erst über den vollen Namen, dann über die Serien-ID.
    //
    // Der Kalender nennt bei Specials die Serie UND den Untertitel — „My Hero
    // Academia I am a hero too". Dafür gibt es bei AniList einen eigenen
    // Eintrag, und der normalisierte Name trifft ihn genau. Die Serien-ID
    // dagegen zeigt bei Crunchyroll für alle Staffeln und Specials auf
    // dieselbe Serie; welcher AniList-Titel dahinter landete, entschied die
    // Reihenfolge in der Map. So wurde aus dem Special die sechste Staffel.
    const title =
      titleForCalendarName(name) ??
      (slot.seriesId
        ? titleFromSeries(slot.seriesId, name, Number(slot.earliest.date.slice(0, 4)))
        : undefined)
    const slug = `cr-${slot.seriesId ?? slugify(key)}`
    if (seenSlugs.has(slug)) continue
    seenSlugs.add(slug)

    /**
     * Der deutsche Name, den Crunchyroll selbst verwendet, gehört an den Titel.
     *
     * Er war die ganze Zeit da — als Name des Releases — aber nicht am Anime,
     * und deshalb nicht durchsuchbar: Eine Suche nach „Meine Wiedergeburt als
     * Schleim" fand nichts, obwohl der Kalender genau diesen Namen anzeigt
     * (aufgefallen 12.08.2026 beim Bau der Suche). Nur 84 von 2.753 Titeln
     * hatten überhaupt einen deutschen Namen, und alle aus Handarbeit.
     *
     * Bedingung: Es darf noch keiner da sein — Handarbeit gewinnt — und der
     * Name muss sich vom englischen unterscheiden, sonst behaupten wir eine
     * Übersetzung, wo Crunchyroll nur den Originaltitel führt.
     */
    if (title && !title.titleDe) {
      const werk = werkTitel(name)
      if (werk && normalizeTitle(werk) !== normalizeTitle(title.titleEn ?? '') && normalizeTitle(werk) !== normalizeTitle(title.titleRomaji ?? '')) {
        title.titleDe = werk
      }
    }

    // Ein einziger Termin ist kein Beleg für einen Wochentakt.
    //
    // Im selben Kalender stehen Specials, Filmpremieren und die Anime Awards.
    // Sie sehen dort aus wie eine Serienfolge; der einzige Unterschied ist,
    // dass es bei ihnen bei einem Termin bleibt. Ohne diese Unterscheidung
    // wurde aus jedem davon eine Reihe von mindestens zwölf Folgen, und der
    // Kalender behauptete Woche für Woche eine Folge, die es nicht gibt.
    // Genau so kam „I am a hero too" zu elf erfundenen Terminen.
    //
    // Der eine Termin allein reicht als Merkmal aber nicht: Eine Serie, die
    // gerade erst anläuft, hat im Kalenderfenster ebenfalls nur einen. Deshalb
    // zählt zusätzlich, was AniList über die Folgenzahl sagt — steht dort eine
    // belegte Zahl über eins, ist es eine Reihe, egal wie viele Termine das
    // Fenster gerade zeigt.
    const seenDates = [...new Set(slot.dates ?? [])]
    const knownEpisodes =
      title?.episodes && title.jpYear
        ? Math.abs(title.jpYear - Number(slot.earliest.date.slice(0, 4))) <= 1
          ? title.episodes
          : undefined
        : undefined
    if (seenDates.length < 2 && (knownEpisodes ?? 1) === 1) {
      const date = slot.earliest.date
      releases.push({
        slug,
        titleId: title?.id ?? -1,
        name,
        platform: 'crunchyroll',
        platformUrl: slot.seriesUrl,
        releaseType: 'batch',
        fsk: title?.fsk,
        note: 'Crunchyroll führt dazu bisher genau einen deutschen Termin.',
        schedule: { firstEpisodeDate: date, time: slot.time, episodeCount: 1 },
        year: Number(date.slice(0, 4)),
        sources: [CR_CALENDAR_URL],
      })
      autoAdded++
      continue
    }

    const derived = derivedStart(slot)
    if (!derived) continue
    const firstEpisodeDate = derived.date
    const releaseYear = Number(firstEpisodeDate.slice(0, 4))

    let episodeCount = title?.episodes
    let episodeCountAssumed = false
    let episodeCountSource: 'anisearch' | undefined
    if (!episodeCount || !title?.jpYear || Math.abs(title.jpYear - releaseYear) > 1) {
      // Die Reihe läuft, aber wie lang sie wird, sagt der Kalender nicht.
      // aniSearch pflegt die Zahl — sonst bleibt zwölf als übliche Cour-Länge.
      // Die Untergrenze ist in beiden Fällen das, was tatsächlich gesehen
      // wurde: sonst fielen belegte Termine hinten heraus.
      const mindestens = (slot.earliest.episode ?? 1) + seenDates.length
      const ausAnisearch = anisearchEpisodes(title?.id)
      episodeCount = Math.max(ausAnisearch?.count ?? 12, mindestens)
      // Nicht mehr geraten, sobald aniSearch die Zahl bestätigt — und sie
      // durch die Untergrenze nicht nach oben korrigiert werden musste.
      episodeCountAssumed =
        !ausAnisearch || ausAnisearch.estimated || episodeCount !== ausAnisearch.count
      if (ausAnisearch && episodeCount === ausAnisearch.count) episodeCountSource = 'anisearch'
    }

    releases.push({
      slug,
      titleId: title?.id ?? -1,
      name,
      platform: 'crunchyroll',
      platformUrl: slot.seriesUrl,
      releaseType: 'weekly',
      fsk: title?.fsk,
      schedule: {
        firstEpisodeDate,
        time: slot.time,
        episodeCount,
        episodeCountAssumed,
        episodeCountSource,
        // Uhrzeit und Wochentag sind belegt; nur der zurückgerechnete Start
        // bleibt eine Annahme, solange die Wochentaktung nicht bestätigt ist.
        estimated: derived.assumed,
        observed: observedEpisodes(slot),
      },
      year: releaseYear,
      sources: [CR_CALENDAR_URL],
    })
    autoAdded++
  }
  log(`${autoAdded} Simuldubs automatisch aus dem Crunchyroll-Kalender ergänzt`)
  if (unverified.length) log(`${unverified.length} kuratierte Termine verworfen (unbestätigt): ${unverified.join(', ')}`)

  // Abgeleitete Termine, für die es keine maschinelle Gegenprüfung gibt.
  //
  // Für Crunchyroll und ADN lesen wir den Kalender und können eine behauptete
  // Synchro widerlegen. Für Netflix, Prime Video und Disney+ gibt es diese
  // Möglichkeit nicht — dort bleibt ein `estimated: true` für immer stehen, und
  // niemand merkt, wenn die angekündigte Fassung nie erscheint. Genau so kam
  // „Mushoku Tensei Staffel 3" in den Kalender (10.08.2026): Die Quelle war
  // eine Simulcast-Übersicht, und ein Simulcast sagt nur, wann eine Folge
  // zeitgleich mit Japan läuft — nicht, ob sie deutsch vertont ist.
  const ungeprueft = releases.filter(
    (r) => r.schedule.estimated && !['crunchyroll', 'adn'].includes(r.platform),
  )
  if (ungeprueft.length) {
    warn(
      `${ungeprueft.length} abgeleitete Termine ohne Gegenprüfung (Plattform hat keinen Kalender, den wir lesen) — ` +
        `von Hand belegen oder streichen: ${ungeprueft.map((r) => r.slug).join(', ')}`,
    )
  }

  // --- Automatisch ergänzte ADN-Titel ---------------------------------------
  // ADN nennt in seiner Schnittstelle je Folge die Sprachfassung. Was dort als
  // `vde` steht, ist eine belegte deutsche Synchro mit belegter Uhrzeit — hier
  // muss nichts abgeleitet werden. Kuratierte Einträge haben Vorrang: Wer eine
  // ADN-Adresse von Hand gepflegt hat, will keinen zweiten Eintrag daneben.
  const leer: AdnData = { scrapedAt: '', window: { from: '', to: '' }, shows: [] }
  const adnKalender = readJson<AdnData>('data/adn.json', leer)
  // Der Katalog-Lauf (`data:adn -- --catalog`) findet Serien, die vollständig
  // im Angebot liegen und deshalb in keinem Kalenderfenster mehr auftauchen.
  // Er läuft selten; fehlt die Datei, ändert sich nichts.
  const adnKatalog = readJson<AdnData>('data/adn-catalog.json', leer)
  const adn: AdnData = {
    ...adnKalender,
    shows: [
      ...adnKalender.shows,
      // Der Kalender ist die frischere Quelle — was dort schon steht, gewinnt.
      ...adnKatalog.shows.filter((k) => !adnKalender.shows.some((s) => s.showId === k.showId)),
    ],
  }
  const curatedAdnShows = new Set(
    releases
      .filter((r) => r.platform === 'adn')
      .map((r) => normalizeTitle(r.name)),
  )
  let adnAdded = 0
  let adnBloecke = 0
  for (const show of adn.shows) {
    if (!show.episodes.length) continue
    if (curatedAdnShows.has(normalizeTitle(show.title))) continue

    // Die im Katalog-Lauf nachgeschlagene Kennung zuerst — sie trifft auch,
    // wo der Namensabgleich an Schreibweisen scheitert.
    const serienTitel =
      (show.anilistId ? titles.get(show.anilistId) : undefined) ??
      titleByName.get(normalizeTitle(show.title)) ??
      titleByName.get(normalizeTitle(show.originalTitle ?? ''))
    // Aus dem Katalogdurchlauf nur, was sich einem Anime zuordnen lässt: Der
    // Katalog führt den französischen Bestand, und ohne Zuordnung bliebe der
    // französische Name stehen, dazu ohne Cover, Genres und Beschreibung.
    // Beim Kalender-Weg ist der Name belegt, dort bleibt der Eintrag auch ohne
    // Treffer.
    if (!serienTitel && show.fromCatalog) continue

    /**
     * Eine ADN-Serienkennung ist ein Franchise, keine Staffel.
     *
     * Bis zum 12.08.2026 wurde je Serie **ein** Release gebaut. Für „Sword Art
     * Online" hieß das: ein Eintrag mit 96 Folgen, deren Nummern zweimal bei 1
     * neu anfangen, unter dem Namen der ersten Staffel — und, weil zwei
     * Abwurftermine nicht als Komplettabwurf erkannt wurden, mit 96
     * Wochenterminen bis 2027. Neun der 37 ADN-Serien führen mehrere Staffeln
     * unter einer Kennung.
     */
    const bloecke = staffelBloecke(show)
    const staffeln = serienTitel?.franchiseId
      ? staffelnDesFranchise(titles.values(), serienTitel.franchiseId)
      : []
    const zuordnungen = ordneBloeckeZuStaffeln(bloecke, staffeln)
    adnBloecke += bloecke.length
    // Nur wenn es bei einem einzigen Block bleibt, behält das Release seinen
    // alten Slug — geteilte Links und Merklisten sollen nicht ins Leere laufen.
    const einBlock = bloecke.length === 1
    /**
     * Kein Anime zweimal in derselben ADN-Serie.
     *
     * Ohne diese Sperre landete „Sailor Moon" doppelt im Datensatz: Staffel 1
     * mit 46 Folgen und Staffel 2 mit 42, beide auf AniList 530 gezeigt, weil
     * der Rückfall auf den Serientitel keine Rücksicht darauf nahm, dass der
     * längst vergeben war. Ein Titel mit zwei widersprüchlichen Folgenzahlen
     * ist schlimmer als ein fehlender Eintrag.
     */
    const belegteTitel = new Set<number>()

    for (const { block, teile, unscharf } of zuordnungen) {
      // Ohne aufgehende Rechnung deckt der Block genau einen Titel ab: den der
      // Serie. Lieber eine gröbere Zuordnung als eine falsche.
      const abschnitte = teile.length
        ? teile
        : [{ title: serienTitel, adnVon: block.nummern[0] ?? 1, adnBis: block.nummern.at(-1) ?? block.episodes.length }]

      for (const abschnitt of abschnitte) {
        const title = abschnitt.title
        if (title && belegteTitel.has(title.id)) {
          warn(
            `ADN ${show.showId} (${show.title}): Staffel ${block.season ?? '?'} mit ${block.episodes.length} Folgen ` +
              `lässt sich keiner eigenen AniList-Staffel zuordnen — übersprungen, statt "${title.titleRomaji ?? title.id}" doppelt zu führen.`,
          )
          continue
        }
        if (title) belegteTitel.add(title.id)
        const slug = adnSlug(show.showId, block, teile.length > 1 ? title?.id : undefined, einBlock)
        if (seenSlugs.has(slug)) continue
        seenSlugs.add(slug)

        // Der Ton ist deutsch — der Name von ADN oft nicht. „One Piece Film 3 •
        // Le Royaume de Chopper" heißt hier „One Piece – Chopper auf der Insel
        // der seltsamen Tiere". Für Katalogtitel gewinnt deshalb der
        // Anime-Eintrag; er nennt außerdem die Staffel beim Namen, während ADN
        // nur „3" schreibt.
        const anzeigename =
          (show.fromCatalog || teile.length) && title
            ? (title.titleDe ?? title.titleEn ?? title.titleRomaji ?? show.title)
            : adnBlockName(show.title, block, bloecke.length)

        const folgen = block.episodes.filter(
          (e) => !teile.length || ((e.episode ?? 0) >= abschnitt.adnVon && (e.episode ?? 0) <= abschnitt.adnBis),
        )
        if (!folgen.length) continue
        const first = folgen[0]
        const letzte = folgen.at(-1)!
        const anzahl = new Set(folgen.map((e) => e.episode ?? e.url)).size

        releases.push({
          slug,
          titleId: title?.id ?? -1,
          name: anzeigename,
          platform: 'adn',
          platformUrl: first.url,
          releaseType: block.rhythm === 'weekly' ? 'weekly' : 'batch',
          /**
           * Was das Datum bedeutet — und was es ausdrücklich nicht bedeutet.
           *
           * Bei einem Wochentakt ist der Termin der Sendeplan, also die
           * Erstveröffentlichung. Bei einem Komplettabwurf weiß ADN nur, wann
           * der Titel ins Angebot kam: „Sword Art Online" am 11.06.2025,
           * obwohl es die deutsche Fassung seit 2013 gibt. „Im Angebot seit"
           * ist in beiden Fällen wahr, „erschienen am" wäre geraten.
           */
          dateMeaning: block.rhythm === 'weekly' ? undefined : 'available-from',
          fsk: title?.fsk ?? fskFromAdnAge(show.age),
          note: adnHinweis(block, abschnitt, teile.length, anzahl, title, unscharf),
          schedule: {
            firstEpisodeDate: first.date,
            time: first.time,
            episodeCount: anzahl,
            lastEpisodeDate: letzte.date,
          },
          year: Number(first.date.slice(0, 4)),
          sources: [ADN_CALENDAR_URL],
        })
        adnAdded++
      }
    }
  }
  if (adn.shows.length)
    log(
      `${adnAdded} ADN-Releases aus ${adnBloecke} Staffelblöcken ergänzt (${adn.shows.length} Serien gefunden)`,
    )

  // --- Termine aus den Nachrichtenquellen ------------------------------------
  // Der letzte Schritt vor der Auswertung, und mit Absicht der letzte: Was aus
  // `data/curated/`, Crunchyroll oder ADN schon da ist, gewinnt gegen den Bot.
  const rohVorschlaege = readJson<{ proposals?: Vorschlag[] }>('data/proposals/anime2you.json', {})
  const ausMeldungen = releasesAus(
    rohVorschlaege.proposals ?? [],
    [...titles.values()],
    releases,
    todayIso(),
  )
  releases.push(...ausMeldungen)
  if (ausMeldungen.length)
    log(
      `${ausMeldungen.length} Termine automatisch aus Anime2You übernommen: ` +
        ausMeldungen.map((r) => `${r.name} (${r.platform}, ${r.schedule.firstEpisodeDate})`).join(', '),
    )

  quellenPflegen(releases)

  // --- Synchro-Verfügbarkeit je Plattform ------------------------------------
  // Ein Stream-Link allein sagt nichts über die Sprache. Belegt ist die Synchro
  // nur dort, wo sie tatsächlich nachgewiesen wurde.
  const dubByTitle = new Map<number, Set<PlatformId>>()
  for (const release of releases) {
    if (release.titleId < 0) continue
    const set = dubByTitle.get(release.titleId) ?? new Set<PlatformId>()
    set.add(release.platform)
    dubByTitle.set(release.titleId, set)
  }
  for (const title of titles.values()) {
    const confirmed = dubByTitle.get(title.id)
    for (const stream of title.streams) {
      if (confirmed?.has(stream.platform)) {
        stream.dub = true
        continue
      }
      if (stream.platform === 'crunchyroll') {
        const id = crunchyrollSeriesId(stream.url)
        // Nur ein Treffer beweist etwas. Ein Fehlen beweist nichts: Der
        // Simulcast-Kalender führt ausschließlich laufende Staffeln, nicht den
        // gesamten Katalog. „Nicht gefunden" bleibt deshalb „ungeprüft".
        if (id && crBySeriesId.has(id)) stream.dub = true
      }
    }
  }

  /**
   * Was ein Mensch nachgesehen hat, schlägt jede Ableitung.
   *
   * Für YouTube, Netflix, Prime Video, RTL+ und Joyn gibt es keine Quelle, die
   * die Tonspur nennt — 3.021 Verweise standen deshalb dauerhaft auf „🇩🇪 ?".
   * `data/dub-confirmed.yaml` löst das auf dem einzigen Weg, der zum
   * Projektgrundsatz passt: durch tatsächliches Nachsehen. Ein Eintrag dort ist
   * ein Beleg, kein Vorschlag, und gilt deshalb auch gegen ein automatisch
   * gesetztes `true`.
   */
  let geprueft = 0
  let entfernt = 0
  const checks = new Map(loadDubChecks().map((c) => [dubKey(c.anilistId, c.platform), c]))
  for (const title of titles.values()) {
    /**
     * Tote Verweise verschwinden, statt ein „✕" zu bekommen.
     *
     * Sechs von zehn Verweisen aus dem ersten Prüfdurchgang waren nicht
     * „vorhanden, aber nur untertitelt", sondern schlicht weg: „Videos nicht
     * verfügbar" oder eine Weiterleitung auf die Startseite. Ein „🇩🇪 ✕"
     * behauptete dort ein Angebot ohne deutsche Fassung — also etwas, das es
     * gar nicht gibt.
     */
    title.streams = title.streams.filter((stream) => {
      const check = checks.get(dubKey(title.id, stream.platform))
      if (check?.available === false) {
        entfernt++
        return false
      }
      if (check && typeof check.dub === 'boolean') {
        stream.dub = check.dub
        geprueft++
      }
      return true
    })
  }
  if (checks.size) {
    log(`${geprueft} geprüfte Synchro-Angaben übernommen, ${entfernt} tote Verweise entfernt (${checks.size} Prüfungen)`)
  }

  /**
   * Was auf Crunchyrolls Serienseiten steht — als Beleg, nicht als Vorbild.
   *
   * Der Scraper liest dort je Folge, ob eine deutsche Tonspur vorliegt.
   * Übernommen wird ausschließlich diese Auskunft; Crunchyrolls
   * Staffeleinteilung bleibt draußen. Sie enthält Folgendoppelungen, mehrfache
   * Wähler-Einträge zur selben Staffel und Blöcke, die zwei unserer Staffeln
   * zusammenfassen (Daniel, 12.08.2026). Unsere Einteilung kommt von AniList
   * und bleibt maßgeblich.
   *
   * Handgeprüftes schlägt auch das: Der Block läuft **vor** dem Einlesen von
   * `dub-confirmed.yaml`, damit ein Mensch das letzte Wort behält.
   */
  const crDub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
  if (crDub.serien.length) {
    const nachUrl = new Map<string, Title[]>()
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'crunchyroll') continue
        const liste = nachUrl.get(stream.url) ?? []
        liste.push(title)
        nachUrl.set(stream.url, liste)
      }
    }
    let belegt = 0
    for (const serie of crDub.serien) {
      for (const urteil of beurteile(serie, nachUrl.get(serie.url) ?? [])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll' && s.url === serie.url)
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        belegt++
      }
    }
    log(`${belegt} Synchro-Angaben aus den Crunchyroll-Serienseiten belegt (${crDub.serien.length} Seiten gelesen)`)
  }

  /**
   * Adressen vermerken, die mehrere unserer Einträge bedienen.
   *
   * Anlass (Daniel, 12.08.2026): Bei „The Café Terrace and Its Goddesses"
   * zeigten unsere Staffel 1 und Staffel 2 auf **dieselbe** Crunchyroll-Seite —
   * und dort steht das Ganze als *eine* Staffel mit 24 Folgen. Dasselbe bei
   * „The Case Study of Vanitas". Wer bei uns „Staffel 2" anklickt und dort 24
   * Folgen vorfindet, hält eine der beiden Angaben für falsch; tatsächlich
   * zählen bloß beide anders.
   *
   * Was hier belegt wird, ist genau das und nicht mehr: **wie viele unserer
   * Einträge dieselbe Adresse teilen.** Wie die Plattform ihrerseits in
   * Staffeln einteilt, wissen wir nicht — dafür müsste man die Serienseite
   * abrufen, die ihre Staffelliste per JavaScript nachlädt. Der Hinweis in der
   * Oberfläche sagt deshalb „kann abweichen", nicht „weicht ab".
   */
  const proAdresse = new Map<string, number>()
  for (const title of titles.values()) {
    for (const stream of title.streams) proAdresse.set(`${stream.platform}|${stream.url}`, (proAdresse.get(`${stream.platform}|${stream.url}`) ?? 0) + 1)
  }
  let geteilt = 0
  for (const title of titles.values()) {
    for (const stream of title.streams) {
      const anzahl = proAdresse.get(`${stream.platform}|${stream.url}`) ?? 1
      if (anzahl > 1) {
        stream.sharedWith = anzahl
        geteilt++
      }
    }
  }
  log(`${geteilt} Verweise teilen sich eine Adresse mit anderen Einträgen`)

  /**
   * „Season" kommt nicht auf die Seite — auch nicht über einen Release-Namen.
   *
   * Die Namen stammen aus dem Crunchyroll-Kalender und aus AniList und tragen
   * dort „Season 2", „2nd Season", „Final Season". Im Detail-Panel stand das
   * dann neben dem deutschen „Staffel 4" — dasselbe Wort zweimal, in zwei
   * Sprachen, in einem Blickfeld (Daniel, 12.08.2026).
   *
   * Umgestellt wird hier und nicht in der Oberfläche, weil dieselben Namen in
   * die ICS-Feeds und die Teilen-Seiten wandern. Ersetzt wird nur die
   * Staffelmarkierung; der übrige Titel ist ein Eigenname.
   *
   * **Vor** dem Ausrollen der Termine — die kopieren den Namen. Stand die
   * Umstellung dahinter, war sie in `releases.json` erledigt und in
   * `events.json` nicht, und der Kalender zeigte weiter „The 100 Girlfriends …
   * Season 3" (bemerkt bei der Sichtprüfung im Browser, 12.08.2026).
   */
  for (const release of releases) release.name = eindeutschenStaffel(release.name)

  // --- Termine ausrollen ----------------------------------------------------
  const events: ReleaseEvent[] = releases
    .flatMap(expandEvents)
    .sort((a, b) => (a.date === b.date ? (a.time ?? '99') .localeCompare(b.time ?? '99') : a.date.localeCompare(b.date)))

  /**
   * Gegenprobe, bevor irgendetwas geschrieben wird.
   *
   * Sie steht hier und nicht in `validate.ts`, weil dort nur die kuratierten
   * Dateien geprüft werden — also ausgerechnet der Teil, den ohnehin ein Mensch
   * durchdacht hat. Der Fehler vom 12.08.2026 (196 erfundene Termine) entstand
   * vollständig in diesem Skript und wäre dort nie aufgefallen.
   *
   * Ein Widerspruch bricht den Lauf ab. Das kostet im schlimmsten Fall eine
   * Nacht ohne frische Daten — ein Kalender, der eine Folge ankündigt, die es
   * nicht gibt, kostet das Vertrauen in jeden anderen Termin.
   */
  const pruefung = pruefeErgebnis(releases, events, titles, todayIso())
  for (const w of pruefung.warnungen) warn(w)
  if (pruefung.fehler.length) {
    for (const f of pruefung.fehler) console.error('  ✖', f)
    console.error(`\n${pruefung.fehler.length} Widersprüche im erzeugten Datensatz — nichts geschrieben.`)
    process.exit(1)
  }

  /**
   * Titel, deren japanische Ausstrahlung noch gar nicht begonnen hat, gehören
   * hinter den Toggle „Anime ohne deutsche Synchro".
   *
   * Daniels Begründung ist zwingend (15.08.2026): „wenn nichtmal jap release,
   * dann logischerweise kein de release." Eine deutsche Synchro entsteht aus
   * einer japanischen Fassung; gibt es die noch nicht, kann es die Synchro auch
   * nicht geben. Was MyDubList dazu führt, ist dann eine **Ankündigung**, und
   * die im selben Topf mit erschienenen Synchros zu führen macht aus einer
   * Ankündigung eine Tatsache.
   *
   * Der Filter ist bewusst grob — das ist er auch in Daniels Auswahl gewesen.
   * Die schärfere Regel („mindestens eine Folge auf Deutsch erschienen") setzt
   * eine verlässliche Synchro-Erkennung voraus, und die ist es gerade nicht:
   * Crunchyroll zeigt Gästen weniger als Angemeldeten, siehe CLAUDE.md. Eine
   * scharfe Regel auf unscharfen Daten würde Titel verstecken, die längst
   * synchronisiert sind.
   *
   * Verloren geht dabei nichts: Die Titel stehen weiter in `ohne-synchro.json`,
   * sind über den Toggle auffindbar, lassen sich merken, und der Newsletter
   * meldet sich, sobald eine Synchro belegt ist.
   */
  // Welche Titel haben deutsche Sprechrollen? Nur der Merker wandert in den
  // Datensatz — die Rollen selbst holt die Oberfläche beim Aufklappen aus
  // `public/data/voices/<id>.json`. Das Verzeichnis füllt `data:voices`, das
  // vor diesem Lauf gelaufen sein muss; fehlt es, bleibt der Merker aus und
  // die Oberfläche zeigt den Bereich schlicht nicht an.
  const mitStimmen = new Set<number>()
  if (existsSync(VOICES_DIR)) {
    for (const datei of readdirSync(VOICES_DIR)) {
      if (!datei.endsWith('.json')) continue
      try {
        const inhalt = JSON.parse(readFileSync(`${VOICES_DIR}/${datei}`, 'utf8')) as {
          roles?: unknown[]
        }
        if (inhalt.roles?.length) mitStimmen.add(Number(datei.replace('.json', '')))
      } catch {
        // Kaputte Datei überspringen — der nächste Sprecher-Lauf schreibt sie neu.
      }
    }
  }

  const mitRelease = new Set(releases.map((r) => r.titleId))
  const heuteIso = todayIso()
  let nochNichtGelaufen = 0
  for (const id of [...titles.keys()]) {
    if (mitRelease.has(id)) continue
    /**
     * Deutsche Sprechrollen schlagen jede Ableitung.
     *
     * Ein deutscher Sprecher zu einer Rolle belegt, dass eine deutsche Fassung
     * **existiert** — das ist kein Indiz, sondern eine Auskunft. Sie gilt auch
     * gegen ein japanisches Startdatum in der Zukunft: AniList führt für
     * Vorabveröffentlichungen und Kinofassungen mitunter beides.
     */
    if (mitStimmen.has(id)) continue
    // Ohne bekanntes Startdatum wird nichts entfernt — Unwissen ist kein Beleg.
    const start = jpStart.get(id)
    if (!start || start <= heuteIso) continue
    titles.delete(id)
    nochNichtGelaufen++
  }
  if (nochNichtGelaufen)
    log(`${nochNichtGelaufen} Titel hinter den Toggle verschoben: japanische Ausstrahlung steht noch aus`)

  // --- Meta -----------------------------------------------------------------
  const allTitles = [...titles.values()]
  const genres = [...new Set(allTitles.flatMap((t) => t.genres))].sort((a, b) => a.localeCompare(b, 'de'))
  const keywords = [...new Set(allTitles.flatMap((t) => t.keywords))].sort((a, b) => a.localeCompare(b, 'de'))
  const platforms = [...new Set(releases.map((r) => r.platform))] as PlatformId[]
  const years = [...new Set(releases.map((r) => r.year))].sort((a, b) => b - a)

  // Bezugsquellen jenseits der neun bekannten Plattformen — maxdome, Apple TV,
  // Videobuster und die Prime-Video-Kanäle. Nach Häufigkeit sortiert, nicht
  // alphabetisch: Wer nach einem Anbieter filtert, sucht zuerst die großen, und
  // eine Liste von 42 Einträgen liest niemand von A bis Z durch.
  const providerCount = new Map<string, number>()
  for (const t of allTitles) {
    for (const w of t.watchLinks ?? []) providerCount.set(w.name, (providerCount.get(w.name) ?? 0) + 1)
  }
  const providers = [...providerCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([name]) => name)

  const meta: DataMeta = {
    generatedAt: new Date().toISOString(),
    titleCount: allTitles.length,
    releaseCount: releases.length,
    eventCount: events.length,
    genres,
    keywords,
    platforms,
    providers,
    years,
    attribution: [
      'Dub-Daten: MyDubList (https://mydublist.com) — CC BY 4.0',
      'Metadaten: AniList (https://anilist.co)',
      'FSK & Anbieter: TMDB (https://www.themoviedb.org), Anbieterdaten von JustWatch',
      'Deutsche Inhaltsangaben & Bezugsquellen: aniSearch (https://www.anisearch.de)',
      'ID-Zuordnung: anime-offline-database (https://github.com/manami-project/anime-offline-database) — ODbL v1.0',
      'Termine: aniSearch, Anime2You — siehe Quellenangabe je Eintrag',
    ],
  }

  // --- Schreiben ------------------------------------------------------------
  // Synopsen liegen getrennt, damit die Startseite nicht Megabytes laden muss.
  //
  // Drei Quellen, in dieser Reihenfolge: aniSearch schreibt redaktionelle
  // deutsche Texte, TMDB oft nur einen übersetzten Stummel, AniList gar kein
  // Deutsch. Vorher gewann TMDB — und bei „You and I Are Polar Opposites
  // Staffel 2" stand deshalb „The second season of …" auf der Seite, obwohl es
  // eine ausführliche deutsche Inhaltsangabe gibt.
  /** Handlung je Titel, mit belegter Herkunft der deutschen Fassung. */
  interface SynopsisEintrag {
    de?: string
    en?: string
    deSource?: { name: string; url: string }
  }
  const synopses: Record<number, SynopsisEintrag> = {}


  /**
   * Die Quelle aus dem Beschreibungstext herauslösen.
   *
   * aniSearch hängt sie an den Text an: „… hinterher.\n\nQuelle:
   * www.anisearch.de/anime/1572". Das stand bei 2.385 von 2.683 deutschen
   * Beschreibungen mitten im Fließtext — und darunter dann noch einmal unsere
   * eigene, anders gestaltete Quellenzeile, die obendrein „themoviedb.org"
   * behauptete, obwohl der Text von aniSearch kam (Daniel, 12.08.2026).
   *
   * Herausgelöst wird sie hier, einmal beim Bauen, statt in der Oberfläche bei
   * jedem Öffnen eines Panels.
   */
  function trenneQuelle(text: string): { text: string; url?: string } {
    const treffer = /\n+\s*Quelle:\s*(\S+)\s*$/.exec(text)
    if (!treffer) return { text: text.trim() }
    const roh = treffer[1]
    return {
      text: text.slice(0, treffer.index).trim(),
      url: roh.startsWith('http') ? roh : `https://${roh}`,
    }
  }

  const slim = allTitles.map((t) => {
    const ausAnisearch = anisearch[t.id]?.descriptionDe
    const ausTmdb = tmdbTitles[t.id]
    if (t.synopsis || ausAnisearch || ausTmdb?.overviewDe) {
      const eintrag: SynopsisEintrag = { en: t.synopsis }
      if (ausAnisearch) {
        const { text, url } = trenneQuelle(ausAnisearch)
        eintrag.de = text
        eintrag.deSource = { name: 'anisearch.de', url: url ?? `https://www.anisearch.de/anime/` }
      } else if (ausTmdb?.overviewDe) {
        eintrag.de = ausTmdb.overviewDe
        eintrag.deSource = {
          name: 'themoviedb.org',
          url: ausTmdb.tmdbId
            ? `https://www.themoviedb.org/${ausTmdb.kind === 'movie' ? 'movie' : 'tv'}/${ausTmdb.tmdbId}`
            : 'https://www.themoviedb.org/',
        }
      }
      synopses[t.id] = eintrag
    }
    const { synopsis: _drop, ...rest } = t
    return mitStimmen.has(t.id) ? { ...rest, hasVoices: true } : rest
  })

  // Der Kalender braucht nur die Titel, zu denen es einen Termin gibt. Die
  // vollständige Liste (mehrere Megabyte) lädt erst die Datenbank-Ansicht nach.
  const referenced = new Set(releases.map((r) => r.titleId))
  writeJson(`${OUT}/titles-core.json`, slim.filter((t) => referenced.has(t.id)))
  writeJson(`${OUT}/titles.json`, slim)
  // Kennung → Reihe: das Erste sortiert die schon gepflegten Titel aus, das
  // Zweite hält Reihen zusammen, die über die Grenze der beiden Bestände gehen.
  schreibeOhneSynchro(new Map(slim.map((t) => [t.id, t.franchiseId ?? t.id])))
  schreibeNeuMitSynchro(slim, releases)
  // Synopsen in Gruppen statt in einer Datei.
  //
  // Vorher lag alles in `synopses.json`: 3,8 MB, die beim ersten Öffnen eines
  // Detail-Panels über die Leitung gingen — für **eine** Beschreibung wurden
  // 2.753 geladen. Bei 32 Gruppen sind es rund 120 KB, und die Gruppe deckt
  // beim Durchklickeln oft gleich mehrere weitere Titel mit ab.
  //
  // Die Gruppe ergibt sich aus der AniList-ID, nicht aus einer laufenden
  // Nummer: So bleibt sie über Datenläufe hinweg dieselbe, und ein gecachter
  // Abruf verfällt nicht, nur weil ein Titel dazukam.
  const gruppen = new Map<number, Record<number, { de?: string; en?: string }>>()
  for (const [id, wert] of Object.entries(synopses)) {
    const gruppe = Number(id) % SYNOPSIS_GROUPS
    const eintrag = gruppen.get(gruppe) ?? {}
    eintrag[Number(id)] = wert
    gruppen.set(gruppe, eintrag)
  }
  clearDir(`${OUT}/synopses`)
  for (const [gruppe, inhalt] of gruppen) writeJson(`${OUT}/synopses/${gruppe}.json`, inhalt)
  log(`Synopsen in ${gruppen.size} Gruppen geschrieben (vorher eine Datei mit ${Object.keys(synopses).length} Einträgen)`)
  /**
   * Die Reihen — welche Staffeln, Filme und Specials zusammengehören.
   *
   * Eine eigene Datei, weil das Detail-Panel die Frage „welche Staffeln gibt es
   * noch?" auch im Kalender beantworten muss, wo nur `titles-core.json` geladen
   * ist. Vorher las es dafür `data.titles` — und das sind dort die 133 Titel
   * mit Termin. Ergebnis (gemeldet von Daniel, 12.08.2026): Bei „That Time I
   * Got Reincarnated as a Slime" stand unter „Staffeln dieser Reihe" allein
   * Staffel 4, weil nur die einen Termin hat; bei „I've Been Killing Slimes"
   * fehlte der Abschnitt ganz, obwohl es eine zweite Staffel gibt.
   *
   * Nur Reihen mit mehr als einem Eintrag — ein Einzeltitel hat keine Reihe.
   * 462 Reihen, nachgeladen beim ersten Öffnen eines Detail-Panels.
   *
   * **Cover stehen seit dem 13.08.2026 mit drin.** Vorher nicht, mit der
   * Begründung „für eine Auswahlliste braucht es sie nicht" — aus der
   * Auswahlliste ist ein Karussell aus Vorschaukarten geworden, und eine Karte
   * ohne Bild ist keine. Gespeichert wird nur der Dateiname ohne
   * Adressvorsatz; den hängt `loadFranchises` wieder an.
   */
  const nachReihe = new Map<number, typeof slim>()
  for (const t of slim) {
    const key = t.franchiseId ?? t.id
    const liste = nachReihe.get(key) ?? []
    liste.push(t)
    nachReihe.set(key, liste)
  }
  const reihen: Record<number, FranchiseMember[]> = {}
  for (const [key, liste] of nachReihe) {
    if (liste.length < 2) continue
    reihen[key] = liste.sort(nachAusstrahlung).map((t) => ({
      id: t.id,
      name: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`,
      format: t.format,
      jpYear: t.jpYear,
      episodes: t.episodes,
      // Nur der Dateiname; den Vorsatz hängt `loadFranchises` wieder an.
      cover: t.coverImage?.startsWith(ANILIST_COVER_BASIS)
        ? t.coverImage.slice(ANILIST_COVER_BASIS.length)
        : t.coverImage,
    }))
  }
  writeJson(`${OUT}/franchises.json`, reihen)
  log(`${Object.keys(reihen).length} Reihen mit mehr als einem Eintrag geschrieben`)

  schreibeMeldungen(slim)

  writeJson(`${OUT}/releases.json`, releases)
  writeJson(`${OUT}/events.json`, events)
  writeJson(`${OUT}/meta.json`, meta, true)

  // --- ICS-Abo-Feeds --------------------------------------------------------
  // Erst leeren: Genres kommen und gehen, sonst blieben alte Feeds als Leichen
  // im Repository liegen und würden weiter ausgeliefert.
  clearDir(`${OUT}/feeds`)
  const siteUrl = process.env.SITE_URL ?? 'https://anime-kalender.de/'
  writeText(`${OUT}/feeds/all.ics`, buildIcs(events, { siteUrl, calendarName: 'Anime-Kalender DE' }))

  for (const platform of platforms) {
    const subset = events.filter((e) => e.platform === platform)
    if (!subset.length) continue
    writeText(
      `${OUT}/feeds/platform-${platform}.ics`,
      buildIcs(subset, { siteUrl, calendarName: `Anime-Kalender DE – ${platform}` }),
    )
  }

  const titleById = new Map(allTitles.map((t) => [t.id, t]))
  for (const genre of genres) {
    const subset = events.filter((e) => titleById.get(e.titleId)?.genres.includes(genre))
    if (subset.length < 3) continue
    writeText(
      `${OUT}/feeds/genre-${slugify(genre)}.ics`,
      buildIcs(subset, { siteUrl, calendarName: `Anime-Kalender DE – ${genre}` }),
    )
  }

  log(`Titel: ${meta.titleCount}`)
  log(`Releases: ${meta.releaseCount}`)
  log(`Termine: ${meta.eventCount}`)
  log(`Genres: ${genres.length}, Keywords: ${keywords.length}`)
}

main()
