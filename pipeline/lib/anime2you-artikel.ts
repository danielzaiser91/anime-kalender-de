/**
 * Anime2You-Artikel für die Claude-Extraktion (P2): Adresse → Kennung, Seite → Fließtext, Auswahl der Neuen.
 * Die Prüfung der Antwort steht in `anime2you-vorschlag.ts`.
 */
import { decodeEntities, stripHtml } from './feed.ts'
import { dubBefund, deutschlandBezug } from './sprachbefund.ts'

/** Mehr liest Claude je Artikel nicht — die Aussagen stehen vor dem Ablauf- und Kommentarteil. */
export const TEXT_HOECHSTENS = 6000

/** `https://www.anime2you.de/news/1059480/yaiba-…/` → `1059480`. */
export function artikelId(url: string): string | undefined {
  return /\/news\/(\d+)\//.exec(url)?.[1]
}

/**
 * Der Artikeltext einer Seite: nur das `<article>`-Element, ohne Teilen-Leiste, Newsticker und Kommentare dahinter.
 * Fehlt das Element, bleibt der Text leer — eine umgebaute Seite soll auffallen, nicht den ganzen Rumpf liefern.
 */
export function artikelText(html: string): string {
  const von = html.indexOf('<article')
  const bis = html.indexOf('</article>', von)
  if (von < 0 || bis < 0) return ''
  const text = decodeEntities(stripHtml(html.slice(von, bis)))
  const ende = text.indexOf('Artikel teilen')
  return (ende >= 0 ? text.slice(0, ende) : text).trim().slice(0, TEXT_HOECHSTENS)
}

/** Wortmarken, die einen Deutschland-Bezug anzeigen, auch wo `deutschlandBezug` nichts findet (Anbieter, Sender, Datenträger). */
const ANBIETER_ODER_SENDER =
  /netflix|crunchyroll|prime video|disney\+|\badn\b|aniverse|\bwow\b|joyn|rtl\+|paramount|prosieben|sat\.1|kabel eins|nickelodeon|blu-ray|\bdvd\b|steelbook|kinostart/i

/** Ab hier folgen Einkaufsliste, Video und Inhaltsangabe – sie nennen immer Shops und Anbieter und sagen nichts über Deutschland. */
const NEBENTEIL = /\n\s*(?:Jetzt (?:vor)?bestellen|Jetzt streamen|Mehr zum Thema|Deutscher Trailer|Externer Inhalt|Teaser:|Trailer:|Visual:|Handlung:)/

/** Lohnt der Artikel eine Lesung durch Claude? Japanische Ankündigungen, Figuren und Trailer nicht. */
export function lohntLesung(titel: string, text: string): boolean {
  const gesamt = `${titel}\n${text.split(NEBENTEIL)[0]}`
  return deutschlandBezug(gesamt, dubBefund(gesamt)) || ANBIETER_ODER_SENDER.test(gesamt)
}

export interface Kandidat {
  id: string
  url: string
  titel: string
  veroeffentlicht: string
}

/**
 * Die Neuen aus den Feeds: nicht gelesen, neueste zuerst, höchstens `grenze`. Ein Artikel in den `sources` eines Eintrags zählt als neu,
 * solange keine Extraktion zu ihm vorliegt (`gelesen`): Von Hand eingearbeitet heißt nicht ausgewertet (Avatar 1059483, 12.10.2026).
 */
export function neueKandidaten(feed: { link: string; title: string; publishedAt: string }[], gelesen: ReadonlySet<string>, grenze: number): Kandidat[] {
  const aus: Kandidat[] = []
  for (const f of [...feed].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const id = artikelId(f.link)
    if (!id || gelesen.has(id) || aus.some((k) => k.id === id)) continue
    aus.push({ id, url: f.link, titel: f.title, veroeffentlicht: f.publishedAt })
    if (aus.length >= grenze) break
  }
  return aus
}
