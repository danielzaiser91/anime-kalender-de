import { useState, type ReactNode } from 'react'
import { googleCalendarUrl, wochenserie } from '@shared/ics.ts'
import { merkbareTermine } from '@shared/logic.ts'
import type { Release } from '@shared/types.ts'
import { downloadIcs } from '../../src/components/detail/hilfen.tsx'
import { FORMAT_NAME, type Format } from './disc-bereich-daten.ts'
import { istKommend, kompaktDatum, type Haendler, type Variante } from './disc-bereich-2-daten.ts'

/*
  Bausteine der Matrix, die B1, B2 und B3 teilen (Runde 2). Texte stehen wörtlich (Mockup); beim Umbau bekommen sie Schlüssel in `i18n.tsx`.
  Schrift: Name 13 px, Edition und Daten 11 px (Runde 1: 15/13 px). Tippziele: jede Zeile und jeder Knopf mindestens 44 px.
*/

const SPALTE = '3.4rem'
const KNOPF = 'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-ak-rand px-3 text-t4 font-semibold hover:bg-ak-flaeche-2'

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
export function KalenderKnopf({ release, today }: { release?: Release; today: string }) {
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
        Kalendereintrag
      </button>
      {offen && (
        <div className="grid grid-cols-2 gap-1">
          <a href={googleCalendarUrl(termine[0], {}, wochenserie(termine))} target="_blank" rel="noreferrer noopener" className={KNOPF}>
            Google
          </a>
          <button type="button" className={KNOPF} onClick={() => downloadIcs(termine, release.slug)}>
            Datei (.ics)
          </button>
        </div>
      )}
    </div>
  )
}

function HaendlerKnopf({ h }: { h: Haendler }) {
  return (
    <a href={h.url} target="_blank" rel="noreferrer noopener" className={KNOPF}>
      {h.name} <span aria-hidden="true">↗</span>
    </a>
  )
}

/** Erst nach der Wahl einer Variante: die Händler, dann der Kalendereintrag — beides als Knopf über die Zeilenbreite. */
export function HaendlerBlock({ v, today, kopf }: { v: Variante; today: string; kopf?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-ak-flaeche-2 p-2" data-disc-haendler>
      {kopf && (
        <span className="text-t4 font-semibold">
          {v.name}
          {v.edition && <span className="font-normal text-ak-leise"> · {v.edition}</span>}
        </span>
      )}
      {v.haendler.map((h) => (
        <HaendlerKnopf key={h.name} h={h} />
      ))}
      <KalenderKnopf release={v.release} today={today} />
    </div>
  )
}

/** Kopf der Matrix: leere Namensspalte, dann „Blu-ray“, „DVD“ …; die Namen stehen kurz, damit 3,4 rem reichen. */
function MatrixKopf({ spalten }: { spalten: Format[] }) {
  const kurz: Record<Format, string> = { b: 'Blu-ray', d: FORMAT_NAME.d, u: '4K' }
  return (
    <div className="grid gap-x-1 pb-0.5 text-t5 font-bold uppercase tracking-[.04em] text-ak-leise" style={{ gridTemplateColumns: raster(spalten) }} aria-hidden="true">
      <span />
      {spalten.map((f) => (
        <span key={f} className="text-center">
          {kurz[f]}
        </span>
      ))}
    </div>
  )
}

interface MatrixProps {
  liste: Variante[]
  spalten: Format[]
  wahl: string | null
  onWahl: (schluessel: string | null) => void
  today: string
  /** Wahr: der Händlerblock klappt unter der gewählten Zeile auf; falsch: der Aufrufer zeigt ihn anderswo. */
  inline: boolean
}

function MatrixZeile({ v, spalten, aktiv, onKlick, today, inline }: { v: Variante; spalten: Format[]; aktiv: boolean; onKlick: () => void; today: string; inline: boolean }) {
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
      {aktiv && inline && (
        <div className="px-1 pb-2">
          <HaendlerBlock v={v} today={today} />
        </div>
      )}
    </li>
  )
}

const GRENZE = 6

/** Die Matrix: eine Zeile je Variante, Spalten die Formate; lange Listen zeigen sechs Zeilen, ein Knopf holt den Rest. */
export function Matrix({ liste, spalten, wahl, onWahl, today, inline }: MatrixProps) {
  const [alle, setAlle] = useState(false)
  const sichtbar = alle || liste.length <= GRENZE + 2 ? liste : liste.slice(0, GRENZE)
  return (
    <div className="flex flex-col">
      <MatrixKopf spalten={spalten} />
      <ul>
        {sichtbar.map((v) => (
          <MatrixZeile key={v.schluessel} v={v} spalten={spalten} aktiv={wahl === v.schluessel} onKlick={() => onWahl(wahl === v.schluessel ? null : v.schluessel)} today={today} inline={inline} />
        ))}
      </ul>
      {sichtbar.length < liste.length && (
        <button type="button" onClick={() => setAlle(true)} className="inline-flex min-h-11 items-center gap-1 self-start rounded-full px-3 text-t4 font-semibold text-ak-akzent-text hover:bg-ak-flaeche-2">
          Alle {liste.length} anzeigen <span aria-hidden="true">▾</span>
        </button>
      )}
    </div>
  )
}

/** Einzelne Volumes, Filme, Sonstiges: hinter einem Knopf, solange es Gesamtausgaben oder Boxen gibt. */
export function Ausklapper({ titel, anzahl, children }: { titel: string; anzahl: number; children: ReactNode }) {
  const [offen, setOffen] = useState(false)
  return (
    <div className="flex flex-col border-t border-ak-linie pt-1">
      <button type="button" aria-expanded={offen} onClick={() => setOffen((o) => !o)} className="inline-flex min-h-11 items-center justify-between gap-2 px-1 text-t4 font-semibold text-ak-akzent-text">
        <span>
          {titel} ({anzahl})
        </span>
        <span aria-hidden="true">{offen ? '▴' : '▾'}</span>
      </button>
      {offen && children}
    </div>
  )
}

/** Kopfzeile: Zahl der Varianten, Verlag leise. */
export function Zaehler({ anzahl, verlag }: { anzahl: number; verlag?: string }) {
  return (
    <div className="flex items-baseline gap-2 text-t5 text-ak-leise">
      <span className="font-bold uppercase tracking-[.08em]">{anzahl === 1 ? '1 Variante' : `${anzahl} Varianten`}</span>
      {verlag && <span className="truncate">· {verlag}</span>}
    </div>
  )
}
