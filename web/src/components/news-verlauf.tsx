import type { Stand } from '../lib/news-verlauf.ts'
import { useLang } from '../lib/i18n.tsx'
import { datumKurz, newsSatz } from '../lib/news-text.ts'
import { quellenLabel } from './news-belege.tsx'
import { hostVon, istLink } from '@shared/quelle.ts'

/**
 * **Der Verlauf unter der geltenden Meldung** (Entwurf B): kleine Zeitleiste, die überholten Stände
 * gedämpft und durchgestrichen, jeder mit „überholt am …" und seinem eigenen Beleg. Der Beleg des
 * Alten bleibt — er belegt, was damals galt.
 */
export function VerlaufZeilen({ staende }: { staende: Stand[] }) {
  const { t } = useLang()
  if (!staende.length) return null
  return (
    <ul className="ml-3 mt-0.5 space-y-1 border-l-2 border-slate-200 pb-1 pl-3 dark:border-slate-700" aria-label={t('news.verlauf')}>
      {staende.map((s, i) => {
        const belege = s.m.belege?.length ? s.m.belege : istLink(s.m.quelle) ? [{ url: s.m.quelle!, name: hostVon(s.m.quelle!) }] : []
        return (
          <li key={`${s.am}-${i}`} className="text-[11px] leading-4 text-slate-400 dark:text-slate-500">
            <span className="tabular-nums">{datumKurz(s.am)}</span>
            {s.ueberholtAm && <span> · {t('news.ueberholtAm', { datum: datumKurz(s.ueberholtAm) })}</span>}
            <span className="block line-through">{newsSatz(s.m)}</span>
            {belege.map((b) => (
              <a key={b.url} href={b.url} target="_blank" rel="noopener noreferrer" className="mr-2 underline decoration-dotted underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300">
                {quellenLabel(b as never)} ↗
              </a>
            ))}
          </li>
        )
      })}
    </ul>
  )
}
