import type { Title } from '../../shared/types.ts'
import { beurteile, deutscheFolgenNachDemEnde, kapitelImBlock, type CrSerie, type Urteil } from './crunchyroll-dub.ts'

/** Ein Urteil, das bei teils deutschem Block die belegten Folgen mitbringt (`dubRanges` am Verweis). */
export type UrteilMitBereichen = Urteil & { dubRanges?: { from: number; to: number; dub: boolean }[] }

const deutschIn = (b: NonNullable<CrSerie['staffeln']>[number]): number => b.deutscheFolgen?.length ?? b.deutsch ?? 0

const kurz = (t: string | null | undefined): string => (t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Der Block, dessen unterscheidender Name im Namen des Films steckt: Der gemeinsame Wortanfang aller Blöcke („Demon Slayer: Kimetsu no Yaiba“)
 * und ein „Arc“ am Ende fallen weg, übrig bleibt „Mugen Train“. Genau ein Treffer von mindestens 6 Zeichen und Deutsch im Block, sonst `undefined`.
 */
function blockDesFilms(bloecke: NonNullable<CrSerie['staffeln']>, film: Title): NonNullable<CrSerie['staffeln']>[number] | undefined {
  if (bloecke.length < 2) return undefined
  const woerter = bloecke.map((b) => (b.name ?? '').split(/\s+/))
  let gemeinsam = 0
  while (woerter.every((w) => w[gemeinsam] !== undefined && w[gemeinsam] === woerter[0]![gemeinsam])) gemeinsam++
  const namen = [film.titleRomaji, film.titleEn, film.titleDe].map(kurz)
  const treffer = bloecke.filter((_, i) => {
    const rest = woerter[i]!.slice(gemeinsam)
    if (rest[rest.length - 1]?.toLowerCase() === 'arc') rest.pop()
    const unterscheidend = kurz(rest.join(' '))
    return unterscheidend.length >= 6 && namen.some((n) => n.includes(unterscheidend))
  })
  return treffer.length === 1 && deutschIn(treffer[0]!) > 0 ? treffer[0] : undefined
}

/**
 * **Ein Block mit einzelnen fremden Folgen kippt das Urteil nicht** (16.11.2026, Demon Slayer, Issue 4047).
 *
 * Staffel 1 steht dort bei deutsch 24 von 26; die Zahl 26 galt deshalb als „auch an einem nicht ganz deutschen Block“ und die
 * Reihenrechnung in `beurteile` ließ den Titel offen — nach dem Bau trug der Verweis weder `dub` noch Bereiche.
 *
 * Gilt nur, wenn **jeder** Block der Serie deutsche Folgen führt und mindestens einer nicht vollständig deutsch ist (vollständig deutsch regelt `beurteile`).
 * Serie: genau ein Block mit unserer Folgenzahl, nur ein Titel dieser Länge, Block teils deutsch (ganz deutsche Blöcke regeln die übrigen Runden); dann tragen die belegten Nummern die Bereiche (`dubRanges`), nichts wird ergänzt.
 * Film: nur, wenn genau ein Block ihm über den unterscheidenden Namensteil zugeordnet ist (`blockDesFilms`); sonst offen (Abnahme PR 4054, Crown Handler Chapter 5).
 */
function beurteileTeilDeutsch(serie: CrSerie, unsere: Title[]): UrteilMitBereichen[] {
  const bloecke = serie.staffeln ?? []
  if (!serie.deutschImAngebot || !bloecke.length || bloecke.some((b) => deutschIn(b) === 0)) return []
  if (!bloecke.some((b) => b.folgen > 0 && b.deutsch < b.folgen)) return []

  const urteile: UrteilMitBereichen[] = []
  for (const t of unsere) {
    if (t.format === 'MOVIE') {
      if (kapitelImBlock(serie, t) !== undefined) continue
      const filmBlock = blockDesFilms(bloecke, t)
      if (filmBlock) urteile.push({ titleId: t.id, dub: true, grund: `Block „${filmBlock.name}“ trägt den Namen des Films und führt deutsche Folgen` })
      continue
    }
    const treffer = bloecke.filter((b) => b.folgen === (t.episodes ?? 0))
    if (treffer.length !== 1 || treffer[0]!.deutsch === treffer[0]!.folgen) continue
    if (unsere.filter((u) => u.episodes === t.episodes && u.format !== 'MOVIE').length !== 1) continue
    const block = treffer[0]!
    if (deutscheFolgenNachDemEnde([block], t.episodes)) continue
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
