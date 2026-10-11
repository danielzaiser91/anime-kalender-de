import type { Title } from '@shared/types.ts'

/**
 * Die Nebenzeile im Zustand „teilweise“: Bei einer laufenden Serie nennt sie die nächste Folge,
 * deren Termin fehlt; bei einer beendeten, dass die übrigen Folgen nicht auf Deutsch belegt sind.
 */
export function teilweiseNeben({ raus, gesamt, title, today, T }: {
  raus: number | undefined
  gesamt: number
  title: Title
  today: string
  T: (k: string, v?: Record<string, string | number>) => string
}): string {
  const laeuft = title.jpEnd ? title.jpEnd >= today : title.jpStatus === 'RELEASING' || title.jpStatus === 'NOT_YET_RELEASED'
  if (laeuft && raus !== undefined && raus < gesamt) return T('antwort.teilweiseOffen', { n: raus + 1 })
  return T('antwort.teilweiseNeben')
}
