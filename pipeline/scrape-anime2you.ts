/**
 * Liest die Nachrichten-Feeds von Anime2You und macht daraus **Vorschläge**.
 *
 * Warum Vorschläge und keine Termine: Der Text einer Meldung ist kein
 * Datensatz. „Ab dem 4. September" kann sich auf den Titel im Titel der
 * Meldung beziehen — oder auf einen anderen, der im dritten Absatz erwähnt
 * wird. Maschinell ist das nicht sicher zu trennen, und dieses Projekt lebt
 * davon, dass die Termine stimmen. Deshalb schreibt dieser Lauf nach
 * `data/proposals/anime2you.json` und rührt `data/curated/` nicht an.
 *
 * Der eigentliche Gewinn ist die Vollständigkeit: Anime2You meldet Netflix,
 * Disney+, Prime Video, ADN, Aniverse, WOW, Joyn, RTL+, Kino und Disc — also
 * genau die Anbieter, für die es keine maschinenlesbare Quelle gibt. Wer den
 * Bericht liest, sieht in einer Liste, was seit der letzten Pflege dazukam.
 *
 * Anime2You erlaubt das Auslesen ausdrücklich: die robots.txt sperrt nur
 * /wp-admin/ und einige SEO-Crawler. Wir kommen mit einem Aufruf je Kategorie
 * und einer Pause dazwischen aus.
 *
 * Aufruf: npx tsx pipeline/scrape-anime2you.ts
 */
import { findDates, parseFeed, type FoundDate } from './lib/feed.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { loadCurated } from './lib/curated.ts'
import type { PlatformId } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'

const UA = 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)'

const FEEDS: { category: string; url: string }[] = [
  { category: 'streaming', url: 'https://www.anime2you.de/streaming-news/feed/' },
  { category: 'disc', url: 'https://www.anime2you.de/disc-news/feed/' },
  { category: 'kino', url: 'https://www.anime2you.de/kino-news/feed/' },
]

/** Wortmarken, an denen eine Plattform im Fließtext erkennbar ist. */
const PLATFORM_HINTS: { platform: PlatformId; pattern: RegExp }[] = [
  { platform: 'crunchyroll', pattern: /\bcrunchyroll\b/i },
  { platform: 'netflix', pattern: /\bnetflix\b/i },
  { platform: 'primevideo', pattern: /\b(prime video|amazon prime)\b/i },
  { platform: 'disneyplus', pattern: /\bdisney\+|disney plus\b/i },
  { platform: 'adn', pattern: /\b(adn|animation digital network)\b/i },
  { platform: 'aniverse', pattern: /\baniverse\b/i },
  { platform: 'wow', pattern: /\b(wow|sky ticket)\b/i },
  { platform: 'joyn', pattern: /\bjoyn\b/i },
  { platform: 'rtlplus', pattern: /\brtl\+/i },
  { platform: 'youtube', pattern: /\byoutube\b/i },
  { platform: 'kino', pattern: /\bkino(start|s)?\b/i },
  { platform: 'disc', pattern: /\b(blu-ray|dvd|steelbook)\b/i },
]

/**
 * Formulierungen, die eine Unterbrechung des Wochentakts ankündigen.
 *
 * Der Kalender rechnet Folgetermine im Siebener-Rhythmus fort. Fällt eine
 * Woche aus, stimmt danach alles nicht mehr — und niemand merkt es, weil kein
 * Kalender-Feed „diese Woche nichts" meldet. Solche Meldungen stehen nur in
 * News.
 *
 * Wie ergiebig das ist, wurde am 12.08.2026 gemessen statt geschätzt: In 3.136
 * Artikeln aus neun Monaten trugen 62 ein Pausen- oder Verschiebungssignal,
 * aber nur **vier** einen erkennbaren Bezug zur deutschen Fassung — der Rest
 * betraf japanische Ausstrahlungen, Disc-Termine und Kinostarts. Etwa eine
 * relevante Meldung alle zwei Monate. Für einen Erkenner mit Textanalyse ist
 * das zu wenig; für einen Filter, der sie zur Prüfung vorlegt, genau richtig.
 */
const PAUSE_HINTS: { art: string; pattern: RegExp }[] = [
  { art: 'pause', pattern: /\b(sende)?pause\b|pausiert|legt eine pause|unterbrich|unterbrochen/i },
  { art: 'verschoben', pattern: /verschoben|verschiebt sich|verzögert|verspätet|später als geplant/i },
  { art: 'entfällt', pattern: /entfällt|fällt aus|kein[e]? neue[n]? folge/i },
  { art: 'recap', pattern: /\brecap\b|best-of-folge|zusammenfassungsfolge|rückblickfolge/i },
]

/** Formulierungen, die eine deutsche Sprachfassung ausdrücklich zusagen. */
const DUB_CONFIRMED =
  /(deutsche[rn]? (synchro|synchronisation|sprachfassung|fassung)|auf deutsch|deutsch(er)? ton|deutsch und japanisch|synchronfassung)/i
/** Formulierungen, die sie ausdrücklich offen lassen — das ist die Warnung. */
const DUB_OPEN =
  /(sprachfassung(en)? (sind|stehen|ist) noch (offen|aus)|sprache unbekannt|noch nicht bekannt.{0,40}sprach)/i

export interface Proposal {
  articleTitle: string
  articleUrl: string
  publishedAt: string
  category: string
  platforms: PlatformId[]
  dates: FoundDate[]
  /** 'ja' — ausdrücklich zugesagt, 'offen' — ausdrücklich unklar, sonst 'unklar'. */
  dub: 'ja' | 'offen' | 'unklar'
  /**
   * Gesetzt, wenn die Meldung eine Unterbrechung des Wochentakts ankündigt —
   * „pause", „verschoben", „entfällt" oder „recap".
   *
   * Solche Artikel kommen auch **ohne** künftiges Datum in die Liste: „Die
   * Serie pausiert bis auf Weiteres" nennt keins, ändert den Kalender aber
   * trotzdem. Sie sind der einzige Fall, in dem ein Vorschlag ohne Termin
   * nützlich ist.
   */
  pause?: string
  /** true, wenn dieser Artikel schon als Quelle in data/curated/ steht. */
  alreadyCurated: boolean
}

async function fetchText(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, text/xml' } })
    if (!res.ok) {
      warn(`${url}: HTTP ${res.status}`)
      return undefined
    }
    return await res.text()
  } catch (err) {
    warn(`${url}: ${(err as Error).message}`)
    return undefined
  }
}

async function main(): Promise<void> {
  // Welche Artikel sind schon eingearbeitet? Steht in den `sources` der
  // kuratierten Einträge — die Adresse ist der Schlüssel.
  const curatedSources = new Set(
    loadCurated().flatMap((entry) => (entry.sources ?? []).map((s) => s.replace(/\/$/, ''))),
  )

  const today = todayIso()
  const proposals: Proposal[] = []

  for (const feed of FEEDS) {
    const xml = await fetchText(feed.url)
    if (!xml) continue
    const items = parseFeed(xml)
    log(`Anime2You ${feed.category}: ${items.length} Meldungen`)

    for (const item of items) {
      const text = `${item.title}\n${item.content}`
      const dates = findDates(text, item.publishedAt)
      // Nur was in der Zukunft liegt oder gerade erst war, ist ein Termin-
      // Kandidat. Rückblicke auf japanische Ausstrahlungen sind es nicht.
      const relevant = dates.filter((d) => (d.iso ?? `${d.month}-31`) >= today)
      const platforms = PLATFORM_HINTS.filter((h) => h.pattern.test(text)).map((h) => h.platform)
      const dub = DUB_OPEN.test(text) ? 'offen' : DUB_CONFIRMED.test(text) ? 'ja' : 'unklar'

      // Pausen nur melden, wenn die deutsche Fassung gemeint sein kann. Ohne
      // diese Bedingung überwiegen japanische Ausstrahlungen bei weitem: In der
      // Messung vom 12.08.2026 trugen 62 Artikel ein Pausensignal, aber nur
      // vier einen Bezug zur deutschen Fassung. Wer die übrigen 58 mitliest,
      // hört nach der zweiten Woche auf, die Liste anzusehen.
      const pause =
        dub !== 'unklar' || platforms.length
          ? PAUSE_HINTS.find((p) => p.pattern.test(text))?.art
          : undefined

      // Ein Vorschlag braucht einen künftigen Termin — außer er meldet eine
      // Pause. „Die Serie pausiert bis auf Weiteres" nennt kein Datum und
      // ändert den Kalender trotzdem.
      if (!relevant.length && !pause) continue

      proposals.push({
        articleTitle: item.title,
        articleUrl: item.link,
        publishedAt: item.publishedAt,
        category: feed.category,
        platforms,
        dates: relevant,
        dub,
        ...(pause ? { pause } : {}),
        alreadyCurated: curatedSources.has(item.link.replace(/\/$/, '')),
      })
    }
    await sleep(1200)
  }

  recordSource('anime2you', proposals.length, proposals.length ? undefined : 'kein Feed-Eintrag mit Termin')
  if (!proposals.length) {
    warn('Keine Vorschläge gefunden — Feed-Aufbau geändert? Bestand bleibt unangetastet.')
    return
  }

  // Bestehende Vorschläge behalten: Ein Feed zeigt nur die letzten Meldungen,
  // ältere wären sonst nach einer Woche verschwunden, bevor jemand sie liest.
  const previous = readJson<{ proposals: Proposal[] }>('data/proposals/anime2you.json', { proposals: [] })
  const merged = new Map(previous.proposals.map((p) => [p.articleUrl, p]))
  for (const proposal of proposals) merged.set(proposal.articleUrl, proposal)

  const all = [...merged.values()]
    // Was inzwischen kuratiert wurde, neu bewerten statt alten Stand behalten.
    .map((p) => ({ ...p, alreadyCurated: curatedSources.has(p.articleUrl.replace(/\/$/, '')) }))
    .filter((p) => p.dates.some((d) => (d.iso ?? `${d.month}-31`) >= today) || !p.alreadyCurated)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  writeJson('data/proposals/anime2you.json', { scrapedAt: new Date().toISOString(), proposals: all }, true)

  const offen = all.filter((p) => !p.alreadyCurated)
  log(`${all.length} Vorschläge gespeichert, davon ${offen.length} noch nicht eingearbeitet.`)
  for (const p of offen.slice(0, 15)) {
    const when = p.dates.map((d) => d.iso ?? d.month).join(', ')
    log(`  · [${p.platforms.join('/') || '?'}] ${p.articleTitle} — ${when} (Synchro: ${p.dub})`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
