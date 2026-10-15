/**
 * Liegt das deutsche Datum höchstens 30 Tage nach dem japanischen Start? Dann ist es ein Simulcast-Tag (OmU), kein Synchro-Datum.
 *
 * Erst ab 2012 und nicht bei Filmen: Davor heißt ein deutsches Datum nah am japanischen Start eine echte Ausstrahlung mit Synchro —
 * „Wickie" 1974, „Final Fantasy: Die Mächte in Dir" im Kino 2001. Gemessen danach: 548 Serien, Stichprobe durchweg OmU-Simulcasts
 * (Kazé, peppermint, Crunchyroll) mit späteren deutschen Discs. Beide Tage als Millisekunden (UTC); fehlt einer, ist die Antwort nein.
 */
export function istNahAmJapanStart(deTag: number | undefined, jpTag: number | undefined, format: string | undefined): boolean {
  return deTag !== undefined && jpTag !== undefined && deTag - jpTag <= 30 * 864e5 && new Date(jpTag).getUTCFullYear() >= 2012 && format !== 'MOVIE'
}
