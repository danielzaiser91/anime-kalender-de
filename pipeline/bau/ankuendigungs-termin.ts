/**
 * **Der angekündigte Tag schlägt eine bloße Schätzung** (Daniel, 01.10.2026).
 *
 * „Die Tagebücher der Apothekerin" Staffel 3 trug als kuratierte Schätzung den
 * 01.10. (aus aniSearch); Crunchyroll hatte seit dem 16.08. den 02.10.
 * angekündigt. Ist ein Simulcast angekündigt und der kuratierte Tag nur geraten
 * (`estimated`), gilt der angekündigte Tag. Ohne Gegenbeweis startet die
 * deutsche Synchro damit zugleich — erscheint sie nicht, markiert
 * `termine-pruefen.ts` den Tag als „nicht erschienen".
 *
 * Liegt in einer eigenen Datei, weil `baueReleases` die Längengrenze reißt.
 */
import type { Ankuendigung } from '../lib/ankuendigungen.ts'

export function angekuendigterTermin(
  entry: { platform: string; schedule?: { estimated?: boolean } },
  angekuendigt: Ankuendigung | undefined,
): string | undefined {
  if (!angekuendigt?.omuAb) return undefined
  if (entry.platform !== 'crunchyroll') return undefined
  if (!entry.schedule?.estimated) return undefined
  return angekuendigt.omuAb
}
