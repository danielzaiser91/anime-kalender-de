import { ERSTAUSGABE_OHNE_WEG_ZEILE, erstausgabeOhneWegAnstieg } from './erstausgabe-ohne-weg.ts'
import { RUECKGANG_ZEILE, streamingRueckgang } from './streaming-rueckgang.ts'

/** Was von der Messung höher oder niedriger als beim letzten Wert auffällt; je Zeile ein Präfix, das der Schritt „Datenqualität messen“ (bestand-bauen.yml) liest. */
export interface Messwerte {
  mitStreamingWeg: number
  erstausgabeOhneWeg: number
}

export function warnZeilen(aktuell: Messwerte, vorher: Partial<Messwerte> | null): string[] {
  const zeilen: string[] = []
  const rueckgang = streamingRueckgang(aktuell.mitStreamingWeg, vorher?.mitStreamingWeg)
  if (rueckgang) zeilen.push(`${RUECKGANG_ZEILE}${rueckgang}`)
  const anstieg = erstausgabeOhneWegAnstieg(aktuell.erstausgabeOhneWeg, vorher?.erstausgabeOhneWeg)
  if (anstieg) zeilen.push(`${ERSTAUSGABE_OHNE_WEG_ZEILE}${anstieg}`)
  return zeilen
}
