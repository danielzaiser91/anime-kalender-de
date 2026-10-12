import type { Translate } from '../../lib/i18n.tsx'
import { type Synopsis } from '../../lib/data.ts'

/** Lizenztexte, die eine Seite zum Nachlesen haben; unbekannte stehen ohne Link. */
const LIZENZ_SEITEN: Record<string, string> = { 'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/deed.de' }

const linkKlasse = 'underline decoration-slate-400/50 underline-offset-2 hover:text-ak-akzent-text'

/** Quellenzeile eines eigenen Textes: alle Quellen, die Lizenz des Textes — Wikipedia verlangt beides (CC BY-SA). */
export function EigeneQuellenZeile({ eigen, t }: { eigen: NonNullable<Synopsis['eigen']>; t: Translate }) {
  const lizenzSeite = LIZENZ_SEITEN[eigen.lizenz]
  return (
    <span className="text-right text-[11px] text-slate-400">
      {t('detail.plotEigen')}{' '}
      {eigen.quellen.map((q, i) => (
        <span key={q.url}>
          {i > 0 && ' · '}
          <a href={q.url} target="_blank" rel="noopener noreferrer" className={linkKlasse}>
            {q.name} ↗
          </a>
        </span>
      ))}
      {' · '}
      {lizenzSeite ? (
        <a href={lizenzSeite} target="_blank" rel="noopener noreferrer" className={linkKlasse}>
          {eigen.lizenz} ↗
        </a>
      ) : (
        eigen.lizenz
      )}
    </span>
  )
}

/** Hinweis über dem Text, wenn er nur die Reihe beschreibt — sonst läse man ihn als Handlung dieser Staffel. */
export function ReiheHinweis({ t }: { t: Translate }) {
  return <p className="mb-1 text-[11px] text-amber-600 dark:text-amber-400/90">{t('detail.plotReihe')}</p>
}
