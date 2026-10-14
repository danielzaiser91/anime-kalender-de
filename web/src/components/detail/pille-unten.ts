import type { Release, StreamLink, Title } from '@shared/types.ts'
import { formatDate } from '@shared/time.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { streamStatus } from './legende-zeilen.ts'
import { teilAngaben } from './wege-falten.ts'

/** Die zweite Zeile einer Stream-Pille: Folgen, Stand der JustWatch-Angabe, Teilbereich; leer, wenn nichts davon gilt. */
export function pilleUnten({ title, s, releases, folgenAngabe, t }: {
  title: Title
  s: StreamLink
  releases: Release[]
  folgenAngabe: string
  t: Translate
}): string | undefined {
  return (
    [
      folgenAngabe,
      streamStatus(title, s, releases) === 'justwatch' ? t('detail.stand', { datum: formatDate(s.dubStand!) }) : '',
      s.teilBereich ? teilAngaben(title, s.teilBereich, t, folgenAngabe).unten : '',
    ]
      .filter(Boolean)
      .join(' · ') || undefined
  )
}
