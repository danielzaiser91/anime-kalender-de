/**
 * **„Auf Deutsch seit …“ nennt nur die echte Erstveröffentlichung** (Daniel, 21.10.2026, Failure Frame): `deErstausgabe.von`
 * war der Tag der deutschen Disc (06.11.2026, Zukunft), die Crunchyroll-Pille daneben sagte „seit 04.02.2025“.
 */
import type { Release, Title } from '@shared/types.ts'

const TAGESDATUM = /^\d{4}-\d{2}-\d{2}$/

/** Der frühere Starttag unter den Anbietern mit belegter deutscher Tonspur — den nennt deren Pille als „seit“. */
export function fruehesterStreamStart(title: Pick<Title, 'streams'>, releases: Release[]): string | undefined {
  const mitTon = new Set((title.streams ?? []).filter((s) => s.dub === true).map((s) => s.platform))
  return releases
    .filter((r) => mitTon.has(r.platform) && r.releaseType !== 'disc')
    .map((r) => r.schedule?.firstEpisodeDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
}

/**
 * Steht die Nebenzeile „Auf Deutsch seit {Tag}“ da? Nie mit einem Tag nach heute, und nicht, wenn ein Anbieter mit
 * deutscher Tonspur am selben oder einem früheren Tag begann (die Pille sagt es schon). Ein Zeitraum ohne Tag bleibt.
 */
export function deSeitZeigen(title: Pick<Title, 'deErstausgabe' | 'streams'>, releases: Release[], heute: string): boolean {
  const von = title.deErstausgabe?.von
  if (!von || !TAGESDATUM.test(von)) return true
  if (von > heute) return false
  const stream = fruehesterStreamStart(title, releases)
  return !(stream && stream <= von)
}
