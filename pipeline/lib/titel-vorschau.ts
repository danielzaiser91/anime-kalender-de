/**
 * Vorschaubild und Folgenzahl der Titelseiten (`/t/<Adresse>/`).
 *
 * WhatsApp zeigt eine Karte nur, wenn das Bild klein genug ist (um 300 KB) und die Maße im Kopf stehen.
 * Die TMDB-Banner der Titel liegen in Größe `w1280` (bis über 1 MB); dieselbe Datei in `w780` ist
 * 780×439 und im Messbestand (16 Titel, 03.11.2026) höchstens 137 KB. Alles andere (AniList-Banner
 * mit 4,75:1 und beliebiger Größe, Cover, Titel ohne Bild) nimmt das Standardbild 1200×630.
 */

export interface Vorschau {
  url: string
  breite: number
  hoehe: number
  /** Große Karte (`summary_large_image`): beide Bildarten sind breit. */
  typ: 'image/jpeg'
}

const TMDB_BANNER = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w1280(\/[\w.-]+\.jpg)$/

/** TMDB-Banner in verkleinerter Größe mit seinen wahren Maßen, sonst das Standardbild. */
export function vorschauBild(eigenesBild: string | undefined, standardUrl: string): Vorschau {
  const m = eigenesBild ? TMDB_BANNER.exec(eigenesBild) : null
  if (m) return { url: `${m[1]}w780${m[2]}`, breite: 780, hoehe: 439, typ: 'image/jpeg' }
  return { url: standardUrl, breite: 1200, hoehe: 630, typ: 'image/jpeg' }
}

/** „1 Folge“, „12 Folgen“. */
export function folgenText(anzahl: number): string {
  return anzahl === 1 ? '1 Folge' : `${anzahl} Folgen`
}

/** Meta-Zeilen des Bilds samt Maßen (Reihenfolge wie bei den Terminseiten). */
export function bildMeta(v: Vorschau): string {
  return (
    `    <meta property="og:image" content="${v.url}" />\n` +
    `    <meta property="og:image:type" content="${v.typ}" />\n` +
    `    <meta property="og:image:width" content="${v.breite}" />\n` +
    `    <meta property="og:image:height" content="${v.hoehe}" />\n`
  )
}

const ERLAUBT_TMDB = /^https:\/\/image\.tmdb\.org\/t\/p\/w780\/[\w.-]+\.jpg$/

/** Mängel der Vorschau einer erzeugten Seite: Maße fehlen, Bild fremd und zu groß, „1 Folgen“. */
export function vorschauMaengel(html: string, site: string): string[] {
  const mangel: string[] = []
  const bild = /property="og:image" content="([^"]+)"/.exec(html)?.[1]
  if (bild && !bild.startsWith(site) && !ERLAUBT_TMDB.test(bild)) mangel.push(`og:image weder eigene Domain noch TMDB w780: ${bild}`)
  if (bild && !/property="og:image:width" content="\d+"/.test(html)) mangel.push('og:image:width fehlt')
  if (bild && !/property="og:image:height" content="\d+"/.test(html)) mangel.push('og:image:height fehlt')
  if (/(^|[^\d.,])1 Folgen/.test(html)) mangel.push('„1 Folgen“ statt „1 Folge“')
  return mangel
}
