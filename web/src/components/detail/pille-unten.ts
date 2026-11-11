import type { Release, StreamLink, Title } from '@shared/types.ts'
import { formatDate } from '@shared/time.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { seitDatumFuerPille } from './chips-regeln.ts'
import { streamStatus } from './legende-zeilen.ts'
import { seitAbText } from './seit-datum.ts'
import { teilAngaben } from './wege-falten.ts'

/** Nennt die Folgenangabe („Fg. 1 ab 05.11.“, Joyn) den künftigen Tag schon, entfällt das „ab 05.11.2026“: die Folgenangabe ist die genauere Aussage. Sie trägt kein Jahr; nur ein Datum nach `today` kann ihr Starttag sein (Jahreswechsel). */
export function seitOhneDoppelung(datum: string | undefined, folgenAngabe: string, today: string): string | undefined {
  return datum && datum > today && folgenAngabe.includes(`ab ${formatDate(datum).slice(0, 6)}`) ? undefined : datum
}

/** Die zweite Zeile einer Stream-Pille: Folgen, Stand der JustWatch-Angabe, Teilbereich, seit wann der Anbieter es führt; leer, wenn nichts davon gilt. */
export function pilleUnten({ title, s, releases, folgenAngabe, today, t }: {
  title: Title
  s: StreamLink
  releases: Release[]
  folgenAngabe: string
  today: string
  t: Translate
}): string | undefined {
  return (
    [
      folgenAngabe,
      streamStatus(title, s, releases) === 'justwatch' ? t('detail.stand', { datum: formatDate(s.dubStand!) }) : '',
      s.teilBereich ? teilAngaben(title, s.teilBereich, t, folgenAngabe).unten : '',
      seitAbText(seitOhneDoppelung(seitDatumFuerPille(title, s.platform, releases, s.kanal), folgenAngabe, today), today, t),
    ]
      .filter(Boolean)
      .join(' · ') || undefined
  )
}
