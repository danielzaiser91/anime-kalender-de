import { toIsoDate } from '../../shared/time.ts'

/**
 * Die Folgentage aus `schedule.observed` einer Veröffentlichung als Beobachtungen.
 *
 * Der Simulcast-Kalender kennt nicht jede Serie (Das Band der Unterwelt, GT00371630: Folgen 22–24
 * kamen pünktlich, standen aber als „ausgeblieben" in der Liste). `observed` speist sich auch aus dem
 * Folgen-Feed. Tage nach heute (Berliner Tag) sind Ankündigungen, keine Beobachtungen.
 */
export function beobachtetAusRelease(
  observed: Record<string, string> | undefined,
  jetzt: Date,
): { date: string; episode: number }[] {
  const heute = toIsoDate(jetzt)
  return Object.entries(observed ?? {})
    .map(([episode, date]) => ({ date, episode: Number(episode) }))
    .filter((o) => o.date <= heute)
}
