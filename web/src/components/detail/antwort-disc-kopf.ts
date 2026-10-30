/**
 * Die Überschrift des Disc-Kastens (aus `antwort-kasten.tsx` herausgelöst, damit die Datei nicht wächst).
 *
 * Ab zwei Bänden zählt der Stand, nicht der nächste Termin: „in 2 Monaten, 06.11.2026“ verschwieg, dass Band 1 seit dem 21.08.
 * im Laden liegt (Banana Fish). Die Zeile nennt deshalb jeden Band: „Vol. 1 seit 21.08.2026 · Vol. 2 am 06.11.2026“.
 */
import { formatDate } from '@shared/time.ts'
import type { Antwort } from './antwort-typ.ts'

type Disc = Extract<Antwort, { art: 'disc' }>
type Uebersetze = (k: string, v?: Record<string, string | number>) => string

/** Relative Angabe zuerst — niemand rechnet gern nach, welcher Tag der 25. ist; ab einer Woche leer. */
function relativ(datum: string, heute: string, T: Uebersetze): string {
  const tage = Math.round((new Date(`${datum}T12:00:00Z`).getTime() - new Date(`${heute}T12:00:00Z`).getTime()) / 86400000)
  if (tage <= 0) return T('antwort.heute')
  if (tage === 1) return T('antwort.morgen')
  if (tage <= 6) return T('antwort.inTagen', { count: tage })
  return ''
}

export function discKopf(antwort: Disc, heute: string, T: Uebersetze): string {
  return (
    antwort.baende
      ?.map((b) =>
        [b.name, T(b.raus ? 'antwort.discSeit' : 'antwort.discAm', { datum: formatDate(b.datum) })]
          .filter(Boolean)
          .join(' '),
      )
      .join(' · ') ?? [relativ(antwort.datum, heute, T), formatDate(antwort.datum)].filter(Boolean).join(', ')
  )
}
