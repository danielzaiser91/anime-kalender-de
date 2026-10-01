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
  /*
    **Ein Monat ist kein Kalendertag** (01.10.2026). `omuAb` darf „JJJJ-MM" sein
    — PSYREN trägt „2026-10". Dieser Wert landete ungeprüft in
    `firstEpisodeDate`, und damit stand ein Monat dort, wo ein Tag erwartet
    wird. Den Monat zeigt der Antwortkasten („mit Untertiteln ab Oktober 2026");
    einen Kalendereintrag setzt nur ein echter Tag.
  */
  if (angekuendigt.omuAb.length !== 10) return undefined
  return angekuendigt.omuAb
}
