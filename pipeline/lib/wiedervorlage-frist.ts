/**
 * Nach wie vielen Tagen ein Sprachbeleg wieder zur Frage wird.
 *
 * Steht in einer eigenen Datei, damit `check:logic` sie prüfen kann: `wiedervorlage.ts`
 * arbeitet beim Laden und darf deshalb nicht importiert werden.
 */
import type { DubBereich } from '../../shared/dub-grenze.ts'
import type { PlatformId } from '../../shared/types.ts'

/**
 * Die reguläre Frist je Anbieter.
 *
 * Crunchyroll, ADN und YouTube fehlen: Deren Sprachangaben holt jeder Lauf neu gegen die
 * Quelle, eine zweite Wiedervorlage wäre doppelte Arbeit. Wer ein Abo-Angebot führt,
 * verliert Lizenzen; ein Kauftitel bleibt kaufbar — daher die Spreizung.
 */
export const FRISTEN: Partial<Record<PlatformId, number>> = {
  primevideo: 180,
  netflix: 180,
  disneyplus: 180,
  rtlplus: 270,
  joyn: 270,
}

/**
 * **Ein „ohne deutschen Ton" veraltet in Wochen, nicht in Monaten** (Daniel, 23.09.2026:
 * „gerade geprüft: Disney+ zeigt de 1-8. 9-11 sind jp").
 *
 * Die Erweiterung maß am 26.08.2026 bei „Though I Am an Inept Villainess" auf Disney+ die
 * Folgen 1–4 mit und 5–7 ohne deutschen Ton. Das stimmte: Mehr als sieben Folgen gab es
 * damals nicht, und die Synchro lag drei Folgen zurück. Vier Wochen später war sie
 * aufgeschlossen, die Pille behauptete weiter „✕ DE 5–7" — das Gegenteil der Lage.
 *
 * Die 180 Tage sind für diesen Fall die falsche Größenordnung. Sie zielen auf verlorene
 * Lizenzen, und die sind selten. Ein `dub: false` über die zuletzt erschienenen Folgen einer
 * **laufenden** Serie ist dagegen eine Momentaufnahme: Jede neue Synchrofolge widerlegt sie.
 */
export const FRIST_LAUFEND_OHNE_TON = 14

/**
 * Welche Frist für diesen Weg gilt — `undefined` heißt: keine Wiedervorlage.
 *
 * Die Kurzfrist greift nur bei den Anbietern mit Handprüfung. Bei Crunchyroll und ADN wäre
 * sie wirkungslos, weil dort ohnehin jeder Lauf nachmisst.
 */
export function fristFuer(
  plattform: PlatformId,
  laeuft: boolean,
  bereiche: DubBereich[] | undefined,
): number | undefined {
  const regulaer = FRISTEN[plattform]
  if (!regulaer) return undefined
  return laeuft && bereiche?.some((r) => !r.dub) ? FRIST_LAUFEND_OHNE_TON : regulaer
}
