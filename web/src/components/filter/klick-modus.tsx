import type { Dispatch, SetStateAction } from 'react'
import type { Translate } from '../../lib/i18n.tsx'

/**
 * **Der Klick-Modus klebt oben im scrollenden Fenster** und gilt für alles darunter, auch für die Schnell-Chips.
 * Zeile 52 px, Knöpfe 44 px (Filterfenster-Entwurf). Er muss ein Kind des scrollenden Elements sein, sonst wirkt `sticky` nicht.
 * Aktiv: „Auswählen" grün wie ein gewählter Chip, „Ausschließen" `rose-600` mit Weiß (4,53 : 1; `rose-500` hatte 3,75 : 1).
 */
export function KlickModusLeiste({
  t,
  mode,
  setMode,
}: {
  t: Translate
  mode: 'include' | 'exclude'
  setMode: Dispatch<SetStateAction<'include' | 'exclude'>>
}) {
  return (
    <div role="group" aria-label={t('filter.mode')} className="sticky top-0 z-10 flex items-center gap-2 border-b border-ak-linie bg-ak-flaeche px-3 py-1">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-ak-leise max-[359px]:sr-only">{t('filter.mode')}</span>
      <div className="flex flex-1 overflow-hidden rounded-xl border border-ak-rand md:max-w-sm">
        {(['include', 'exclude'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={[
              'h-11 flex-1 cursor-pointer px-2 text-xs font-bold transition',
              mode !== m ? 'text-ak-leise hover:bg-ak-flaeche-2' : m === 'exclude' ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-emerald-950',
            ].join(' ')}
          >
            {m === 'exclude' ? `⊘ ${t('filter.modeExclude')}` : t('filter.modeInclude')}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Das Suchfeld für **alle** Pillen — ersetzt die einzelnen Suchfelder der Gruppen. Nicht klebend (es kostete dauerhaft 40 px). */
export function FilterSuche({
  t,
  filterQuery,
  setFilterQuery,
}: {
  t: Translate
  filterQuery: string
  setFilterQuery: Dispatch<SetStateAction<string>>
}) {
  return (
    <div className="px-3 py-2.5">
      <input
        type="search"
        value={filterQuery}
        onChange={(e) => setFilterQuery(e.target.value)}
        placeholder={t('filter.sucheAlle')}
        aria-label={t('filter.sucheAlle')}
        className="h-10 w-full min-w-0 rounded-lg md:max-w-sm border border-ak-rand bg-ak-flaeche px-3 text-xs text-ak-text"
      />
    </div>
  )
}
