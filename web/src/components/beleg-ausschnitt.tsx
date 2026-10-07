import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'

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

const BTN = 'cursor-pointer rounded border border-slate-600 px-2.5 py-1 text-xs hover:bg-white/10'
const klemme = (w: number, von: number, bis: number) => Math.min(bis, Math.max(von, w))

/** Bereich um die Fundstelle: Rand, mindestens 40 % der Seitenbreite, höchstens 2:1, mittig um die Fundstelle und im Bild gehalten. */
function bereichUm([x, y, b, h]: Markierung, mass: Mass): Bereich {
  const rb = klemme(Math.max(0.4, b + 2 * Math.max(0.05, b * 0.35)), 0, 1)
  const rh = klemme(Math.max(h + 2 * Math.max(0.035, h * 0.8), (rb * mass.b) / 2 / mass.h), 0, 1)
  return { x: klemme(x + b / 2 - rb / 2, 0, 1 - rb), y: klemme(y + h / 2 - rh / 2, 0, 1 - rh), b: rb, h: rh }
}

/** Der Rahmen um die Fundstelle, in Anteilen des umgebenden Bildes. */
function Rahmen({ r, innen }: { r: Bereich; innen?: Ref<HTMLDivElement> }) {
  return <div ref={innen} aria-label="Fundstelle" className="pointer-events-none absolute rounded border-[3px] border-rose-500 bg-rose-500/10" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.b * 100}%`, height: `${r.h * 100}%` }} />
}

/** Nur der Bereich um die Fundstelle, vergrößert auf die Breite des Fensters. */
function Ausschnittsbild({ url, name, fund, bereich, mass, eins }: { url: string; name: string; fund: Bereich; bereich: Bereich; mass: Mass; eins: boolean }) {
  const { x, y, b, h } = bereich
  const innen = { x: (fund.x - x) / b, y: (fund.y - y) / h, b: fund.b / b, h: fund.h / h }
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
function Seitenbild({ url, name, fund }: { url: string; name: string; fund: Bereich }) {
  const marke = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = window.setTimeout(() => marke.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div className="relative mx-auto w-full max-w-[1800px]">
      <img src={url} alt={`Beleg: ${name}`} className="block w-full rounded" />
      <Rahmen r={fund} innen={marke} />
    </div>
  )
}

function Umschalter({ ansicht, setAnsicht }: { ansicht: Ansicht; setAnsicht: (a: Ansicht) => void }) {
  return (
    <div role="tablist" aria-label="Ansicht des Belegs" className="mx-auto mb-3 flex w-fit rounded-full border border-slate-600 bg-slate-900 p-0.5 text-sm">
      {(['ausschnitt', 'seite'] as const).map((a) => (
        <button key={a} type="button" role="tab" aria-selected={ansicht === a} onClick={() => setAnsicht(a)} className={`cursor-pointer rounded-full px-4 py-1 ${ansicht === a ? 'bg-white font-bold text-slate-900' : 'text-slate-300 hover:text-white'}`}>
          {a === 'ausschnitt' ? 'Beleg' : 'Ganze Seite'}
        </button>
      ))}
    </div>
  )
}

/** „Originalgröße": der Ausschnitt in echten Bildpunkten (Schrift, die im Seitenbild zu klein ist), seitlich verschiebbar. */
const Groesse = ({ eins, setEins }: { eins: boolean; setEins: (e: boolean) => void }) => (
  <div className="mb-2 flex justify-center">
    <button type="button" aria-pressed={eins} onClick={() => setEins(!eins)} className={`${BTN} ${eins ? 'bg-white/15 font-bold' : ''}`}>
      Originalgröße
    </button>
  </div>
)

const Zurueck = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`${BTN} mb-3`}>
    ← Zurück zum Ausschnitt
  </button>
)

/** Die kleine Übersichtskarte: die ganze Seite, der Ausschnitt gestrichelt, die Fundstelle als Rahmen. */
function Karte({ url, fund, bereich, onClick }: { url: string; fund: Bereich; bereich: Bereich; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Ganze Seite ansehen" className="w-40 shrink-0 cursor-zoom-in self-center text-left md:self-start">
      <span className="relative block overflow-hidden rounded border border-white/10">
        <img src={url} alt="" className="block w-full opacity-80" />
        <span className="pointer-events-none absolute border border-dashed border-white/80" style={{ left: `${bereich.x * 100}%`, top: `${bereich.y * 100}%`, width: `${bereich.b * 100}%`, height: `${bereich.h * 100}%` }} />
        <Rahmen r={fund} />
      </span>
      <span className="mt-1 block text-center text-xs text-slate-400">Ganze Seite</span>
    </button>
  )
}

const Huelle = ({ breite, children }: { breite: string; children: ReactNode }) => (
  <div className={`mx-auto ${breite}`} onClick={(e) => e.stopPropagation()}>
    {children}
  </div>
)

/**
 * **Der Beleg als Ausschnitt** (Vorschau `beleg`, Daniel, 07.10.2026): Das Seitenbild ist bis zu 1.800 Pixel breit und auf dem Desktop zu klein zum Lesen. Gezeigt wird deshalb
 * zuerst der Bereich um die Fundstelle; die ganze Seite bleibt einen Schritt entfernt. Drei Varianten: `schalter` (Umschalter „Beleg | Ganze Seite"), `klick` (nur der Ausschnitt,
 * ein Klick darauf zeigt die ganze Seite) und `karte` (Ausschnitt groß, daneben eine Übersichtskarte der Seite).
 */
export function BelegAusschnitt({ url, name, markierung, variante }: { url: string; name: string; markierung: Markierung; variante: string }) {
  const [ansicht, setAnsicht] = useState<Ansicht>('ausschnitt')
  const [mass, setMass] = useState<Mass>()
  const [eins, setEins] = useState(false)
  useEffect(() => {
    const bild = new Image()
    bild.onload = () => setMass({ b: bild.naturalWidth, h: bild.naturalHeight })
    bild.src = url
  }, [url])
  if (!mass) return <p className="p-4 text-sm text-slate-400">Lädt …</p>
  const fund: Bereich = { x: markierung[0], y: markierung[1], b: markierung[2], h: markierung[3] }
  const bereich = bereichUm(markierung, mass)
  const ausschnitt = <Ausschnittsbild url={url} name={name} fund={fund} bereich={bereich} mass={mass} eins={eins} />
  const seite = <Seitenbild url={url} name={name} fund={fund} />
  const gr = ansicht === 'ausschnitt' ? <Groesse eins={eins} setEins={setEins} /> : null
  const zurueck = () => setAnsicht('ausschnitt')
  const zurSeite = () => setAnsicht('seite')
  if (ansicht === 'seite' && variante !== 'schalter') {
    return (
      <Huelle breite="max-w-5xl">
        <Zurueck onClick={zurueck} />
        {seite}
      </Huelle>
    )
  }
  if (variante === 'schalter') {
    return (
      <Huelle breite="max-w-[1800px]">
        <Umschalter ansicht={ansicht} setAnsicht={setAnsicht} />
        {gr}
        {ansicht === 'ausschnitt' ? ausschnitt : seite}
      </Huelle>
    )
  }
  if (variante === 'klick') {
    return (
      <Huelle breite="max-w-[1800px]">
        {gr}
        <button type="button" onClick={zurSeite} title="Klick zeigt die ganze Seite" className="block w-full cursor-zoom-out text-left">
          {ausschnitt}
          <span className="mt-2 block text-center text-xs text-slate-400">Klick auf das Bild zeigt die ganze Seite</span>
        </button>
      </Huelle>
    )
  }
  return (
    <Huelle breite="max-w-[1800px]">
      {gr}
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">{ausschnitt}</div>
        <Karte url={url} fund={fund} bereich={bereich} onClick={zurSeite} />
      </div>
    </Huelle>
  )
}
