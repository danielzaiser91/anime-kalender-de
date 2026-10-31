/**
 * ADN-Serien aus der Handliste (`data/cartoon-handliste.yaml`) als Cartoons (31.10.2026).
 *
 * `fetch-cartoons.ts` trägt `adnId` in den Roh-Eintrag. Der ADN-Bau (`07-adn.ts`) nimmt den Cartoon dann als Titel der Serie, sonst fiele
 * jede Katalogserie ohne aniSearch-Eintrag heraus; `schreibeCartoons` gibt dem Cartoon den ADN-Weg.
 */
import { alsTitel, type CartoonEintrag } from '../lib/cartoons.ts'
import { readJson } from '../lib/util.ts'
import type { AdnData, AdnShow } from '../lib/adn.ts'
import type { Title } from '../../shared/types.ts'

/** ADN-Serienkennung → Cartoon-Titel der Handliste (`hatAufnahmeBeleg` lässt solche Einträge immer zu). */
export function cartoonTitelJeAdn(roh: Record<string, CartoonEintrag>): Map<number, Title> {
  const jeAdn = new Map<number, Title>()
  for (const e of Object.values(roh)) if (e.adnId) jeAdn.set(e.adnId, alsTitel(e))
  return jeAdn
}

/** Die Serien aus Kalender und Katalog (die Kennung steht in beiden, der Weg braucht nur die erste). */
export function adnShowsLesen(): AdnShow[] {
  const leer: AdnData = { scrapedAt: '', window: { from: '', to: '' }, shows: [] }
  return [...readJson<AdnData>('data/adn.json', leer).shows, ...readJson<AdnData>('data/adn-catalog.json', leer).shows]
}

/** Cartoon-Kennung → ADN-Serie, die der Handlisten-Eintrag nennt und die mit Folgen und Adresse im Katalog oder Kalender steht. */
export function adnShowJeCartoon(roh: Record<string, CartoonEintrag>, shows: AdnShow[]): Map<number, AdnShow> {
  const jeCartoon = new Map<number, AdnShow>()
  for (const e of Object.values(roh)) {
    const show = e.adnId ? shows.find((s) => s.showId === e.adnId) : undefined
    if (show?.episodes.length && show.url) jeCartoon.set(e.id, show)
  }
  return jeCartoon
}

/**
 * Der Weg ADN mit deutschem Ton: nur für Cartoons der Handliste, deren Serie ADN mit Folgen führt (Katalog und Kalender führen nur Folgen
 * mit `vde`). Ein vorhandener ADN-Weg (TMDB-Anbieter) bekommt Ton und Adresse. Gibt die Zahl der gesetzten Wege zurück.
 */
export function ergaenzeAdnWege(titel: Title[], roh: Record<string, CartoonEintrag>, shows: AdnShow[]): number {
  const showJeCartoon = adnShowJeCartoon(roh, shows)
  let neu = 0
  for (const t of titel) {
    const show = showJeCartoon.get(t.id)
    if (!show) continue
    const vorhanden = t.streams.find((s) => s.platform === 'adn')
    if (vorhanden) {
      vorhanden.dub = true
      vorhanden.url ||= show.url
    } else t.streams.push({ platform: 'adn', url: show.url, dub: true })
    neu++
  }
  return neu
}
