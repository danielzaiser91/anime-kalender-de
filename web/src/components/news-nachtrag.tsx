import { useState } from 'react'
import { useLang } from '../lib/i18n.tsx'

/**
 * **Der Nachtrag einer rückwirkenden Meldung: eine Zeile, dahinter beschriftete Abschnitte** (Daniel, 04.10.2026:
 * „nach klick auf mehr formatiert, mit überschriften, sections, color … statt langer fließtext").
 *
 * Jede Art hat eine Farbe und eine feste Überschrift; welche Abschnitte da sind, bestimmt der Eintrag am Release.
 */
const STIL: Record<string, string> = {
  quelle: 'border-sky-500/50 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  grund: 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  abhilfe: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  zusage: 'border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200',
}

export function NachtragText({ kurz, abschnitte }: { kurz?: string; abschnitte: { art: string; text: string }[] }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  return (
    <div>
      {kurz && <span>{kurz} </span>}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="cursor-pointer font-semibold underline decoration-dotted underline-offset-2"
      >
        {offen ? t('filter.showLess') : t('klapptext.mehr')}
      </button>
      {offen && (
        <div className="mt-1.5 grid gap-1.5">
          {abschnitte.map((a) => (
            <section key={a.art + a.text.slice(0, 12)} className={`rounded border-l-2 px-2 py-1 ${STIL[a.art] ?? STIL.quelle}`}>
              <h4 className="text-[10px] font-bold uppercase tracking-wide">{t(`news.nachtrag.${a.art}` as never)}</h4>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-700 dark:text-slate-200">{a.text}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
