import { addDays } from './time.ts'

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

function tage(datum: string): number {
  return Date.parse(`${datum}T12:00:00Z`) / 86_400_000
}

/** Der Abstand Synchro minus Original in Tagen; `undefined`, wenn zu wenige oder zu uneinheitliche Folgen vorliegen. */
export function synchroVersatz(beobachtet: Record<number, string>, original: Record<number, string>): number | undefined {
  const abstaende = Object.entries(beobachtet)
    .filter(([folge, datum]) => datum && original[Number(folge)])
    .map(([folge, datum]) => Math.round(tage(datum) - tage(original[Number(folge)])))
    .sort((a, b) => a - b)
  if (abstaende.length < MIN_BEOBACHTUNGEN) return undefined
  if (abstaende[abstaende.length - 1] - abstaende[0] > MAX_STREUUNG_TAGE) return undefined
  return abstaende[abstaende.length >> 1]
}

/**
 * Die Synchro-Tage der Folgen hinter der letzten Beobachtung bis `bisFolge`: Originaltag plus Abstand.
 * Leer, wenn der Abstand nicht belastbar ist oder ein Tag nicht hinter der letzten Beobachtung liegt
 * (dann stimmt die Zuordnung der Folgennummern nicht), und leer, wenn der Wochentakt dieselben Tage ergibt:
 * nur eine Pause im Original ändert etwas.
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
  const wochentakt = Object.entries(ergebnis).every(([folge, tag]) => tag === addDays(beobachtet[letzte], 7 * (Number(folge) - letzte)))
  return wochentakt ? {} : ergebnis
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
