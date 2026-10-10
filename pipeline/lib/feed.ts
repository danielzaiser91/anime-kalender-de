/**
 * Minimaler RSS-Leser und deutsche Datumserkennung.
 *
 * Absichtlich ohne Fremdbibliothek: Wir brauchen genau vier Felder und eine
 * Handvoll Datumsformen. Ein XML-Parser als Abhängigkeit wäre mehr Wartung als
 * Nutzen — und die Feeds hier sind alle WordPress, also gleich aufgebaut.
 */
import { diffDays, toIsoDate } from '../../shared/time.ts'

export interface FeedItem {
  title: string
  link: string
  /** ISO-Datum der Veröffentlichung des Artikels, nicht des Releases. */
  publishedAt: string
  /** Volltext, soweit der Feed ihn mitliefert. */
  content: string
}

function decodeEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#187;/g, '»')
    .replace(/&#171;/g, '«')
    .replace(/&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block)
  return match ? decodeEntities(match[1]).trim() : ''
}

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  for (const block of xml.split('<item>').slice(1)) {
    const item = block.slice(0, block.indexOf('</item>'))
    const link = tag(item, 'link')
    if (!link) continue
    const published = tag(item, 'pubDate')
    const date = published ? new Date(published) : undefined
    items.push({
      title: tag(item, 'title'),
      link,
      publishedAt: date && !Number.isNaN(date.getTime()) ? toIsoDate(date) : '',
      // `content:encoded` trägt den Volltext, `description` nur den Anriss.
      content: stripHtml(tag(item, 'content:encoded') || tag(item, 'description')),
    })
  }
  return items
}

export function stripHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const MONTHS: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
}

export interface FoundDate {
  /** ISO-Datum, wenn Tag, Monat und Jahr bekannt sind. */
  iso?: string
  /** "2026-09" wenn nur der Monat genannt wurde. */
  month?: string
  /** true, wenn das Jahr aus dem Artikeldatum ergänzt wurde (Tabellenzellen wie „15.01.“), nicht im Text stand. */
  geschaetzt?: boolean
  /** Der Textausschnitt, in dem das Datum stand — zum Nachprüfen. */
  context: string
}

/**
 * Findet deutsche Datumsangaben im Fließtext.
 *
 * Erkannt werden „am 4. September 2026", „ab dem 15.10.2026" und der häufige
 * Fall ohne Jahr („ab dem 4. September"), bei dem das Jahr aus dem
 * Erscheinungsdatum des Artikels ergänzt wird — mit Jahreswechsel-Korrektur:
 * Ein im Dezember angekündigter Januartermin liegt im Folgejahr.
 *
 * Monatsangaben ohne Tag („im September 2026") kommen als `month` zurück statt
 * als erfundener Erster des Monats. Ein halbes Datum ist eine ehrliche Angabe,
 * ein geratenes nicht.
 */
export function findDates(text: string, articleDate: string, tabellenTageOhneJahr = false): FoundDate[] {
  const out: FoundDate[] = []
  const seen = new Map<string, number>()
  const push = (found: FoundDate) => {
    const key = found.iso ?? found.month ?? ''
    if (!key) return
    const bisher = seen.get(key)
    // Eine Angabe mit Jahr schlägt dieselbe ohne Jahr.
    if (bisher !== undefined) {
      if (out[bisher]!.geschaetzt && !found.geschaetzt) out[bisher] = found
      return
    }
    seen.set(key, out.length)
    out.push(found)
  }
  const context = (index: number) => text.slice(Math.max(0, index - 70), index + 70).replace(/\s+/g, ' ').trim()

  // "4. September 2026" / "4. September"
  const long = /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?:\s+(\d{4}))?/gi
  for (const m of text.matchAll(long)) {
    const day = Number(m[1])
    const month = MONTHS[m[2].toLowerCase()]
    const year = m[3] ? Number(m[3]) : jahrNaechsterTag(articleDate, month, day)
    push({ iso: isoOf(year, month, day), context: context(m.index ?? 0) })
  }

  // "15.10.2026"
  for (const m of text.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g)) {
    push({ iso: isoOf(Number(m[3]), Number(m[2]), Number(m[1])), context: context(m.index ?? 0) })
  }

  /* „15.01.“ ohne Jahr: nur auf Anfrage (Tabellen eines Shop-Artikels) — im Fließtext ist „Folge 3.5.“ kein Datum. Das Jahr wählt den
     Tag, der dem Artikeldatum am nächsten liegt; die Angabe gilt als geschätzt. */
  for (const m of tabellenTageOhneJahr ? text.matchAll(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(?!\d)/g) : []) {
    const iso = isoOf(jahrNaechsterTag(articleDate, Number(m[2]), Number(m[1])), Number(m[2]), Number(m[1]))
    if (iso) push({ iso, context: context(m.index ?? 0), geschaetzt: true })
  }

  // "im September 2026" — Monat ohne Tag
  const monthOnly = /\b(?:im|ab)\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi
  for (const m of text.matchAll(monthOnly)) {
    const month = MONTHS[m[1].toLowerCase()]
    push({ month: `${m[2]}-${String(month).padStart(2, '0')}`, context: context(m.index ?? 0) })
  }

  return out
}

/** Jahr, in dem Tag und Monat dem Artikeldatum am nächsten liegen: Januar-Artikel mit „15.12.“ meint das Vorjahr, November-Artikel mit „15.09.“ bleibt im Jahr. */
function jahrNaechsterTag(articleDate: string, month: number, day: number): number {
  const jahr = Number(articleDate.slice(0, 4)) || new Date().getUTCFullYear()
  const kandidaten = [jahr - 1, jahr, jahr + 1].filter((y) => isoOf(y, month, day))
  const abstand = (y: number) => Math.abs(diffDays(articleDate, isoOf(y, month, day)!))
  return kandidaten.sort((a, b) => abstand(a) - abstand(b))[0] ?? jahr
}

function isoOf(year: number, month: number, day: number): string | undefined {
  if (!year || !month || !day || month > 12 || day > 31) return undefined
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  // Gegenprobe: 31. Februar wäre sonst ein gültig aussehender Unsinn.
  const back = new Date(`${iso}T00:00:00Z`)
  return back.getUTCDate() === day && back.getUTCMonth() + 1 === month ? iso : undefined
}
