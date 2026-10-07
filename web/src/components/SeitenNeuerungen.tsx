import { useLang } from '../lib/i18n.tsx'
import { datumKurz } from '../lib/news-text.ts'
import { jungeNeuerungen } from '../lib/seiten-neuerungen.ts'
import { todayIso } from '@shared/time.ts'

/**
 * „Neu auf der Seite": die jüngsten Neuerungen der Seite selbst, über den Anime-Meldungen.
 * Eingeklappt und ohne Signalfarbe (Daniel, 07.10.2026: der Kasten zog mehr Blick als die Anime) — Anime stehen im Vordergrund.
 */
export function SeitenNeuerungen(): React.JSX.Element | null {
  const { t } = useLang()
  const liste = jungeNeuerungen(todayIso())
  if (!liste.length) return null
  return (
    <details aria-label={t('news.seite')} className="mb-3 text-xs text-ak-leise">
      <summary className="w-fit cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200">
        {t('news.seite')} · {liste.length}
      </summary>
      <ul className="mt-1 space-y-0.5 border-l border-slate-300 pl-3 dark:border-slate-700">
        {liste.map((n) => (
          <li key={n.datum + n.text} className="flex gap-2">
            <span className="shrink-0 tabular-nums">{datumKurz(n.datum)}</span>
            <span className="min-w-0">
              {n.text}
              {n.ziel && (
                <>
                  {' '}
                  <a href={n.ziel} className="whitespace-nowrap underline underline-offset-2">
                    {t('news.seiteAnsehen')}
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
