import { Fragment } from 'react'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import type { RelevanzArt } from '../lib/db-relevanz.ts'
import type { DbSort } from '../lib/router.ts'
import { DbKopfzeile } from './db-kopfzeile.tsx'
import { DbKarte, type DbKarteProps } from './db-karte.tsx'
import type { ListenEintrag } from '../lib/db-liste.ts'

/** Zählzeile links, Sortierung rechts. */
export function DbZaehlzeile({ ergebnisse, mitSynchro, suche, sort, onSortChange }: {
  ergebnisse: number
  mitSynchro: number
  suche: string
  sort: DbSort
  onSortChange: (next: DbSort) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
      <DbKopfzeile ergebnisse={ergebnisse} mitSynchro={mitSynchro} suche={suche} />
      <DbSortWahl sort={sort} onChange={onSortChange} suche={!!suche.trim()} />
    </div>
  )
}

const GRUPPEN_TEXT: Record<RelevanzArt, { schluessel: TranslationKey; farbe: string }> = {
  laeuft: { schluessel: 'db.gruppeLaeuft', farbe: 'text-emerald-700 dark:text-emerald-400' },
  bald: { schluessel: 'db.gruppeBald', farbe: 'text-amber-700 dark:text-amber-400' },
  erschienen: { schluessel: 'db.gruppeErschienen', farbe: 'text-slate-600 dark:text-slate-300' },
  unbekannt: { schluessel: 'db.gruppeUnbekannt', farbe: 'text-slate-500 dark:text-slate-400' },
}

/** Überschrift einer Gruppe in der Relevanz-Ansicht; sie trägt den Status, den die Kachel dann nicht wiederholt. */
export function DbGruppenKopf({ art, zahl }: { art: RelevanzArt; zahl: number }) {
  const { t } = useLang()
  const g = GRUPPEN_TEXT[art]
  return (
    <h2 className={`col-span-full mt-2 border-b border-slate-200 pb-1 text-sm font-semibold first:mt-0 dark:border-white/10 ${g.farbe}`}>
      {t(g.schluessel)} <span className="font-normal text-slate-500 dark:text-slate-400">· {zahl.toLocaleString('de-DE')}</span>
    </h2>
  )
}

/** Die Sortierwahl über dem Raster; „Relevanz" ist die Vorgabe (mit Suche: Treffergüte, sonst Gruppen). */
export function DbSortWahl({ sort, onChange, suche, kompakt }: { sort: DbSort; onChange: (next: DbSort) => void; suche: boolean; kompakt?: boolean }) {
  const { t } = useLang()
  return (
    <label className="ml-auto flex cursor-pointer items-center gap-2">
      <span className="hidden sm:inline">{t('db.sort')}</span>
      <select
        value={sort}
        aria-label={t('db.sort')}
        onChange={(e) => onChange(e.target.value as DbSort)}
        className={['cursor-pointer border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-white/5', kompakt ? 'h-11 w-28 rounded-full' : 'rounded-md'].filter(Boolean).join(' ')}
      >
        <option value="relevanz">{t(suche ? 'db.sortRelevanz' : 'db.sortRelevanzGruppen')}</option>
        <option value="titel">{t('db.sortTitle')}</option>
        <option value="jahr">{t('db.sortYear')}</option>
        <option value="score">{t('db.sortScore')}</option>
      </select>
    </label>
  )
}

/**
 * Kein Treffer: Die Zählzeile sagt schon „0 Ergebnisse für …" — hier steht nur, was jetzt helfen kann. Leise, ohne
 * Signalfarbe; der Schalter für den Bestand ohne Synchro als Knopf, weil er der häufigste Grund für eine leere Liste ist.
 */
export function DbLeer({ ohneSynchro, onOhneSynchro }: { ohneSynchro: boolean; onOhneSynchro: () => void }) {
  const { t } = useLang()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-ak-rand px-6 py-10 text-center">
      <p className="text-sm text-ak-leise">{t('db.leerTipps')}</p>
      {!ohneSynchro && (
        <button
          type="button"
          onClick={onOhneSynchro}
          className="cursor-pointer rounded-full border border-ak-rand px-4 py-2 text-sm font-semibold text-ak-text transition hover:border-ak-leise hover:bg-ak-flaeche-2"
        >
          {t('db.leerOhneSynchro')}
        </button>
      )}
    </div>
  )
}

/** „N weitere anzeigen" unter dem Raster. */
export function MehrKnopf({ schritt, rest, onClick }: { schritt: number; rest: number; onClick: () => void }) {
  const { t } = useLang()
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
    >
      {t('db.more', { count: Math.min(schritt, rest) })}
      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t('db.remaining', { count: rest })}</span>
    </button>
  )
}

/** Das Kachelraster der Datenbank, in der Relevanz-Ansicht mit Gruppenüberschriften. */
export function DbRaster({ liste, zahlen, ...rest }: Omit<DbKarteProps, 'main' | 'members' | 'gruppe' | 'ab'> & { liste: ListenEintrag[]; zahlen: Partial<Record<RelevanzArt, number>> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      {liste.map(({ main, members, art, ab }, i) => (
        <Fragment key={main.id}>
          {art && art !== liste[i - 1]?.art && <DbGruppenKopf art={art} zahl={zahlen[art] ?? 0} />}
          <DbKarte main={main} members={members} gruppe={art} ab={ab} {...rest} />
        </Fragment>
      ))}
    </div>
  )
}
