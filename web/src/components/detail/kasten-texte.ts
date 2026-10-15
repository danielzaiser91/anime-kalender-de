import type { ReleaseEvent, Title } from '@shared/types.ts'
import { formatDate, weekdayName } from '@shared/time.ts'
import { kostenloseFolgen, kostenlosEtikett } from '@shared/kostenlos.ts'
import type { Antwort } from './antwort-typ.ts'

/** Die Überschrift des grünen Blocks „Kostenlos“: ganz oder „teilweise · 3 von 12“, verglichen mit den deutschen Folgen. */
export function kostenlosKopfVon({ title, antwort, T }: {
  title: Title
  antwort: Antwort
  T: (k: string, v?: Record<string, string | number>) => string
}): string {
  const k = kostenloseFolgen(title)
  const deutsch =
    title.format === 'MOVIE' || title.episodes === 1
      ? 1
      : antwort.art === 'fertig'
        ? antwort.gesamt
        : antwort.art === 'teilweise' || antwort.art === 'laeuft'
          ? antwort.raus
          : undefined
  const belegtMax = Math.max(
    0,
    ...(title.streams ?? []).map((s) =>
      (s.dubRanges ?? []).filter((r) => r.dub).reduce((n, r) => n + r.to - r.from + 1, 0),
    ),
  )
  const von = deutsch || belegtMax || undefined
  return kostenlosEtikett(k, von) === 'teil'
    ? `${T('kostenlos.teil')} · ${T('kostenlos.zahl', { frei: k!.frei!, von: von! })}`
    : T('kostenlos.ganz')
}

/**
 * Der Tag, an dem die ausgebliebene Folge kommen sollte, mit Uhrzeit, wenn bekannt.
 * Ein fortgeschriebener Tag (`estimated`) ist keine Ankündigung des Anbieters und heißt „erwartet“.
 */
export function ausgebliebenTerminText(
  e: ReleaseEvent,
  T: (k: string, v?: Record<string, string | number>) => string,
): string {
  const schluessel = e.estimated ? 'antwort.erwartetFuer' : 'antwort.angekuendigtFuer'
  const werte = { tag: weekdayName(e.date), datum: formatDate(e.date) }
  if (!e.time) return T(schluessel, werte)
  return T(`${schluessel}Zeit`, { ...werte, zeit: e.timeEstimated ? `≈ ${e.time}` : e.time })
}
