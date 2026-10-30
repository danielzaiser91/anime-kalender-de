/**
 * Die Überschrift des Disc-Kastens, wenn schon ein Band erschienen ist (aus `antwort-kasten.tsx` herausgelöst).
 *
 * Ab zwei Bänden zählt der Stand, nicht der nächste Termin: „in 2 Monaten, 06.11.2026“ verschwieg, dass Band 1 seit dem 21.08.
 * im Laden liegt (Banana Fish). Die Zeile nennt deshalb jeden Band: „Vol. 1 seit 21.08.2026 · Vol. 2 am 06.11.2026“.
 * Vor dem ersten Band steht stattdessen der Satz aus `antwort-vorstart.ts`; eine einzelne künftige Disc geht immer dorthin.
 */
import { formatDate } from '@shared/time.ts'
import type { Antwort } from './antwort-typ.ts'

type Disc = Extract<Antwort, { art: 'disc' }>
type Uebersetze = (k: string, v?: Record<string, string | number>) => string

export function discKopf(antwort: Disc, T: Uebersetze): string {
  return (antwort.baende ?? [])
    .map((b) => [b.name, T(b.raus ? 'antwort.discSeit' : 'antwort.discAm', { datum: formatDate(b.datum) })].filter(Boolean).join(' '))
    .join(' · ')
}
