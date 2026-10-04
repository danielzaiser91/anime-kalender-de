import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** **Das Beleg-Bild** an einer Quelle; öffentlich lesbar (Daniel, 04.10.2026). */
const WORKER = import.meta.env.VITE_NEWSLETTER_API ?? ''
export function BelegKnopf({ bild, titel }: { bild?: string; titel: string }) {
  const [offen, setOffen] = useState(false)
  if (!bild || !WORKER) return null
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
      {offen && <BelegDialog bild={bild} titel={titel} zu={() => setOffen(false)} />}
    </>
  )
}

function BelegDialog({ bild, titel, zu }: { bild: string; titel: string; zu: () => void }) {
  const [url, setUrl] = useState<string>()
  const [fehler, setFehler] = useState<string>()
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
    return () => {
      aktiv = false
      document.removeEventListener('keydown', esc)
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [bild, zu])
  const [einpassen, setEinpassen] = useState(false)
  /*
    **Der Dialog füllt den ganzen Bildschirm** (Daniel, 04.10.2026) und hängt am `<body>`: Im Detail-Panel (transformiert) bezog
    sich `fixed` auf das Panel, und das Bild stand in dessen schmaler Spalte. Standard ist die volle Breite mit Bildlauf — ein
    Beleg ist oft eine lange Seite —, „Einpassen" zeigt ihn ganz im Fenster.
  */
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Beleg: ${titel}`} className="fixed inset-0 z-[60] flex flex-col bg-black/90 text-slate-200" onClick={zu}>
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-900 px-4 py-2 text-sm" onClick={(e) => e.stopPropagation()}>
        <b className="min-w-0 flex-1 truncate">Beleg: {titel}</b>
        <button type="button" onClick={() => setEinpassen((e) => !e)} aria-pressed={einpassen} className="cursor-pointer rounded border border-slate-600 px-2.5 py-1 text-xs hover:bg-white/10">
          {einpassen ? 'Volle Breite' : 'Einpassen'}
        </button>
        <button type="button" onClick={zu} className="cursor-pointer rounded border border-slate-600 px-2.5 py-1 text-xs hover:bg-white/10">Schließen</button>
      </div>
      <div className={`min-h-0 flex-1 ${einpassen ? 'flex items-center justify-center p-3' : 'overflow-auto'}`}>
        {fehler ? (
          <p className="p-4 text-sm text-rose-300">{fehler}</p>
        ) : url ? (
          <img
            src={url}
            alt={`Beleg: ${titel}`}
            onClick={(e) => e.stopPropagation()}
            className={einpassen ? 'max-h-full max-w-full rounded object-contain' : 'mx-auto block w-full max-w-[1800px]'}
          />
        ) : (
          <p className="p-4 text-sm text-slate-400">Lädt …</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
