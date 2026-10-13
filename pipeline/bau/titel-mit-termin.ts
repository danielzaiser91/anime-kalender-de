import { type Release } from '../../shared/types.ts'

/**
 * Titel, die schon einen Termin haben, der „Im Angebot seit“ ersetzt (`13-3-listen.ts`, `13-7-erstausgabe-angebot.ts`).
 *
 * **Eine Disc ist kein Streaming-Termin.** „Im Angebot seit“ sagt, seit wann ein Anbieter den Titel führt; der Erscheinungstag
 * einer DVD- oder Blu-ray-Box sagt darüber nichts. Ein Disc-Termin nahm Titeln mit Streaming-Katalogdatum bisher das „Im Angebot
 * seit“ (13.10.2026: Pokémon „Die Anfänge“, Netflix seit 02.2025, Box am 27.11.2026).
 */
export function titelMitTermin(releases: Release[]): Set<number> {
  return new Set(releases.filter((r) => r.platform !== 'disc').map((r) => r.titleId))
}
