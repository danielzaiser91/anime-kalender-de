import type { Translate } from '../../lib/i18n.tsx'
import { type Synopsis } from '../../lib/data.ts'
import { LIZENZ_SEITEN } from '@shared/lizenzen.ts'

const linkKlasse = '-my-3 inline-flex min-h-11 items-center underline decoration-slate-400/50 underline-offset-2 hover:text-ak-text'

/** Quellenzeile eines eigenen Textes: alle Quellen, die Lizenz des Textes — Wikipedia verlangt beides (CC BY-SA). */
export function EigeneQuellenZeile({ eigen, t }: { eigen: NonNullable<Synopsis['eigen']>; t: Translate }) {
  const lizenzSeite = LIZENZ_SEITEN[eigen.lizenz]
  return (
    <span className="flex flex-wrap justify-end gap-x-1 gap-y-3 text-right text-t4 text-slate-600 dark:text-slate-400">
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
  return <p className="mb-1 text-t4 text-ak-warnung-text">{t('detail.plotReihe')}</p>
}
