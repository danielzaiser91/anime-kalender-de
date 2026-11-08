import type { Release, Title } from '../../shared/types.ts'

/**
 * Titel mit Joyn-Weg, deren ProSieben-MAXX-Termin gerade läuft (Sichtungen ab gestern am Termin), und deren Joyn-Weg trotzdem kein Abruffenster trägt:
 * Die Pille nennt dann keine Folgen. Fenster entstehen in `bau/13-1-joyn-fenster.ts` nur aus belegten Folgennummern.
 */
export function joynLaeuftOhneFenster(titel: Pick<Title, 'id' | 'streams'>[], releases: Pick<Release, 'titleId' | 'platform' | 'sender' | 'sendungen'>[]): number[] {
  const laeuft = new Set(
    releases.filter((r) => r.platform === 'tv' && (r.sender ?? '').toLowerCase() === 'prosieben maxx' && (r.sendungen?.length ?? 0) > 0).map((r) => r.titleId),
  )
  return titel
    .filter((t) => laeuft.has(t.id) && (t.streams ?? []).some((s) => s.platform === 'joyn' && !s.fenster?.length))
    .map((t) => t.id)
    .sort((a, b) => a - b)
}
