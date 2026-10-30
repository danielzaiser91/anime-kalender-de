import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from '../../lib/escape.ts'
import { useVerlaufEintrag } from '../../lib/use-verlauf-eintrag.ts'
import { gleichesBild } from './cover-gleich.ts'

/**
 * **Das Cover groß ansehen** (Daniel, 04.10.2026; seit dem 06.10.2026 öffnet der Klick aufs Cover, das Symbol in der Leiste entfiel):
 * Die Ansicht liegt als eigene Schicht über allem (`createPortal`), damit darunter nichts ausgelöst wird; ein Klick irgendwo in der
 * Schicht oder Escape schließt sie. Sie hat keine Adresse, aber einen Verlaufseintrag (`useVerlaufEintrag`): „Zurück“ schließt sie, nicht das Panel. Ein Klick aufs Banner zeigt das Banner.
 *
 * **Bildauslieferung** (Daniel, 07.10.2026: schärfer, aber ohne unnötiges Datenvolumen): Das AniList-Cover (460 px) steht sofort da, es
 * ist schon geladen. Erst **mit dem Öffnen** — nie vorab — fordert die Ansicht das große Plakat an (TMDB, `srcset` mit 500 und 780 px
 * Breite; der Browser nimmt die kleinste Fassung, die für Fenster und Bildschirmdichte reicht). Bei Datensparmodus oder langsamer
 * Leitung gibt es nur die 500er. Das große Bild blendet sich über das kleine, sobald es da ist; fällt es aus, bleibt das kleine.
 * **Nur dasselbe Motiv** (08.10.2026, Ishura): TMDB wählt das größte Plakat, nicht unbedingt das AniList-Bild — vor dem Überblenden prüft
 * `cover-gleich.ts` per dHash, ob beide dasselbe zeigen; sonst bleibt das AniList-Cover (unscharf, aber dasselbe Bild wie im Panel).
 */
export const COVER_MAX_EREIGNIS = 'cover-maximieren'
const TMDB_BILD = 'https://image.tmdb.org/t/p'
/** Klick auf das Cover: öffnet die Ansicht, außer ein Bedienelement im Bild wurde getroffen. */
/** Beim Berühren oder Überfahren des Covers: Verbindung zum Bildserver schon aufbauen, damit das große Plakat nach dem Klick sofort fließt. */
let vorgewaermt = false
export function coverVorwaermen(): void {
  if (vorgewaermt) return
  vorgewaermt = true
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = 'https://image.tmdb.org'
  document.head.appendChild(link)
}
const ausserBedienelement = (e: { target: EventTarget }) => !(e.target as HTMLElement).closest('a,button,input,[role=button]')
export const beiCoverKlick = (e: { target: EventTarget }): void => {
  if (ausserBedienelement(e)) window.dispatchEvent(new CustomEvent(COVER_MAX_EREIGNIS, { detail: 'cover' }))
}
/** Klick auf das Banner: dieselbe Ansicht, aber mit dem Banner (ohne Banner fällt sie aufs Cover zurück). */
export const beiBannerKlick = (e: { target: EventTarget }): void => {
  if (ausserBedienelement(e)) window.dispatchEvent(new CustomEvent(COVER_MAX_EREIGNIS, { detail: 'banner' }))
}

/** Die Bildfassungen eines TMDB-Plakats; `gross` = [Pfad, Breite, Höhe]. */
function grossesBild(gross: [string, number, number]): { src: string; srcSet: string } {
  const leitung = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const knapp = Boolean(leitung?.saveData) || /^(slow-2g|2g|3g)$/.test(leitung?.effectiveType ?? '')
  const breiten = (knapp ? [500] : [500, 780]).filter((w) => w <= gross[1])
  if (!breiten.length) return { src: `${TMDB_BILD}/original${gross[0]}`, srcSet: '' }
  return {
    src: `${TMDB_BILD}/w${breiten[breiten.length - 1]}${gross[0]}`,
    srcSet: breiten.map((w) => `${TMDB_BILD}/w${w}${gross[0]} ${w}w`).join(', '),
  }
}

export function CoverMaximieren({ bild, banner, gross, titel }: { bild: string | undefined; banner?: string; gross?: [string, number, number]; titel: string }) {
  const [offen, setOffen] = useState(false)
  const [zeigtBanner, setZeigtBanner] = useState(false)
  /* „Zurück“ schließt erst die Ansicht, nicht das Panel dahinter (Daniel, 13.10.2026). */
  useVerlaufEintrag(offen, () => setOffen(false))
  const [kaputt, setKaputt] = useState(false)
  /* Das große Plakat nur, wenn es dasselbe Motiv ist wie das Cover im Panel (`cover-gleich.ts`). */
  const [gleich, setGleich] = useState(false)
  const grossPfad = gross?.[0]
  const schliessen = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!offen || !bild || !grossPfad) return
    let aktiv = true
    void gleichesBild(bild, grossPfad).then((g) => aktiv && setGleich(g))
    return () => {
      aktiv = false
    }
  }, [offen, bild, grossPfad])
  /* Fokus in die Ansicht holen und beim Schließen zurückgeben: Tastatur und Screenreader bleiben nicht hinter der Schicht hängen. */
  useEffect(() => {
    if (!offen) return
    const davor = document.activeElement as HTMLElement | null
    schliessen.current?.focus()
    return () => davor?.focus?.()
  }, [offen])
  useEscape(
    offen,
    (e) => {
      e.stopImmediatePropagation()
      setOffen(false)
    },
    { ziel: 'document', capture: true },
  )
  useEffect(() => {
    const auf = (e: Event) => {
      setZeigtBanner((e as CustomEvent<string>).detail === 'banner')
      setOffen(true)
    }
    window.addEventListener(COVER_MAX_EREIGNIS, auf)
    return () => window.removeEventListener(COVER_MAX_EREIGNIS, auf)
  }, [])
  /* Ein anderer Titel, ein anderes Bild: der Zustand des vorigen gilt nicht weiter. */
  useEffect(() => {
    setKaputt(false)
    setGleich(false)
  }, [grossPfad])
  const anzeige = zeigtBanner && banner ? banner : bild
  if (!anzeige || !offen) return null
  const gr = !zeigtBanner && gross && !kaputt && gleich ? grossesBild(gross) : undefined
  return <CoverSchicht key={grossPfad} bild={anzeige} label={zeigtBanner && banner ? 'Banner' : 'Cover'} titel={titel} gr={gr} schliessen={schliessen} onZu={() => setOffen(false)} onKaputt={() => setKaputt(true)} />
}

/** Die Schicht selbst: das Cover (klein, sofort) und darüber, sobald geladen, das große Plakat. */
function CoverSchicht({ bild, label, titel, gr, schliessen, onZu, onKaputt }: {
  bild: string
  label: string
  titel: string
  gr: { src: string; srcSet: string } | undefined
  schliessen: RefObject<HTMLButtonElement | null>
  onZu: () => void
  onKaputt: () => void
}) {
  /* Gehört zur geöffneten Schicht: jedes Öffnen beginnt ohne „geladen“, sonst bliebe das Basisbild (Banner!) unsichtbar. */
  const [geladen, setGeladen] = useState(false)
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label}: ${titel}`}
      onClick={(e) => { e.stopPropagation(); onZu() }}
      className="fixed inset-0 z-[80] grid cursor-zoom-out place-items-center bg-black/90 p-3"
    >
      <img src={bild} alt={titel} className={`[grid-area:1/1] max-h-full max-w-full object-contain transition-opacity ${geladen ? 'opacity-0' : ''}`} />
      <button
        ref={schliessen}
        type="button"
        aria-label="Schließen"
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-xl text-white hover:bg-black/80"
      >
        ✕
      </button>
      {gr && (
        <img
          src={gr.src}
          srcSet={gr.srcSet || undefined}
          sizes="min(100vw, 66vh)"
          alt=""
          decoding="async"
          onLoad={() => setGeladen(true)}
          onError={onKaputt}
          className={`[grid-area:1/1] max-h-full max-w-full object-contain transition-opacity ${geladen ? '' : 'opacity-0'}`}
        />
      )}
    </div>,
    document.body,
  )
}
