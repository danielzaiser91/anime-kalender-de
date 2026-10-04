import type { Title } from '@shared/types.ts'
import { useLang, type Translate } from '../lib/i18n.tsx'
import { Toggle } from './ui.tsx'
import { DeFlaggeZeichen } from './de-flagge.tsx'

/**
 * **Die drei Schalter über der Datenbank in einer Zeile** (Daniel, 04.10.2026): Sie sitzen an einer festen Stelle und
 * rutschen nicht mehr, wenn die Zählung darunter länger oder kürzer wird. „Anime ohne deutsche Synchro" holt einen ganz
 * anderen Bestand dazu und leuchtet deshalb, sobald er an ist.
 */
export function DbSchalter({ ohneSynchro, onOhneSynchroChange, laedt, grouped, onGroupedChange, cartoonsAus, onCartoonsAusChange }: {
  ohneSynchro: boolean
  onOhneSynchroChange: (next: boolean) => void
  laedt: boolean
  grouped: boolean
  onGroupedChange: (next: boolean) => void
  cartoonsAus: boolean
  onCartoonsAusChange: (next: boolean) => void
}) {
  const { t } = useLang()
  const pille = 'inline-flex items-center rounded-full border px-3 py-1.5 transition'
  const ruhig = 'border-slate-300 dark:border-white/15'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`${pille} ${ohneSynchro ? 'border-amber-400/60 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10' : `${ruhig} border-dashed`}`}>
        <Toggle checked={ohneSynchro} onChange={onOhneSynchroChange} label={t('db.withoutDub')} hint={t('db.withoutDubHint')} />
      </span>
      <span className={`${pille} ${ruhig}`}>
        <Toggle checked={grouped} onChange={onGroupedChange} label={t('db.groupSeasons')} hint={t('db.groupSeasonsHint')} />
      </span>
      <span className={`${pille} ${ruhig}`}>
        <Toggle checked={cartoonsAus} onChange={onCartoonsAusChange} label={t('db.cartoonsAus')} hint={t('db.cartoonsAusHinweis')} />
      </span>
      {laedt && <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t('db.withoutDubLoading')}</span>}
    </div>
  )
}

/** Anime und Cartoons, mit und ohne belegte deutsche Synchro — gezählt am Merker `ohneSynchro`, nicht an einer zweiten Regel. */
export function zaehlTeile(titles: Title[]): { anime: number; cartoons: number; ohneAnime: number; ohneCartoons: number } {
  const z = { anime: 0, cartoons: 0, ohneAnime: 0, ohneCartoons: 0 }
  for (const t of titles) {
    if (t.ohneSynchro) t.westlich ? z.ohneCartoons++ : z.ohneAnime++
    else t.westlich ? z.cartoons++ : z.anime++
  }
  return z
}

/**
 * „2.300 Ergebnisse (gebündelt) für „wolf"". Mit Suchbegriff nennt die Zeile ihn, sonst liest sich die Null wie ein
 * leerer Bestand statt wie ein Ergebnis.
 */
export function ergebnisText(anzahl: number, gebuendelt: boolean, suche: string, t: Translate): string {
  const kopf = t(anzahl === 1 ? 'db.ergebnis1' : 'db.ergebnisse', { count: anzahl.toLocaleString('de-DE') })
  return [kopf, gebuendelt ? t('db.gebuendelt') : '', suche.trim() ? t('db.ergebnisFuer', { suche: suche.trim() }) : ''].filter(Boolean).join(' ')
}

/**
 * Die Zählzeile: Ergebnisse, davon mit deutscher Flagge, und — wenn der Bestand ohne Synchro dabei ist — wie viele ohne.
 * Fasst die Ansicht Staffeln zusammen, zählt `ergebnisse` die Kacheln, die Teilzahlen weiter Titel (Daniel, 04.10.2026).
 */
export function DbKopfzeile({ titles, ergebnisse, gebuendelt, suche }: { titles: Title[]; ergebnisse: number; gebuendelt: boolean; suche: string }) {
  const { t } = useLang()
  const z = zaehlTeile(titles)
  const zahl = (n: number) => n.toLocaleString('de-DE')
  const paar = (anime: number, cartoons: number) => (
    <>
      <b className="font-semibold text-slate-700 dark:text-slate-200">{zahl(anime)}</b> {t('db.animeUnd')}{' '}
      <b className="font-semibold text-slate-700 dark:text-slate-200">{zahl(cartoons)}</b> {t('db.cartoons')}
    </>
  )
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="font-semibold text-slate-800 dark:text-slate-100">{ergebnisText(ergebnisse, gebuendelt, suche, t)}</span>
      <span className="inline-flex items-center gap-1.5">
        {t('db.davon')} <DeFlaggeZeichen /> {paar(z.anime, z.cartoons)}
      </span>
      {z.ohneAnime + z.ohneCartoons > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-1.5 py-0.5">
          {paar(z.ohneAnime, z.ohneCartoons)} {t('db.ohne')} <DeFlaggeZeichen />
        </span>
      )}
    </span>
  )
}
