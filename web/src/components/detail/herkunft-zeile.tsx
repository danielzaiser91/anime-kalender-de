import type { Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { herkunftVon } from '../../lib/herkunft.ts'
import { Flagge } from '../filter/Flagge.tsx'
import { herkunftName } from '../filter/herkunft-gruppe.tsx'

const LAENDER = new Intl.DisplayNames(['de'], { type: 'region' })

/** Das Land der Produktion beim Namen („Frankreich“), nicht die Filtergruppe „USA & Co.“. */
const landName = (code: string): string => (code === 'US' ? 'USA' : (LAENDER.of(code) ?? code))

/** Nur Nicht-Japan: bei Japan sagt die Unterzeile über dem Bild schon „JP …", „Unbekannt" wäre Rauschen (Mockup „Herkunftsfilter" B). */
export function zeigtHerkunft(title: Title): boolean {
  const h = herkunftVon(title)
  return h !== 'JP' && h !== 'XX'
}

/** „Herkunft: Flagge Land" als eine Zeile im Bereich „Zum Werk". */
export function HerkunftZeile({ title, t }: { title: Title; t: Translate }) {
  const h = herkunftVon(title)
  return (
    <p className="mb-2 flex items-center gap-1.5 text-sm text-ak-text/85">
      <span className="text-xs text-slate-500 dark:text-slate-400">{t('filter.herkunft')}</span>
      <Flagge land={h} />
      {title.land ? landName(title.land) : herkunftName(t, h)}
    </p>
  )
}
