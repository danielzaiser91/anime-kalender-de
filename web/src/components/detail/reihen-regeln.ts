import type { FranchiseMember } from '@shared/types.ts'
import type { StaffelNummer } from '@shared/titles.ts'

/**
 * Ein Teil der Reihe ohne belegte deutsche Synchro steht hinter dem Schalter der Box „Teile in dieser Reihe" — auch ein angekündigter oder laufender. Nur der geöffnete Titel
 * bleibt immer sichtbar. Daniel am 04.10.2026: Mit eingeschaltetem „ohne Synchro ausblenden" dürfen nur Teile mit belegter Synchro oder der Titel selbst dort stehen.
 * Das ersetzt die Ausnahme für künftige Teile vom 04.09.2026 („Black Clover Staffel 2 sofort sehen"): 119 Teile ohne Synchro blieben so trotz Schalter sichtbar (gemessen 05.10.2026);
 * sie sind jetzt nur einen Klick entfernt, die Zahl am Schalter nennt sie.
 */
export function istEingeklappt(m: Pick<FranchiseMember, 'id' | 'ohneSynchro'>, geoeffneteId: number): boolean {
  return Boolean(m.ohneSynchro) && m.id !== geoeffneteId
}

/** „Staffel 4" bzw. „Staffel 4 - Teil 2". */
export function staffelKurz(n: Pick<StaffelNummer, 'staffel' | 'teil'>): string {
  return n.teil ? `Staffel ${n.staffel} - Teil ${n.teil}` : `Staffel ${n.staffel}`
}

/**
 * Rückt die gewählte Zeile in die Mitte ihrer Liste, falls sie außerhalb liegt — und scrollt nur die Liste.
 * `scrollIntoView` scrollte das ganze Panel, es öffnete vorgescrollt (Handy 393 px, 09.10.2026).
 */
export function zeileInListeSichtbar(zeile: HTMLElement | null): void {
  const box = zeile?.closest<HTMLElement>('[data-reihe-liste]')
  if (!zeile || !box) return
  const oben = zeile.offsetTop
  if (oben >= box.scrollTop && oben + zeile.offsetHeight <= box.scrollTop + box.clientHeight) return
  box.scrollTop = oben - (box.clientHeight - zeile.offsetHeight) / 2
}
