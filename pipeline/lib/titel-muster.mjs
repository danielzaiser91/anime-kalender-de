/**
 * Was ein Videotitel über die Fassung verrät — an einer Stelle.
 *
 * Die beiden Muster brauchen sowohl der Lauf (`check-youtube.mjs`, beim
 * Abrufen) als auch der Bericht (`report-youtube.mjs`, beim Aufbereiten eines
 * schon vorhandenen Befunds). Stünden sie zweimal da, liefen sie auseinander —
 * und der Bericht zeigte dann eine andere Auskunft als die, die im Bestand
 * gelandet ist.
 *
 * Beide sind **Hinweise, keine Belege**. Ein `dub: true` oder `false` setzt in
 * diesem Projekt ein Mensch; diese Muster sortieren nur vor.
 */

/**
 * Der Titel deutet auf eine deutsche Fassung.
 *
 * Gesucht wird nach Wörtern, die es nur im Deutschen gibt — „der", „das" und
 * „ein" stehen auch in anderen Sprachen, „Der Film" und „Ganzer Film" nicht.
 */
export const DEUTSCHE_SPUR =
  /\b(der Film|ganzer Film|deutsch|german dub|auf Deutsch|Synchronfassung|Staffel|Folge)\b/i

/**
 * Der Titel nennt ausdrücklich eine **andere** Fassung als die deutsche.
 *
 * „OmU" heißt Original mit Untertiteln — ein Kürzel, das im deutschen
 * Anime-Vertrieb jeder kennt und das kein Uploader versehentlich setzt.
 * Gefunden am 24.08.2026 bei „Tokyo Ghoul, 2. Staffel, 1. Episode, OmU" und
 * „Anime, My Hero Academia, Episode 01, OmU"; beide standen ohne jede
 * Sprachangabe im Kalender.
 *
 * Eine **fremde Synchronfassung** zählt gleich: „Attack on Titan Part 1
 * (English Dub)" ist eine Synchro, nur nicht unsere. „German Dub" fällt
 * bewusst nicht darunter — das steht schon in `DEUTSCHE_SPUR`.
 *
 * Das ist die wertvollste Auskunft dieser Liste, weil sie die Trennlinie des
 * Projekts betrifft: Synchro ist nicht Untertitel.
 */
export const ANDERE_FASSUNG =
  /\b(OmU|OmdU|Untertitel|subbed|sub\)|\(sub\b|(English|Englisch|French|Spanish|Italian)\s*(Dub|Sub)\b)/i
