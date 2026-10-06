import { useLang } from '../lib/i18n.tsx'
import { datumKurz } from '../lib/news-text.ts'
import { jungeNeuerungen } from '../lib/seiten-neuerungen.ts'
import { todayIso } from '@shared/time.ts'

/** „Neu auf der Seite": die jüngsten Neuerungen der Seite selbst, über den Anime-Meldungen. */
export function SeitenNeuerungen(): React.JSX.Element | null {
  const { t } = useLang()
  const liste = jungeNeuerungen(todayIso())
  if (!liste.length) return null
  return (
    <section aria-label={t('news.seite')} className="mb-3 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 dark:border-sky-900/60 dark:bg-sky-950/30">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">{t('news.seite')}</h2>
      <ul className="mt-1 space-y-0.5">
        {liste.map((n) => (
          <li key={n.datum + n.text} className="flex gap-2 text-xs text-slate-700 dark:text-slate-300">
            <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{datumKurz(n.datum)}</span>
            <span className="min-w-0">
              {n.text}
              {n.ziel && (
                <>
                  {' '}
                  <a href={n.ziel} className="whitespace-nowrap text-sky-700 underline underline-offset-2 dark:text-sky-300">
                    {t('news.seiteAnsehen')}
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
