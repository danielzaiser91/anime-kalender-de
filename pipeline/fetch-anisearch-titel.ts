/**
 * **Deutsche Titel für Anime ohne belegte Synchro.**
 *
 * Anlass (Daniel, 31.08.2026): „Ein Landei aus dem Dorf vor dem letzten Dungeon
 * sucht das Abenteuer in der Stadt" läuft bei Prime, war in unserer Datenbank
 * aber nicht zu finden. Der Titel steht als AniList 112649 in
 * `ohne-synchro.json` — ohne deutschen Namen, denn AniList führt keine, und
 * geholt wurden sie bisher nur für die rund 2.700 kuratierten Titel.
 *
 * Sein Urteil: „anilist ist müll, die bessere quelle ist anisearch."
 *
 * **Gemessen, bevor umgestellt wurde** (die Zahlen stehen in `status.md`):
 *
 * - aniSearch 14694 führt exakt den Titel, den auch Prime zeigt.
 * - Die ID-Brücke aus `data/anime-ids.json` deckt 11.609 der 15.119 Titel ab.
 * - TMDB kennt denselben Titel und wäre mit 28 Abrufen je Sekunde viel
 *   schneller — hat aber **keine** ID-Brücke. Über die Namenssuche blieben 28
 *   von 50 Stichproben ohne Treffer, und „Dream" wurde zu „Traum Studios".
 *   Ein Falschtreffer bringt einen erfundenen deutschen Titel in den Bestand.
 *
 * Deshalb aniSearch über die Kennung, im Takt von zwei Sekunden: Am 09.08.2026
 * hat ein zu schneller Lauf die IP gesperrt, und das traf auch Daniel selbst.
 *
 * Aufruf: `tsx pipeline/fetch-anisearch-titel.ts [--limit N] [--alle]`
 * Ohne `--alle` kommen nur TV/ONA ab 2015 dran — dort laufen die Titel, die bei
 * einem Anbieter zu sehen sind und deshalb überhaupt einen deutschen Namen
 * tragen (Daniel: „erstmal alle ab 2015, danach den rest").
 */
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'

const UA = 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)'
const TAKT_MS = 2000
/* `--limit` heißt es in allen anderen Läufen — dieselbe Schreibweise spart eine Fehlerquelle. */
const GRENZE = Number(/--limit[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 2500)
const ALLE = process.argv.includes('--alle')

interface OhneSynchro {
  id: number
  titleRomaji?: string
  titleEn?: string
  titleDe?: string
  format?: string
  jpYear?: number
}
interface Titeleintrag {
  /** Wie der Titel bei aniSearch heißt — der deutsche Name, wo es einen gibt. */
  titel: string
  anisearchId: number
  fetchedAt: string
}

const bruecke = readJson<{ anisearch: Record<string, number> }>('data/anime-ids.json', {
  anisearch: {},
}).anisearch
const bestand = readJson<Record<string, Titeleintrag>>('data/anisearch-titel.json', {})
const ohne = readJson<OhneSynchro[]>('public/data/ohne-synchro.json', [])

if (!Object.keys(bruecke).length) {
  warn('Keine aniSearch-Kennungen in data/anime-ids.json — erst `data:anisearch` laufen lassen.')
  process.exit(0)
}

/**
 * **Die Reihenfolge ist die Entscheidung.**
 *
 * Neuere Serien zuerst, denn ein deutscher Titel entsteht, wenn ein Anbieter
 * den Anime hierzulande zeigt. Bei einer Serie von 1979 gibt es meistens keinen,
 * und der Abruf kostet trotzdem zwei Sekunden.
 */
const warteschlange = ohne
  .filter((t) => bruecke[String(t.id)] && !bestand[String(t.id)])
  .filter((t) => ALLE || (['TV', 'ONA'].includes(t.format ?? '') && (t.jpYear ?? 0) >= 2015))
  .sort((a, b) => (b.jpYear ?? 0) - (a.jpYear ?? 0))

log(`${warteschlange.length} Titel offen, davon kommen ${Math.min(GRENZE, warteschlange.length)} dran`)

/** Der deutsche Name steht in der Überschrift der Seite, nicht im Seitentitel. */
function titelAus(html: string): string | null {
  const m = /<h1[^>]*id="htitle"[^>]*>([^<]+)</.exec(html)
  return m ? m[1].replace(/\s+/g, ' ').trim() || null : null
}

let geholt = 0
let neu = 0
for (const t of warteschlange.slice(0, GRENZE)) {
  const asId = bruecke[String(t.id)]!
  try {
    const antwort = await fetch(`https://www.anisearch.de/anime/${asId}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    })
    if (!antwort.ok) {
      warn(`aniSearch ${asId} (AniList ${t.id}): HTTP ${antwort.status}`)
      /* Eine Sperre erkennt man daran, dass sie nicht aufhört — dann abbrechen. */
      if (antwort.status === 403 || antwort.status === 429) {
        warn('Abbruch: aniSearch weist ab. Der Rest kommt im nächsten Lauf.')
        break
      }
      continue
    }
    const titel = titelAus(await antwort.text())
    if (titel) {
      bestand[String(t.id)] = { titel, anisearchId: asId, fetchedAt: new Date().toISOString() }
      neu++
    }
    geholt++
    if (geholt % 100 === 0) log(`  ${geholt}/${Math.min(GRENZE, warteschlange.length)} — zuletzt „${titel ?? '—'}"`)
  } catch (err) {
    warn(`aniSearch ${asId}: ${(err as Error).message}`)
  }
  await sleep(TAKT_MS)
}

writeJson('data/anisearch-titel.json', bestand, true)
log(`${geholt} Seiten geholt, ${neu} Titel gesichert, ${Object.keys(bestand).length} insgesamt`)
