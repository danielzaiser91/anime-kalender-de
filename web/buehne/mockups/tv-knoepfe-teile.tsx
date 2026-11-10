import { Children, createContext, isValidElement, useContext, type CSSProperties, type ComponentProps, type ReactNode } from 'react'
import { TerminZeile as EchteZeile } from '../../src/components/detail/termin-zeile.tsx'
import type { Pille } from '../../src/components/detail/pille.tsx'
import type { LiveLink } from '../../src/components/detail/live-link.tsx'

/** Der Sender der Zeile; der echte Live-Knopf bekommt nur „Joyn“ und die Adresse, der Sendername fehlt ihm. */
const SenderKontext = createContext<string | undefined>(undefined)

/** Wie die Seite, nur mit dem Sender im Kontext (Ersatz für `TerminZeile`). */
export function ZeileMitSender(p: ComponentProps<typeof EchteZeile>) {
  return (
    <SenderKontext.Provider value={p.release.sender}>
      <EchteZeile {...p} />
    </SenderKontext.Provider>
  )
}

function SpielZeichen() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={14} height={14} className="size-3.5 shrink-0" fill="currentColor">
      <path d="M7 4v16l13-8z" />
    </svg>
  )
}

const KNOPF = 'inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-ak-flaeche-2 px-3 text-t3 font-semibold text-ak-text transition hover:bg-ak-pille-hover'

type Live = ComponentProps<typeof LiveLink>

/** Beschrifteter Live-Knopf: nennt den Sender, der Anbieter (Joyn) steht im Hinweis. `breit` füllt die Zeile. */
function LiveKnopf({ url, hinweis, breit }: Live & { breit?: boolean }) {
  const sender = useContext(SenderKontext) ?? hinweis
  return (
    <a href={url} target="_blank" rel="noopener" title={hinweis} aria-label={`${sender} live – ${hinweis}`} className={`${KNOPF} ${breit ? 'flex-1' : 'shrink'}`}>
      <span className="text-ak-tv"><SpielZeichen /></span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate">{sender} live</span>
        {breit && <span className="truncate text-t4 font-normal text-ak-leise">{hinweis.replace(/^Live /, '')}</span>}
      </span>
    </a>
  )
}

/** A und B: kürzester Text, nur Sender und „live“. */
export const LiveKurz = (p: Live) => <LiveKnopf {...p} />
/** C: Knopf füllt die Zeile, zweite Zeile nennt den Anbieter. */
export const LiveBreit = (p: Live) => <LiveKnopf {...p} breit />

type PilleEig = ComponentProps<typeof Pille>

const MARKE = 'bg-ak-pille text-ak-text shadow-[inset_0_0_0_1px_rgba(15,23,42,.12),inset_3px_0_0_var(--marke)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.08),inset_3px_0_0_var(--marke)]'

/** Die Knöpfe der Zeile, wenn es mehr als den Kalenderknopf sind (TV mit Live oder Programm); sonst `undefined`. */
function knopfZeile(aktion: ReactNode): ReactNode | undefined {
  if (!isValidElement<{ children?: ReactNode }>(aktion)) return undefined
  return Children.toArray(aktion.props.children).length > 1 ? aktion : undefined
}

function Inhalt({ name, unten, icon, status, farbe }: PilleEig) {
  return (
    <>
      {icon && <span className="flex shrink-0 items-center" style={farbe ? { color: farbe } : undefined}>{icon}</span>}
      <span className="flex min-w-0 flex-col">
        <span className="text-t3 font-semibold">{name}</span>
        {unten && <span className="text-t4 text-ak-leise">{unten}</span>}
      </span>
      {status}
    </>
  )
}

/** Die Chip ohne Knöpfe: volle Breite. */
function Chip(p: PilleEig & { klasse: string }) {
  const stil = p.farbe ? ({ '--marke': p.farbe } as CSSProperties) : undefined
  return (
    <a href={p.url || undefined} target="_blank" rel="noreferrer noopener" style={stil} className={p.klasse}>
      <Inhalt {...p} />
    </a>
  )
}

const CHIP = `relative flex min-h-[52px] w-full min-w-0 items-center gap-2.5 rounded-xl py-1.5 pl-3.5 pr-4 transition hover:bg-ak-pille-hover ${MARKE}`

/** A und C: die Chip über die ganze Breite, die Knöpfe als eigene Zeile darunter. */
export function PilleZeileDarunter(p: PilleEig) {
  const knoepfe = knopfZeile(p.aktion)
  if (!knoepfe) return <PilleVorher {...p} />
  return (
    <div className="flex w-full max-w-full flex-col gap-1">
      <Chip {...p} klasse={CHIP} />
      <div className="flex items-center gap-1">{knoepfe}</div>
    </div>
  )
}

/** B: dieselbe Fläche, die Knöpfe sitzen als Fußzeile in der Chip. */
export function PilleKnoepfeDrin(p: PilleEig) {
  const knoepfe = knopfZeile(p.aktion)
  if (!knoepfe) return <PilleVorher {...p} />
  const stil = p.farbe ? ({ '--marke': p.farbe } as CSSProperties) : undefined
  return (
    <div style={stil} className={`relative w-full max-w-full rounded-xl ${MARKE}`}>
      <Chip {...p} klasse="relative flex min-h-[52px] w-full min-w-0 items-center gap-2.5 rounded-t-xl py-1.5 pl-3.5 pr-4 transition hover:bg-ak-pille-hover" />
      <div className="mx-1 flex items-center gap-1 border-t border-black/10 pb-1 pt-1 dark:border-white/10">{knoepfe}</div>
    </div>
  )
}

/** Alles ohne Live/Programm (Streams, Discs) bleibt wie auf der Seite. */
function PilleVorher(p: PilleEig) {
  return (
    <div className="flex max-w-full items-center gap-1">
      <Chip {...p} klasse={`relative inline-flex min-h-[52px] min-w-0 max-w-full items-center gap-2.5 rounded-xl py-1.5 pl-3.5 pr-4 transition hover:bg-ak-pille-hover ${MARKE}`} />
      {p.aktion}
    </div>
  )
}
