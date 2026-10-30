/**
 * **ADN-News als lesbare Quelle für angekündigte Termine.**
 *
 * Der Kalender-Endpunkt (`gw.api.animationdigitalnetwork.com`) ist die Quelle,
 * aus der wir ADN-Termine lesen — als Link auf der Seite ist er aber unbrauchbar:
 * Ohne `date`-Parameter antwortet er mit `400 Bad Request` (Daniel, 01.10.2026,
 * mit Bild). Lesbar ist der News-Artikel, in dem ADN dieselbe Ankündigung
 * erklärt.
 *
 * `news.animationdigitalnetwork.com` ist ein WordPress. Die REST-Schnittstelle
 * (`/wp-json/wp/v2/posts`) liefert Titel, Adresse, Datum und Inhalt; im Inhalt
 * steht die ADN-Serienseite (`…/video/1423-eighty-six`). Über deren Kennung
 * wird der Artikel unserem Release zugeordnet.
 *
 * Zuletzt gelesen, nicht dauerhaft gemerkt: Der Abruf läuft einmal am Tag
 * (siehe `holeAdnNews`), die Datei `data/adn-news.json` trägt den Stand.
 */
import { todayIso } from '../../shared/time.ts'
import { fetchJson, log, readJson, writeJson } from './util.ts'
import { recordSource } from './health.ts'

const POSTS_API = 'https://news.animationdigitalnetwork.com/wp-json/wp/v2/posts'
/** Zwei Seiten à 100 Beiträge reichen rund einen Monat zurück. */
const SEITEN = 2

export interface WpPost {
  link?: string
  date?: string
  title?: { rendered?: string }
  content?: { rendered?: string }
}

export interface AdnNewsArtikel {
  titel: string
  url: string
  datum: string
  /** ADN-Serienkennungen, die im Artikel verlinkt sind. */
  showIds: number[]
}
export interface AdnNews {
  geholtAm: string
  artikel: AdnNewsArtikel[]
}

const SERIEN_LINK = /animationdigitalnetwork\.com\/(?:de\/)?video\/(\d+)/

/** Steht die Stelle im Text in einer offenen Klammer? Tags zählen nicht zum Text. */
function inKlammer(html: string, stelle: number): boolean {
  const text = html.slice(Math.max(0, stelle - 400), stelle).replace(/<[^>]*>/g, '')
  return text.lastIndexOf('(') > text.lastIndexOf(')')
}

/** Watchlist-Knopf oder Bild-Teaser (Verweis ohne Text): ADN zeigt so die eigene Serie des Artikels, nie einen Vergleich. */
function istKnopfOderBild(html: string, tag: RegExpMatchArray): boolean {
  if (/wp-block-button__link/.test(tag[0])) return true
  const ab = (tag.index ?? 0) + tag[0].length
  const ende = html.indexOf('</a>', ab)
  return !html.slice(ab, ende < 0 ? undefined : ende).replace(/<[^>]*>/g, '').trim()
}

/** Ein Artikel über eine Serie (samt Film/Fortsetzung) hat höchstens so viele Knopf-/Bild-Serien; mehr ist eine Sammelmeldung. */
const EINZELARTIKEL_HOECHSTENS = 2
/** Und höchstens so viele nur im Fließtext verlinkte Serien: eine Aufzählung mehrerer Serien ist eine Sammelmeldung. */
const VERGLEICHE_HOECHSTENS = 1

/**
 * Serien, um die es im Artikel geht. Verweise in Klammern („Studio: Lerche (Assassination Classroom, …)") nennen
 * andere Serien als Auskunft über Studio oder Regie und zählen nicht. Bestehen alle Verweise aus solchen, bleiben alle.
 * Hat der Artikel nur eine oder zwei Serien mit Knopf/Bild-Teaser, sind Fließtext-Verweise Vergleiche („wie Sailor Moon")
 * und zählen nicht; eine Sammelmeldung mit mehr Knopf-Serien behält ihre Fließtext-Serien.
 */
export function serienDesArtikels(html: string): number[] {
  const treffer = [...html.matchAll(/<a\b[^>]*>/g)].filter((m) => SERIEN_LINK.test(m[0]))
  const ohneKlammer = treffer.filter((m) => !inKlammer(html, m.index))
  const gewaehlt = ohneKlammer.length ? ohneKlammer : treffer
  const kern = gewaehlt.filter((m) => istKnopfOderBild(html, m))
  const idsVon = (liste: RegExpMatchArray[]) => new Set(liste.map((m) => SERIEN_LINK.exec(m[0])?.[1]))
  const anzahl = idsVon(kern).size
  const nurFliesstext = [...idsVon(gewaehlt)].filter((id) => !idsVon(kern).has(id)).length
  const einzel = anzahl >= 1 && anzahl <= EINZELARTIKEL_HOECHSTENS && nurFliesstext <= VERGLEICHE_HOECHSTENS
  const quelle = einzel ? kern : gewaehlt
  const ids = quelle.map((m) => Number(SERIEN_LINK.exec(m[0])?.[1]))
  return [...new Set(ids)].filter((n) => Number.isFinite(n))
}

/** HTML-Reste aus der Überschrift entfernen — die News-Titel tragen `&#8211;` & Co. */
function ohneHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Deutsche Beiträge mit Serienverweis als Artikel; die Schnittstelle liefert auch `/fr/`. */
export function artikelAusBeitraegen(beitraege: WpPost[]): AdnNewsArtikel[] {
  const artikel: AdnNewsArtikel[] = []
  for (const p of beitraege) {
    if (!p.link?.includes('/de/')) continue
    const showIds = serienDesArtikels(p.content?.rendered ?? '')
    if (!showIds.length) continue
    artikel.push({ titel: ohneHtml(p.title?.rendered ?? ''), url: p.link, datum: (p.date ?? '').slice(0, 10), showIds })
  }
  return artikel
}

/**
 * Holt die ADN-News. Läuft **einmal am Tag**; ist `data/adn-news.json` von
 * heute, passiert nichts (der Aufruf hängt am ADN-Lauf, der auch stündlich
 * laufen kann).
 */
export async function holeAdnNews(force = false): Promise<void> {
  const alt = readJson<AdnNews | null>('data/adn-news.json', null)
  if (!force && alt?.geholtAm?.slice(0, 10) === todayIso()) return

  const artikel: AdnNewsArtikel[] = []
  let posts = 0
  for (let page = 1; page <= SEITEN; page++) {
    let seite: WpPost[]
    try {
      seite = await fetchJson<WpPost[]>(`${POSTS_API}?per_page=100&page=${page}&_fields=link,date,title,content`)
    } catch (err) {
      if (page === 1) {
        /*
          Der Bericht ist ein Alarm, kein Abbruch: Ein ausgefallener News-Abruf
          darf den Kalender-Abruf nicht mitreißen. Der alte Stand bleibt stehen.
        */
        recordSource('adn-news', 0, `Abruf gescheitert: ${(err as Error).message}`)
        log(`ADN-News nicht erreichbar — alter Stand bleibt: ${(err as Error).message}`)
        return
      }
      break
    }
    if (!seite.length) break
    posts += seite.length
    artikel.push(...artikelAusBeitraegen(seite))
  }

  if (!posts) {
    recordSource('adn-news', 0, 'kein Beitrag gelesen')
    log('ADN-News: kein Beitrag gelesen — alter Stand bleibt.')
    return
  }
  recordSource('adn-news', artikel.length, artikel.length ? undefined : 'kein Artikel mit Serienverweis')
  writeJson('data/adn-news.json', { geholtAm: new Date().toISOString(), artikel } satisfies AdnNews, true)
  log(`ADN-News: ${artikel.length} Artikel mit Serienverweis aus ${posts} Beiträgen`)
}

/**
 * **Der spezifischste Artikel je Serie.**
 *
 * Ein Line-up nennt dreißig Serien; als Quelle zu „86: Eighty Six" führte es auf
 * eine Übersichtsseite. Gewählt wird deshalb der Artikel mit den **wenigsten**
 * Serienkennungen, bei Gleichstand der jüngere.
 */
export function artikelJeShow(news: AdnNews | null): Map<number, AdnNewsArtikel> {
  const map = new Map<number, AdnNewsArtikel>()
  for (const a of news?.artikel ?? []) {
    for (const id of a.showIds) {
      const alt = map.get(id)
      const besser =
        !alt ||
        a.showIds.length < alt.showIds.length ||
        (a.showIds.length === alt.showIds.length && a.datum > alt.datum)
      if (besser) map.set(id, a)
    }
  }
  return map
}
