/**
 * Holt deutsche Inhaltsangaben und Stream-Anbieter von aniSearch.
 *
 * Warum diese Quelle:
 *
 * - **Die Beschreibungen sind dort deutsch und ausführlich.** TMDB liefert für
 *   Anime oft nur einen englischen Stummel („The second season of …"), AniList
 *   grundsätzlich nur Englisch. aniSearch pflegt redaktionelle deutsche Texte.
 * - **Die Stream-Liste nennt, wo ein Titel auf Deutsch läuft** — auch für alte
 *   Katalogtitel, die in keinem Simulcast-Kalender mehr auftauchen.
 *
 * Warum nicht werstreamt.es, wo mehr stünde: Deren robots.txt untersagt
 * automatisiertes Auslesen ausdrücklich („The collection of content … through
 * automated means … is prohibited"). aniSearch erlaubt es — die robots.txt
 * sperrt nur Weiterleitungs- und Konto-Pfade. Also nehmen wir, was erlaubt ist,
 * und tragen den Rest von Hand nach.
 *
 * **Offene Baustelle:** aniSearch betreibt unter `api.anisearch.com` eine
 * offizielle Schnittstelle mit OAuth-Zugang. Die wäre der richtige Weg — sie
 * verlangt aber eine registrierte Anwendung, und ein Konto kann nur der
 * Betreiber dieses Projekts anlegen. Bis dahin bleibt das Lesen der
 * öffentlichen Seiten, im dokumentierten Takt der API.
 *
 * Die Zuordnung AniList → aniSearch kommt aus der anime-offline-database des
 * manami-Projekts (ODbL). Titelvergleiche wären hier fatal: „.hack//Quantum"
 * und „.hack//Sign" trennt kein Suchindex zuverlässig.
 *
 * Aufruf: npm run data:anisearch [-- --limit 250]
 */
import { gzipSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Release, Title } from '../shared/types.ts'

const args = process.argv.slice(2)
/**
 * Wie viele Seiten ein Lauf höchstens holt.
 *
 * Ein Versuch mit 2.900 Titeln am Stück endete damit, dass aniSearch die
 * Verbindung verweigerte (`UND_ERR_CONNECT_TIMEOUT`) — nach rund tausend
 * Anfragen im Sekundentakt, und zu Recht. Der Bestand liegt im Repo und wächst
 * mit jedem Nachtlauf; er muss nicht an einem Tag vollständig sein.
 *
 * 200 Titel sind bei sechs Sekunden Abstand rund zwanzig Minuten Lauf und
 * bleiben damit deutlich unter dem Umfang, der die Sperre auslöste. Bei 60 je
 * Lauf hätte der Rückstand von 1.652 Titeln 28 Tage gebraucht; so sind es acht.
 */
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 200
const FORCE = args.includes('--force')

/**
 * Abstand zwischen zwei Anfragen: sechs Sekunden, also zehn pro Minute.
 *
 * Das ist keine gegriffene Zahl, sondern das strengere der beiden Limits, die
 * aniSearch für seine API dokumentiert (10/Minute bzw. 100/2 Minuten, je nach
 * Endpunkt). Hier werden zwar HTML-Seiten gelesen und keine API befragt — aber
 * die Grenze, die der Betreiber für seine eigene Schnittstelle zieht, ist die
 * beste verfügbare Auskunft darüber, was er für zumutbar hält.
 *
 * Der erste Anlauf lief mit 60 Anfragen pro Minute. Das war sechsmal über dem
 * Limit und endete in einer Sperre — nachvollziehbarerweise.
 */
const DELAY_MS = 6000

/**
 * So viele Fehlschläge hintereinander, dann ist Schluss.
 *
 * Wenn eine Seite dichtmacht, hilft Weitermachen niemandem: Jede weitere
 * Anfrage ist nutzlos und verlängert nur die Sperre. Abbrechen ist hier die
 * höflichere und die klügere Reaktion.
 */
const MAX_FAILURES = 5

/**
 * Wir sagen, wer wir sind.
 *
 * Hier stand vorher eine Chrome-Kennung. aniSearch schreibt in der eigenen
 * Doku, dass Anfragen ohne aussagekräftige Kennung als Missbrauch gewertet und
 * die IP gesperrt wird — genau das ist am 09.08.2026 passiert. Eine gefälschte
 * Browser-Kennung ist dabei nicht die harmlosere, sondern die schlechtere
 * Variante: Sie nimmt dem Betreiber die Möglichkeit, den Verursacher
 * anzuschreiben, statt ihn auszusperren.
 */
const UA = 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)'
const IDS_URL =
  'https://github.com/manami-project/anime-offline-database/releases/latest/download/anime-offline-database-minified.json'

/** Wie lange die ID-Brücke gilt, bevor sie neu geladen wird. */
const IDS_MAX_AGE_DAYS = 7
/**
 * Nach wie vielen Tagen ein Titeleintrag erneut geholt wird.
 *
 * Siehe die Begründung an der Warteschlange unten: Ohne Wiedervorlage kann ein
 * Anbieter, der die Rechte verliert, nie wieder aus unserem Bestand
 * verschwinden.
 */
/**
 * Wiedervorlage nach dreißig Tagen — nicht nach vierzehn.
 *
 * **Vierzehn waren nicht haltbar, und das ist gerechnet, nicht gefühlt.** Der
 * Bestand hat 2.615 Titel mit aniSearch-Kennung; um eine Frist von 14 Tagen
 * einzuhalten, müssten täglich 187 Seiten geholt werden. Geholt wurden **60 je
 * Woche** — die Warteschlange konnte nie leer werden, und am 29.08.2026 lagen
 * **955 von 2.615** Seiten im Archiv, der Rest gar nicht.
 *
 * Was daran hängt, ist mehr als ein deutscher Titel: Aus demselben Archiv
 * kommen die Beschreibungen, die Anbieterlisten und seit dem 29.08. die
 * deutschen Disc-Ausgaben — der einzige Bezugsweg für 176 Titel, die sonst
 * keinen zeigen.
 *
 * Dreißig Tage verlangen 87 Seiten am Tag. Der Tageslauf holt 120; damit trägt
 * die Frist mit Luft, und der Rückstand ist in gut drei Wochen aufgeholt.
 */
const TITEL_MAX_AGE_DAYS = Number(process.argv[process.argv.indexOf('--alter') + 1]) || 30

function veraltet(eintrag: { fetchedAt?: string }): boolean {
  if (!eintrag.fetchedAt) return true
  return (Date.now() - new Date(eintrag.fetchedAt).getTime()) / 86_400_000 > TITEL_MAX_AGE_DAYS
}

export interface AnisearchStream {
  /** Erkennungsname des Anbieters, wie aniSearch ihn im Bild führt. */
  provider: string
  url: string
}

/** Eine Sprachfassung, wie aniSearch sie in der Infobox führt. */
export interface AnisearchLanguage {
  /** Sprachname im Original der Seite: „Japanisch", „Deutsch", … */
  language: string
  title?: string
  /** Der Titel in Originalschrift — steht nur beim japanischen Block. */
  titleNative?: string
  /** „Laufend", „Abgeschlossen", „Angekündigt" … */
  status?: string
  /** Zeitraum wie angegeben, etwa „08.07.2026 - ?". */
  released?: string
  publisher?: string[]
  /**
   * true, wenn aniSearch die Fassung als **synchronisiert** führt.
   *
   * Die Seite unterscheidet das von „untertitelt" über die Klasse `dubbed-1`
   * am Lautsprecher-Symbol. Für einen Synchro-Kalender ist genau das die
   * Kernaussage der ganzen Seite.
   */
  dubbed?: boolean
}

/**
 * Was in der Infobox einer aniSearch-Seite steht.
 *
 * Bewusst großzügig: Auch Felder, die der Kalender heute nicht anzeigt, werden
 * mitgenommen. Der Abruf ist der teure Teil — das Speichern kostet nichts, und
 * jedes Feld, das hier fehlt, bedeutet später einen zweiten Lauf über tausende
 * Seiten einer fremden Redaktion.
 */
export interface AnisearchInfo {
  /** „TV-Serie", „Film", „OVA" … */
  format?: string
  episodes?: number
  /**
   * true, wenn aniSearch die Folgenzahl **selbst** als vorläufig kennzeichnet.
   *
   * Die Seite hängt dann ein Warnzeichen mit dem Hinweis „Episodenanzahl:
   * vorläufige Schätzung" an. Ohne dieses Feld dürften wir die Zahl nach
   * unseren eigenen Regeln gar nicht übernehmen — eine geschätzte Zahl
   * ungekennzeichnet zu übernehmen macht aus fremder Unsicherheit eine eigene
   * Behauptung.
   */
  episodesEstimated?: boolean
  /** Länge einer Folge in Minuten. */
  runtimeMinutes?: number
  season?: string
  studios?: string[]
  /** Beteiligte mit ihrer Funktion, so wie aniSearch sie nennt. */
  staff?: { name: string; role?: string }[]
  /** „Light Novel", „Manga", „Original" … */
  adaptedFrom?: string
  /** Japanischer Sendeplatz, etwa „Mittwoch 23:45 (JST)". */
  broadcast?: string
  websites?: { name: string; url: string }[]
  /** Alternative Schreibweisen — hilft beim Abgleich mit Plattform-Titeln. */
  synonyms?: string[]
  languages: AnisearchLanguage[]
  /** Alle Warnhinweise der Seite im Wortlaut, auch die hier nicht gedeuteten. */
  issues?: string[]
}

export interface AnisearchEntry {
  anisearchId: number
  /** Deutsche Inhaltsangabe, Quellenhinweis entfernt. */
  descriptionDe?: string
  streams: AnisearchStream[]
  info?: AnisearchInfo
  fetchedAt: string
}

interface IdMap {
  updatedAt: string
  /** AniList-ID → aniSearch-ID. */
  anisearch: Record<number, number>
}

/** Lädt die ID-Brücke, wenn sie fehlt oder veraltet ist. */
async function loadIdMap(): Promise<IdMap> {
  const existing = readJson<IdMap>('data/anime-ids.json', { updatedAt: '', anisearch: {} })
  const ageDays = existing.updatedAt
    ? (Date.now() - new Date(existing.updatedAt).getTime()) / 86_400_000
    : Number.POSITIVE_INFINITY
  if (ageDays < IDS_MAX_AGE_DAYS && Object.keys(existing.anisearch).length) return existing

  log('ID-Brücke wird geladen (anime-offline-database)…')
  const response = await fetch(IDS_URL, { redirect: 'follow', headers: { 'User-Agent': UA } })
  if (!response.ok) {
    warn(`ID-Brücke nicht abrufbar (HTTP ${response.status}) — bestehende Zuordnung bleibt.`)
    return existing
  }
  const body = (await response.json()) as { data?: { sources?: string[] }[] }
  const anisearch: Record<number, number> = {}
  for (const entry of body.data ?? []) {
    const sources = entry.sources ?? []
    const anilist = sources.find((s) => s.includes('anilist.co/anime/'))
    const search = sources.find((s) => s.includes('anisearch.com/anime/'))
    if (!anilist || !search) continue
    const a = Number(anilist.split('/').pop())
    const b = Number(search.split('/').pop())
    if (a && b) anisearch[a] = b
  }
  const map: IdMap = { updatedAt: new Date().toISOString(), anisearch }
  writeJson('data/anime-ids.json', map, true)
  log(`ID-Brücke: ${Object.keys(anisearch).length} Titel mit aniSearch-Kennung`)
  return map
}

function decode(raw: string): string {
  return raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

/**
 * Zieht die deutsche Inhaltsangabe aus der Seite.
 *
 * aniSearch legt je Sprache einen eigenen Block an; ohne die Sprachprüfung
 * bekäme man den englischen Text und hätte nichts gewonnen.
 */
function extractDescription(html: string): string | undefined {
  const section = /<section id="description">([\s\S]*?)<\/section>/.exec(html)?.[1]
  if (!section) return undefined
  const german = /<div lang="de"[^>]*>([\s\S]*?)<\/div>/.exec(section)?.[1]
  if (!german) return undefined
  const text = decode(
    german
      .replace(/<br\s*\/?>/gi, '\n')
      // Der Quellenhinweis am Ende ist Fußnote, nicht Inhalt.
      .replace(/<span class="source">[\s\S]*$/i, '')
      .replace(/Source:[\s\S]*$/i, '')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > 40 && !istPlatzhalter(text) ? text : undefined
}

/**
 * **Der Aufruf zum Mitschreiben ist keine Handlung.**
 *
 * Wo aniSearch keine deutsche Inhaltsangabe hat, steht trotzdem etwas im
 * `<div lang="de">` — eine Bitte an die Leser: „Eine kurze Inhaltsangabe zum
 * Anime ‚X' würde vielen Anime- und Manga-Fans weiterhelfen. Du kennst diesen
 * Anime bereits? Dann unterstütze aniSearch und füge eine kurze Beschreibung
 * hinzu."
 *
 * Der Text ist über 40 Zeichen lang, deutsch und wohlgeformt — er kam durch
 * jede Prüfung, die es hier gab. Am 04.09.2026 gemessen: **121 Titel** zeigten
 * live einen Mitmach-Aufruf an der Stelle, an der ihre Handlung stehen sollte,
 * und verdeckten dabei die englische Fassung, die es sehr wohl gab.
 *
 * **Die Lehre ist größer als der Fall:** Eine Quelle, die ein Feld immer
 * füllt, füllt es auch, wenn sie nichts hat. Ein Längentest prüft, dass etwas
 * dasteht — nicht, dass es die Frage beantwortet.
 */
function istPlatzhalter(text: string): boolean {
  return /unterstütze aniSearch|füge eine kurze Beschreibung|würde vielen Anime- und Manga-Fans/i.test(
    text,
  )
}

/**
 * Die Stream-Anbieter der Seite.
 *
 * aniSearch benennt den Anbieter auf zwei Wegen, je nachdem ob die Kachel ein
 * Anbieterlogo oder ein Titelbild trägt:
 *
 *   1. `<span class="name">Netflix</span>` — der Klartext, wenn vorhanden.
 *   2. sonst der Dateiname des Logos, etwa `…/streams/v2/crunchyroll.webp`.
 *
 * Nur auf den Dateinamen zu setzen, hat bei „Steel Ball Run" den Netflix-Link
 * verschluckt: Dort steht ein Serienbild statt eines Logos, der Name aber
 * ordentlich als Text daneben.
 */
function extractStreams(html: string): AnisearchStream[] {
  const start = html.indexOf('<section id="streams"')
  if (start < 0) return []
  const section = html.slice(start, html.indexOf('</section>', start))
  // Ein leerer Abschnitt trägt die Klasse `empty` und enthält nur den Aufruf,
  // selbst etwas beizutragen.
  if (/<section id="streams" class="empty"/.test(section)) return []

  const out: AnisearchStream[] = []
  for (const match of section.matchAll(/<a href="(https?:\/\/[^"]+)"[\s\S]*?<\/a>/g)) {
    const url = decode(match[1])
    if (out.some((s) => s.url === url)) continue
    const anchor = match[0]
    const named = /<span class="name">([^<]+)<\/span>/.exec(anchor)?.[1]
    const fromLogo = /\/streams\/[^"]*\/([a-z0-9_-]+)\.webp/i.exec(anchor)?.[1]
    const provider = (named ?? fromLogo ?? hostOf(url)).trim().toLowerCase().replace(/\s+/g, '-')
    if (provider) out.push({ provider, url })
  }
  return out
}

/**
 * Die Abschnitte, die ins Rohdaten-Archiv wandern.
 *
 * Warum überhaupt archiviert wird: Der erste Anlauf hat aus jeder Seite nur
 * Inhaltsangabe und Streams herausgelöst und die übrigen 110 KB verworfen. Als
 * dann die Folgenzahl gebraucht wurde, war der einzige Weg dorthin ein zweiter
 * Lauf über alle 2.612 Seiten — bei sechs Sekunden Abstand über vier Stunden
 * Last auf einem fremden Server, für Daten, die wir schon einmal hatten. Der
 * Abruf ist teuer, das Aufheben kostet drei Kilobyte.
 *
 * Was **nicht** ins Archiv geht, ist keine Platzfrage: Forum, Kommentare,
 * Rezensionen, Umfragen und Bearbeiterlisten sind Beiträge einzelner Menschen.
 * Die haben sie auf aniSearch veröffentlicht und nicht in unser Repo — wir
 * legen keine Sammlung fremder personenbezogener Daten an, nur weil sie
 * technisch mit im Abruf steckt.
 */
const ARCHIV_ABSCHNITTE = [
  'information',
  'description',
  'genres-tags',
  'streams',
  'trailers',
  'items',
  'images',
  'characters',
  'relations',
  'recommendations',
  'ratings',
  'status',
]

const ARCHIV_DIR = 'data/anisearch-raw'

/** Schneidet die aufhebenswerten Abschnitte aus der Seite. */
function extractArchive(html: string): string {
  const teile: string[] = []
  for (const id of ARCHIV_ABSCHNITTE) {
    const start = html.indexOf(`<section id="${id}"`)
    if (start < 0) continue
    const ende = html.indexOf('</section>', start)
    if (ende < 0) continue
    teile.push(html.slice(start, ende + 10))
  }
  return teile.join('\n')
}

/**
 * Legt die Rohabschnitte gzip-komprimiert ab — eine Datei je Titel.
 *
 * Eine Datei je Titel statt eines großen Archivs, weil Git binäre Dateien
 * komplett neu speichert statt als Änderung: Ein Sammelarchiv würde bei jedem
 * Nachtlauf in voller Größe erneut in die Historie wandern. So bleibt jede
 * Datei nach ihrem einzigen Schreibvorgang unangetastet.
 */
function saveArchive(anisearchId: number, html: string): void {
  const inhalt = extractArchive(html)
  if (!inhalt) return
  if (!existsSync(ARCHIV_DIR)) mkdirSync(ARCHIV_DIR, { recursive: true })
  const pfad = `${ARCHIV_DIR}/${anisearchId}.html.gz`
  const neu = gzipSync(inhalt, { level: 9 })
  // Unverändert nicht neu schreiben: Sonst erzeugt jeder Lauf mit --force
  // tausende neue Blobs in der Historie, obwohl sich nichts geändert hat.
  if (existsSync(pfad) && readFileSync(pfad).equals(neu)) return
  writeFileSync(pfad, neu)
}

/** Letzter Ausweg für den Anbieternamen: die Domain. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.')[0]
  } catch {
    return ''
  }
}

/** Tags raus, Entities auf, Leerraum normalisieren. */
function textOf(html: string): string {
  return decode(html.replace(/<[^>]+>/g, ' '))
    .replace(/‑/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Die Links eines Infobox-Feldes als Klartext — Studios, Staff, Publisher. */
function namesOf(html: string): string[] {
  const namen = [...html.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => textOf(m[1]))
    .filter(Boolean)
  return namen.length ? namen : textOf(html).split(/,\s*/).filter(Boolean)
}

/**
 * Zerlegt einen Infobox-Block in seine Felder.
 *
 * aniSearch schreibt jedes Feld als `<div class="…"><span class="header">Label:
 * </span>Wert`. Die Blöcke sind nicht sauber geschlossen — deshalb endet ein
 * Wert hier am Anfang des nächsten Feldes statt an einem `</div>`.
 */
function fields(block: string): { key: string; label: string; value: string }[] {
  const out: { key: string; label: string; value: string }[] = []
  // Ein Wert endet am nächsten Feld — oder an der nächsten Sprachflagge. Ohne
  // die zweite Grenze hängte sich an „Ausstrahlung: Mittwoch 23:45 (JST)" noch
  // der englische Titel an, der im HTML unmittelbar darauf folgt.
  const muster =
    /<div class="([a-z-]+)">\s*<span class="header">([^<]+):<\/span>([\s\S]*?)(?=<div class="[a-z-]+">\s*<span class="header">|<img[^>]*class="flag" alt=|$)/g
  for (const m of block.matchAll(muster)) {
    out.push({ key: m[1], label: decode(m[2]).trim(), value: m[3] })
  }
  return out
}

/**
 * Liest die Infobox aus — alles, was dort steht.
 *
 * Der Aufbau: ein allgemeiner Kopf (Typ, Folgen, Season, Studio, Staff,
 * Sendeplatz), danach je Sprachfassung ein eigener Block mit Titel, Status,
 * Zeitraum und Publisher. Getrennt werden sie durch die Flaggen-Bilder.
 */
export function extractInfo(html: string): AnisearchInfo | undefined {
  const start = html.indexOf('<section id="information"')
  if (start < 0) return undefined
  const section = html.slice(start, html.indexOf('</section>', start))

  const info: AnisearchInfo = { languages: [] }

  // Jeder Warnhinweis der Seite, im Wortlaut. Gedeutet wird unten nur der zur
  // Folgenzahl — die übrigen liegen für später bereit, statt verloren zu gehen.
  const issues = [...section.matchAll(/class="issue-[^"]*"[^>]*data-tooltip="([^"]+)"/g)].map((m) =>
    decode(m[1]),
  )
  if (issues.length) info.issues = [...new Set(issues)]

  // Die Flaggen der Sprachblöcke tragen `class` vor `alt`; die kleinen Flaggen
  // in der Webseiten-Zeile umgekehrt. Daran lassen sie sich sauber trennen.
  const marken = [...section.matchAll(/<img[^>]*class="flag" alt="([^"]+)" title="[^"]*">/g)]

  const grenzen = marken.map((m) => m.index!)

  for (const [i, marke] of marken.entries()) {
    const block = section.slice(grenzen[i], grenzen[i + 1] ?? section.length)
    const eintrag: AnisearchLanguage = { language: decode(marke[1]) }
    const titel = /<strong class="f16">([\s\S]*?)<\/strong>/.exec(block)?.[1]
    if (titel) eintrag.title = textOf(titel)
    const nativ = /<\/strong>\s*<div class="grey">([\s\S]*?)<\/div>/.exec(block)?.[1]
    if (nativ) eintrag.titleNative = textOf(nativ)

    for (const feld of fields(block)) {
      const wert = textOf(feld.value)
      if (!wert && feld.key !== 'status') continue
      switch (feld.label) {
        case 'Status':
          eintrag.status = wert.split(' ')[0] || undefined
          // Das Lautsprecher-Symbol trennt synchronisiert von untertitelt.
          if (/class="dubbed dubbed-1"/.test(feld.value)) eintrag.dubbed = true
          break
        case 'Veröffentlicht':
          eintrag.released = wert
          break
        case 'Publisher':
          eintrag.publisher = namesOf(feld.value)
          break
      }
    }
    info.languages.push(eintrag)
  }

  // Die allgemeinen Angaben stehen nicht vor dem ersten Sprachblock, sondern
  // im japanischen — Typ, Season und Studio folgen dort auf den Titel. Sie über
  // die ganze Infobox zu suchen ist deshalb nicht nur einfacher, sondern auch
  // haltbarer: Die Labels kommen genau einmal vor, „Studio" lässt sich nicht
  // mit dem blockweisen „Publisher" verwechseln.
  for (const feld of fields(section)) {
    const wert = textOf(feld.value)
    switch (feld.label) {
      case 'Typ': {
        // „TV-Serie, 13 (~24 min, Gesamt 5 Std)" — oder mit Warnzeichen
        // zwischen Komma und Zahl: „TV-Serie, ⚠ 12".
        //
        // Die Zahl muss unmittelbar hinter dem Komma gelesen werden, nicht als
        // letzte Zahl des Feldes: Dahinter stehen bei den meisten Titeln noch
        // Folgenlänge und Gesamtlaufzeit. Die erste Fassung nahm die letzte
        // Zahl und fand die Folgenzahl deshalb nur bei den wenigen Titeln
        // ohne Laufzeitangabe — 3 % statt 97 %.
        const typ = /^\s*([^,<]+?)\s*,\s*(?:<span[^>]*>[\s\S]*?<\/span>\s*)*(\d+)/.exec(feld.value)
        info.format = (typ?.[1] ?? wert.split(',')[0]).trim() || undefined
        if (typ?.[2]) info.episodes = Number(typ[2])
        if (/data-tooltip="Episodenanzahl[^"]*"/.test(feld.value)) info.episodesEstimated = true
        // Die Folgenlänge steht als maschinenlesbare Dauer daneben. Sie kostet
        // nichts und beantwortet die Frage, die nach „wann" als Nächstes kommt.
        const dauer = /<time datetime="PT(?:(\d+)H)?(?:(\d+)M)?"/.exec(feld.value)
        if (dauer) {
          const minuten = Number(dauer[1] ?? 0) * 60 + Number(dauer[2] ?? 0)
          if (minuten > 0) info.runtimeMinutes = minuten
        }
        break
      }
      case 'Season':
        info.season = wert
        break
      case 'Studio':
        info.studios = namesOf(feld.value)
        break
      case 'Staff':
        // „<a>Akio KAZUMI</a> (Direction)" — die Funktion steht hinter dem
        // Link, nicht darin. Sie mitzunehmen kostet nichts und macht die
        // Angabe erst brauchbar: Ein Regisseur ist etwas anderes als der
        // Zeichner der Vorlage.
        info.staff = [...feld.value.matchAll(/<a [^>]*>([\s\S]*?)<\/a>\s*(?:\(([^)]+)\))?/g)]
          .map((m) => ({ name: textOf(m[1]), role: m[2] ? decode(m[2]).trim() : undefined }))
          .filter((p) => p.name)
        break
      case 'Adaptiert von':
        info.adaptedFrom = wert
        break
      case 'Ausstrahlung':
        info.broadcast = wert
        break
      case 'Webseite':
        info.websites = [...feld.value.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
          .map((m) => ({ name: textOf(m[2]), url: decode(m[1]) }))
          .filter((w) => w.url)
        break
    }
  }

  // Synonyme stehen hinter dem letzten Sprachblock und damit außerhalb des
  // Kopfes — deshalb hier über die ganze Infobox.
  const synonyme = fields(section).find((f) => f.label === 'Synonyme')
  if (synonyme) {
    info.synonyms = textOf(synonyme.value.replace(/<input[\s\S]*$/, ''))
      .split(/,\s*/)
      .map((s) => s.replace(/…mehr$/, '').trim())
      .filter(Boolean)
  }

  return info
}

async function fetchTitle(anisearchId: number): Promise<Omit<AnisearchEntry, 'anisearchId'> | undefined> {
  const url = `https://www.anisearch.de/anime/${anisearchId}`
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    })
    if (!response.ok) {
      warn(`aniSearch ${anisearchId}: HTTP ${response.status}`)
      return undefined
    }
    const html = await response.text()
    // Zuerst archivieren, dann auswerten. Wenn ein Muster unten danebengreift,
    // liegt die Seite trotzdem vor und der Fehler ist ohne neuen Abruf zu
    // beheben — genau darum geht es beim Archiv.
    saveArchive(anisearchId, html)
    return {
      descriptionDe: extractDescription(html),
      streams: extractStreams(html),
      info: extractInfo(html),
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    warn(`aniSearch ${anisearchId}: ${(err as Error).message}`)
    return undefined
  }
}

/** Nur bei direktem Aufruf loslaufen — der Parser wird auch importiert. */
const IST_HAUPTLAUF = process.argv[1]?.replace(/\\/g, '/').endsWith('fetch-anisearch.ts')

async function main(): Promise<void> {
  const ids = await loadIdMap()
  // Die vollständige Liste, nicht `titles-core.json` — die enthält nur Titel
  // mit Termin, und gerade die alten Katalogtitel brauchen den deutschen Text
  // am dringendsten.
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const cache = readJson<Record<string, AnisearchEntry>>('data/anisearch.json', {})

  // Titel mit Termin zuerst — das sind die, die tatsächlich jemand aufschlägt.
  const withRelease = new Set(releases.map((r) => r.titleId))
  const queue = titles
    .filter((t) => ids.anisearch[t.id])
    /**
     * Geholt wird, was fehlt **oder was zu alt ist**.
     *
     * Bis zum 15.08.2026 stand hier nur „noch nicht im Bestand oder ohne
     * Infobox". Damit war jeder Titel nach dem ersten erfolgreichen Abruf
     * dauerhaft erledigt, und sein Bestand an Anbietern fror ein. Das ist genau
     * dort falsch, wo sich am meisten ändert: Verliert ein Dienst die
     * Lizenzrechte, nimmt er die deutsche Fassung wieder aus dem Angebot —
     * Crunchyroll führt aus diesem Grund keine erste Staffel von „Attack on
     * Titan" mehr (Daniel, 15.08.2026). Ein Bestand, der nur wachsen kann,
     * behauptet solche Angebote weiter.
     *
     * Vierzehn Tage sind der Kompromiss: aniSearch gehört einer kleinen
     * Redaktion, jeder Abruf kostet dort Last, und Lizenzen wechseln nicht
     * wöchentlich. Bei 2.612 Einträgen bedeutet das rund 190 Abrufe je Nacht,
     * verteilt über die ohnehin laufende Warteschlange.
     */
    /*
      **Eine fehlende Archivdatei ist ein Grund zum Nachholen — auch bei
      frischem Abrufdatum.**

      Am 29.08.2026 gemessen: 2.616 Titel haben einen vollständigen Eintrag mit
      `info` und einem Abrufdatum von heute — und **1.660 davon haben keine
      Archivdatei**. Das Archiv ist irgendwann verlorengegangen, vermutlich beim
      Aufräumen der verschachtelten Ordner am 24.08.2026 (13.458 Dateien).

      Gemerkt hat es niemand, denn die Warteschlange fragte nur nach dem Alter,
      und das war in Ordnung. Der Lauf meldete „nichts nachzuladen", während
      zwei Drittel des Archivs fehlten.

      **Was daran hängt:** Aus dem Archiv kommen seit dem 29.08. die deutschen
      Disc-Ausgaben — der einzige Bezugsweg für 173 Titel, die sonst keinen
      zeigen. Ohne Archivdatei ist ein Titel dort unsichtbar, egal wie frisch
      sein Eintrag aussieht.

      Das ist dieselbe Lehre wie „Ein Abruf, der nur ergänzt, veraltet
      zwangsläufig" (CLAUDE.md), eine Ebene tiefer: **Ein Abruf, der nur nach
      dem Alter fragt, merkt einen Datenverlust nicht.**
    */
    .filter(
      (t) =>
        FORCE ||
        !cache[t.id] ||
        !cache[t.id].info ||
        veraltet(cache[t.id]) ||
        !existsSync(`${ARCHIV_DIR}/${ids.anisearch[t.id]}.html.gz`),
    )
    /*
      **Wer noch nie geholt wurde, kommt vor jeder Auffrischung.**

      Bis zum 04.09.2026 sortierte hier nur ein Kriterium: Titel mit Termin
      zuerst. In derselben Gruppe standen damit zwei sehr verschiedene Fälle —
      ein Titel ohne **jede** Angabe und 1.660 Titel, die nur ihre Archivdatei
      nachholen (siehe den Absatz darüber). Bei 200 Abrufen je Lauf heißt das:
      Der Neue wartet acht Läufe lang hinter Einträgen, die bereits vollständig
      sind.

      Genau so geschehen bei „Die Tagebücher der Apothekerin: Staffel 3": Die
      ID-Brücke kannte die Zuordnung seit dem 31.08. (AniList 195516 → aniSearch
      20704), der Titel lief am 01.10. an, und im Bestand stand weder eine
      aniSearch-Kennung noch eine deutsche Beschreibung — die Seite zeigte
      englischen AniList-Text (Daniel, 04.09.2026: „hat anisearch handlung?
      bestimmt besser und deutsch"). Er hatte recht: aniSearch führt die Seite,
      wir hatten sie nur nie abgerufen.

      Fehlt ein Eintrag ganz, kostet sein Abruf dasselbe wie eine Auffrischung
      und bringt ungleich mehr — also zuerst.
    */
    .sort(
      (a, b) =>
        Number(!cache[b.id]) - Number(!cache[a.id]) ||
        Number(withRelease.has(b.id)) - Number(withRelease.has(a.id)),
    )
    .slice(0, LIMIT)

  if (!queue.length) {
    log('aniSearch: nichts nachzuladen.')
    recordSource('anisearch', Object.keys(cache).length)
    return
  }

  log(`aniSearch: ${queue.length} Titel werden geholt (${Object.keys(cache).length} bereits im Bestand)`)
  let neu = 0
  let mitText = 0
  let mitStream = 0

  let fehlerInFolge = 0
  for (const title of queue) {
    const anisearchId = ids.anisearch[title.id]
    const entry = await fetchTitle(anisearchId)
    if (entry) {
      cache[title.id] = { anisearchId, ...entry }
      neu++
      fehlerInFolge = 0
      if (entry.descriptionDe) mitText++
      if (entry.streams.length) mitStream++
    } else if (++fehlerInFolge >= MAX_FAILURES) {
      warn(`${MAX_FAILURES} Fehlschläge in Folge — aniSearch macht dicht. Lauf wird beendet.`)
      break
    }
    // Zwischendurch sichern. Ein Lauf über tausend Titel dauert eine gute
    // halbe Stunde; würde erst am Ende geschrieben, wäre ein Abbruch kurz
    // davor gleichbedeutend mit tausend vergeblichen Anfragen an eine fremde
    // Seite. Genau das ist einmal passiert.
    if (neu % 25 === 0) writeJson('data/anisearch.json', cache, true)
    // Reichlich Abstand. Die Seite gehört einer kleinen Redaktion, nicht einem
    // Rechenzentrum — ein Ansturm ist respektlos und endet in einer Sperre.
    await sleep(DELAY_MS)
  }

  writeJson('data/anisearch.json', cache, true)
  recordSource('anisearch', neu, neu ? undefined : 'kein Titel abrufbar')
  log(`aniSearch: ${neu} geholt, davon ${mitText} mit deutschem Text, ${mitStream} mit Stream-Angabe`)
}

if (IST_HAUPTLAUF) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
