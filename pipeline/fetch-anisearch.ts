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
import { KENNUNG } from './lib/kennung.ts'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { ARCHIV_DIR, baueWarteschlange } from './lib/anisearch-warteschlange.ts'
import { archivLuecken, verbinde, zurueckgestellt, type Auftrag, type WegListe, type Zeile } from './lib/anisearch-archiv-vorrang.ts'
import { nachFehlern } from './lib/anisearch-sperre.ts'
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
/*
  **Browser-Signatur plus Projektkennung**. aniSearch weist die nackte
  Projektkennung seit dem 19.09.2026 mit HTTP 423 ab; die Begründung und die Messung stehen
  in `lib/kennung.ts`.
*/
const UA = KENNUNG
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
function saveArchive(anisearchId: number, html: string): boolean {
  const inhalt = extractArchive(html)
  if (!inhalt) return false
  if (!existsSync(ARCHIV_DIR)) mkdirSync(ARCHIV_DIR, { recursive: true })
  const pfad = `${ARCHIV_DIR}/${anisearchId}.html.gz`
  const neu = gzipSync(inhalt, { level: 9 })
  // Unverändert nicht neu schreiben: Sonst erzeugt jeder Lauf mit --force
  // tausende neue Blobs in der Historie, obwohl sich nichts geändert hat.
  if (!existsSync(pfad) || !readFileSync(pfad).equals(neu)) writeFileSync(pfad, neu)
  return true
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
    /*
      **Der Wert endet am `</div>`, nicht am Ende der Infobox.**

      Synonyme sind das letzte Feld; `fields()` schneidet erst am nächsten Feld
      oder am Abschnittsende, und dazwischen steht noch der Knopf „Alle
      anzeigen". Ohne diesen Schnitt hängt er am **letzten** Synonym — gemessen
      am 08.09.2026 bei 1.840 von 2.430 Einträgen im Bestand. Aufgefallen ist es
      nie, weil das Feld bis dahin niemand gelesen hat.
    */
    const roh = synonyme.value.split('</div>')[0]!.replace(/<input[\s\S]*$/, '')
    info.synonyms = textOf(roh)
      .split(/,\s*/)
      .map((s) => s.replace(/…mehr$/, '').trim())
      .filter(Boolean)
  }

  return info
}

type Abruf =
  | { art: 'ok'; entry: Omit<AnisearchEntry, 'anisearchId'>; archiviert: boolean }
  /** Endgültige Auskunft der Seite (404/410): gibt es nicht. Keine Nichtauskunft — die heißt `fehler`. */
  | { art: 'weg'; code: number }
  | { art: 'fehler' }

async function fetchTitle(anisearchId: number): Promise<Abruf> {
  const url = `https://www.anisearch.de/anime/${anisearchId}`
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    })
    if (!response.ok) {
      warn(`aniSearch ${anisearchId}: HTTP ${response.status}`)
      return response.status === 404 || response.status === 410 ? { art: 'weg', code: response.status } : { art: 'fehler' }
    }
    const html = await response.text()
    // Zuerst archivieren, dann auswerten. Wenn ein Muster unten danebengreift,
    // liegt die Seite trotzdem vor und der Fehler ist ohne neuen Abruf zu
    // beheben — genau darum geht es beim Archiv.
    const archiviert = saveArchive(anisearchId, html)
    return {
      art: 'ok',
      archiviert,
      entry: {
        descriptionDe: extractDescription(html),
        streams: extractStreams(html),
        info: extractInfo(html),
        fetchedAt: new Date().toISOString(),
      },
    }
  } catch (err) {
    warn(`aniSearch ${anisearchId}: ${(err as Error).message}`)
    return { art: 'fehler' }
  }
}

const WEG_DATEI = 'data/anisearch-archiv-weg.json'

/**
 * Holt die Seiten der Reihe nach, im Abstand von `DELAY_MS`. Fehlschläge in Folge (Sperre, Zeitüberschreitung) beenden den Lauf — mit Frist (`ende`)
 * legt er stattdessen Pausen ein und fragt danach einzeln nach (`lib/anisearch-sperre.ts`). Wer nicht kam, bleibt in der Lücke; vermerkt wird nur
 * eine endgültige Auskunft (404/410, Seite ohne Archivabschnitte).
 */
async function arbeiteAb(queue: Auftrag[], cache: Record<string, AnisearchEntry>, weg: WegListe, ende?: number) {
  const z = { neu: 0, mitText: 0, mitStream: 0, weg: 0 }
  let fehlerInFolge = 0
  let pausen = 0
  let abrufe = 0
  const sichern = (): void => {
    writeJson('data/anisearch.json', cache, true)
    writeJson(WEG_DATEI, weg, true)
  }
  for (const { asId, titelIds } of queue) {
    if (ende !== undefined && Date.now() >= ende) {
      log('aniSearch: Frist erreicht — der Rest bleibt für den nächsten Lauf.')
      break
    }
    const abruf = await fetchTitle(asId)
    if (abruf.art === 'ok') {
      for (const id of titelIds) cache[id] = { anisearchId: asId, ...abruf.entry }
      z.neu++
      if (abruf.entry.descriptionDe) z.mitText++
      if (abruf.entry.streams.length) z.mitStream++
      // Eine Seite ohne Archivabschnitte kann auch eine Sperrseite sein: zählt als Fehlschlag, gemerkt wird sie nur kurz.
      if (abruf.archiviert) fehlerInFolge = 0
      else {
        fehlerInFolge++
        weg[asId] = { code: 200, am: new Date().toISOString() }
      }
    } else if (abruf.art === 'weg') {
      weg[asId] = { code: abruf.code, am: new Date().toISOString() }
      z.weg++
      fehlerInFolge = 0
    } else fehlerInFolge++
    const folge = nachFehlern(fehlerInFolge, MAX_FAILURES, pausen, ende === undefined ? undefined : ende - Date.now())
    if (folge.art === 'ende') {
      warn(`${MAX_FAILURES} Fehlschläge in Folge — aniSearch macht dicht. Lauf wird beendet.`)
      break
    }
    if (folge.art === 'pause') {
      sichern()
      warn(`${MAX_FAILURES} Fehlschläge in Folge — Pause ${folge.minuten} Minuten, danach eine einzelne Anfrage.`)
      await sleep(folge.minuten * 60_000)
      pausen++
      fehlerInFolge = MAX_FAILURES - 1
    }
    // Zwischendurch sichern. Ein Lauf über tausend Titel dauert eine gute
    // halbe Stunde; würde erst am Ende geschrieben, wäre ein Abbruch kurz
    // davor gleichbedeutend mit tausend vergeblichen Anfragen an eine fremde
    // Seite. Genau das ist einmal passiert.
    if (++abrufe % 25 === 0) sichern()
    // Reichlich Abstand. Die Seite gehört einer kleinen Redaktion, nicht einem
    // Rechenzentrum — ein Ansturm ist respektlos und endet in einer Sperre.
    await sleep(DELAY_MS)
  }
  sichern()
  return z
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
  const weg = readJson<WegListe>(WEG_DATEI, {})
  const katalog = readJson<Zeile[]>('public/data/ohne-synchro.json', [])
  const mitTermin = new Set(releases.map((r) => r.titleId))
  const luecken = () => archivLuecken({ haupt: titles, katalog, bruecke: ids.anisearch, mitTermin, hatCache: (id) => Boolean(cache[id]), weg, jetztMs: Date.now() })
  const zaehle = (l: ReturnType<typeof luecken>): string => `Hauptbestand ${l.haupt.length}, Katalog ${l.katalog.length} Kennungen ohne Archivseite`
  const vorher = luecken()
  log(`aniSearch-Lücke vorher: ${zaehle(vorher)}`)

  // Vorrang: Archivlücken des Hauptbestands, dann Auffrischung und Neues der ID-Brücke, mit --katalog zuletzt die Lücken des Katalogs.
  const bisher = baueWarteschlange({ ids: ids.anisearch, titles, releases, cache, force: FORCE, limit: LIMIT, veraltet })
  const queue = verbinde(
    vorher.haupt,
    bisher.map((t) => ({ asId: ids.anisearch[t.id]!, titelIds: [t.id] })),
    args.includes('--katalog') ? vorher.katalog : [],
  )
    .filter((a) => !zurueckgestellt(weg, a.asId, Date.now()))
    .slice(0, LIMIT)

  if (!queue.length) {
    log('aniSearch: nichts nachzuladen.')
    recordSource('anisearch', Object.keys(cache).length)
    return
  }

  log(`aniSearch: ${queue.length} Seiten werden geholt (${Object.keys(cache).length} Titel bereits im Bestand)`)
  const fristMin = Number(args[args.indexOf('--frist') + 1]) || 0
  const z = await arbeiteAb(queue, cache, weg, fristMin ? Date.now() + fristMin * 60_000 : undefined)
  recordSource('anisearch', z.neu, z.neu ? undefined : 'kein Titel abrufbar')
  log(`aniSearch: ${z.neu} geholt, davon ${z.mitText} mit deutschem Text, ${z.mitStream} mit Stream-Angabe; ${z.weg} Seiten gibt es nicht mehr`)
  log(`aniSearch-Lücke nachher: ${zaehle(luecken())}`)
}

if (IST_HAUPTLAUF) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
