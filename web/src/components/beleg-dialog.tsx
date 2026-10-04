import { useEffect, useState } from 'react'

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
  return (
    <div role="dialog" aria-modal="true" aria-label={`Beleg: ${titel}`} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3" onClick={zu}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-xl bg-slate-900 p-3 text-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2 text-sm">
          <b className="min-w-0 flex-1 truncate">Beleg: {titel}</b>
          <button type="button" onClick={zu} className="cursor-pointer rounded border border-slate-600 px-2 py-0.5 text-xs">Schließen</button>
        </div>
        {fehler ? <p className="text-sm text-rose-300">{fehler}</p> : url ? <img src={url} alt={`Beleg: ${titel}`} className="w-full rounded" /> : <p className="text-sm text-slate-400">Lädt …</p>}
      </div>
    </div>
  )
}
