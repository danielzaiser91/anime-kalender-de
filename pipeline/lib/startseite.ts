/**
 * Der vorgerenderte Text der Startseite. Für Besucher mit JavaScript verdeckt der Ladeschirm ihn, bis die App ihn ersetzt;
 * Suchmaschinen und Besucher ohne JavaScript lesen ihn. Er trägt den Suchbegriff „deutscher Anime-Kalender“ in Überschrift und Satz.
 */
import { ARTIKEL_STIL, SITE } from './titel-seite.ts'

/** Eine Aussage für Maschinenleser (JSON-LD) und für den ersten Absatz der Seite. */
export const START_AUSSAGE =
  'Der deutsche Anime-Kalender zeigt, wann welcher Anime mit deutscher Synchro erscheint: bei Crunchyroll, Netflix, Prime Video, ADN und Disney+, auf Disc und im Kino.'

const ABSAETZE = [
  START_AUSSAGE,
  'Synchro ist nicht Untertitel: Aufgenommen sind Anime und Animationsserien, für die es eine deutsche Fassung gibt oder angekündigt ist. Was nur wahrscheinlich ist, steht als solches da.',
  'Die Termine lassen sich als Kalender-Abo (ICS) oder in Google Calendar übernehmen. Der Newsletter meldet, wenn eine neue Synchro startet.',
]

/** `termine`: fertige Listeneinträge der nächsten Termine (leer = keine Liste). */
export function startseiteInhalt(termine: string, anzahlTermine: number): string {
  return (
    `<article style="${ARTIKEL_STIL}">\n` +
    `      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">Deutscher Anime-Kalender</h1>\n` +
    ABSAETZE.map((a) => `      <p style="margin:0 0 1rem;">${a}</p>\n`).join('') +
    (termine
      ? `      <h2 style="font-size:1.1rem;margin:1.5rem 0 .5rem;color:#fff;">Als nächstes</h2>\n` +
        `      <ul style="margin:0 0 1.5rem;padding-left:1.2rem;">\n${termine}      </ul>\n`
      : '') +
    `      <p><a href="${SITE}termine/" style="color:#7dd3fc;">Alle ${anzahlTermine} Termine ansehen</a></p>\n` +
    `    </article>`
  )
}
