import type { FranchiseMember } from '@shared/types.ts'
import { erscheintErst } from '@shared/logic.ts'

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
