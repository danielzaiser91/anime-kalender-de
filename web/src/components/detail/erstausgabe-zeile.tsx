import type { Title } from '@shared/types.ts'
import { useLang } from '../../lib/i18n.tsx'
import { datumKurz } from '../../lib/news-text.ts'
import { NEWS_FARBE } from '../NewsView.tsx'
import { QuellenKnopf } from '../beleg-dialog.tsx'

/**
 * **Die deutsche Erstausgabe als älteste Neuigkeit eines Titels**, zurückdatiert auf ihren Tag; Beleg ist die aniSearch-Seite, aus der das Datum stammt.
 * Keine Meldung im News-Strom (sie ist keine Nachricht von heute), nur eine Zeile in der Zeitleiste des Panels.
 */
export function ErstausgabeZeile({ title }: { title: Title }) {
  const { t } = useLang()
  const e = title.deErstausgabe!
  const belege = title.anisearchId ? [{ name: 'aniSearch', url: `https://www.anisearch.de/anime/${title.anisearchId}` }] : []
  return (
    <li className="relative flex flex-col gap-1">
      <span aria-hidden className="absolute -left-[17px] top-1.5 size-[9px] rounded-full bg-emerald-500 ring-2 ring-ak-flaeche" />
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 rounded-md bg-ak-flaeche-2 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ak-text">{datumKurz(e.von!)}</span>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${NEWS_FARBE.neu}`}>{t('detail.erstausgabeArt')}</span>
        {belege.length > 0 && <QuellenKnopf belege={belege} betreff={t('detail.erstausgabeSatz')} />}
      </span>
      <span className="text-[13px] font-medium leading-snug text-ak-text">
        {t('detail.erstausgabeSatz')}
        {e.publisher ? ` · ${e.publisher}` : ''}
      </span>
    </li>
  )
}
