import type { Release, Title } from '../../shared/types.ts'

/**
 * Joyn-Block-Termine, die den eigenen Joyn-Fenstern des Titels widersprechen: ein automatischer, geschätzter `batch`
 * („alle Folgen seit Tag X“), obwohl `streams[].fenster` Folge für Folge Zeiten trägt (Yaiba, 09.11.2026: Block 08.11.,
 * Fenster ab 05.11. je 18:50). Abhilfe ist ein Handtermin (`data/curated/`), der den automatischen ersetzt.
 */
export function joynBlockTrotzFenster(releases: Release[], titles: Title[]): Release[] {
  const mitFenster = new Set(
    titles.filter((t) => t.streams?.some((s) => s.platform === 'joyn' && (s.fenster?.length ?? 0) > 0)).map((t) => t.id),
  )
  return releases.filter(
    (r) => r.platform === 'joyn' && r.automatisch && r.releaseType === 'batch' && r.schedule?.estimated && mitFenster.has(r.titleId),
  )
}
