import type { NewsBeleg } from '@shared/types.ts'

/** Crunchyrolls News-Rubriken aus dem Pfad — „Crunchyroll News" dreimal sagte nicht, was dahinter steht. */
const RUBRIKEN: Record<string, string> = { 'seasonal-lineup': 'Season-Lineup', latest: 'News' }

/** Anzeigename eines Belegs: bei Crunchyroll-News die Rubrik aus dem Pfad (der Verlag steht im Tooltip), sonst der Verlag. */
export function quellenLabel(b: NewsBeleg): string {
  const rubrik = /crunchyroll\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?news\/([a-z-]+)\//i.exec(b.url)?.[1]
  if (!rubrik) return b.name
  return RUBRIKEN[rubrik] ?? rubrik.replace(/-/g, ' ')
}
