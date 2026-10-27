import type { PlatformId } from './types.ts'

/** Amazon-Suchlink als Fallback für Kauf-Releases. */
export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.de/s?k=${encodeURIComponent(`${query} Anime Blu-ray`)}`
}

/** Amazon-Suche nach der EAN: zeigt das genau eine Produkt (Conan Box 1, gemessen 27.10.2026), anders als die Namenssuche. */
export function amazonEanUrl(ean: string): string {
  return `https://www.amazon.de/s?k=${ean}`
}

/** Wie genau führt ein Amazon-Link zum Produkt? `name` = Namenssuche (viele Treffer), `ean` = ein Treffer, `produkt` = Produktseite. */
export function amazonLinkArt(url: string | undefined): 'name' | 'ean' | 'produkt' | undefined {
  const m = /^https:\/\/(?:www\.)?amazon\.[a-z.]+\/(s\?|dp\/|gp\/product\/)(?:k=([^&]*))?/.exec(url ?? '')
  if (!m) return undefined
  if (m[1] !== 's?') return 'produkt'
  return /^\d{8,14}$/.test(m[2] ?? '') ? 'ean' : 'name'
}

/**
 * Prime-Video-Links laufen bei uns grundsätzlich über **amazon.de**.
 *
 * Zwei Gründe. Erstens: Die ASIN ist **nicht** marktübergreifend gleich —
 * `amazon.com/dp/B0H1QXXRG1` auf `amazon.de` umzuschreiben führt zuverlässig
 * auf eine Fehlerseite (am 08.08.2026 genau so passiert). AniList verlinkt fast
 * immer die US-Storefront, ihre Kennungen sind hier also wertlos.
 * Zweitens: `amazon.de` ist die vertrautere Adresse als `primevideo.com` und
 * führt zur selben Inhalteseite.
 *
 * Ein brauchbarer Deeplink kann deshalb nur aus der Kuratierung kommen; alles
 * andere wird zur Suche.
 */
export function isUnusablePrimeLink(url: string): boolean {
  return !/^https:\/\/(www\.)?amazon\.de\//.test(url)
}

/** Suche auf amazon.de statt eines Deeplinks, der ins Leere führt. */
export function primeVideoSearchUrl(query: string): string {
  return `https://www.amazon.de/s?k=${encodeURIComponent(query)}&i=instant-video`
}

/**
 * Suchadressen der Streamingdienste — der Rettungsanker, wenn AniList keinen
 * Deeplink kennt.
 *
 * Gerade bei Katalogtiteln ist das die Regel: AniList pflegt Anbieter-Links
 * vor allem für neue Simulcasts, ein 2000er-Jahrgang wie „Yu-Gi-Oh!" hat dort
 * keinen. Ohne Fallback stünde die Plattform als toter Text da, obwohl der
 * Titel dort nachweislich läuft. Eine Suche mit dem richtigen Begriff führt in
 * zwei Klicks ans Ziel — und sie kann nicht veralten.
 */
const PLATFORM_SEARCH: Partial<Record<PlatformId, (q: string) => string>> = {
  netflix: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
  disneyplus: (q) => `https://www.disneyplus.com/de-de/search?q=${encodeURIComponent(q)}`,
  crunchyroll: (q) => `https://www.crunchyroll.com/de/search?q=${encodeURIComponent(q)}`,
  primevideo: primeVideoSearchUrl,
  paramountplus: (q) => `https://www.paramountplus.com/de/search/?q=${encodeURIComponent(q)}`,
  adn: (q) => `https://animationdigitalnetwork.com/de/search?q=${encodeURIComponent(q)}`,
  wow: (q) => `https://www.wowtv.de/suche?q=${encodeURIComponent(q)}`,
  joyn: (q) => `https://www.joyn.de/suche?search=${encodeURIComponent(q)}`,
  rtlplus: (q) => `https://plus.rtl.de/suche?q=${encodeURIComponent(q)}`,
  youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  aniverse: (q) => `https://www.aniverse.de/?s=${encodeURIComponent(q)}`,
  disc: amazonSearchUrl,
}

/**
 * Notfall-Adresse für eine Plattform. `undefined` für `kino` — ein Kinostart
 * hat keine eine Adresse, an die man schicken könnte, und eine erfundene wäre
 * schlechter als gar keine.
 */
export function platformSearchUrl(platform: PlatformId, query: string): string | undefined {
  return PLATFORM_SEARCH[platform]?.(query)
}
