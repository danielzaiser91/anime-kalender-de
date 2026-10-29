import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { Tooltip } from '../ui.tsx'
import { useLang, type Translate } from '../../lib/i18n.tsx'

/*
  Fläche mit 1-px-Ring und 3-px-Markenstreifen links; die Markenfarbe steht nur im Zeichen und im Streifen (`--marke`),
  die Schrift in der Textfarbe (Daniel, 19.09.2026: „rot auf rot ist nicht so gut"; 12.10.2026: wieder Pillen statt Zeilen).
*/
const PILLE_MARKE =
  'bg-ak-pille text-ak-text shadow-[inset_0_0_0_1px_rgba(15,23,42,.12),inset_3px_0_0_var(--marke)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.08),inset_3px_0_0_var(--marke)]'
const PILLE_OHNE_MARKE = 'bg-ak-pille text-ak-text shadow-[inset_0_0_0_1px_rgba(15,23,42,.12)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]'

/**
 * **Ein Anbieter, eine Pille** (Daniel, 12.10.2026, Panel V2 nachgeschärft): Zeichen in Markenfarbe, Name, darunter Folgen und
 * nächster Termin; der Sprachzustand sitzt als Blase oben rechts (`status`). Der Kalenderknopf (`aktion`) steht neben der Pille.
 * Mindesthöhe 52 px (Tippziel).
 */
export function Pille({ name, farbe, url, unten, titel, icon, durchgestrichen, status, aktion }: {
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
    <a
      href={url || undefined}
      target="_blank"
      rel="noreferrer noopener"
      style={farbe ? ({ '--marke': farbe } as CSSProperties) : undefined}
      className={`relative inline-flex min-h-[52px] min-w-0 max-w-full items-center gap-2.5 rounded-xl py-1.5 pl-3.5 pr-4 transition hover:bg-ak-pille-hover ${farbe ? PILLE_MARKE : PILLE_OHNE_MARKE}`}
    >
      {icon && (
        <span className="flex shrink-0 items-center" style={farbe ? { color: farbe } : undefined}>
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className={`text-t3 font-semibold ${durchgestrichen ? 'line-through' : ''}`}>{name}</span>
        {unten && <span className="text-t4 text-ak-leise">{unten}</span>}
      </span>
      {status}
    </a>
  )
  return (
    <div className={`flex max-w-full items-center gap-1 ${durchgestrichen ? 'opacity-70' : ''}`}>
      {titel ? (
        <Tooltip text={titel} seite="oben" className="min-w-0 max-w-full">
          {haupt}
        </Tooltip>
      ) : (
        haupt
      )}
      {aktion}
    </div>
  )
}

/** Sprachzustand eines Wegs: Beleg am Weg, JustWatch-Ton an genau dieser Seite (`jwDeutsch`, sieht aus wie belegt, Herkunft im Hover), Hinweis laut JustWatch, nur Untertitel (die Quelle nennt nur den Originalton) oder offen. */
export type DubStatusArt = 'belegt' | 'jwDeutsch' | 'justwatch' | 'schwester' | 'annahme' | 'anbieter' | 'omu' | 'offen'

/** `stand` steht nur, wo die Angabe von JustWatch stammt (Datum des Abrufs). */
export function statusArt(dub: boolean | undefined, stand?: string): DubStatusArt {
  if (dub) return 'belegt'
  return stand ? 'justwatch' : 'offen'
}

/* Kontrast (14.10.2026, dunkel / hell): belegt 10,0 / 5,5 und offen 6,2 / 5,6 aus `tools/design-kontrast.mjs`; Weiß auf #475569 7,6 und auf #1d4ed8 6,7 von Hand gerechnet. */
const FREMDANGABE = 'bg-[#475569] text-white'
const STATUS_KLASSE: Record<DubStatusArt, string> = {
  belegt: 'bg-ak-gut text-ak-auf-gut',
  jwDeutsch: 'bg-ak-gut text-ak-auf-gut',
  justwatch: FREMDANGABE,
  schwester: FREMDANGABE,
  annahme: FREMDANGABE,
  anbieter: FREMDANGABE,
  omu: 'bg-[#1d4ed8] text-white',
  offen: 'bg-ak-flaeche-2 text-ak-leise',
}
const STATUS_TEXT = { belegt: 'detail.statusDeutsch', jwDeutsch: 'detail.statusDeutsch', justwatch: 'detail.statusJustwatch', schwester: 'detail.statusSchwester', annahme: 'detail.statusAnnahme', anbieter: 'detail.statusAnbieter',omu: 'detail.statusOmu', offen: 'detail.statusOffen' } as const

/** Wahr, wenn der Kopf des Kastens „Sprache offen“ schon sagt (`kasten-marke.tsx`). */
export const KopfSagtOffen = createContext(false)

/** Die Blase an der Pille; ihr Ring hat die Farbe des Kastens (`--kasten`), damit sie wie ausgeschnitten wirkt. */
export function DubStatus({ art }: { art: DubStatusArt }) {
  const { t } = useLang()
  const kopfOffen = useContext(KopfSagtOffen)
  if (art === 'offen' && kopfOffen) return null
  return (
    <span
      className={`absolute -right-0.5 -top-3.5 inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-t5 font-bold ring-2 ring-[color:var(--kasten,transparent)] ${STATUS_KLASSE[art]}`}
    >
      {t(STATUS_TEXT[art])}
    </span>
  )
}

/** Die Legende unter den Pillen: nur, was dort wirklich vorkommt — ein belegtes „✓ Deutsch“ braucht keine. */
export function legendeFuer(arten: Iterable<DubStatusArt>, geschaetzt: boolean, t: Translate): string | undefined {
  const da = new Set(arten)
  const saetze = [
    da.has('justwatch') ? t('detail.legendeJustwatch') : '',
    da.has('schwester') ? t('detail.legendeSchwester') : '',
    da.has('annahme') ? t('detail.legendeAnnahme') : '',
    da.has('anbieter') ? t('detail.legendeAnbieter') : '',
    geschaetzt ? t('detail.legendeGeschaetzt') : '',
  ].filter(Boolean)
  return saetze.length ? saetze.join(' ') : undefined
}
