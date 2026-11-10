/**
 * **Haupttitel ohne Streaming-Weg: die Zahl darf nur sinken** (Daniel, 06.11.2026: „Miraculous World: New York“ zeigte nichts, obwohl vier Dienste ihn führen).
 * `data/streaming-luecke-stand.json` hält die Kennungen des Standes; jede Kennung außerhalb davon ist neu. Verglichen werden Kennungen, nicht die Zahl:
 * Eine sinkende Zahl verdeckt neue Verluste.
 * Lehre: Die Kennzahl `hauptOhneJedenWeg` stand seit 11.10.2026 in `tools/datenqualitaet-messen.mjs`, aber ohne Schwelle und ohne Lauf; 325 Titel ohne jeden
 * Weg galten über Wochen als Normalzustand (`docs/wissen/quellen.md`, „Streaming-Lücke“).
 */
import type { Title } from '../../shared/types.ts'

export interface LueckenStand {
  stand: string
  /** Kein Stream, kein Bezugsweg und keine Ausgabe in `releases.json` (Definition von `hauptOhneJedenWeg`). */
  ohneJedenWeg: number[]
  /** Kein Stream und kein Bezugsweg der Art `stream` (Disc-Links und Händler zählen nicht). */
  ohneStreamingWeg: number[]
}

type TitelKurz = Pick<Title, 'id' | 'streams' | 'watchLinks'>

/** Die Kennungen, denen heute ein Weg fehlt. */
export function streamingLuecke(titles: TitelKurz[], releaseTitelIds: ReadonlySet<number>): { ohneJedenWeg: number[]; ohneStreamingWeg: number[] } {
  const ohneStreamingWeg = titles.filter((t) => !t.streams?.length && !(t.watchLinks ?? []).some((w) => w.kind === 'stream'))
  return {
    ohneStreamingWeg: ohneStreamingWeg.map((t) => t.id),
    ohneJedenWeg: ohneStreamingWeg.filter((t) => !t.watchLinks?.length && !releaseTitelIds.has(t.id)).map((t) => t.id),
  }
}

export interface LueckenBilanz {
  neuOhneJedenWeg: number[]
  neuOhneStreamingWeg: number[]
  /** Kennungen des Standes, die inzwischen einen Weg haben (Liste darf gekürzt werden). */
  erledigt: number
}

export function lueckenBilanz(ist: ReturnType<typeof streamingLuecke>, stand: LueckenStand): LueckenBilanz {
  const jeden = new Set(stand.ohneJedenWeg)
  const streaming = new Set(stand.ohneStreamingWeg)
  const istJeden = new Set(ist.ohneJedenWeg)
  const istStreaming = new Set(ist.ohneStreamingWeg)
  return {
    neuOhneJedenWeg: ist.ohneJedenWeg.filter((id) => !jeden.has(id)),
    neuOhneStreamingWeg: ist.ohneStreamingWeg.filter((id) => !streaming.has(id)),
    erledigt: stand.ohneJedenWeg.filter((id) => !istJeden.has(id)).length + stand.ohneStreamingWeg.filter((id) => !istStreaming.has(id)).length,
  }
}
