import { abgleich } from './folgentitel-abgleich.ts'
import { istPlatzhalter } from './folgentitel-zeilen.ts'

/**
 * **Deutsche Folgentitel von RTL+** (Daniel, 01.11.2026: Beyblade X trug ab Folge 66 keine Titel, obwohl `data/rtlplus-folgen.json` sie führt).
 * Die Quelle zählt die Staffeln hintereinander durch (`durchzaehlen` in `lib/rtlplus-folgen.ts`: Länge einer Staffel = ihre höchste bekannte
 * Nummer), `nr` ist also unsere Nummer, wenn unser Titel die ganze Serie führt. Das belegen die Titel, die wir schon haben (aniSearch, Crunchyroll):
 * mindestens drei davon liegen auf RTL+-Nummern, und mindestens vier Fünftel gleichen dem RTL+-Titel derselben Nummer (`abgleich`). Sonst gibt es nichts —
 * ein Titel, der nur eine Staffel der Serie führt (eigene Nummern ab 1), fällt so heraus, statt falsche Titel zu bekommen.
 */
export interface RtlplusEintrag {
  folgen?: { nr: number; dt: string }[]
}

/** Die RTL+-Titel je unserer Nummer, wenn die vorhandenen Titel ihre Zählung belegen; sonst `undefined`. */
export function rtlplusFolgentitel(vorhanden: ReadonlyMap<number, string>, e: RtlplusEintrag | undefined): Map<number, string> | undefined {
  const jeNr = new Map((e?.folgen ?? []).filter((f) => f.dt && !istPlatzhalter(f.dt)).map((f) => [f.nr, f.dt] as const))
  return abgleich(vorhanden, jeNr) === 'passt' ? jeNr : undefined
}
