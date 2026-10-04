import { useEffect, useState } from 'react'
import { loadJson } from '../../lib/data.ts'
import { Tooltip } from '../ui.tsx'

/**
 * **Die Folgenliste im Antwortkasten** (Daniel, 04.10.2026): Ein Pfeil klappt sie auf, der Kasten wächst mit,
 * höchstens 16 rem hoch und mit Bildlauf. Ab 50 Folgen gibt es Reiter in 50er-Paketen („1–50", „51–100" …), damit
 * One Piece nicht als eine Wand dasteht. Jede Folge steht in einer Zeile: Nummer, Titel, und die deutsche Flagge,
 * wo für diese Folge eine Synchro belegt ist. Die Minuten stehen einmal am Kopf („~24 Min. je Folge"), solange alle
 * Folgen gleich lang sind; sonst je Zeile.
 *
 * Die Daten kommen nachgeladen aus `public/data/folgen/<AniList-ID>.json` (`pipeline/bau/folgen-dateien.ts`);
 * den Pfeil gibt es nur, wo eine Datei existiert (Verzeichnis `index.json`).
 */
type Folge = [nr: number, titel: string, minuten?: number]
interface Liste {
  f: Folge[]
  de: [number, number][]
  min?: number
  h?: [number, string][]
}

const PAKET = 50
let verzeichnis: Promise<Set<number>> | undefined
const holeVerzeichnis = (): Promise<Set<number>> => (verzeichnis ??= loadJson<number[]>('folgen/index.json').then((l) => new Set(l)).catch(() => new Set<number>()))

let zaehlungen: Promise<Record<string, [number, number]>> | undefined
/** `[alle Folgen, Folgen mit deutscher Synchro]` aus `folgen/zaehlung.json` — für die Überschrift, wo AniList keine Folgenzahl führt. */
export function useFolgenZaehlung(titleId: number): [number, number] | undefined {
  const [z, setZ] = useState<[number, number]>()
  useEffect(() => {
    let aktiv = true
    setZ(undefined)
    void (zaehlungen ??= loadJson<Record<string, [number, number]>>('folgen/zaehlung.json').catch(() => ({} as Record<string, [number, number]>))).then((m) => aktiv && setZ(m[String(titleId)]))
    return () => {
      aktiv = false
    }
  }, [titleId])
  return z
}

export function FolgenBereich({ titleId }: { titleId: number }) {
  const [gibtEs, setGibtEs] = useState(false)
  const [offen, setOffen] = useState(false)
  const [liste, setListe] = useState<Liste>()
  const [paket, setPaket] = useState(0)
  useEffect(() => {
    let aktiv = true
    setGibtEs(false)
    setOffen(false)
    setListe(undefined)
    setPaket(0)
    void holeVerzeichnis().then((s) => aktiv && setGibtEs(s.has(titleId)))
    return () => {
      aktiv = false
    }
  }, [titleId])
  useEffect(() => {
    if (!offen || liste) return
    let aktiv = true
    void loadJson<Liste>(`folgen/${titleId}.json`).then((l) => aktiv && setListe(l)).catch(() => aktiv && setListe({ f: [], de: [] }))
    return () => {
      aktiv = false
    }
  }, [offen, liste, titleId])
  if (!gibtEs) return null
  const folgen = liste?.f
  const pakete = folgen ? Math.ceil(folgen.length / PAKET) : 0
  const sichtbar = folgen?.slice(paket * PAKET, paket * PAKET + PAKET) ?? []
  const deutsch = (nr: number) => liste?.de.some(([von, bis]) => nr >= von && nr <= bis) ?? false
  return (
    <div className="mt-2 border-t border-slate-300 pt-1.5 text-xs text-slate-700 dark:border-white/10 dark:text-slate-200">
      <button type="button" onClick={() => setOffen((o) => !o)} aria-expanded={offen} className="flex w-full cursor-pointer items-center gap-1.5 py-0.5 text-left font-semibold">
        <span aria-hidden className={`inline-block transition-transform ${offen ? 'rotate-90' : ''}`}>▸</span>
        Folgen{folgen ? ` (${folgen.length})` : ''}
        {liste?.min ? <span className="font-normal text-slate-500 dark:text-slate-400">· ~{liste.min} Min. je Folge</span> : null}
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
                  className={`cursor-pointer rounded px-1.5 py-0.5 tabular-nums ${i === paket ? 'bg-slate-300 font-bold dark:bg-white/20' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'}`}
                >
                  {i * PAKET + 1}–{Math.min((i + 1) * PAKET, folgen!.length)}
                </button>
              ))}
            </div>
          )}
          <ul className="max-h-64 overflow-y-auto pr-1">
            {!folgen && <li className="text-slate-500 dark:text-slate-400">Lädt …</li>}
            {folgen && !folgen.length && <li className="text-slate-500 dark:text-slate-400">Keine Folgentitel bekannt.</li>}
            {sichtbar.map(([nr, titel, min]) => (
              <li key={nr} className="flex items-baseline gap-2 py-px">
                <span className="w-9 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">{nr}</span>
                <span className="min-w-0 flex-1 truncate">{titel || '—'}</span>
                {min ? <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{min} Min.</span> : null}
                {deutsch(nr) ? <DeFlagge /> : <FolgeOhneFlagge hinweis={liste?.h?.find(([n]) => n === nr)?.[1]} gibtDeutsche={Boolean(liste?.de.length)} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Die deutsche Flagge als drei Streifen — Emoji-Flaggen zeigt Windows nur als „DE". */
function DeFlagge() {
  return (
    <Tooltip text="Für diese Folge existiert eine Deutsche Synchro." eigenerFokus>
      <span role="img" aria-label="Deutsche Synchro" className="inline-block h-2.5 w-4 shrink-0 rounded-[2px]" style={{ background: 'linear-gradient(#000 33.3%, #d00 33.3% 66.6%, #ffce00 66.6%)' }} />
    </Tooltip>
  )
}

/** Die Lücke in der Flaggenreihe: ✕ mit dem Hinweistext, wo belegt ist, dass es keine Synchro gibt; sonst ein „?". */
function FolgeOhneFlagge({ hinweis, gibtDeutsche }: { hinweis?: string; gibtDeutsche: boolean }) {
  if (!hinweis && !gibtDeutsche) return null
  const marke = 'inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold leading-none'
  return (
    <Tooltip text={hinweis ?? 'Für diese Folge ist keine deutsche Synchro belegt.'} eigenerFokus>
      <span
        role="img"
        aria-label={hinweis ?? 'Keine deutsche Synchro belegt'}
        className={`${marke} ${hinweis ? 'border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-300' : 'border-slate-400 text-slate-500 dark:border-slate-500 dark:text-slate-400'}`}
      >
        {hinweis ? '✕' : '?'}
      </span>
    </Tooltip>
  )
}
