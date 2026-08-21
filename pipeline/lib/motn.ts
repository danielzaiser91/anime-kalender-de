/**
 * Streaming Availability API (Movie of the Night) — Typen und Auswertung.
 *
 * Was diese Quelle kann, was keine andere kann: Sie nennt je Folge die
 * **Tonspuren**, getrennt nach `audios` und `subtitles`. Genau an dieser
 * Trennlinie hängt das Projekt (CLAUDE.md, „Synchro ist nicht Untertitel") —
 * ein `deu` unter `audios` ist der Beleg, ein `deu` unter `subtitles` ist es
 * ausdrücklich nicht. Für Netflix, Prime Video und Disney+ gibt es sonst
 * überhaupt keine maschinenlesbare Auskunft; dort stand bisher dauerhaft
 * „🇩🇪 ?".
 *
 * ## Die vier gemessenen Grenzen dieser Quelle (21.08.2026)
 *
 * Sie stehen hier, weil jede von ihnen eine Zeile Code weiter unten erzwingt:
 *
 *  1. **Sie belegt nur, was da ist — nie, was fehlt.** Folge 7 von
 *     „Thunderbolt Fantasy" war am 19.08.2026 fällig und lag am 21.08.2026 auf
 *     Netflix in deutscher Fassung (Daniels Sichtprüfung); die API führte für
 *     diese Folge gar keine Netflix-Option. Mindestens zwei Tage Verzug.
 *     Daraus folgt die härteste Regel dieser Datei: **aus dieser Quelle
 *     entsteht nie ein `dub: false`.** Eine fehlende Folge, eine fehlende
 *     `streamingOptions` und ein `audios` ohne `deu` heißen alle dasselbe —
 *     „noch nicht bekannt".
 *  2. **Die Serienebene widerspricht der eigenen Episodenebene.** Bei „Frieren"
 *     meldet `streamingOptions` auf Serienebene deutschen Ton bei Crunchyroll,
 *     während alle 28 Crunchyroll-Episoden `audios: [jpn]` tragen. Die
 *     Serienebene ist eine Zusammenfassung und wird hier nirgends gelesen.
 *  3. **Die Staffelzählung ist eine andere als unsere.** „Frieren" ist dort
 *     eine Staffel mit 39 Folgen, „Mushoku Tensei" drei mit 61. Zugeordnet wird
 *     deshalb über **Folgennummern**, nie über Staffelnummern.
 *  4. **Sie kennt laufende Staffeln nur bei manchen Anbietern.** Bei Mushoku
 *     Tensei Staffel 3 (Crunchyroll) und Frieren Staffel 2 stehen leere
 *     Platzhalter ohne einen einzigen Anbieter, obwohl deutsche Folgen belegt
 *     sind. Bei Netflix („Thunderbolt Fantasy") war sie dagegen folgengenau und
 *     bestätigte unseren einzigen Beleg. Deshalb zählt hier **nur Netflix** —
 *     für Crunchyroll und ADN haben wir eigene, bessere Quellen im Haus.
 *  5. **Ein Kanal im Abo eines anderen Anbieters ist nicht dessen Katalog.**
 *     Erst am 21.08.2026 am echten Abruf sichtbar geworden: Bei „Frieren" steht
 *     unter `netflix` und `crunchyroll` je ein Eintrag — und ein dritter mit
 *     `service.id = "prime"`, `type = "addon"`, `addon.id = "crunchyrollde"`.
 *     Das ist der Crunchyroll-Kanal bei Amazon, nicht Prime Videos eigenes
 *     Angebot. Wer nur `service.id` liest, schreibt Prime Video 24 deutsche
 *     Folgen zu, die es dort gar nicht gibt. `dienstId` liefert deshalb nur für
 *     Optionen **ohne** `addon` eine Plattform; Kanäle werden getrennt unter
 *     `addons` geführt (siehe `MotnBestand`).
 */
import type { PlatformId, Title } from '../../shared/types.ts'

/** Eine Anbieter-Option, wie die API sie je Folge liefert. */
export interface MotnOption {
  service?: { id?: string } | string
  /** Gesetzt, wenn das Angebot über einen Kanal im Abo läuft — siehe Grenze 5. */
  addon?: { id?: string } | string
  type?: string
  link?: string
  audios?: { language?: string; region?: string }[]
  subtitles?: { closedCaptions?: boolean; locale?: { language?: string } }[]
  /** Unix-Sekunden. */
  availableSince?: number
  /** Unix-Sekunden. */
  expiresOn?: number
}

export interface MotnEpisode {
  itemType?: string
  episodeNumber?: number
  seasonNumber?: number
  title?: string
  streamingOptions?: Record<string, MotnOption[]>
}

export interface MotnSeason {
  seasonNumber?: number
  episodes?: MotnEpisode[]
}

/** Eine Serie, wie die API sie liefert — nur die Felder, die wir auswerten. */
export interface MotnShow {
  id?: string
  imdbId?: string
  tmdbId?: string
  title?: string
  originalTitle?: string
  firstAirYear?: number
  lastAirYear?: number
  episodeCount?: number
  seasons?: MotnSeason[]
  episodes?: MotnEpisode[]
  /** Serienebene — siehe Grenze 2. Wird bewusst nicht ausgewertet. */
  streamingOptions?: Record<string, MotnOption[]>
}

/**
 * Welche Dienste dieser Quelle wir **erfassen**.
 *
 * Nicht dasselbe wie `UEBERNOMMEN`, und der Unterschied ist der Grund, warum
 * Crunchyroll hier steht, obwohl aus dieser Quelle nie eine Crunchyroll-Angabe
 * in den Datensatz geht: **Crunchyroll ist unser Prüfstein.** Für 190 Serien
 * wissen wir aus `data/crunchyroll-dub.json` unabhängig, ob dort eine deutsche
 * Tonspur liegt — für Netflix wissen wir es fast nirgends. Würde die
 * Crunchyroll-Angabe schon beim Erfassen weggeworfen, hätte die
 * Kontrollmessung nichts, woran sie die Quelle messen könnte, und „erst
 * messen, dann glauben" wäre ein Satz ohne Deckung.
 *
 * ADN fehlt: Ob und unter welcher Kennung diese Quelle ADN überhaupt führt, ist
 * nicht belegt — geprüft ist nur, dass bei „Frieren" `crunchyroll`, `netflix`
 * und `prime` unter `streamingOptions.de` stehen (21.08.2026). Eine geratene
 * Kennung fände nie etwas und sähe dabei aus wie eine Auskunft.
 */
export const DIENSTE: Record<string, PlatformId> = {
  netflix: 'netflix',
  prime: 'primevideo',
  disney: 'disneyplus',
  crunchyroll: 'crunchyroll',
}

/**
 * Was die Pipeline aus dieser Quelle in den Datensatz übernimmt — nur Netflix.
 *
 * Crunchyroll bleibt draußen, weil die Quelle sich dort selbst widerspricht
 * (Grenze 2) und wir eine eigene, bessere Auskunft im Haus haben. Prime Video
 * und Disney+ bleiben draußen, bis die Kontrollmessung für sie eine
 * Trefferquote zeigt — sie werden erfasst und in `data/motn-messung.md` eigens
 * ausgewiesen, mehr nicht.
 */
export const UEBERNOMMEN: PlatformId[] = ['netflix']

/** Befund je Dienst für **eine** Serie der Quelle. */
export interface MotnDienstBefund {
  /**
   * Absolute Folgennummern (1-basiert, in der Reihenfolge der Quelle), für die
   * dieser Dienst überhaupt geführt wird.
   */
  gelistet: number[]
  /** Davon die mit deutschem Ton unter `audios`. */
  deutsch: number[]
  /** Frühestes `availableSince` über alle Folgen, als ISO-Datum. */
  seit?: string
  /** Frühestes `expiresOn` über alle Folgen, als ISO-Datum. */
  laeuftAusAm?: string
}

/** Eine Serie im Bestand — das, was `data/motn.json` je `imdbId` festhält. */
export interface MotnBestand {
  imdbId: string
  titel: string
  originalTitel?: string
  jahr?: number
  /** Wie viele Folgen die Quelle führt. Grundlage jeder Zuordnung. */
  folgen: number
  /**
   * Was die Quelle selbst als `episodeCount` angibt.
   *
   * Nicht dasselbe wie `folgen`, und der Unterschied ist eine Messung: Bei
   * „Frieren" steht oben `episodeCount: 38`, während die Staffelliste derselben
   * Antwort 39 Einträge hat. Zugeordnet wird über `folgen` — nur die
   * Listenlänge sagt, an welcher Stelle eine Folge steht. Das Feld steht hier,
   * damit der Bericht benennen kann, woran eine Zuordnung gescheitert ist.
   */
  folgenLautQuelle?: number
  dienste: Partial<Record<PlatformId, MotnDienstBefund>>
  /**
   * Kanäle im Abo eines anderen Anbieters, je Kanalkennung — `crunchyrollde`
   * etwa (Grenze 5).
   *
   * Getrennt geführt und **nirgends** in den Datensatz übernommen: Ein Kanal ist
   * ein eigenes Angebot mit eigener Adresse, und wir führen ihn nicht als
   * Plattform. Er steht hier, weil die Kontrollmessung ihn braucht — bei
   * „Frieren" trägt der Crunchyroll-Kanal deutschen Ton, während dieselbe Quelle
   * für Crunchyroll selbst nur `jpn` führt. Genau dieser Unterschied ist die
   * Auskunft, und ihn wegzuwerfen hieße, die Messung um ihre Grundlage zu
   * bringen.
   */
  addons?: Record<string, MotnDienstBefund>
  geprueftAm: string
}

export interface MotnDaten {
  fetchedAt: string
  /** Verbrauchte Anfragen je Kalendermonat — das Kontingent setzt monatlich zurück. */
  verbrauch: Record<string, number>
  /** Wo der Katalogdurchlauf stehen geblieben ist. */
  katalogCursor?: string | null
  shows: Record<string, MotnBestand>
  /**
   * Gedächtnis der Titelsuche: AniList-ID → gefundene `imdbId` oder `null`.
   *
   * Das ist **kein** Zuordnungsergebnis, sondern nur die Warteschlange. Die
   * eigentliche Zuordnung entsteht in `ordneShowsZu` aus dem Bestand — sie
   * kostet kein Kontingent und darf sich deshalb bei jedem Build neu bilden.
   * Wäre sie hier gespeichert, wäre eine einmal falsche Zuordnung endgültig.
   */
  gesucht: Record<string, { imdbId: string | null; geprueftAm: string }>
  /**
   * Gedächtnis des Direktabrufs: `tv/209867` → gefundene `imdbId` oder `null`.
   *
   * Wie `gesucht` nur die Warteschlange, keine Zuordnung. Der Schlüssel ist die
   * TMDB-Kennung aus `data/tmdb-titles.json` und **nicht** unsere Titel-ID:
   * Mehrere unserer Staffeln teilen sich dieselbe TMDB-Serie, und jede einzeln
   * zu fragen wäre dieselbe Antwort zum vielfachen Preis.
   */
  tmdb: Record<string, { imdbId: string | null; geprueftAm: string }>
}

export const LEER: MotnDaten = { fetchedAt: '', verbrauch: {}, shows: {}, gesucht: {}, tmdb: {} }

/**
 * Deutscher Ton — und ausschließlich `audios`.
 *
 * Die eine Zeile, um die es in diesem ganzen Auftrag geht. `subtitles` wird
 * nicht einmal gelesen: Chiikawa hat 120 deutsche Folgen, alle untertitelt,
 * keine synchronisiert. Wer hier `subtitles` mitnähme, beantwortete eine andere
 * Frage als die gestellte.
 */
export function hatDeutschenTon(option: MotnOption): boolean {
  return (option.audios ?? []).some((a) => a?.language === 'deu')
}

function rohId(wert: { id?: string } | string | undefined): string | undefined {
  return typeof wert === 'string' ? wert : wert?.id
}

/**
 * Der Dienst, dem dieses Angebot gehört — oder keiner, wenn es ein Kanal ist.
 *
 * Grenze 5: Ein `addon` läuft zwar über das Abo des Basisdienstes, gehört aber
 * nicht zu dessen Katalog. Die Option ohne diese Unterscheidung zu lesen hieße,
 * Prime Video den Bestand von Crunchyroll zuzuschlagen.
 */
function dienstId(option: MotnOption): string | undefined {
  return addonId(option) ? undefined : rohId(option.service)
}

/** Die Kennung des Kanals, über den das Angebot läuft — `crunchyrollde` etwa. */
export function addonId(option: MotnOption): string | undefined {
  return rohId(option.addon)
}

function isoAus(sekunden: number | undefined): string | undefined {
  if (!sekunden || !Number.isFinite(sekunden)) return undefined
  return new Date(sekunden * 1000).toISOString().slice(0, 10)
}

/**
 * Die Folgen einer Serie in **einer** durchlaufenden Reihenfolge.
 *
 * Ohne diese Flachlegung wäre die Staffelnummer der Quelle die Zuordnung — und
 * die stimmt nicht mit unserer überein (Grenze 3). Sortiert wird nach
 * (Staffel, Folge) der Quelle, damit die absoluten Nummern reproduzierbar sind;
 * die Reihenfolge im JSON allein wäre es nicht.
 */
export function folgenInReihenfolge(show: MotnShow): MotnEpisode[] {
  const roh = show.seasons?.length
    ? show.seasons.flatMap((s) =>
        (s.episodes ?? []).map((e) => ({ ...e, seasonNumber: e.seasonNumber ?? s.seasonNumber })),
      )
    : (show.episodes ?? [])
  return [...roh].sort(
    (a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) || (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0),
  )
}

/** Fasst eine Antwort der Quelle zu dem zusammen, was `data/motn.json` festhält. */
export function bestandAus(show: MotnShow, heute: string): MotnBestand | undefined {
  if (!show.imdbId) return undefined
  const folgen = folgenInReihenfolge(show)
  const dienste: Partial<Record<PlatformId, MotnDienstBefund>> = {}
  const addons: Record<string, MotnDienstBefund> = {}

  folgen.forEach((folge, i) => {
    const nummer = i + 1
    for (const option of folge.streamingOptions?.de ?? []) {
      const kanal = addonId(option)
      const plattform = kanal ? undefined : DIENSTE[dienstId(option) ?? '']
      if (!plattform && !kanal) continue
      const befund = plattform
        ? (dienste[plattform] ??= { gelistet: [], deutsch: [] })
        : (addons[kanal as string] ??= { gelistet: [], deutsch: [] })
      befund.gelistet.push(nummer)
      if (hatDeutschenTon(option)) befund.deutsch.push(nummer)
      const seit = isoAus(option.availableSince)
      if (seit && (!befund.seit || seit < befund.seit)) befund.seit = seit
      const aus = isoAus(option.expiresOn)
      if (aus && (!befund.laeuftAusAm || aus < befund.laeuftAusAm)) befund.laeuftAusAm = aus
    }
  })

  return {
    imdbId: show.imdbId,
    titel: show.title ?? '',
    originalTitel: show.originalTitle,
    jahr: show.firstAirYear,
    folgen: folgen.length,
    ...(show.episodeCount && show.episodeCount !== folgen.length ? { folgenLautQuelle: show.episodeCount } : {}),
    dienste,
    ...(Object.keys(addons).length ? { addons } : {}),
    geprueftAm: heute,
  }
}

/** Welche unserer Staffeln welchen Folgenbereich der Quelle abdeckt. */
export interface MotnZuordnung {
  titleId: number
  von: number
  bis: number
}

/**
 * Ordnet die Folgen einer Serie der Quelle unseren Staffeln zu — über die
 * Stückzahl, nie über die Staffelnummer.
 *
 * Zwei Wege, beide ohne jede Toleranz:
 *
 *  1. **Präfix.** Die ersten k Staffeln summieren sich genau auf die Zahl der
 *     Folgen, die die Quelle führt. Das ist der Normalfall — die Quelle zählt
 *     „Frieren" als eine Staffel mit 39 Folgen, wir als 28 + 11.
 *  2. **Genau eine Staffel.** Trägt die Quelle nur eine spätere Staffel, kann
 *     kein Präfix aufgehen. Dann zählt eine einzelne Staffel mit exakt dieser
 *     Folgenzahl — aber nur, wenn sie **eindeutig** ist. Bei „Sword Art Online"
 *     haben Staffel 2 und Alicization beide 24 Folgen; dort ist die Zahl kein
 *     Beweis, und dann bleibt es offen.
 *
 * Geht keiner der beiden Wege auf, gibt es **keine** Zuordnung. Das ist die
 * teure, aber richtige Antwort: Eine falsche Automatik kostet mehr als eine
 * Zeile Handarbeit, und ein fremder Titel im Datensatz ist genau der Fehler,
 * den `ordneBloeckeZuStaffeln` bei ADN schon einmal produziert hat.
 */
export function ordneFolgenZuStaffeln(gesamt: number, staffeln: Title[]): MotnZuordnung[] | undefined {
  if (gesamt < 1 || !staffeln.length) return undefined

  let summe = 0
  for (let k = 0; k < staffeln.length; k++) {
    summe += staffeln[k].episodes ?? 0
    if (summe > gesamt) break
    if (summe === gesamt) {
      let offset = 1
      return staffeln.slice(0, k + 1).map((t) => {
        const von = offset
        offset += t.episodes ?? 0
        return { titleId: t.id, von, bis: offset - 1 }
      })
    }
  }

  const einzeln = staffeln.filter((t) => (t.episodes ?? 0) === gesamt)
  if (einzeln.length === 1) return [{ titleId: einzeln[0].id, von: 1, bis: gesamt }]
  return undefined
}

/**
 * Belegt die Quelle für diesen Folgenbereich eine deutsche Fassung?
 *
 * Verlangt wird **jede** Folge des Bereichs. Der Grund steht in Grenze 1: Eine
 * Folge ohne Eintrag heißt „noch nicht bekannt", nicht „ohne deutschen Ton" —
 * und aus einem teilweisen Befund ein „die Staffel gibt es auf Deutsch" zu
 * machen, wäre genau die Sorte Hochrechnung, gegen die dieses Projekt
 * geschrieben ist. Eine unvollständige Staffel bleibt offen und geht an die
 * Handarbeit.
 */
export function belegtDeutsch(befund: MotnDienstBefund, von: number, bis: number): boolean {
  if (bis < von) return false
  const deutsch = new Set(befund.deutsch)
  for (let n = von; n <= bis; n++) if (!deutsch.has(n)) return false
  return true
}

/**
 * Ein abgelaufenes Angebot belegt nichts mehr.
 *
 * Die Frage steht seit dem 15.08.2026 offen (CLAUDE.md): Verliert ein Dienst
 * die Lizenz, behauptet ein Bestand, der nur wachsen kann, das Angebot für
 * immer weiter. Crunchyroll führt aus genau diesem Grund keine erste Staffel
 * von „Attack on Titan" mehr.
 *
 * Gestrichen wird deshalb **nicht** — das wäre ein Nein aus einer Quelle, die
 * keine Neins kennt. Der Beleg wird nur nicht mehr gesetzt: Er sagt dann nicht
 * „liegt dort auf Deutsch", sondern „lag dort", und das ist keine Antwort auf
 * unsere Frage. Der Verweis fällt damit von selbst wieder in die Prüfliste.
 */
export function nochGueltig(laeuftAusAm: string | undefined, heute: string): boolean {
  return !laeuftAusAm || laeuftAusAm > heute
}

// --- Zuordnung: welche Serie der Quelle gehört zu welchem unserer Titel ------
//
// Diese Hälfte der Datei kostet **kein** Kontingent. Sie arbeitet nur auf dem
// Bestand, den der Abruf hinterlassen hat, und darf deshalb bei jedem Build neu
// rechnen. Genau das ist der Grund, sie nicht im Abrufskript zu speichern: Eine
// gespeicherte Zuordnung wäre eine Antwort, die ihre eigene Überprüfung
// verhindert — der Fehler, an dem dieses Projekt schon dreimal hing.

/**
 * Der Name, unter dem die Quelle eine Reihe führt: ohne Staffelzusatz.
 *
 * Aus Daniels Vormessung vom 21.08.2026 (20 Titel, naive Titelsuche): Fünf
 * Fehlschläge, fast alle mit Staffelzusatz — „JUJUTSU KAISEN Season 2",
 * „KONOSUBA … Season 3", „Aggretsuko: Season 4", „HERO MASK part II". Die
 * Quelle zählt Staffeln anders als wir (Grenze 3) und führt die Reihe als einen
 * Eintrag.
 */
export function suchName(vertreter: Pick<Title, 'titleEn' | 'titleRomaji' | 'titleDe'>): string {
  const roh = vertreter.titleEn || vertreter.titleRomaji || vertreter.titleDe || ''
  return roh
    .replace(/\b(season|staffel|part|cour|teil)\s*(\d+|[ivx]+)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s:–—-]+$/, '')
    .trim()
}

/** Was für den Namensabgleich von einer Serie der Quelle gebraucht wird. */
export type MotnKandidat = Pick<MotnBestand, 'imdbId' | 'titel' | 'originalTitel' | 'jahr'>

function alsTrefferTitel(k: MotnKandidat) {
  return { title: { romaji: k.originalTitel ?? null, english: k.titel || null, native: null } }
}

/** Die Namensbewertung aus `lib/adn.ts`, hereingereicht statt fest verdrahtet. */
export interface MotnVergleich {
  passtZuSerie: (a: { title: string }, b: ReturnType<typeof alsTrefferTitel>) => boolean
  bewerteTreffer: (a: { title: string }, b: ReturnType<typeof alsTrefferTitel>) => number
  volltreffer: (a: { title: string }, b: ReturnType<typeof alsTrefferTitel>) => boolean
}

/**
 * Der Suchtreffer, der gemeint ist — oder keiner.
 *
 * `bewerteTreffer` und `volltreffer` kommen aus dem ADN-Abgleich und lösen dort
 * genau dieses Problem: Es gewinnt der beste Treffer, nicht der erste, und
 * kurze Kürzel wie „OVA" entscheiden mit. Für die **automatische** Übernahme
 * genügt der beste Treffer allerdings nicht — verlangt wird zusätzlich ein
 * Volltreffer, also vollständige Wortdeckung ohne Zutaten, und ein passendes
 * Jahr. „Im Zweifel offen lassen": Eine falsche Automatik kostet mehr als eine
 * Zeile Handarbeit.
 */
export function besterShow(
  name: string,
  jahr: number | undefined,
  kandidaten: MotnKandidat[],
  vergleiche: MotnVergleich,
): { kandidat: MotnKandidat; voll: boolean; jahrPasst: boolean } | undefined {
  const suche = { title: name }
  let beste: { kandidat: MotnKandidat; punkte: number; voll: boolean; jahrPasst: boolean } | undefined
  for (const k of kandidaten) {
    if (!k.imdbId) continue
    const gegen = alsTrefferTitel(k)
    if (!vergleiche.passtZuSerie(suche, gegen)) continue
    const jahrPasst = !!jahr && !!k.jahr && Math.abs(k.jahr - jahr) <= 1
    const punkte = vergleiche.bewerteTreffer(suche, gegen)
    if (beste && punkte <= beste.punkte) continue
    beste = { kandidat: k, punkte, voll: vergleiche.volltreffer(suche, gegen), jahrPasst }
  }
  return beste && { kandidat: beste.kandidat, voll: beste.voll, jahrPasst: beste.jahrPasst }
}

/** Was die Quelle über einen unserer Titel bei einem Anbieter sagt. */
export interface MotnBeleg {
  titleId: number
  platform: PlatformId
  imdbId: string
  /** Folgenbereich der Quelle, den dieser Titel abdeckt. */
  von: number
  bis: number
  /** Jede Folge des Bereichs trägt deutschen Ton — der Beleg. */
  deutsch: boolean
  /**
   * Titel, Jahr und Folgenzahl haben alle drei gepasst.
   *
   * `ordneShowsZu` liefert nichts anderes — das Feld ist die zweite Sicherung
   * an der Stelle, an der geschrieben wird (`uebernehmbar`), und die Zusicherung
   * in `check-logic.ts` hängt daran. Zwei von dreien reichen nicht.
   */
  eindeutig: boolean
  seit?: string
  laeuftAusAm?: string
}

/**
 * Zuordnung über den ganzen Bestand — ohne einen einzigen Abruf.
 *
 * `reihenVon` liefert je Titel die Staffeln seines Franchise in
 * Ausstrahlungsreihenfolge; `vergleiche` reicht die Namensbewertung aus
 * `lib/adn.ts` herein. Beides steckt nicht fest darin, damit diese Datei ohne
 * den ADN-Abgleich prüfbar bleibt.
 */
export function ordneShowsZu(
  titles: Title[],
  shows: Record<string, MotnBestand>,
  reihenVon: (title: Title) => Title[],
  vergleiche: MotnVergleich,
  /**
   * Zusätzliche Kandidaten je Titel, gefunden über die **TMDB-Kennung** statt
   * über den Namen.
   *
   * Warum das nötig wurde: Der Wortindex weiter unten findet eine Serie nur,
   * wenn unser Titel und ihrer ein Wort von vier Zeichen teilen. „Solo Leveling"
   * heißt bei uns romanisiert „Ore dake Level Up na Ken" — kein geteiltes Wort,
   * kein Kandidat, obwohl der Abruf sie über die Kennung gezielt geholt hat.
   *
   * Es ist eine **Vorauswahl**, kein Freifahrtschein: Die Annahme unten prüft
   * weiterhin Titel, Jahr und Folgenzahl. Die Kennung kommt aus unserem eigenen
   * `data/tmdb-titles.json`, und die ist selbst über eine Namenssuche entstanden
   * — sie zu glauben, ohne sie zu prüfen, hieße einen Namensabgleich durch einen
   * anderen zu ersetzen.
   */
  zusatzKandidaten?: (title: Title) => string[],
): MotnBeleg[] {
  /**
   * Vorauswahl über geteilte Wörter.
   *
   * Ohne sie wäre jeder Titel gegen jede Serie des Katalogs zu prüfen. Der
   * Index kostet einen Durchlauf und macht aus Hunderttausenden Vergleichen ein
   * paar Dutzend je Titel.
   */
  const index = new Map<string, MotnBestand[]>()
  for (const bestand of Object.values(shows)) {
    for (const wort of woerter(`${bestand.titel} ${bestand.originalTitel ?? ''}`)) {
      const liste = index.get(wort) ?? []
      liste.push(bestand)
      index.set(wort, liste)
    }
  }

  const belege: MotnBeleg[] = []
  const erledigt = new Set<number>()
  const gesehen = new Set<string>()

  for (const title of titles) {
    if (erledigt.has(title.id)) continue
    const reihe = reihenVon(title)
    const staffeln = reihe.length ? reihe : [title]
    const vertreter = staffeln[0]
    const name = suchName(vertreter)
    if (!name) continue

    const kandidaten = new Map<string, MotnBestand>()
    for (const wort of woerter(name)) {
      for (const b of index.get(wort) ?? []) kandidaten.set(b.imdbId, b)
    }
    // Über die Kennung geholte Serien kommen für jede Staffel der Reihe dazu,
    // nicht nur für den Vertreter: Gefragt wurde je Titel, geantwortet wird je
    // Reihe.
    for (const staffel of staffeln) {
      for (const imdbId of zusatzKandidaten?.(staffel) ?? []) {
        const b = shows[imdbId]
        if (b) kandidaten.set(b.imdbId, b)
      }
    }
    if (!kandidaten.size) continue

    const treffer = besterShow(name, vertreter.jpYear, [...kandidaten.values()], vergleiche)
    if (!treffer) continue
    const bestand = shows[treffer.kandidat.imdbId]
    if (!bestand) continue

    /**
     * Ein Halbtreffer ist kein Treffer — er wird gar nicht erst geführt.
     *
     * Gemessen am 21.08.2026 an einem Bestand aus zwei Serien: Das Wort „magic"
     * zog fünf fremde Reihen an („MASHLE", „The Saint's Magic Power is
     * Omnipotent", „Anti-Magic Academy", „Magic Maker"), und weil alle fünf
     * zwölf Folgen haben, ging bei jeder auch die Folgenrechnung auf.
     * `passtZuSerie` ist eben ein Türsteher, kein Schiedsrichter — ein einziges
     * geteiltes Wort genügt ihm.
     *
     * Die Übernahme hätte sie ohnehin abgelehnt. Aber sie stünden im Bericht
     * und in der Kontrollmessung, und dort wären sie das Gegenteil von
     * hilfreich: Sie würden gegen fremde Belege gemessen und die Quote nach
     * Belieben verschieben.
     */
    if (!treffer.voll || !treffer.jahrPasst) continue

    const bereiche = ordneFolgenZuStaffeln(bestand.folgen, staffeln)
    // Ohne aufgehende Folgenrechnung gibt es keine Zuordnung — und damit auch
    // keinen halben Beleg. Die Reihe bleibt vollständig in der Handarbeit.
    if (!bereiche) continue

    for (const bereich of bereiche) {
      erledigt.add(bereich.titleId)
      for (const [platform, befund] of Object.entries(bestand.dienste) as [PlatformId, MotnDienstBefund][]) {
        // Eine Staffel kann über mehrere ihrer Geschwister erreicht werden;
        // zweimal derselbe Beleg wäre in jeder Zählung ein Fehler.
        const schluessel = `${bereich.titleId}|${platform}`
        if (gesehen.has(schluessel)) continue
        gesehen.add(schluessel)
        belege.push({
          titleId: bereich.titleId,
          platform,
          imdbId: bestand.imdbId,
          von: bereich.von,
          bis: bereich.bis,
          deutsch: belegtDeutsch(befund, bereich.von, bereich.bis),
          eindeutig: true,
          seit: befund.seit,
          laeuftAusAm: befund.laeuftAusAm,
        })
      }
    }
  }
  return belege
}

/**
 * Darf dieser Beleg in den Datensatz? Die Zusicherung dieser Quelle.
 *
 * Sie steht als Funktion da und nicht als Kommentar im Build, damit
 * `check-logic.ts` sie nachstellen kann — jede der vier Bedingungen ist eine
 * Messung vom 21.08.2026, und keine davon darf beim nächsten Umbau still
 * verschwinden:
 *
 *  * **`deutsch`** — nur ein `audios` mit `deu` über den ganzen Folgenbereich.
 *    Kein `false` aus dieser Quelle, nirgends.
 *  * **`eindeutig`** — Titel, Jahr und Folgenzahl haben alle drei gepasst. Zwei
 *    von dreien reichen nicht.
 *  * **nicht `laeuft`** — bei einer laufenden Staffel entscheidet der Verzug
 *    der Quelle darüber, was sie zeigt. Bei Mushoku Tensei Staffel 3 wären das
 *    null deutsche Folgen gewesen, während drei belegt sind.
 *  * **nicht abgelaufen** — ein `expiresOn` in der Vergangenheit sagt „lag
 *    dort", und das ist keine Antwort auf unsere Frage.
 */
export function uebernehmbar(beleg: MotnBeleg, laeuft: boolean, heute: string): boolean {
  if (!beleg.deutsch || !beleg.eindeutig) return false
  if (!UEBERNOMMEN.includes(beleg.platform)) return false
  if (laeuft) return false
  if (!nochGueltig(beleg.laeuftAusAm, heute)) return false
  return true
}

/** Wortzerlegung für die Vorauswahl — bewusst grob, sie filtert nur vor. */
function woerter(s: string): string[] {
  return [
    ...new Set(
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4),
    ),
  ]
}
