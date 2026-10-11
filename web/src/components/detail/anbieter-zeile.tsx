import type { ReactNode } from 'react'
import { Tooltip } from '../ui.tsx'
import { useLang, type Translate } from '../../lib/i18n.tsx'

/**
 * **Ein Anbieter, eine Zeile** (Daniel, 11.10.2026, Variante V2 der Panel-Gestaltung): links Zeichen, Name und
 * darunter Folgen und nächster Termin, rechts der Sprachzustand mit Wort; der ganze Block führt zum Anbieter.
 * Mindesthöhe 48 px (Tippziel); der Kalenderknopf (`aktion`) steht neben dem Link, nicht darin.
 */
export function AnbieterZeile({ name, farbe, url, unten, titel, icon, durchgestrichen, status, aktion }: {
  name: ReactNode
  farbe?: string
  url?: string
  unten?: ReactNode
  titel?: string
  icon?: ReactNode
  /** Eine Ausgabe ohne deutschen Ton — sichtbar und anklickbar, aber durchgestrichen. */
  durchgestrichen?: boolean
  status?: ReactNode
  aktion?: ReactNode
}) {
  const haupt = (
    <a href={url || undefined} target="_blank" rel="noreferrer noopener" className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 py-1.5">
      {icon && (
        <span className="flex min-w-9 shrink-0 justify-center" style={farbe ? { color: farbe } : undefined}>
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className={`text-[15px] font-medium ${durchgestrichen ? 'line-through' : ''}`}>{name}</span>
        {unten && <span className="text-xs text-slate-600 dark:text-slate-400">{unten}</span>}
      </span>
      {status}
    </a>
  )
  return (
    <div className={`flex items-center gap-1 border-t border-slate-200/70 first:border-t-0 dark:border-white/10 ${durchgestrichen ? 'opacity-70' : ''}`}>
      {titel ? (
        <Tooltip text={titel} seite="oben" className="flex min-w-0 flex-1 [&>span]:min-w-0 [&>span]:flex-1">
          {haupt}
        </Tooltip>
      ) : (
        haupt
      )}
      {aktion}
    </div>
  )
}

/** Sprachzustand eines Wegs: Beleg am Weg, Fremdangabe (JustWatch) oder offen. */
export type DubStatusArt = 'belegt' | 'justwatch' | 'offen'

/** `stand` steht nur, wo die Angabe von JustWatch stammt (Datum des Abrufs). */
export function statusArt(dub: boolean | undefined, stand?: string): DubStatusArt {
  if (dub) return 'belegt'
  return stand ? 'justwatch' : 'offen'
}

const STATUS_KLASSE: Record<DubStatusArt, string> = {
  belegt: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  justwatch: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
  offen: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300',
}
const STATUS_TEXT = { belegt: 'detail.statusDeutsch', justwatch: 'detail.statusJustwatch', offen: 'detail.statusOffen' } as const

export function DubStatus({ art }: { art: DubStatusArt }) {
  const { t } = useLang()
  return <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_KLASSE[art]}`}>{t(STATUS_TEXT[art])}</span>
}

/** Die Legende unter den Zeilen: nur, was dort wirklich vorkommt — ein belegtes „✓ Deutsch“ braucht keine. */
export function legendeFuer(arten: Iterable<DubStatusArt>, geschaetzt: boolean, t: Translate): string | undefined {
  const da = new Set(arten)
  const saetze = [
    da.has('justwatch') ? t('detail.legendeJustwatch') : '',
    da.has('offen') ? t('detail.legendeOffen') : '',
    geschaetzt ? t('detail.legendeGeschaetzt') : '',
  ].filter(Boolean)
  return saetze.length ? saetze.join(' ') : undefined
}
