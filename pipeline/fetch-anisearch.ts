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
 * Die Zuordnung AniList → aniSearch kommt aus der anime-offline-database des
 * manami-Projekts (ODbL). Titelvergleiche wären hier fatal: „.hack//Quantum"
 * und „.hack//Sign" trennt kein Suchindex zuverlässig.
 *
 * Aufruf: npm run data:anisearch [-- --limit 250]
 */
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Release, Title } from '../shared/types.ts'

const args = process.argv.slice(2)
/**
 * Wie viele Seiten ein Lauf höchstens holt.
 *
 * Bewusst klein. Ein Versuch mit 2.900 Titeln am Stück endete damit, dass
 * aniSearch die Verbindung verweigerte (`UND_ERR_CONNECT_TIMEOUT`) — nach rund
 * tausend Anfragen im Sekundentakt, und zu Recht. Der Bestand liegt im Repo
 * und wächst mit jedem Nachtlauf; er muss nicht an einem Tag vollständig sein.
 */
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 120
const FORCE = args.includes('--force')

/** Abstand zwischen zwei Anfragen. */
const DELAY_MS = 2500

/**
 * So viele Fehlschläge hintereinander, dann ist Schluss.
 *
 * Wenn eine Seite dichtmacht, hilft Weitermachen niemandem: Jede weitere
 * Anfrage ist nutzlos und verlängert nur die Sperre. Abbrechen ist hier die
 * höflichere und die klügere Reaktion.
 */
const MAX_FAILURES = 5

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
const IDS_URL =
  'https://github.com/manami-project/anime-offline-database/releases/latest/download/anime-offline-database-minified.json'

/** Wie lange die ID-Brücke gilt, bevor sie neu geladen wird. */
const IDS_MAX_AGE_DAYS = 7

export interface AnisearchStream {
  /** Erkennungsname des Anbieters, wie aniSearch ihn im Bild führt. */
  provider: string
  url: string
}

export interface AnisearchEntry {
  anisearchId: number
  /** Deutsche Inhaltsangabe, Quellenhinweis entfernt. */
  descriptionDe?: string
  streams: AnisearchStream[]
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
  return text.length > 40 ? text : undefined
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

/** Letzter Ausweg für den Anbieternamen: die Domain. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.')[0]
  } catch {
    return ''
  }
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
    return {
      descriptionDe: extractDescription(html),
      streams: extractStreams(html),
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    warn(`aniSearch ${anisearchId}: ${(err as Error).message}`)
    return undefined
  }
}

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
    .filter((t) => FORCE || !cache[t.id])
    .sort((a, b) => Number(withRelease.has(b.id)) - Number(withRelease.has(a.id)))
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

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
