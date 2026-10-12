/**
 * **Premiere und Premiere\*** (Daniel, 10.10.2026) — Texte und Regel, die Seite, ICS und Bau teilen.
 *
 * „Premiere“: erstmals auf diesem Weg auf Deutsch. „Premiere\*“: dasselbe, aber die Fassung gab es
 * vorher schon auf Disc oder im Kino. Beides nur mit Handbeleg (`Release.premiere`): `weg` tv|stream,
 * `quelle` (muss in `sources` stehen), `vorher` disc|kino samt `vorherDatum` vor dem Start. Nie aus
 * Abwesenheit oder „im Angebot seit“ ableiten. Prüfung und Bau: `pipeline/lib/premiere.ts`.
 */
import type { PlatformId, Release } from './types.ts'

/** Der Weg, auf dem eine deutsche Fassung schon vor der Premiere erschienen war. */
export type PremiereVorher = 'disc' | 'kino'

/** Der Handbeleg am kuratierten Release (`Release.premiere`). */
export interface ReleasePremiere {
  weg: 'tv' | 'stream'
  quelle: string
  vorher?: PremiereVorher
  /** Pflicht, sobald `vorher` gesetzt ist: Tag der früheren Disc- bzw. Kino-Ausgabe. */
  vorherDatum?: string
}

const VORHER: Record<PremiereVorher, string> = { disc: 'auf Disc', kino: 'im Kino' }

/** Beschriftung des Zeichens: mit Sternchen, wenn es die Fassung vorher schon gab. */
export function premiereLabel(vorher?: PremiereVorher): string {
  return vorher ? 'Premiere*' : 'Premiere'
}

/** Tooltip: „Erstmals im Streaming auf Deutsch. Vorher nur auf Disc.“ (ohne `vorher` nur der erste Satz). */
export function premiereHinweis(platform: PlatformId, vorher?: PremiereVorher): string {
  const erstmals = `Erstmals ${platform === 'tv' ? 'im TV' : 'im Streaming'} auf Deutsch.`
  return vorher ? `${erstmals} Vorher nur ${VORHER[vorher]}.` : erstmals
}

/** Belegt der Mensch, dass dieses Fernseh-Release die erste deutsche Ausstrahlung ist? */
export function premiereBelegtTv(r: Release | undefined): boolean {
  return r?.platform === 'tv' && r.premiere?.weg === 'tv'
}
