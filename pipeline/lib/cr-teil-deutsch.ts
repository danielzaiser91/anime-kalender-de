import type { Title } from '../../shared/types.ts'
import { beurteile, deutscheFolgenNachDemEnde, kapitelImBlock, type CrSerie, type Urteil } from './crunchyroll-dub.ts'

/** Ein Urteil, das bei teils deutschem Block die belegten Folgen mitbringt (`dubRanges` am Verweis). */
export type UrteilMitBereichen = Urteil & { dubRanges?: { from: number; to: number; dub: boolean }[] }

const deutschIn = (b: NonNullable<CrSerie['staffeln']>[number]): number => b.deutscheFolgen?.length ?? b.deutsch ?? 0

/**
 * **Ein Block mit einzelnen fremden Folgen kippt das Urteil nicht** (16.11.2026, Demon Slayer, Issue 4047).
 *
 * Staffel 1 steht dort bei deutsch 24 von 26; die Zahl 26 galt deshalb als „auch an einem nicht ganz deutschen Block“ und die
 * Reihenrechnung in `beurteile` ließ den Titel offen — nach dem Bau trug der Verweis weder `dub` noch Bereiche.
 *
 * Gilt nur, wenn **jeder** Block der Serie deutsche Folgen führt und mindestens einer nicht vollständig deutsch ist (vollständig deutsch regelt `beurteile`).
 * Serie: genau ein Block mit unserer Folgenzahl, nur ein Titel dieser Länge, Block teils deutsch (ganz deutsche Blöcke regeln die übrigen Runden); dann tragen die belegten Nummern die Bereiche (`dubRanges`), nichts wird ergänzt.
 * Film: ein Block ohne Namensbezug kann ihn nicht beziffern; wie bei ganz deutschen Serien genügt, dass jeder Block Deutsch führt (außer Kapitelfilme, die `kapitelImBlock` entscheidet).
 */
function beurteileTeilDeutsch(serie: CrSerie, unsere: Title[]): UrteilMitBereichen[] {
  const bloecke = serie.staffeln ?? []
  if (!serie.deutschImAngebot || !bloecke.length || bloecke.some((b) => deutschIn(b) === 0)) return []
  if (!bloecke.some((b) => b.folgen > 0 && b.deutsch < b.folgen)) return []

  const urteile: UrteilMitBereichen[] = []
  for (const t of unsere) {
    if (deutscheFolgenNachDemEnde(bloecke, t.episodes)) continue
    if (t.format === 'MOVIE') {
      if (kapitelImBlock(serie, t) !== undefined) continue
      urteile.push({ titleId: t.id, dub: true, grund: `jeder der ${bloecke.length} Blöcke führt deutsche Folgen` })
      continue
    }
    const treffer = bloecke.filter((b) => b.folgen === (t.episodes ?? 0))
    if (treffer.length !== 1 || treffer[0]!.deutsch === treffer[0]!.folgen) continue
    if (unsere.filter((u) => u.episodes === t.episodes && u.format !== 'MOVIE').length !== 1) continue
    const block = treffer[0]!
    const nummern = [...new Set((block.deutscheFolgen ?? []).map((f) => Number(f.nummer)).filter((n) => Number.isInteger(n) && n >= 1))].sort((a, b) => a - b)
    if (nummern.length !== block.deutsch || nummern[nummern.length - 1]! > block.folgen) continue
    const dubRanges: { from: number; to: number; dub: boolean }[] = []
    for (const n of nummern) {
      const letzter = dubRanges[dubRanges.length - 1]
      if (letzter && n === letzter.to + 1) letzter.to = n
      else dubRanges.push({ from: n, to: n, dub: true })
    }
    urteile.push({ titleId: t.id, dub: true, dubRanges, grund: `„${block.name}“: ${block.deutsch} von ${block.folgen} Folgen deutsch, einzige Staffel mit ${block.folgen} Folgen` })
  }
  return urteile
}

/** `beurteile` plus die Teil-Deutsch-Urteile für alles, was die Reihenrechnung offen ließ. */
export function beurteileMitTeilDeutsch(serie: CrSerie, unsere: Title[]): UrteilMitBereichen[] {
  const basis: UrteilMitBereichen[] = beurteile(serie, unsere)
  const bekannt = new Set(basis.map((u) => u.titleId))
  return [...basis, ...beurteileTeilDeutsch(serie, unsere).filter((u) => !bekannt.has(u.titleId))]
}
