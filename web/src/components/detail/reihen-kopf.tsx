import type { ReactNode } from 'react'
import type { Translate } from '../../lib/i18n.tsx'

/** Schalter „N ohne Synchro" — kurz, damit die Kopfzeile einzeilig bleibt; der volle Satz steht im Tooltip. */
export function OhneSynchroSchalter({ t, zahl, ohneOffen, onChange }: { t: Translate; zahl: number; ohneOffen: boolean; onChange: () => void }) {
  return (
    <label className="ml-auto inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-t4 text-slate-600 dark:text-slate-300"
    >
      <input type="checkbox" className="sr-only" checked={ohneOffen} onChange={onChange} />
      <span
        aria-hidden="true"
        className={['relative h-3.5 w-6 rounded-full transition', ohneOffen ? 'bg-sky-500' : 'bg-slate-300 dark:bg-white/20'].join(' ')}
      >
        <span
          className={['absolute top-0.5 size-2.5 rounded-full bg-white shadow transition-all', ohneOffen ? 'left-3' : 'left-0.5'].join(' ')}
        />
      </span>
      {t('detail.reiheOhneSchalterKurz', { n: zahl })}
    </label>
  )
}

/**
 * Kopf der Reihenliste (klebt oben im Scrollbereich): Suche mit Schalter, darunter die Reiter.
 * Feste Höhe (4,5 rem), damit Liste und Kopf nicht springen, wenn Reiter oder Schalter wechseln.
 */
export function ReihenKopf({ t, suche, onSuche, schalter, reiterZeile, reiter, aktiv, onReiter }: {
  t: Translate
  suche: string
  onSuche: (text: string) => void
  schalter: ReactNode
  reiterZeile: boolean
  reiter: { titel: string; anzahl: number }[] | null
  aktiv: string | undefined
  onReiter: (titel: string) => void
}) {
  return (
    <div className="sticky -top-2 z-10 -mx-2 -mt-2 mb-1 flex flex-col gap-1.5 bg-white/95 px-2 pb-1.5 pt-2 backdrop-blur dark:bg-slate-900/95">
      <div className="flex h-11 items-center gap-2">
        <input
          type="search"
          value={suche}
          onChange={(e) => onSuche(e.target.value)}
          placeholder={t('detail.reiheSuche')}
          aria-label={t('detail.reiheSuche')}
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent px-3 text-t3 outline-none focus:border-sky-400 dark:border-white/10"
        />
        {schalter}
      </div>
      {reiterZeile && (
        <div className="flex h-11 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
          {reiter && (
            <div role="tablist" className="flex gap-1">
              {reiter.map((g) => (
                <button
                  key={g.titel}
                  type="button"
                  role="tab"
                  aria-selected={g.titel === aktiv}
                  onClick={() => onReiter(g.titel)}
                  className={[
                    'min-h-11 cursor-pointer rounded-full px-3 text-t4 transition',
                    g.titel === aktiv
                      ? 'bg-sky-500/20 font-semibold text-sky-700 dark:text-sky-200'
                      : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-white/10',
                  ].join(' ')}
                >
                  {g.titel} <span className="tabular-nums">{g.anzahl}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
