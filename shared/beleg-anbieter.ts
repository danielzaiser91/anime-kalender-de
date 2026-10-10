/**
 * **Anbieter und Typ eines Belegs** (Daniel, 10.10.2026: „Der selbe Anbieter kann sich nicht selbst belegen").
 *
 * Je Aussage zählt ein Anbieter (Host ohne `www.`) einmal je Typ. Ein Typfeld gibt es am Beleg nicht;
 * der Typ folgt aus dem Pfad, damit Pipeline (Entdoppeln) und Oberfläche (Reiter-Beschriftung) dieselbe Regel nutzen.
 */
export type BelegTyp = 'artikel' | 'kalender' | 'katalog' | 'feed' | 'seite'

export const BELEG_TYP_LABEL: Record<BelegTyp, string> = { artikel: 'Artikel', kalender: 'Kalender', katalog: 'Katalog', feed: 'Feed', seite: 'Seite' }

/** Host ohne `www.`; eine unlesbare Adresse bleibt, wie sie ist. */
export function anbieterVon(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

const FEED = /\.(?:xml|rss|atom)$|\/feed\/?$/i
const KALENDER = /calendar|kalender|\/schedule|programm/i
const ARTIKEL = /\/(?:news|article|artikel|blog|presse?|press)\b|\/\d{4}\/\d{1,2}\//i
const KATALOG = /\/(?:series|watch|anime|title|serien|filme|film|browse|dp|gp\/video)\b/i

/**
 * Typ aus Host und Pfad: Feed, Kalender-Endpunkt (ADN), Artikel, Kalenderpfad, Katalog; alles andere ist eine Seite.
 * Der Artikelpfad schlägt den Kalenderpfad: ein Wort im Titel („…-prime-video-simulcast") macht aus einem Artikel keinen Kalender.
 */
export function belegTyp(url: string): BelegTyp {
  let host = ''
  let pfad = url
  try {
    const u = new URL(url)
    host = u.host
    pfad = u.pathname
  } catch {
    /* unlesbar: der Pfad ist die ganze Zeichenkette */
  }
  if (FEED.test(pfad)) return 'feed'
  if (host.startsWith('gw.api.')) return 'kalender'
  if (host.startsWith('news.') || ARTIKEL.test(pfad)) return 'artikel'
  if (KALENDER.test(pfad)) return 'kalender'
  return KATALOG.test(pfad) ? 'katalog' : 'seite'
}
