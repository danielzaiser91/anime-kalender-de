import type { FranchiseMember } from '@shared/types.ts'
import { erscheintErst } from '@shared/logic.ts'
import type { StaffelNummer } from '@shared/titles.ts'

/**
 * Ein Teil der Reihe ohne belegte deutsche Synchro steht hinter dem Schalter der Box „Teile in dieser Reihe" — auch ein angekündigter oder laufender. Nur der geöffnete Titel
 * bleibt immer sichtbar. Daniel am 04.10.2026: Mit eingeschaltetem „ohne Synchro ausblenden" dürfen nur Teile mit belegter Synchro oder der Titel selbst dort stehen.
 * Das ersetzt die Ausnahme für künftige Teile vom 04.09.2026 („Black Clover Staffel 2 sofort sehen"): 119 Teile ohne Synchro blieben so trotz Schalter sichtbar (gemessen 05.10.2026);
 * sie sind jetzt nur einen Klick entfernt, die Zahl am Schalter nennt sie.
 * Ein „geplanter" Teil (Original noch nicht erschienen, `erscheintErst`) zählt ebenfalls dazu (Daniel, 10.10.2026), auch wenn ihm das Flag `ohneSynchro` fehlt.
 */
export function istEingeklappt(m: Pick<FranchiseMember, 'id' | 'ohneSynchro' | 'jpStart' | 'jpStatus' | 'jpYear'>, geoeffneteId: number): boolean {
  return (Boolean(m.ohneSynchro) || erscheintErst(m)) && m.id !== geoeffneteId
}

/** „Staffel 4" bzw. „Staffel 4 - Teil 2". */
export function staffelKurz(n: Pick<StaffelNummer, 'staffel' | 'teil'>): string {
  return n.teil ? `Staffel ${n.staffel} - Teil ${n.teil}` : `Staffel ${n.staffel}`
}

/**
 * Ein Rest aus Zahl oder Satzzeichen („0", „2.0", „!") sagt allein nichts: Aus „Jujutsu Kaisen 0" wurde in der Liste „0" (12.10.2026).
 * Klammern bleiben, „(2016)" unterscheidet zwei Fassungen.
 */
export function istNichtssagend(rest: string): boolean {
  return rest !== '' && !/[\p{L}()]/u.test(rest)
}

/** Der Name eines Teils ohne Reihenname; ist der Rest nichtssagend oder leer, steht der volle Name da. */
export function kurzName(rest: string, voll: string): string {
  return rest && !istNichtssagend(rest) ? rest : voll
}

/** Der Zusatz hinter „Staffel N ·": der Rest, bei nichtssagendem Rest der volle Name — außer der Rest ist nur die Staffelnummer selbst. */
export function zeilenZusatz(nr: Pick<StaffelNummer, 'staffel' | 'eigenerName'>, rest: string, voll: string): string {
  if (!nr.eigenerName || !rest) return ''
  if (!istNichtssagend(rest)) return rest
  return rest === String(nr.staffel) ? '' : voll
}
