import { useState } from 'react'
import { googleCalendarUrl, wochenserie } from '@shared/ics.ts'
import { merkbareTermine } from '@shared/logic.ts'
import type { Release } from '@shared/types.ts'
import { useLang, type TranslationKey } from '../../lib/i18n.tsx'
import { kaufTextSchluessel } from './disc-ausgabe.ts'
import type { Format } from './disc-ausgaben.ts'
import { istKommend, kompaktDatum, spaltenVon, type Variante } from './disc-varianten.ts'
import { downloadIcs } from './hilfen.tsx'

/*
  Die Matrix des Disc-Bereichs (Mockup B3): Zeile = Variante, Spalte = Format. Händler und Kalender klappen erst unter der
  angetippten Zeile auf. Schrift: Name 13 px, Edition und Daten 11 px; jede Zeile und jeder Knopf mindestens 44 px hoch.
*/

const SPALTE = '3.4rem'
const KNOPF = 'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-ak-rand px-3 text-t4 font-semibold hover:bg-ak-flaeche-2'
/** Bis hierhin zeigt die Matrix alle Zeilen; darüber sechs und einen Knopf für den Rest. */
const GRENZE = 6

/** Spaltenraster der Matrix: Name nimmt den Rest, je Format eine schmale Spalte. */
const raster = (spalten: Format[]): string => `minmax(0,1fr) repeat(${spalten.length}, ${SPALTE})`

function Datum({ iso, today }: { iso?: string; today: string }) {
  if (!iso) return <span className="text-ak-sehr-leise">–</span>
  const kommend = istKommend(iso, today)
  return <span className={`text-t5 tabular-nums ${kommend ? 'font-bold text-ak-akzent-text' : 'text-ak-leise'}`}>{kompaktDatum(iso)}</span>
}

/** Name in der ersten Spalte: „Box 1“, darunter die Edition leise; Filme tragen ihren Titel als Edition. */
function NameZelle({ v }: { v: Variante }) {
  return (
    <span className="flex min-w-0 flex-col py-1">
      <span className={`text-t4 leading-tight ${v.art === 'gesamt' ? 'font-bold' : 'font-semibold'}`}>{v.name}</span>
      {v.edition && <span className="line-clamp-2 text-t5 leading-tight text-ak-leise">{v.edition}</span>}
    </span>
  )
}

/** Kalendereintrag über die ganze Zeilenbreite; erst ein Tipp öffnet die zwei Wege (Google, Datei). Nur, wo noch etwas aussteht. */
function KalenderKnopf({ release, today }: { release?: Release; today: string }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  const termine = release ? merkbareTermine(release, today) : []
  if (!release || !termine.length) return null
  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={KNOPF} aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        {t('disc.kalender')}
      </button>
      {offen && (
        <div className="grid grid-cols-2 gap-1">
          <a href={googleCalendarUrl(termine[0], {}, wochenserie(termine))} target="_blank" rel="noreferrer noopener" className={KNOPF}>
            {t('disc.google')}
          </a>
          <button type="button" className={KNOPF} onClick={() => downloadIcs(termine, release.slug)}>
            {t('disc.datei')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Die Beschriftung steht wie bisher in der Pille: „Bei Amazon“ (EAN-Suche), „Bei Amazon suchen“ (Namenssuche), sonst „Kaufen bei …“. */
function HaendlerKnopf({ name, url }: { name: string; url: string }) {
  const { t } = useLang()
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className={KNOPF}>
      {t(kaufTextSchluessel(url), { shop: name })} <span aria-hidden="true">↗</span>
    </a>
  )
}

/** Erst nach der Wahl einer Variante: die Händler, dann der Kalendereintrag — beides als Knopf über die Zeilenbreite. */
function HaendlerBlock({ v, today }: { v: Variante; today: string }) {
  const { t } = useLang()
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-ak-flaeche-2 p-2" data-disc-haendler>
      {v.haendler.map((h) => (
        <HaendlerKnopf key={h.url} {...h} />
      ))}
      <KalenderKnopf release={v.release} today={today} />
      {v.quelle && (
        <a href={v.quelle} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center justify-center text-t5 text-ak-leise underline">
          {t('disc.quelle')}
        </a>
      )}
    </div>
  )
}

/** Kopf der Matrix: leere Namensspalte, dann „Blu-ray“, „DVD“, „4K“. */
function MatrixKopf({ spalten }: { spalten: Format[] }) {
  const { t } = useLang()
  return (
    <div className="grid gap-x-1 pb-0.5 text-t5 font-bold uppercase tracking-[.04em] text-ak-leise" style={{ gridTemplateColumns: raster(spalten) }} aria-hidden="true">
      <span />
      {spalten.map((f) => (
        <span key={f} className="text-center">
          {t(`disc.format.${f}` as TranslationKey)}
        </span>
      ))}
    </div>
  )
}

interface ZeileProps {
  v: Variante
  spalten: Format[]
  aktiv: boolean
  onKlick: () => void
  today: string
}

function MatrixZeile({ v, spalten, aktiv, onKlick, today }: ZeileProps) {
  return (
    <li className={`border-l-2 border-t border-t-ak-linie ${aktiv ? 'border-l-ak-akzent bg-ak-flaeche-2/60' : 'border-l-transparent'}`}>
      <button type="button" aria-expanded={aktiv} onClick={onKlick} className="grid min-h-11 w-full items-center gap-x-1 rounded-md px-1 text-left hover:bg-ak-flaeche-2" style={{ gridTemplateColumns: raster(spalten) }}>
        <NameZelle v={v} />
        {spalten.map((f) => (
          <span key={f} className="text-center">
            {v.formate.includes(f) ? <Datum iso={v.datumJe[f]} today={today} /> : <span className="text-ak-sehr-leise">–</span>}
          </span>
        ))}
      </button>
      {aktiv && (
        <div className="px-1 pb-2">
          <HaendlerBlock v={v} today={today} />
        </div>
      )}
    </li>
  )
}

export interface MatrixProps {
  liste: Variante[]
  wahl: string | null
  onWahl: (schluessel: string | null) => void
  today: string
}

/** Die Matrix: eine Zeile je Variante, Spalten die Formate; lange Listen zeigen sechs Zeilen, ein Knopf holt den Rest. */
export function Matrix({ liste, wahl, onWahl, today }: MatrixProps) {
  const { t } = useLang()
  const [alle, setAlle] = useState(false)
  const spalten = spaltenVon(liste)
  const sichtbar = alle || liste.length <= GRENZE + 2 ? liste : liste.slice(0, GRENZE)
  return (
    <div className="flex flex-col">
      <MatrixKopf spalten={spalten} />
      <ul>
        {sichtbar.map((v) => (
          <MatrixZeile key={v.schluessel} v={v} spalten={spalten} aktiv={wahl === v.schluessel} onKlick={() => onWahl(wahl === v.schluessel ? null : v.schluessel)} today={today} />
        ))}
      </ul>
      {sichtbar.length < liste.length && (
        <button type="button" onClick={() => setAlle(true)} className="inline-flex min-h-11 items-center gap-1 self-start rounded-full px-3 text-t4 font-semibold text-ak-akzent-text hover:bg-ak-flaeche-2">
          {t('disc.alleZeigen', { n: liste.length })} <span aria-hidden="true">▾</span>
        </button>
      )}
    </div>
  )
}
