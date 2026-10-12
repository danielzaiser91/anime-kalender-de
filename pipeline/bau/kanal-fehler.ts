import { todayIso } from '../../shared/time.ts'
import type { Release, Title } from '../../shared/types.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { kanalTitelOhneBeleg, kanalWegEntfernt } from '../lib/invarianten-kanal.ts'
import { kanalAdressenOhneAussage, kanalAdressenOhneBeleg } from '../lib/kanal-titel.ts'
import { readJson } from '../lib/util.ts'
import { terminBelegtNichts } from './09-1-belege.ts'
import { deutschLautAnisearch } from './ohne-beleg.ts'

/**
 * D-25 und D-26 (`lib/invarianten-kanal.ts`) an der Auslieferung. Als andere Quelle für D-25 gelten ein Termin bei Prime, der etwas belegt,
 * und aniSearch „deutsch“. D-26 liest `data/verweise-entfernt.json`, die der Bau vor dieser Prüfung geschrieben hat (13-2 vor 13-5).
 */
export function kanalFehler(titles: Iterable<Title>, releases: Release[]): string[] {
  const heute = todayIso()
  const mitTermin = new Set(releases.filter((r) => r.platform === 'primevideo' && !terminBelegtNichts(r, heute)).map((r) => r.titleId))
  const checks = loadDubChecks()
  const entfernt = readJson<{ verweise?: { titleId: number; plattform: string; url: string; grund?: string }[] }>('data/verweise-entfernt.json', {}).verweise ?? []
  return [
    ...kanalTitelOhneBeleg(titles, kanalAdressenOhneBeleg(checks), (t) => mitTermin.has(t.id) || deutschLautAnisearch(t)),
    ...kanalWegEntfernt(entfernt, kanalAdressenOhneAussage(checks)),
  ]
}
