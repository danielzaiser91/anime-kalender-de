import { useState, type ReactNode } from 'react'
import { formatDate } from '@shared/time.ts'
import { farbeZuAnbieter } from '../../src/components/detail/pillen.tsx'
import { Pille } from '../../src/components/detail/pille.tsx'
import { seitAbText } from '../../src/components/detail/seit-datum.ts'
import { TIPPFLAECHE_HOCH } from '../../src/components/detail/tippziel.ts'
import { AnbieterIcon, anbieterDatei } from '../../src/lib/anbieter-icon.tsx'
import { DiscZeichen } from '../../src/components/ui.tsx'
import type { DiscBereichEigenschaften } from '../ersatz.tsx'
import { FORMAT_KURZ, FORMAT_NAME, type Ausgabe, type Format } from './disc-bereich-daten.ts'

/*
  Bausteine, die alle drei Varianten teilen. Texte stehen hier wörtlich (Mockup); beim Umbau bekommen sie Schlüssel in `i18n.tsx`.
*/

/** Blu-ray trägt die Infofarbe, DVD bleibt neutral, 4K die Favoritenfarbe — drei Formate, drei Töne, keine Signalfarbe. */
const FORMAT_KLASSE: Record<Format, string> = {
  b: 'bg-ak-info-grund text-ak-info-text ring-ak-info/40',
  d: 'bg-ak-flaeche-2 text-ak-text ring-ak-rand',
  u: 'bg-ak-favorit/20 text-ak-favorit-text ring-ak-favorit/40',
}

/** Das Format als kleine Marke: „BD“, „DVD“, „4K“ — ausgeschrieben im Tooltip. */
export function FormatMarke({ format, gross }: { format: Format; gross?: boolean }) {
  return (
    <span
      title={FORMAT_NAME[format]}
      className={`inline-flex shrink-0 items-center rounded font-bold uppercase leading-none ring-1 ring-inset ${FORMAT_KLASSE[format]} ${
        gross ? 'h-6 px-2 text-t4 tracking-[.06em]' : 'h-[18px] px-1.5 text-[10px] tracking-[.08em]'
      }`}
    >
      {gross ? FORMAT_NAME[format] : FORMAT_KURZ[format]}
    </span>
  )
}

export function FormatMarken({ formate, gross }: { formate: Format[]; gross?: boolean }) {
  return (
    <span className="inline-flex shrink-0 flex-wrap items-center gap-1">
      {formate.map((f) => (
        <FormatMarke key={f} format={f} gross={gross} />
      ))}
    </span>
  )
}

/**
 * „ab 30.10.2026“ in Akzentfarbe (kommt noch), „seit 02.10.2026“ leise (gibt es schon); ohne Datum „Datum offen“.
 * `kurz`: „ab 30.10.26“ (Karte); `gestapelt`: „AB“ klein über „30.10.26“ — schmal genug für eine Rasterzelle am Handy.
 */
export function DatumText({ a, today, t, kurz, gestapelt }: { a: Ausgabe; today: string; t: DiscBereichEigenschaften['t']; kurz?: boolean; gestapelt?: boolean }) {
  if (!a.datum) return <span className="text-t4 italic text-ak-leise">Datum offen</span>
  const kommend = a.datum > today
  const farbe = kommend ? 'font-bold text-ak-akzent-text' : 'text-ak-leise'
  if (gestapelt) {
    return (
      <span className={`flex flex-col items-center text-t4 leading-tight tabular-nums ${farbe}`}>
        <span className="text-[10px] uppercase tracking-[.08em]">{kommend ? 'ab' : 'seit'}</span>
        <span>{formatDate(a.datum).replace(/(\d\d)(\d\d)$/, '$2')}</span>
      </span>
    )
  }
  const text = kurz ? `${kommend ? 'ab' : 'seit'} ${formatDate(a.datum).replace(/(\d\d)(\d\d)$/, '$2')}` : (seitAbText(a.datum, today, t) ?? '')
  return <span className={`whitespace-nowrap text-t4 tabular-nums ${farbe}`}>{text}</span>
}

/**
 * Die Händler hinter einer Ausgabe als leise Textlinks im Fließtext: optisch 16 px hoch, die Trefferfläche über
 * `TIPPFLAECHE_HOCH` 44 px — dieselbe Lösung wie bei den niedrigen Textzielen der Seite (`tippziel.ts`).
 */
export function HaendlerLinks({ a }: { a: Ausgabe }) {
  if (!a.haendler.length) return null
  return (
    <span className="block text-t5 leading-4 text-ak-leise">
      <DiscZeichen className="mr-1 inline size-3 align-[-2px]" />
      {a.haendler.map((h, i) => (
        <span key={h.url}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <a href={h.url} target="_blank" rel="noreferrer noopener" className={`${TIPPFLAECHE_HOCH} hover:text-ak-text hover:underline`}>
            {h.name}
          </a>
        </span>
      ))}
    </span>
  )
}

/** Der Verlag, einmal über allem — leise, denn er ist Hintergrund, nicht Auskunft. */
export function KopfZeile({ verlag, anzahl, rechts }: { verlag?: string; anzahl: number; rechts?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-t5 text-ak-leise">
      <span className="font-bold uppercase tracking-[.08em]">{anzahl === 1 ? '1 Ausgabe' : `${anzahl} Ausgaben`}</span>
      {verlag && <span className="truncate">· {verlag}</span>}
      {rechts && <span className="ml-auto shrink-0">{rechts}</span>}
    </div>
  )
}

const GRENZE = 6

/** Lange Reihen (One Piece: 38 Boxen) zeigen die ersten sechs; der Knopf holt den Rest — ein Tippziel von 44 px. */
export function useGekuerzt<T>(liste: T[]): { sichtbar: T[]; knopf: ReactNode } {
  const [offen, setOffen] = useState(false)
  if (liste.length <= GRENZE) return { sichtbar: liste, knopf: null }
  const knopf = (
    <button
      type="button"
      onClick={() => setOffen((o) => !o)}
      aria-expanded={offen}
      data-disc-mehr
      className="inline-flex min-h-11 items-center gap-1 self-start rounded-full px-3 text-t4 font-semibold text-ak-akzent-text hover:bg-ak-flaeche-2"
    >
      {offen ? 'Weniger anzeigen' : `Alle ${liste.length} Ausgaben`} <span aria-hidden="true">{offen ? '▴' : '▾'}</span>
    </button>
  )
  return { sichtbar: offen ? liste : liste.slice(0, GRENZE), knopf }
}

/** Die übrigen Kaufwege (Apple TV, Google Play …) wie auf der Seite: eine Pille je Shop; aniSearch steckt schon in den Ausgaben. */
export function KaufwegPillen({ sortiertNachZugang, discAusgaben, folgenAngabeFuer, t }: DiscBereichEigenschaften) {
  const shops = sortiertNachZugang.flatMap(({ shops }) => shops).filter((g) => !(g.shop === 'aniSearch' && discAusgaben.length))
  if (!shops.length) return null
  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-4 pt-1">
      {shops.map((g) => (
        <Pille
          key={g.shop + g.eintraege[0].url}
          name={g.shop}
          url={g.eintraege[0].url}
          unten={g.eintraege.length > 1 ? t('where.angebote', { count: g.eintraege.length }) : g.eintraege[0].dubRanges?.length ? folgenAngabeFuer({ dubRanges: g.eintraege[0].dubRanges }) || undefined : undefined}
          farbe={farbeZuAnbieter(g.shop)}
          icon={anbieterDatei(g.shop) ? <AnbieterIcon was={g.shop} /> : <DiscZeichen />}
        />
      ))}
    </div>
  )
}
