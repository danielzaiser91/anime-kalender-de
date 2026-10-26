import type { Kandidat } from '@shared/empfehlung-pool.ts'
import type { KartenQuelle } from '../../lib/empfehlung-duell-bilder.ts'
import type { DuellSchritt } from '../../lib/empfehlung-duell-steuerung.ts'

export type Status = '' | 'gewinnt' | 'verliert'

const RAHMEN = 'relative block h-full min-h-0 w-full overflow-hidden rounded-2xl bg-ak-flaeche-2 shadow-2xl md:aspect-[2/3] md:h-auto md:max-h-full md:w-auto md:max-w-full'

function Karte({ k, bild, genres, status, seite, wahl }: {
  k: Kandidat
  bild: KartenQuelle
  genres: string[]
  status: Status
  seite: 'a' | 'b'
  wahl: () => void
}) {
  return (
    <button type="button" onClick={wahl} data-seite={seite} className={`empf-kandidat ${status} ${RAHMEN}`}>
      {bild.src && <img {...bild} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-12 text-left text-[clamp(16px,4.5vw,22px)] font-extrabold leading-tight empf-name">
        {k.n}
        <span className="mt-1.5 flex gap-1 text-[11px] font-semibold">
          {genres.map((g) => (
            <i key={g} className="empf-chip rounded-full px-2 py-0.5 not-italic">
              {g}
            </i>
          ))}
        </span>
      </span>
      {status === 'gewinnt' && (
        <span className="empf-haken absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ak-gut text-lg font-extrabold text-ak-auf-gut" aria-hidden>
          ✓
        </span>
      )}
    </button>
  )
}

/** Zwischenbild, solange die nächsten Cover noch laden: eine leere Fläche, nie das alte Cover. */
function Platzhalter({ seite }: { seite: 'a' | 'b' }) {
  return <div data-seite={seite} className={`empf-platz ${RAHMEN}`} aria-hidden />
}

/** Die beiden Karten samt „oder“; im Schritt „warten“ stehen statt der Karten Platzhalter. */
export function DuellKarten({ paar, quelle, genres, schritt, status, oder, waehle }: {
  paar: [Kandidat, Kandidat]
  quelle: (id: number) => KartenQuelle
  genres: (k: Kandidat) => string[]
  schritt: DuellSchritt
  status: (seite: 'A' | 'B') => Status
  oder: string
  waehle: (seite: 'A' | 'B') => void
}) {
  const warten = schritt === 'warten'
  const [a, b] = paar
  return (
    <div data-schritt={schritt} className="empf-duell grid min-h-0 flex-1 grid-cols-1 grid-rows-[1fr_auto_1fr] items-center justify-items-center gap-2 md:grid-cols-[1fr_auto_1fr] md:grid-rows-1 md:gap-4">
      <div className="h-full min-h-0 w-full md:flex md:justify-end">
        {warten ? <Platzhalter seite="a" /> : <Karte key={a.id} k={a} bild={quelle(a.id)} genres={genres(a)} status={status('A')} seite="a" wahl={() => waehle('A')} />}
      </div>
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-ak-sehr-leise">{oder}</span>
      <div className="h-full min-h-0 w-full md:flex md:justify-start">
        {warten ? <Platzhalter seite="b" /> : <Karte key={b.id} k={b} bild={quelle(b.id)} genres={genres(b)} status={status('B')} seite="b" wahl={() => waehle('B')} />}
      </div>
    </div>
  )
}
