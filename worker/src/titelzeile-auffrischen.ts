/**
 * **Gleicher Inhalt: den Zeitpunkt nachziehen, wo ein Leser den Unterschied sieht** (13.10.2026).
 *
 * Dieselben Regeln wie `pruefung-unveraendert.ts` (`haltFrisch`, `haltUebernommeneFrisch`; Begründung dort), auf die
 * Folge in der Titelzeile übertragen:
 * - offene Folge vor dem letzten Listenbau: `gemeldet_am` erneuern (Wiedervorlage, Zähler);
 * - übernommene Folge an einem neuen Tag (Berlin oder UTC): erneuern und wieder öffnen (der Bau liest nur offene);
 * - übernommene Folge vor dem Listenbau, derselbe Tag: nur erneuern.
 * Sonst `null`: keine Änderung, null geschriebene Zeilen.
 */
import { jetztIso } from './werte.ts'
import { berlinTag } from './pruefung-unveraendert.ts'
import { AM, MELDUNG_UEBERNOMMEN, type Eintrag } from './titelzeile-format.ts'

/** `listenbauAm`: Zeitpunkt des letzten Listenbaus (`holeListenbauAm`), erst bei Bedarf geholt. */
export async function auffrischen(vorher: Eintrag, listenbauAm: () => Promise<string | null>): Promise<Eintrag | null> {
  const jetzt = jetztIso()
  const am = vorher[AM]
  const neuerTag = vorher[MELDUNG_UEBERNOMMEN] === 1 && (berlinTag(am) !== berlinTag(jetzt) || am.slice(0, 10) !== jetzt.slice(0, 10))
  const bau = neuerTag ? null : await listenbauAm()
  if (!neuerTag && !(bau && am < bau)) return null
  const frisch = [...vorher] as Eintrag
  frisch[AM] = jetzt
  if (neuerTag) frisch[MELDUNG_UEBERNOMMEN] = 0
  return frisch
}
