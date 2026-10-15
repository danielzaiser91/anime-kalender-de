import { addDays, diffDays } from './time.ts'

/**
 * **Synchro-Termine aus den Terminen des Originals** (15.10.2026).
 *
 * Läuft die deutsche Fassung dem Original in festem Abstand hinterher, übernimmt sie auch dessen Pausen:
 * Tomb Raider King pausierte im Original eine Woche vor dem Finale, die Synchro folgte mit demselben Abstand
 * (+20 Tage über alle 11 Folgen). Die reine Wochenfortschreibung kennt die Pause nicht und setzte Folge 12
 * auf einen Tag, an dem nichts kam. Der Abstand wird nur geglaubt, wenn er gemessen und stabil ist.
 */

/** Mindestens so viele Folgen mit Synchro- und Originaltag, sonst ist der Abstand Zufall. */
export const MIN_BEOBACHTUNGEN = 4
/** Größte Streuung der Abstände in Tagen; die Originaldaten (TMDB) sind selbst ±1 Tag genau. */
export const MAX_STREUUNG_TAGE = 1
/**
 * Erst ab so vielen Tagen Abstand zum Wochentakt zählt ein Originaltermin als Pause: Ein Tag ist die Streuung der
 * TMDB-Daten. Rückgerechnet (15.10.2026, `tools/synchro-original-rueckrechnung.ts`) stimmte bei 26 von 26
 * Ein-Tages-Abweichungen der Wochentakt, nie die Tabelle.
 */
export const MIN_ABWEICHUNG_TAGE = 2

/** Der Abstand Synchro minus Original in Tagen; `undefined`, wenn zu wenige oder zu uneinheitliche Folgen vorliegen. */
export function synchroVersatz(beobachtet: Record<number, string>, original: Record<number, string>): number | undefined {
  const abstaende = Object.entries(beobachtet)
    .filter(([folge, datum]) => datum && original[Number(folge)])
    .map(([folge, datum]) => diffDays(original[Number(folge)], datum))
    .sort((a, b) => a - b)
  if (abstaende.length < MIN_BEOBACHTUNGEN) return undefined
  if (abstaende[abstaende.length - 1] - abstaende[0] > MAX_STREUUNG_TAGE) return undefined
  return abstaende[abstaende.length >> 1]
}

/**
 * Die Synchro-Tage der Folgen hinter der letzten Beobachtung bis `bisFolge`: Originaltag plus Abstand.
 * Leer, wenn der Abstand nicht belastbar ist oder ein Tag nicht hinter der letzten Beobachtung liegt
 * (dann stimmt die Zuordnung der Folgennummern nicht). Die Tabelle beginnt erst bei der ersten Folge, die mindestens
 * `MIN_ABWEICHUNG_TAGE` vom Wochentakt abweicht; ohne eine solche Pause im Original ist sie leer.
 */
export function termineNachOriginal(beobachtet: Record<number, string>, original: Record<number, string>, bisFolge: number): Record<number, string> {
  const versatz = synchroVersatz(beobachtet, original)
  const letzte = Math.max(0, ...Object.keys(beobachtet).map(Number))
  if (versatz === undefined) return {}
  const ergebnis: Record<number, string> = {}
  let davor = beobachtet[letzte]
  for (const folge of Object.keys(original).map(Number).filter((n) => n > letzte && n <= bisFolge).sort((a, b) => a - b)) {
    const tag = addDays(original[folge], versatz)
    if (tag <= davor) break
    ergebnis[folge] = tag
    davor = tag
  }
  const takt = (folge: number) => addDays(beobachtet[letzte], 7 * (folge - letzte))
  const pause = Object.entries(ergebnis).findIndex(([folge, tag]) => Math.abs(diffDays(takt(Number(folge)), tag)) >= MIN_ABWEICHUNG_TAGE)
  return pause < 0 ? {} : Object.fromEntries(Object.entries(ergebnis).slice(pause))
}

/**
 * Der Tag einer fortgeschriebenen Folge nach den Originalterminen, sonst `undefined`.
 * `stuetzpunkt` ist die letzte belegte Folge: nur Folgen dahinter, und nur mit einem Tag hinter ihrem.
 * Hinter der letzten bekannten Originalfolge geht es im Wochenabstand weiter.
 */
export function folgeNachOriginal(
  nachOriginal: Record<number, string> | undefined,
  folge: number,
  stuetzpunkt: { episode: number; date: string } | undefined,
): string | undefined {
  const bekannt = Object.keys(nachOriginal ?? {}).map(Number).sort((a, b) => a - b)
  if (!nachOriginal || !stuetzpunkt || !bekannt.length || folge <= stuetzpunkt.episode || folge < bekannt[0]) return undefined
  const bis = bekannt.filter((n) => n <= folge).at(-1)!
  const tag = addDays(nachOriginal[bis], 7 * (folge - bis))
  return tag > stuetzpunkt.date ? tag : undefined
}

/** Fällt der Tag auf eine Sendepause (`skipDates`), kommt die Folge erst eine Woche später — wie in der Wochenfortschreibung von `lastEpisodeDate`. */
export function erstesFreiesDatum(tag: string, skips: ReadonlySet<string>): string {
  let datum = tag
  for (let i = 0; skips.has(datum) && i < 400; i++) datum = addDays(datum, 7)
  return datum
}
