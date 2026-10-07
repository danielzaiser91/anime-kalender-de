import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { Tooltip } from './ui.tsx'

type Markierung = [x: number, y: number, breite: number, hoehe: number]
type Ansicht = 'ausschnitt' | 'seite'
interface Mass {
  b: number
  h: number
}
interface Bereich {
  x: number
  y: number
  b: number
  h: number
}

const klemme = (w: number, von: number, bis: number) => Math.min(bis, Math.max(von, w))

/** Bereich um die Fundstelle: Rand, mindestens 40 % der Seitenbreite, höchstens 2:1, mittig um die Fundstelle und im Bild gehalten. */
function bereichUm([x, y, b, h]: Markierung, mass: Mass): Bereich {
  const rb = klemme(Math.max(0.4, b + 2 * Math.max(0.05, b * 0.35)), 0, 1)
  const rh = klemme(Math.max(h + 2 * Math.max(0.035, h * 0.8), (rb * mass.b) / 2 / mass.h), 0, 1)
  return { x: klemme(x + b / 2 - rb / 2, 0, 1 - rb), y: klemme(y + h / 2 - rh / 2, 0, 1 - rh), b: rb, h: rh }
}

/** Der Rahmen um die Fundstelle, in Anteilen des umgebenden Bildes. */
function Rahmen({ r, innen }: { r?: Bereich; innen?: Ref<HTMLDivElement> }) {
  if (!r) return null
  return <div ref={innen} aria-label="Fundstelle" className="pointer-events-none absolute rounded border-[3px] border-rose-500 bg-rose-500/10" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.b * 100}%`, height: `${r.h * 100}%` }} />
}

/** Nur der Bereich um die Fundstelle, vergrößert auf die Breite des Fensters (`eins`: in echten Bildpunkten, seitlich verschiebbar). */
function Ausschnittsbild({ url, name, fund, bereich, mass, eins }: { url: string; name: string; fund?: Bereich; bereich: Bereich; mass: Mass; eins: boolean }) {
  const { x, y, b, h } = bereich
  const innen = fund && { x: (fund.x - x) / b, y: (fund.y - y) / h, b: fund.b / b, h: fund.h / h }
  return (
    <div className={eins ? 'overflow-x-auto' : ''}>
      <div className="relative overflow-hidden rounded border border-white/10" style={{ aspectRatio: `${b * mass.b} / ${h * mass.h}`, width: eins ? `${b * mass.b}px` : '100%', maxWidth: eins ? 'none' : '100%' }}>
        <img src={url} alt={`Beleg: ${name}, Ausschnitt um die Fundstelle`} className="absolute max-w-none" style={{ width: `${100 / b}%`, left: `${(-x / b) * 100}%`, top: `${(-y / h) * 100}%` }} />
        <Rahmen r={innen} />
      </div>
    </div>
  )
}

/** Die ganze Seite in voller Breite; die Marke scrollt ins Bild, sobald sie erscheint. */
function Seitenbild({ url, name, fund }: { url: string; name: string; fund?: Bereich }) {
  const marke = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = window.setTimeout(() => marke.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div className="relative mx-auto w-full">
      <img src={url} alt={`Beleg: ${name}`} className="block w-full rounded" />
      <Rahmen r={fund} innen={marke} />
    </div>
  )
}

const KNOPF = 'cursor-pointer rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10'

interface LeisteProps {
  ansicht: Ansicht
  setAnsicht: (a: Ansicht) => void
  eins: boolean
  setEins: (e: boolean) => void
  info: string
  ohneFund: boolean
  original: { url: string; host: string }
  ziel: HTMLElement | null
}

/**
 * **Die Werkzeuge stehen in der Kopfzeile des Fensters, nicht darunter** (Daniel, 07.10.2026: „verbraucht unnötig Platz und schiebt den Artikel nach unten"): Umschalter „Beleg | Ganze Seite",
 * „1:1" für die Originalgröße, ⓘ (Datum und Prüfstand erscheinen beim Zeigen oder Tippen) und der Sprung zur Originalseite als Symbol. Sie werden per Portal in die Kopfzeile gesetzt (`ziel`).
 */
function Leiste({ ansicht, setAnsicht, eins, setEins, info, ohneFund, original, ziel }: LeisteProps) {
  if (!ziel) return null
  return createPortal(
    <>
      <div role="tablist" aria-label="Ansicht des Belegs" className="flex rounded-full border border-slate-600 bg-slate-950 p-0.5 text-xs">
        {(['ausschnitt', 'seite'] as const).map((a) => (
          <button key={a} type="button" role="tab" aria-selected={ansicht === a} onClick={() => setAnsicht(a)} className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1 ${ansicht === a ? 'bg-white font-bold text-slate-900' : 'text-slate-300 hover:text-white'}`}>
            {a === 'ausschnitt' ? 'Beleg' : <><span className="sm:hidden">Seite</span><span className="hidden sm:inline">Ganze Seite</span></>}
          </button>
        ))}
      </div>
      {ansicht === 'ausschnitt' && (
        <button type="button" aria-pressed={eins} onClick={() => setEins(!eins)} title="Originalgröße: echte Bildpunkte, seitlich verschiebbar" className={`${KNOPF} hidden sm:inline-block ${eins ? 'bg-white/15 font-bold' : ''}`}>
          1:1
        </button>
      )}
      <span className="flex-1" />
      <Tooltip text={<>{info}{ohneFund && <span className="mt-1 block opacity-80">Keine Fundstelle markiert — gezeigt wird der Seitenanfang.</span>}</>} seite="unten" eigenerFokus>
        <button type="button" aria-label="Woher der Beleg stammt" className={KNOPF}>
          ⓘ
        </button>
      </Tooltip>
      <a href={original.url} target="_blank" rel="noopener noreferrer" title={`Originalseite bei ${original.host}`} aria-label={`Originalseite bei ${original.host} öffnen`} className={`${KNOPF} border-rose-400 text-rose-200`}>
        ↗
      </a>
    </>,
    ziel,
  )
}

/** Die Übersichtskarte: die ganze Seite klein, der Ausschnitt gestrichelt, die Fundstelle als Rahmen. */
function Karte({ url, fund, bereich, onClick }: { url: string; fund?: Bereich; bereich: Bereich; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Ganze Seite ansehen" className="w-32 shrink-0 cursor-zoom-in self-center text-left md:self-start">
      <span className="relative block overflow-hidden rounded border border-white/10">
        <img src={url} alt="" className="block w-full opacity-80" />
        <span className="pointer-events-none absolute border border-dashed border-white/80" style={{ left: `${bereich.x * 100}%`, top: `${bereich.y * 100}%`, width: `${bereich.b * 100}%`, height: `${bereich.h * 100}%` }} />
        <Rahmen r={fund} />
      </span>
    </button>
  )
}

/** Höchstens doppelt so breit wie das Bild selbst: Aufnahmen mit 520 px Breite sind auf 1.400 px gezogen verschwommen (Daniel, 07.10.2026: „am Desktop nicht lesbar“). */
const Huelle = ({ breite, children }: { breite: number; children: ReactNode }) => (
  <div className="mx-auto w-full" style={{ maxWidth: breite }} onClick={(e) => e.stopPropagation()}>
    {children}
  </div>
)

/**
 * **Der Beleg als Ausschnitt** (Vorschau `beleg`, Daniel, 07.10.2026): Das Seitenbild ist bis zu 1.800 Pixel breit und auf dem Desktop zu klein zum Lesen. Gezeigt wird deshalb zuerst der Bereich
 * um die Fundstelle; die ganze Seite bleibt einen Klick entfernt. Varianten: `schalter` (nur die Leiste), `klick` (zusätzlich zeigt ein Klick auf den Ausschnitt die ganze Seite) und
 * `karte` (daneben eine kleine Übersichtskarte der Seite).
 */
export function BelegAusschnitt({ url, name, markierung, variante, info, original, ziel }: { url: string; name: string; markierung?: Markierung; variante: string; info: string; original: { url: string; host: string }; ziel: HTMLElement | null }) {
  const [ansicht, setAnsicht] = useState<Ansicht>('ausschnitt')
  const [mass, setMass] = useState<Mass>()
  const [eins, setEins] = useState(false)
  useEffect(() => {
    const bild = new Image()
    bild.onload = () => setMass({ b: bild.naturalWidth, h: bild.naturalHeight })
    bild.src = url
  }, [url])
  if (!mass) return <p className="p-4 text-sm text-slate-400">Lädt …</p>
  /* Ohne markierte Fundstelle zeigt der Ausschnitt den Seitenanfang (Überschrift und erste Absätze), ohne Rahmen. */
  const fund: Bereich | undefined = markierung && { x: markierung[0], y: markierung[1], b: markierung[2], h: markierung[3] }
  const bereich = markierung ? bereichUm(markierung, mass) : { x: 0, y: 0, b: 1, h: Math.min(1, mass.b / 2 / mass.h) }
  const ausschnitt = <Ausschnittsbild url={url} name={name} fund={fund} bereich={bereich} mass={mass} eins={eins} />
  const zurSeite = () => setAnsicht('seite')
  const inhalt =
    ansicht === 'seite' ? (
      <Seitenbild url={url} name={name} fund={fund} />
    ) : variante === 'klick' ? (
      <button type="button" onClick={zurSeite} title="Klick zeigt die ganze Seite" className="block w-full cursor-zoom-out text-left">
        {ausschnitt}
      </button>
    ) : variante === 'karte' ? (
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">{ausschnitt}</div>
        <Karte url={url} fund={fund} bereich={bereich} onClick={zurSeite} />
      </div>
    ) : (
      ausschnitt
    )
  return (
    <Huelle breite={Math.min(1800, mass.b * 2)}>
      <Leiste ansicht={ansicht} setAnsicht={setAnsicht} eins={eins} setEins={setEins} info={info} ohneFund={!fund} original={original} ziel={ziel} />
      {inhalt}
    </Huelle>
  )
}
