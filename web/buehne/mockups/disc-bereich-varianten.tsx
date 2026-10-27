import type { ReactNode } from 'react'
import { MerkenKnopf } from '../../src/components/detail/merken.tsx'
import type { DiscBereichEigenschaften } from '../ersatz.tsx'
import { artikelUrl, discAusgabenVon, formateVon, FORMAT_NAME, geteilt, istKommend, verlagVon, zielVon, type Ausgabe, type Format } from './disc-bereich-daten.ts'
import { DatumText, FormatMarken, HaendlerLinks, KaufwegPillen, KopfZeile, useGekuerzt } from './disc-bereich-teile.tsx'

type Zeit = Pick<DiscBereichEigenschaften, 'today' | 't'>

/** Der Name als Link zum ersten Händler; ohne Händler als Text. 44 px hoch, damit die Zeile selbst das Tippziel ist. */
function NameLink({ a, klasse }: { a: Ausgabe; klasse: string }) {
  const ziel = zielVon(a)
  const text = <span className={a.gesamt ? 'font-bold' : 'font-semibold'}>{a.name}</span>
  return ziel ? (
    <a href={ziel} target="_blank" rel="noreferrer noopener" className={`${klasse} hover:underline`}>
      {text}
    </a>
  ) : (
    <span className={klasse}>{text}</span>
  )
}

/** Gemeinsamer Rahmen: Kopfzeile, Inhalt, Mehr-Knopf, dann die übrigen Kaufwege der Seite. */
function Rahmen({ e, alle, knopf, children }: { e: DiscBereichEigenschaften; alle: Ausgabe[]; knopf: ReactNode; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <KopfZeile verlag={verlagVon(e.discReleases)} anzahl={alle.length} />
      {children}
      {knopf}
      <KaufwegPillen {...e} />
    </div>
  )
}

/* ---------- A: Liste in zwei Gruppen ---------- */

function ListenZeile({ a, today, t }: { a: Ausgabe } & Zeit) {
  return (
    <li className="flex items-center gap-2.5 py-1">
      <span className="flex w-10 shrink-0 flex-col items-start gap-1">
        <FormatMarken formate={a.formate} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <NameLink a={a} klasse="flex min-h-11 items-center text-t3" />
        <HaendlerLinks a={a} />
      </span>
      <DatumText a={a} today={today} t={t} />
      <MerkenKnopf release={a.release} today={today} zeile />
    </li>
  )
}

function Gruppe({ titel, liste, today, t }: { titel?: string; liste: Ausgabe[] } & Zeit) {
  if (!liste.length) return null
  return (
    <div className="flex flex-col">
      {titel && <span className="text-t5 font-bold uppercase tracking-[.08em] text-ak-leise">{titel}</span>}
      <ul className="divide-y divide-ak-linie">
        {liste.map((a) => (
          <ListenZeile key={a.schluessel} a={a} today={today} t={t} />
        ))}
      </ul>
    </div>
  )
}

/** A: Eine Zeile je Ausgabe, Format links als Marke, Datum rechts; „Vorbestellbar“ über „Erhältlich“ (jüngste oben). */
export function DiscListe(e: DiscBereichEigenschaften) {
  const alle = discAusgabenVon(e)
  const { kommend, erschienen } = geteilt(alle, e.today)
  const { sichtbar, knopf } = useGekuerzt(erschienen)
  return (
    <Rahmen e={e} alle={alle} knopf={knopf}>
      <Gruppe titel="Vorbestellbar" liste={kommend} today={e.today} t={e.t} />
      <Gruppe titel={kommend.length ? 'Erhältlich' : undefined} liste={sichtbar} today={e.today} t={e.t} />
    </Rahmen>
  )
}

/* ---------- B: Raster Ausgabe × Format ---------- */

function Zelle({ a, f, today, t }: { a: Ausgabe; f: Format } & Zeit) {
  const artikel = a.artikel[f]
  const url = artikel ? artikelUrl(artikel) : zielVon(a)
  const inhalt = <DatumText a={a} today={today} t={t} gestapelt />
  return url ? (
    <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center rounded-lg px-1.5 hover:bg-ak-flaeche-2">
      {inhalt}
    </a>
  ) : (
    inhalt
  )
}

function RasterZeile({ a, spalten, today, t }: { a: Ausgabe; spalten: Format[] } & Zeit) {
  const linie = 'border-t border-ak-linie'
  return (
    <>
      <span className={`flex min-w-0 flex-col justify-center py-1 ${linie}`}>
        <NameLink a={a} klasse="flex min-h-11 items-center text-t3 leading-tight" />
        <HaendlerLinks a={a} />
      </span>
      {spalten.map((f) => (
        <span key={f} className={`flex min-h-11 items-center justify-center ${linie}`}>
          {a.formate.includes(f) ? <Zelle a={a} f={f} today={today} t={t} /> : <span className="text-ak-sehr-leise">–</span>}
        </span>
      ))}
      <span className={`flex items-center ${linie}`}>
        <MerkenKnopf release={a.release} today={today} zeile />
      </span>
    </>
  )
}

/** B: Zeilen sind Ausgaben, Spalten die Formate; die Zelle trägt das Datum und führt zum Artikel des Formats. */
export function DiscRaster(e: DiscBereichEigenschaften) {
  const alle = discAusgabenVon(e)
  const spalten = formateVon(alle)
  const { sichtbar, knopf } = useGekuerzt([...alle].reverse())
  return (
    <Rahmen e={e} alle={alle} knopf={knopf}>
      <div className="grid items-stretch gap-x-1" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${spalten.length}, auto) auto` }}>
        <span />
        {spalten.map((f) => (
          <span key={f} className="justify-self-center pb-1 text-t5 font-bold uppercase tracking-[.08em] text-ak-leise">
            {FORMAT_NAME[f]}
          </span>
        ))}
        <span />
        {sichtbar.map((a) => (
          <RasterZeile key={a.schluessel} a={a} spalten={spalten} today={e.today} t={e.t} />
        ))}
      </div>
    </Rahmen>
  )
}

/* ---------- C: Karten ---------- */

const KARTE =
  'relative flex flex-col gap-1 rounded-xl bg-ak-pille p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,.12)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]'

function Karte({ a, today, t }: { a: Ausgabe } & Zeit) {
  const kommend = istKommend(a, today)
  return (
    <li className={`${KARTE} ${a.gesamt ? 'col-span-2' : ''} ${kommend ? 'ring-2 ring-ak-akzent/60' : ''}`}>
      <span className="flex items-center justify-between gap-1">
        <FormatMarken formate={a.formate} />
        <DatumText a={a} today={today} t={t} kurz />
      </span>
      <NameLink a={a} klasse="flex min-h-11 items-center text-t3 leading-tight" />
      <span className="mt-auto flex items-center justify-between gap-1">
        <HaendlerLinks a={a} />
        <MerkenKnopf release={a.release} today={today} zeile />
      </span>
    </li>
  )
}

/** C: Eine Karte je Ausgabe, zwei nebeneinander; die Gesamtausgabe über die ganze Breite, Kommendes mit Akzentring. */
export function DiscKarten(e: DiscBereichEigenschaften) {
  const alle = discAusgabenVon(e)
  const { kommend, erschienen } = geteilt(alle, e.today)
  const { sichtbar, knopf } = useGekuerzt([...kommend, ...erschienen])
  return (
    <Rahmen e={e} alle={alle} knopf={knopf}>
      <ul className="grid grid-cols-2 gap-2">
        {sichtbar.map((a) => (
          <Karte key={a.schluessel} a={a} today={e.today} t={e.t} />
        ))}
      </ul>
    </Rahmen>
  )
}
