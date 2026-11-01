/**
 * Die Tonspur-Zeile einer Netflix-Titelseite (ohne Anmeldung, gemessen 01.11.2026).
 *
 * Nicht angemeldet liefert `GET /de/title/<id>` schon im ersten HTML `<h4>Audio</h4><span>Deutsch, …</span>`
 * (bis zu sechs Sprachen, ein Wert für den ganzen Titel). Das belegt nur einen **Film**: Für eine Serie sagt
 * die Zeile nichts über einzelne Folgen (My Hero Academia zeigt „Deutsch“, obwohl nur zwei Staffeln deutsch sind).
 */

export type TonspurUrteil = 'ja' | 'nein' | 'unbekannt'

export interface NetflixTonspur {
  urteil: TonspurUrteil
  /** Die Sprachen der Audio-Zeile, wie die Seite sie schreibt (ohne „[Original]“). */
  sprachen: string[]
}

/** Mehr als diese Zahl Sprachen zeigt die Seite nie; eine volle Liste ohne Deutsch kann abgeschnitten sein. */
export const SEITE_ZEIGT_HOECHSTENS = 6

const AUDIO_ZEILE = /<h4[^>]*>\s*Audio\s*<\/h4>\s*<span[^>]*>([^<]*)<\/span>/i

/** Deutsch als Sprache der Synchro; „Deutsch – Audiodeskription“ und Untertitel-Sprachen zählen nicht. */
const DEUTSCH = /^(Deutsch|German)$/i

/**
 * Liest die Audio-Zeile. `unbekannt` heißt: keine Zeile gefunden — das ist Nichtauskunft, kein Nein.
 * Ein `nein` gibt es nur, wenn die Liste kürzer als die Obergrenze der Seite ist.
 */
export function leseNetflixTonspur(html: string): NetflixTonspur {
  const roh = AUDIO_ZEILE.exec(html)?.[1]
  if (!roh?.trim()) return { urteil: 'unbekannt', sprachen: [] }
  const sprachen = roh
    .replace(/&#x27;|&#39;/g, "'")
    .split(/,\s*|\s+und\s+/)
    .map((s) => s.replace(/\s*\[Original\]\s*$/i, '').trim())
    .filter(Boolean)
  if (sprachen.some((s) => DEUTSCH.test(s))) return { urteil: 'ja', sprachen }
  return { urteil: sprachen.length >= SEITE_ZEIGT_HOECHSTENS ? 'unbekannt' : 'nein', sprachen }
}

/** Die Titelkennung einer Netflix-Titeladresse (`/title/<id>`), sonst undefined. */
export function netflixKennung(url: string): string | undefined {
  return /netflix\.com\/(?:[a-z-]+\/)?title\/(\d+)/i.exec(url)?.[1]
}
