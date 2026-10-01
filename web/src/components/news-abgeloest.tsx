import { istLink } from '@shared/quelle.ts'
import type { NewsMeldung } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { datumKurz } from '../lib/news-text.ts'

/**
 * **Was eine Meldung abgelöst hat, steht neben ihr** (Daniel, 01.10.2026).
 *
 * Ein Link in einem Knopf wäre ungültiges HTML — der Verweis steht deshalb
 * daneben, wie die Quellenangabe. Ausgelagert, damit `MeldungZeile` die
 * Längengrenze hält.
 */
export function AbgeloestHinweis({ m }: { m: NewsMeldung }) {
  const { t } = useLang()
  if (m.ersetzt) {
    const text = t('news.ersetzt', { datum: m.ersetzt.datum ? datumKurz(m.ersetzt.datum) : '' })
    return istLink(m.ersetzt.quelle) ? (
      <a
        href={m.ersetzt.quelle}
        target="_blank"
        rel="noopener noreferrer"
        title={t('news.ersetztTitel')}
        className="shrink-0 text-[10px] text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
      >
        {text} ↗
      </a>
    ) : (
      <span title={t('news.ersetztTitel')} className="shrink-0 text-[10px] text-amber-700 dark:text-amber-400">
        {text}
      </span>
    )
  }
  if (m.zurueckgezogen) {
    return (
      <span title={t('news.zurueckgezogenTitel')} className="shrink-0 text-[10px] text-rose-600 dark:text-rose-400">
        {t('news.zurueckgezogen')}
      </span>
    )
  }
  return null
}
