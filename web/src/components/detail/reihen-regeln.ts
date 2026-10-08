import type { FranchiseMember } from '@shared/types.ts'

/**
 * Bleibt von einem Teilnamen nach dem Abzug des Reihennamens nur eine Ziffer („Cyberpunk: Edgerunners 2" → „2"), sagt das nichts:
 * dann gilt der volle Name. „Staffel 2" daraus zu machen wäre geraten — „Mob Psycho 100", „Jujutsu Kaisen 0" sind keine Staffeln.
 */
export function sprechendeBeschriftung(kurz: string, voll: string): string {
  return /^\d+$/.test(kurz.trim()) ? voll : kurz
}

/**
 * Ein Teil der Reihe ohne belegte deutsche Synchro steht hinter dem Schalter der Box „Teile in dieser Reihe" — auch ein angekündigter oder laufender. Nur der geöffnete Titel
 * bleibt immer sichtbar. Daniel am 04.10.2026: Mit eingeschaltetem „ohne Synchro ausblenden" dürfen nur Teile mit belegter Synchro oder der Titel selbst dort stehen.
 * Das ersetzt die Ausnahme für künftige Teile vom 04.09.2026 („Black Clover Staffel 2 sofort sehen"): 119 Teile ohne Synchro blieben so trotz Schalter sichtbar (gemessen 05.10.2026);
 * sie sind jetzt nur einen Klick entfernt, die Zahl am Schalter nennt sie.
 */
export function istEingeklappt(m: Pick<FranchiseMember, 'id' | 'ohneSynchro'>, geoeffneteId: number): boolean {
  return Boolean(m.ohneSynchro) && m.id !== geoeffneteId
}
