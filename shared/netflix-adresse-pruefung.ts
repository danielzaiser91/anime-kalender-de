/**
 * Führt diese Netflix-Adresse zu einem Titel — oder ins Leere?
 *
 * Nach der Vereinheitlichung vom 27.08.2026 tragen fast alle Netflix-Verweise
 * eine Kennung (`/title/<id>`). Zwei bleiben übrig, und beide kommen aus AniLists
 * Verweisliste:
 *
 * - `netflix.com/title/` ohne Nummer — führt auf eine leere Seite
 * - `netflix.com/DetectiveConanMovies` — führt auf eine **Genre-Liste**, nicht
 *   auf den Film, den unser Eintrag meint
 *
 * Beide sind für einen Besucher wertlos: Er klickt und findet nicht, wonach er
 * gesucht hat. Daniels Vorgabe dazu (27.08.2026): „auf unserem kalender sollen
 * nur funktionierende links angezeigt werden."
 *
 * **Ein Verweis ohne Kennung wird deshalb nicht angezeigt** — und der Titel
 * landet in der Prüfliste, wo die richtige Adresse von Hand nachgetragen werden
 * kann. Das ist der Unterschied zu „entfernen und vergessen".
 */
export function netflixAdresseTaugt(url: string): boolean {
  if (!/netflix\.com/i.test(url)) return true
  /* Eine Kennung genügt — die Wunschadressen sind seit 27.08.2026 aufgelöst. */
  if (/\/(?:title|watch)\/\d{6,}/.test(url)) return true
  /* Eine Genre-Liste ist kein Titel, auch wenn sie funktioniert. */
  return false
}
