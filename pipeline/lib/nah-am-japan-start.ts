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

interface SprachBlock {
  language?: string
  released?: string
}

const tagMs = (s?: string): number | undefined => {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s ?? '')
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : undefined
}

/**
 * Der japanische Starttag aus aniSearchs Sprachblöcken — nur, wenn Japan das Original ist. Beginnt ein anderer nicht deutscher Block früher
 * („Pac-Man und die Geisterabenteuer": Englisch 15.06.2013, Japanisch 05.04.2014 ist eine Synchro), gibt es keinen japanischen Start,
 * und ein deutsches Datum dicht daran sagt nichts über einen Simulcast.
 */
export function japanStartTag(sprachen: SprachBlock[]): number | undefined {
  const jp = tagMs(sprachen.find((l) => l.language === 'Japanisch')?.released)
  if (jp === undefined) return undefined
  const frueher = sprachen.some((l) => l.language !== 'Deutsch' && l.language !== 'Japanisch' && (tagMs(l.released) ?? Infinity) < jp)
  return frueher ? undefined : jp
}
