import { useEffect, useState } from 'react'
import { loadJson } from '../../lib/data.ts'

/**
 * **Die Folgenliste im Antwortkasten** (Daniel, 04.10.2026): Ein Pfeil klappt sie auf, der Kasten wächst mit,
 * höchstens 16 rem hoch und mit Bildlauf. Ab 50 Folgen gibt es Reiter in 50er-Paketen („1–50", „51–100" …), damit
 * One Piece nicht als eine Wand dasteht. Jede Folge steht in einer Zeile: Nummer, Titel, Minuten.
 *
 * Die Daten kommen nachgeladen aus `public/data/folgen/<AniList-ID>.json` (`pipeline/bau/folgen-dateien.ts`);
 * den Pfeil gibt es nur, wo eine Datei existiert (Verzeichnis `index.json`).
 */
type Folge = [nr: number, minuten: number, titel: string]

const PAKET = 50
let verzeichnis: Promise<Set<number>> | undefined
const holeVerzeichnis = (): Promise<Set<number>> => (verzeichnis ??= loadJson<number[]>('folgen/index.json').then((l) => new Set(l)).catch(() => new Set<number>()))

export function FolgenBereich({ titleId }: { titleId: number }) {
  const [gibtEs, setGibtEs] = useState(false)
  const [offen, setOffen] = useState(false)
  const [folgen, setFolgen] = useState<Folge[]>()
  const [paket, setPaket] = useState(0)
  useEffect(() => {
    let aktiv = true
    setGibtEs(false)
    setOffen(false)
    setFolgen(undefined)
    setPaket(0)
    void holeVerzeichnis().then((s) => aktiv && setGibtEs(s.has(titleId)))
    return () => {
      aktiv = false
    }
  }, [titleId])
  useEffect(() => {
    if (!offen || folgen) return
    let aktiv = true
    void loadJson<Folge[]>(`folgen/${titleId}.json`).then((f) => aktiv && setFolgen(f)).catch(() => aktiv && setFolgen([]))
    return () => {
      aktiv = false
    }
  }, [offen, folgen, titleId])
  if (!gibtEs) return null
  const pakete = folgen ? Math.ceil(folgen.length / PAKET) : 0
  const sichtbar = folgen?.slice(paket * PAKET, paket * PAKET + PAKET) ?? []
  return (
    <div className="mt-2 border-t border-white/10 pt-1.5 text-xs text-slate-200">
      <button type="button" onClick={() => setOffen((o) => !o)} aria-expanded={offen} className="flex w-full cursor-pointer items-center gap-1.5 py-0.5 text-left font-semibold">
        <span aria-hidden className={`inline-block transition-transform ${offen ? 'rotate-90' : ''}`}>▸</span>
        Folgen{folgen ? ` (${folgen.length})` : ''}
      </button>
      {offen && (
        <div>
          {pakete > 1 && (
            <div role="tablist" className="mb-1 flex flex-wrap gap-1">
              {Array.from({ length: pakete }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === paket}
                  onClick={() => setPaket(i)}
                  className={`cursor-pointer rounded px-1.5 py-0.5 tabular-nums ${i === paket ? 'bg-white/20 font-bold' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                >
                  {i * PAKET + 1}–{Math.min((i + 1) * PAKET, folgen!.length)}
                </button>
              ))}
            </div>
          )}
          <ul className="max-h-64 overflow-y-auto pr-1">
            {!folgen && <li className="text-slate-400">Lädt …</li>}
            {folgen && !folgen.length && <li className="text-slate-400">Keine Folgentitel bekannt.</li>}
            {sichtbar.map(([nr, min, titel]) => (
              <li key={nr} className="flex items-baseline gap-2 py-px">
                <span className="w-9 shrink-0 text-right tabular-nums text-slate-400">{nr}</span>
                <span className="min-w-0 flex-1 truncate" title={titel}>{titel || '—'}</span>
                {min > 0 && <span className="shrink-0 tabular-nums text-slate-400">{min} Min.</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
