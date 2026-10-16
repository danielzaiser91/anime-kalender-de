import type { DubCheck } from './dub-confirmed.ts'

/**
 * Eigene Sichtung oder Messung in der Notiz: „Daniel, 10.10.2026“, „Tonspuren:“ (Amazon-Seite), Crunchyroll-Schnittstelle.
 * „Daniels Entscheidung“ zählt nicht: Sie nahm einen Serienton an, sah ihn aber nicht (Fruits Basket S1, 17.09.2026).
 */
const EIGENE_QUELLE = /Daniel(,| am)? \d\d\.\d\d\.\d{4}|Tonspuren:|Schnittstelle/

/** Ein „deutsch“-Handbeleg, dessen Notiz als Quelle nur JustWatch nennt: JustWatchs Ton gilt der ganzen Serie, nicht der Staffel. */
export function stuetztSichNurAufJustWatch(c: Pick<DubCheck, 'dub' | 'note'>): boolean {
  if (c.dub !== true) return false
  const note = c.note ?? ''
  return /JustWatch/i.test(note) && !EIGENE_QUELLE.test(note)
}
