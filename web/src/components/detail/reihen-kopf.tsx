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

/** Kopf der Reihenliste bei langen Reihen: Suche mit Schalter, eine feste Zeile von 44 px, damit nichts springt, wenn der Schalter wechselt. */
export function ReihenKopf({ t, suche, onSuche, schalter }: { t: Translate; suche: string; onSuche: (text: string) => void; schalter: ReactNode }) {
  return (
    <div className="mb-1 flex h-11 items-center gap-2">
      <input
        type="search"
        value={suche}
        onChange={(e) => onSuche(e.target.value)}
        placeholder={t('detail.reiheSuche')}
        aria-label={t('detail.reiheSuche')}
        className="h-11 min-w-0 flex-1 rounded-lg border border-ak-rand bg-transparent px-3 text-t3"
      />
      {schalter}
    </div>
  )
}
