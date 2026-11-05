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
  /** Große Karte für breite Bilder, kleine (`summary`) für das hochformatige Plakat. */
  karte: 'summary_large_image' | 'summary'
  typ: 'image/jpeg'
}

/** Maße der Original-Plakate aus `data/tmdb-poster.json`, Schlüssel = Pfad (`/abc.jpg`). */
export type PlakatMasse = ReadonlyMap<string, readonly [number, number]>

const TMDB_BANNER = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w1280(\/[\w.-]+\.jpg)$/
const TMDB_PLAKAT = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w500(\/[\w.-]+\.jpg)$/
const PLAKAT_BREITE = 500

/** Pfad → Originalmaße; Einträge ohne Pfad oder ohne beide Maße zählen nicht. */
export function plakatMasse(poster: Record<string, { p?: string | null; w?: number | null; h?: number | null } | null>): PlakatMasse {
  const masse = new Map<string, readonly [number, number]>()
  for (const e of Object.values(poster)) {
    if (e?.p && e.w && e.h) masse.set(e.p, [e.w, e.h])
  }
  return masse
}

/**
 * Eigenes Bild mit wahren Maßen, sonst das Standardbild: erst das TMDB-Banner in w780 (780×439), dann das
 * TMDB-Plakat in w500 (Höhe aus den Originalmaßen, nur wenn sie vorliegen), sonst Standard 1200×630.
 */
export function vorschauBild(banner: string | undefined, cover: string | undefined, standardUrl: string, masse: PlakatMasse): Vorschau {
  const b = banner ? TMDB_BANNER.exec(banner) : null
  if (b) return { url: `${b[1]}w780${b[2]}`, breite: 780, hoehe: 439, karte: 'summary_large_image', typ: 'image/jpeg' }
  const p = cover ? TMDB_PLAKAT.exec(cover) : null
  const original = p ? masse.get(p[2]) : undefined
  if (cover && original) {
    const hoehe = Math.round((PLAKAT_BREITE * original[1]) / original[0])
    return { url: cover, breite: PLAKAT_BREITE, hoehe, karte: 'summary', typ: 'image/jpeg' }
  }
  return { url: standardUrl, breite: 1200, hoehe: 630, karte: 'summary_large_image', typ: 'image/jpeg' }
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

const ERLAUBT_TMDB = /^https:\/\/image\.tmdb\.org\/t\/p\/(w780|w500)\/[\w.-]+\.jpg$/
/** Breite, die zur TMDB-Größe im Pfad gehört. */
const BREITE_JE_GROESSE: Record<string, number> = { w780: 780, w500: 500 }

/** Mängel der Vorschau einer erzeugten Seite: Maße fehlen oder passen nicht zum Pfad, Bild fremd und zu groß, „1 Folgen“. */
export function vorschauMaengel(html: string, site: string): string[] {
  const mangel: string[] = []
  const bild = /property="og:image" content="([^"]+)"/.exec(html)?.[1]
  const tmdb = bild ? ERLAUBT_TMDB.exec(bild) : null
  if (bild && !bild.startsWith(site) && !tmdb) mangel.push(`og:image weder eigene Domain noch TMDB w780/w500: ${bild}`)
  const breite = /property="og:image:width" content="(\d+)"/.exec(html)?.[1]
  if (tmdb && breite && Number(breite) !== BREITE_JE_GROESSE[tmdb[1]]) mangel.push(`og:image:width ${breite} passt nicht zu ${tmdb[1]}: ${bild}`)
  if (bild && !/property="og:image:width" content="\d+"/.test(html)) mangel.push('og:image:width fehlt')
  if (bild && !/property="og:image:height" content="\d+"/.test(html)) mangel.push('og:image:height fehlt')
  if (/(^|[^\d.,])1 Folgen/.test(html)) mangel.push('„1 Folgen“ statt „1 Folge“')
  return mangel
}
