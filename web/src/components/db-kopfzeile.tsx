import type { Title } from '@shared/types.ts'
import { useLang, type Translate } from '../lib/i18n.tsx'
import { Toggle } from './ui.tsx'
import { DeFlaggeZeichen } from './de-flagge.tsx'

/**
 * **Die zwei Schalter über der Datenbank in einer Zeile** (Daniel, 04.10.2026): Sie sitzen an einer festen Stelle und
 * rutschen nicht mehr, wenn die Zählung darunter länger oder kürzer wird. „Anime ohne deutsche Synchro" holt einen ganz
 * anderen Bestand dazu und leuchtet deshalb, sobald er an ist.
 */
export function DbSchalter({ ohneSynchro, onOhneSynchroChange, laedt, grouped, onGroupedChange }: {
  ohneSynchro: boolean
  onOhneSynchroChange: (next: boolean) => void
  laedt: boolean
  grouped: boolean
  onGroupedChange: (next: boolean) => void
}) {
  const { t } = useLang()
  /* `relative`: das `sr-only`-Input des Schalters ist absolut positioniert und ragte sonst aus der rollbaren Reihe
     bis zur Seitenkante — das Handy legte den Viewport 594 statt 390 px breit an (gemessen, 08.10.2026). */
  const pille = 'relative inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 whitespace-nowrap transition'
  const ruhig = 'border-slate-300 dark:border-white/15'
  return (
    /* Auf dem Handy eine rollbare Reihe (drei Zeilen Schalter über dem Raster waren zu viel), ab `sm` umbrechend. */
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      <span className={`${pille} ${ohneSynchro ? 'border-amber-400/60 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10' : `${ruhig} border-dashed`}`}>
        <Toggle checked={ohneSynchro} onChange={onOhneSynchroChange} label={t('db.withoutDub')} hint={t('db.withoutDubHint')} />
      </span>
      <span className={`${pille} ${ruhig}`}>
        <Toggle checked={grouped} onChange={onGroupedChange} label={t('db.groupSeasons')} hint={t('db.groupSeasonsHint')} />
      </span>
      {laedt && <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t('db.withoutDubLoading')}</span>}
    </div>
  )
}


/** Kacheln, in denen mindestens ein Glied belegte deutsche Synchro hat — dieselbe Regel, nach der die Kachel ihr Band „keine deutsche Synchro" zeigt. */
export function zaehleMitSynchro(liste: { members: Title[] }[]): number {
  let n = 0
  for (const k of liste) if (k.members.some((m) => !m.ohneSynchro)) n++
  return n
}

/** „2.300 Ergebnisse für „wolf"". Mit Suchbegriff nennt die Zeile ihn, sonst liest sich die Null wie ein leerer Bestand. */
export function ergebnisText(anzahl: number, suche: string, t: Translate): string {
  const kopf = t(anzahl === 1 ? 'db.ergebnis1' : 'db.ergebnisse', { count: anzahl.toLocaleString('de-DE') })
  return suche.trim() ? `${kopf} ${t('db.ergebnisFuer', { suche: suche.trim() })}` : kopf
}

/**
 * Die Trefferzeile: Ergebnisse (Kacheln) und, nur wenn sie abweicht, wie viele davon deutsche Synchro haben.
 * Desktop eine Zeile, am Handy (`zweizeilig`) zwei neben dem Filter-Knopf.
 */
export function DbKopfzeile({ ergebnisse, mitSynchro, suche, zweizeilig }: { ergebnisse: number; mitSynchro: number; suche: string; zweizeilig?: boolean }) {
  const { t } = useLang()
  const zusatz = ergebnisse > 0 && mitSynchro !== ergebnisse
  return (
    <span className={zweizeilig ? 'flex min-w-0 flex-col leading-[1.1]' : 'flex flex-wrap items-center gap-x-2'}>
      <span className={zweizeilig ? 'truncate text-xs font-semibold text-ak-text' : 'font-semibold text-slate-800 dark:text-slate-100'}>{ergebnisText(ergebnisse, suche, t)}</span>
      {zusatz && (
        <span className={zweizeilig ? 'inline-flex items-center gap-1 text-[11px] text-ak-leise' : 'inline-flex items-center gap-1'}>
          {!zweizeilig && '·'} {t('db.mitSynchro', { count: mitSynchro.toLocaleString('de-DE') })} <DeFlaggeZeichen />
        </span>
      )}
    </span>
  )
}
