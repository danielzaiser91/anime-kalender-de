import { abstandGrob, diffDays } from '@shared/time.ts'

type Uebersetze = (k: string, v?: Record<string, string | number>) => string

/** Countdown für die Satzmitte („erscheint in 2 Wochen, am …"), kleingeschrieben. */
export function abstandImSatz(heute: string, datum: string, T: Uebersetze): string {
  const { einheit, anzahl } = abstandGrob(diffDays(heute, datum))
  if (einheit === 'heute') return T('antwort.relHeute')
  if (einheit === 'morgen') return T('antwort.relMorgen')
  if (einheit === 'tage') return T('antwort.relInTagen', { count: anzahl })
  if (einheit === 'wochen') return anzahl === 1 ? T('antwort.relInEinerWoche') : T('antwort.relInWochen', { count: anzahl })
  if (einheit === 'monate') return anzahl === 1 ? T('antwort.relInEinemMonat') : T('antwort.relInMonaten', { count: anzahl })
  return anzahl === 1 ? T('antwort.relInEinemJahr') : T('antwort.relInJahren', { count: anzahl })
}
