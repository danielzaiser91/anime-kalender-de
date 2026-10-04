import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NewsBeleg } from '@shared/types.ts'
import { hostVon } from '@shared/quelle.ts'
import { datumKurz } from '../lib/news-text.ts'

/** **Das Beleg-Bild** an einer Quelle; öffentlich lesbar (Daniel, 04.10.2026). */
const WORKER = import.meta.env.VITE_NEWSLETTER_API ?? ''
export function BelegKnopf({ beleg, titel }: { beleg?: NewsBeleg; titel: string }) {
  const [offen, setOffen] = useState(false)
  if (!beleg?.bild || !WORKER) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        title={`Beleg ansehen: ${titel}`}
        aria-label={`Beleg ansehen: ${titel}`}
        className="shrink-0 cursor-pointer rounded border border-current px-1 text-[10px] leading-4 opacity-80 hover:opacity-100"
      >
        ▣ Beleg
      </button>
      {offen && <BelegDialog beleg={beleg} titel={titel} zu={() => setOffen(false)} />}
    </>
  )
}

/** Was das Bild zeigt, in einem Satz — mit dem Tag, an dem die Quelle es sagte oder wir nachgesehen haben. */
function erklaerung(b: NewsBeleg): string {
  if (b.gemessenAm) return `Unsere Messung vom ${datumKurz(b.gemessenAm)}: So sah ${b.name} an diesem Tag aus.`
  if (b.ausgabeAm) return `Produktseite bei ${b.name}; die Ausgabe erscheint am ${datumKurz(b.ausgabeAm)}.`
  const wann = b.veroeffentlichtAm ? `, veröffentlicht am ${datumKurz(b.veroeffentlichtAm)}` : ''
  const spaeter = b.aktualisiertAm && b.aktualisiertAm !== b.veroeffentlichtAm ? `, aktualisiert am ${datumKurz(b.aktualisiertAm)}` : ''
  return `Quelle: ${b.name}${wann}${spaeter}.`
}

function BelegDialog({ beleg, titel, zu }: { beleg: NewsBeleg; titel: string; zu: () => void }) {
  const bild = beleg.bild!
  const [url, setUrl] = useState<string>()
  const [fehler, setFehler] = useState<string>()
  const [einpassen, setEinpassen] = useState(false)
  const [markiert, setMarkiert] = useState(false)
  const marke = useRef<HTMLDivElement>(null)
  const [x, y, b, h] = beleg.markierung ?? []
  useEffect(() => {
    let aktiv = true
    let blobUrl: string | undefined
    fetch(`${WORKER}/beleg?key=${encodeURIComponent(bild)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Bild nicht gefunden' : `Fehler ${r.status}`)
        blobUrl = URL.createObjectURL(await r.blob())
        if (aktiv) setUrl(blobUrl)
      })
      .catch((e: Error) => aktiv && setFehler(e.message))
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && zu()
    document.addEventListener('keydown', esc)
    /* Hinter dem Dialog bleibt die Seite stehen — und ihre Bildlaufleiste verschwindet (Daniel, 04.10.2026). */
    const vorher = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      aktiv = false
      document.removeEventListener('keydown', esc)
      document.documentElement.style.overflow = vorher
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [bild, zu])
  const zurFundstelle = () => {
    setEinpassen(false)
    setMarkiert(true)
    /* Erst nach dem Umschalten auf volle Breite liegt die Marke an ihrem Platz. */
    window.setTimeout(() => marke.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
  }
  const btn = 'cursor-pointer rounded border border-slate-600 px-2.5 py-1 text-xs hover:bg-white/10'
  /*
    **Der Dialog füllt den ganzen Bildschirm** (Daniel, 04.10.2026) und hängt am `<body>`: Im Detail-Panel (transformiert) bezog
    sich `fixed` auf das Panel, und das Bild stand in dessen schmaler Spalte. Standard ist die volle Breite mit Bildlauf — ein
    Beleg ist oft eine lange Seite —, „Einpassen" zeigt ihn ganz im Fenster.
  */
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Beleg: ${titel}`} className="fixed inset-0 z-[60] flex flex-col bg-black/90 text-slate-200" onClick={zu}>
      <div className="shrink-0 border-b border-white/10 bg-slate-900 px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 text-sm">
          <b className="min-w-0 flex-1 truncate">Beleg: {titel}</b>
          {x !== undefined && (
            <button type="button" onClick={zurFundstelle} className={`${btn} border-rose-400 text-rose-200`}>
              Zur Fundstelle
            </button>
          )}
          <button type="button" onClick={() => setEinpassen((e) => !e)} aria-pressed={einpassen} className={btn}>
            {einpassen ? 'Volle Breite' : 'Einpassen'}
          </button>
          <button type="button" onClick={zu} className={btn}>Schließen</button>
        </div>
        <p className="mt-1 text-xs leading-snug text-slate-300">
          {erklaerung(beleg)} Wir sichern von jeder Quelle ein Bild, damit prüfbar bleibt, worauf die Meldung beruht.{' '}
          <a href={beleg.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-300 underline decoration-dotted underline-offset-2">
            Originalseite bei {hostVon(beleg.url)} ↗
          </a>
        </p>
      </div>
      <div className={`min-h-0 flex-1 ${einpassen ? 'flex items-center justify-center p-3 md:p-6' : 'overflow-auto p-3 md:p-6'}`} onClick={zu}>
        {fehler ? (
          <p className="p-4 text-sm text-rose-300">{fehler}</p>
        ) : url ? (
          <div className={einpassen ? 'relative max-h-full max-w-full' : 'relative mx-auto w-full max-w-[1800px]'} onClick={(e) => e.stopPropagation()}>
            <img src={url} alt={`Beleg: ${titel}`} className={einpassen ? 'max-h-full max-w-full rounded object-contain' : 'block w-full rounded'} />
            {markiert && x !== undefined && (
              <div
                ref={marke}
                aria-label="Fundstelle"
                className="pointer-events-none absolute rounded border-[3px] border-rose-500 bg-rose-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{ left: `${x * 100}%`, top: `${(y ?? 0) * 100}%`, width: `${(b ?? 0) * 100}%`, height: `${(h ?? 0) * 100}%` }}
              />
            )}
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-400">Lädt …</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
