import { aehnlich } from './folgentitel-tmdb.ts'

/** Ab so vielen Titeln, die beide Seiten auf derselben Nummer führen, belegen sie die Zählung (oder widerlegen sie). */
export const MIN_VERGLICHEN = 3

export type Abgleich = 'passt' | 'widerspricht' | 'offen'

/**
 * Die Titel, die wir schon haben (aniSearch, Crunchyroll), gegen die Titel einer Quelle auf denselben Nummern: mindestens vier Fünftel gleich (Name gleich
 * oder enthalten, oder Wörter gemeinsam, `aehnlich`) → `passt`; weniger → `widerspricht`; weniger als `MIN_VERGLICHEN` gemeinsame Nummern → `offen`
 * (kein Vergleich, also auch kein Beleg).
 */
export function abgleich(vorhanden: ReadonlyMap<number, string>, quelle: ReadonlyMap<number, string>): Abgleich {
  const gemeinsam = [...vorhanden].filter(([nr]) => quelle.has(nr))
  if (gemeinsam.length < MIN_VERGLICHEN) return 'offen'
  const gleich = gemeinsam.filter(([nr, titel]) => aehnlich(titel, quelle.get(nr) as string)).length
  return gleich * 5 >= gemeinsam.length * 4 ? 'passt' : 'widerspricht'
}
