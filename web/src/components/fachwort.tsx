import type { ReactNode } from 'react'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { Tooltip } from './ui.tsx'

/** Abkürzungen, die im Fließtext eine Erklärung bekommen. */
const FACHWOERTER: Record<string, TranslationKey> = { OmU: 'fachwort.omu' }
const MUSTER = new RegExp(`\\b(${Object.keys(FACHWOERTER).join('|')})\\b`)

/**
 * **„OmU" ist unterstrichen und erklärt sich**: Wer die Abkürzung nicht
 * kennt, sieht an der Unterstreichung, dass er zeigen oder tippen kann.
 */
export function MitFachwoertern({ text }: { text: string }): ReactNode {
  const { t } = useLang()
  const teile = text.split(MUSTER)
  if (teile.length === 1) return text
  return teile.map((teil, i) =>
    FACHWOERTER[teil] ? (
      <Tooltip key={i} text={t(FACHWOERTER[teil])} unterstrichen>
        {teil}
      </Tooltip>
    ) : (
      teil
    ),
  )
}
