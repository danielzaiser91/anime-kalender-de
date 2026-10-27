import { useState, type ReactNode } from 'react'
import { anzeigeName } from '@shared/titles.ts'
import type { DiscBereichEigenschaften } from '../ersatz.tsx'
import { discAusgabenVon, FORMAT_NAME, FORMATE, verlagVon, type Format } from './disc-bereich-daten.ts'
import { ART_NAME, gruppenVon, hauptUndRest, spaltenVon, spaetestes, variantenVon, type Art, type Variante } from './disc-bereich-2-daten.ts'
import { Ausklapper, HaendlerBlock, Matrix, Zaehler } from './disc-bereich-2-teile.tsx'
import { KaufwegPillen } from './disc-bereich-teile.tsx'

/*
  Drei Antworten auf „viele Optionen“ (Daniel, 27.10.2026, Punkt 2 und 8). Allen gemeinsam: erst die Varianten als Matrix
  (Zeile = Variante, Spalte = Format), Händler und Kalender erst nach der Wahl; Gesamtausgaben und Boxen oben, Volumes und
  Filme hinter einem Ausklapper; aniSearch ist nie Händler.
*/

function useVarianten(e: DiscBereichEigenschaften): Variante[] {
  return variantenVon(discAusgabenVon(e), anzeigeName(e.title))
}

/** Rahmen: Zähler, Inhalt, dann die übrigen Kaufwege der Seite (Apple TV, Google Play …). */
function Rahmen({ e, anzahl, children }: { e: DiscBereichEigenschaften; anzahl: number; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <Zaehler anzahl={anzahl} verlag={verlagVon(e.discReleases)} />
      {children}
      <KaufwegPillen {...e} />
    </div>
  )
}

const REST_NAME = (rest: Variante[]): string => gruppenVon(rest).map((g) => ART_NAME[g.art]).join(' & ')

interface WahlProps {
  wahl: string | null
  onWahl: (s: string | null) => void
  today: string
}

/** Hauptliste (Gesamtausgaben/Boxen oder alles) plus Ausklapper für den Rest; `inline` entscheidet, wo der Händlerblock steht. */
function HauptUndRest({ liste, inline, ...w }: { liste: Variante[]; inline: boolean } & WahlProps) {
  const { haupt, rest } = hauptUndRest(liste)
  return (
    <>
      <Matrix liste={haupt} spalten={spaltenVon(haupt)} inline={inline} {...w} />
      {rest.length > 0 && (
        <Ausklapper titel={REST_NAME(rest)} anzahl={rest.length}>
          <Matrix liste={rest} spalten={spaltenVon(rest)} inline={inline} {...w} />
        </Ausklapper>
      )}
    </>
  )
}

/* ---------- B1: Versions-Dropdown + Matrix, Händler klappt unter der Zeile auf ---------- */

type Filter = string // 'alle' | `art:<art>` | `fmt:<format>`

function optionenVon(liste: Variante[]): { wert: Filter; text: string }[] {
  const gruppen = gruppenVon(liste)
  const formate = FORMATE.filter((f) => liste.some((v) => v.formate.includes(f)))
  return [
    { wert: 'alle', text: `Alle Varianten (${liste.length})` },
    ...(gruppen.length > 1 ? gruppen.map((g) => ({ wert: `art:${g.art}`, text: `${ART_NAME[g.art]} (${g.liste.length})` })) : []),
    ...(formate.length > 1 ? formate.map((f) => ({ wert: `fmt:${f}`, text: `Nur ${FORMAT_NAME[f]} (${liste.filter((v) => v.formate.includes(f)).length})` })) : []),
  ]
}

const passt = (v: Variante, filter: Filter): boolean => filter === 'alle' || filter === `art:${v.art}` || v.formate.some((f) => filter === `fmt:${f}`)

export function DiscDropdown(e: DiscBereichEigenschaften) {
  const alle = useVarianten(e)
  const [filter, setFilter] = useState<Filter>('alle')
  const [wahl, setWahl] = useState<string | null>(null)
  const liste = alle.filter((v) => passt(v, filter))
  const optionen = optionenVon(alle)
  return (
    <Rahmen e={e} anzahl={alle.length}>
      {optionen.length > 1 && (
        <label className="flex flex-col gap-0.5 text-t5 font-bold uppercase tracking-[.08em] text-ak-leise">
          Version
          <select
            value={filter}
            onChange={(ev) => {
              setFilter(ev.target.value)
              setWahl(null)
            }}
            className="min-h-11 w-full rounded-lg border border-ak-rand bg-ak-flaeche px-2 text-t4 font-semibold normal-case tracking-normal text-ak-text"
          >
            {optionen.map((o) => (
              <option key={o.wert} value={o.wert}>
                {o.text}
              </option>
            ))}
          </select>
        </label>
      )}
      {filter === 'alle' ? (
        <HauptUndRest liste={liste} inline wahl={wahl} onWahl={setWahl} today={e.today} />
      ) : (
        <Matrix liste={liste} spalten={spaltenVon(liste)} inline wahl={wahl} onWahl={setWahl} today={e.today} />
      )}
    </Rahmen>
  )
}

/* ---------- B2: Filter-Chips + Matrix, Händler in einer Auswahlkarte darunter ---------- */

function Chip({ aktiv, onKlick, children }: { aktiv: boolean; onKlick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={aktiv} onClick={onKlick} className="inline-flex min-h-11 shrink-0 items-center">
      <span className={`rounded-full border px-3 py-1 text-t4 ${aktiv ? 'border-ak-akzent bg-ak-flaeche-2 font-semibold text-ak-akzent-text' : 'border-ak-rand text-ak-text'}`}>{children}</span>
    </button>
  )
}

function ChipReihe<T extends string>({ titel, werte, wert, onWahl, text }: { titel: string; werte: T[]; wert: T | null; onWahl: (w: T | null) => void; text: (w: T) => string }) {
  if (werte.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-x-1">
      <span className="w-14 shrink-0 text-t5 font-bold uppercase tracking-[.08em] text-ak-leise">{titel}</span>
      <Chip aktiv={wert === null} onKlick={() => onWahl(null)}>
        Alle
      </Chip>
      {werte.map((w) => (
        <Chip key={w} aktiv={wert === w} onKlick={() => onWahl(wert === w ? null : w)}>
          {text(w)}
        </Chip>
      ))}
    </div>
  )
}

export function DiscChips(e: DiscBereichEigenschaften) {
  const alle = useVarianten(e)
  const [format, setFormat] = useState<Format | null>(null)
  const [art, setArt] = useState<Art | null>(null)
  const [wahl, setWahl] = useState<string | null>(null)
  const liste = alle.filter((v) => (!format || v.formate.includes(format)) && (!art || v.art === art))
  const gewaehlt = alle.find((v) => v.schluessel === wahl)
  const wechsle = <T,>(setze: (w: T | null) => void) => (w: T | null) => {
    setze(w)
    setWahl(null)
  }
  return (
    <Rahmen e={e} anzahl={alle.length}>
      <ChipReihe titel="Format" werte={spaltenVon(alle)} wert={format} onWahl={wechsle(setFormat)} text={(f) => FORMAT_NAME[f]} />
      <ChipReihe titel="Art" werte={gruppenVon(alle).map((g) => g.art)} wert={art} onWahl={wechsle(setArt)} text={(a) => ART_NAME[a]} />
      {art || format ? <Matrix liste={liste} spalten={spaltenVon(liste)} inline={false} wahl={wahl} onWahl={setWahl} today={e.today} /> : <HauptUndRest liste={liste} inline={false} wahl={wahl} onWahl={setWahl} today={e.today} />}
      {liste.length === 0 && <p className="text-t4 text-ak-leise">Keine Variante mit dieser Auswahl.</p>}
      {gewaehlt && (
        <div className="sticky bottom-2 z-10 rounded-xl border border-ak-rand bg-ak-flaeche p-1 shadow-lg">
          <HaendlerBlock v={gewaehlt} today={e.today} kopf />
        </div>
      )}
    </Rahmen>
  )
}

/* ---------- B3: nach Art gruppiert, Gruppen klappen auf, Händler unter der Zeile ---------- */

/** „2019–2026“ bzw. „2025“: die Spanne der Daten einer Gruppe, damit man ohne Aufklappen weiß, wo man landet. */
function jahre(liste: Variante[]): string {
  const alle = liste.map(spaetestes).filter(Boolean).map((d) => d.slice(0, 4)).sort()
  return alle[0] === alle[alle.length - 1] ? alle[0] : `${alle[0]}–${alle[alle.length - 1]}`
}

function Gruppe({ art, liste, offen: start, w }: { art: Art; liste: Variante[]; offen: boolean; w: WahlProps }) {
  const [offen, setOffen] = useState(start)
  return (
    <section className="flex flex-col border-t border-ak-linie first:border-t-0">
      <button type="button" aria-expanded={offen} onClick={() => setOffen((o) => !o)} className="flex min-h-11 items-center justify-between gap-2 px-1 text-left">
        <span className="text-t4 font-bold">
          {ART_NAME[art]} <span className="font-normal text-ak-leise">· {liste.length} · {jahre(liste)}</span>
        </span>
        <span aria-hidden="true" className="text-ak-akzent-text">
          {offen ? '▴' : '▾'}
        </span>
      </button>
      {offen && <Matrix liste={liste} spalten={spaltenVon(liste)} inline {...w} />}
    </section>
  )
}

export function DiscGruppen(e: DiscBereichEigenschaften) {
  const alle = useVarianten(e)
  const [wahl, setWahl] = useState<string | null>(null)
  const { rest } = hauptUndRest(alle)
  const zu = new Set(rest.map((v) => v.art))
  return (
    <Rahmen e={e} anzahl={alle.length}>
      {gruppenVon(alle).map((g) => (
        /* Die aniSearch-Ausgaben kommen nach den Terminen; mit dem Schlüssel greift der Startzustand auch dann. */
        <Gruppe key={`${g.art}-${!zu.has(g.art)}`} art={g.art} liste={g.liste} offen={!zu.has(g.art)} w={{ wahl, onWahl: setWahl, today: e.today }} />
      ))}
    </Rahmen>
  )
}
