import { todayIso } from '../../shared/time.ts'
import type { Release, Title } from '../../shared/types.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { kanalTitelOhneBeleg } from '../lib/invarianten-kanal.ts'
import { kanalAdressenOhneBeleg } from '../lib/kanal-titel.ts'
import { terminBelegtNichts } from './09-1-belege.ts'
import { deutschLautAnisearch } from './ohne-beleg.ts'

/** D-25 (`lib/invarianten-kanal.ts`) an der Auslieferung: als andere Quelle gelten ein Termin bei Prime, der etwas belegt, und aniSearch „deutsch“. */
export function kanalFehler(titles: Iterable<Title>, releases: Release[]): string[] {
  const heute = todayIso()
  const mitTermin = new Set(releases.filter((r) => r.platform === 'primevideo' && !terminBelegtNichts(r, heute)).map((r) => r.titleId))
  return kanalTitelOhneBeleg(titles, kanalAdressenOhneBeleg(loadDubChecks()), (t) => mitTermin.has(t.id) || deutschLautAnisearch(t))
}
