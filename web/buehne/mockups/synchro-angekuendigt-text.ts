import { ankuendigungZeile } from '@shared/ankuendigung.ts'
import { formatDate } from '@shared/time.ts'
import type { Title } from '@shared/types.ts'
import type { Translate } from '../../src/lib/i18n.tsx'

export type Ankuendigung = NonNullable<Title['ankuendigung']>

/** Die Teile der heutigen Nebenzeile „Crunchyroll · mit Untertiteln seit 10.10.2026 · Synchro-Termin offen“. */
export function zeilenTeile(a: Ankuendigung, t: Translate): { anbieter: string; untertitel: string; termin: string } {
  const [anbieter, untertitel, termin] = ankuendigungZeile(a, t as unknown as (k: string, v?: Record<string, string | number>) => string).split(' · ')
  return { anbieter, untertitel, termin }
}

/** Die Quelle, die die Synchro nennt: der Artikel über deutsche Synchros, sonst die erste. */
export function quelleVon(a: Ankuendigung): string | undefined {
  return a.quellen.find((q) => /synchro/i.test(q)) ?? a.quellen[0]
}

/** „Stand 15.09.2026“ — das Datum der Quelle, nie der Tag der Synchro. */
export const standText = (a: Ankuendigung): string => `Stand ${formatDate(a.stand)}`

