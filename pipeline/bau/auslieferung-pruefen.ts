import { readJson } from '../lib/util.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { reihenVerweiseAufgeloest, synchroNichtHinterToggle } from '../lib/invarianten-auslieferung.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { OUT } from './grundlagen.ts'
import { ohneSynchroVonHand } from './ohne-beleg.ts'

/** D-06 und D-15 an den geschriebenen Dateien (`lib/invarianten-auslieferung.ts`): Fehlermeldungen, leer heißt in Ordnung. */
export function auslieferungsInvarianten(): string[] {
  const lies = <T>(datei: string, leer: T): T => readJson<T>(`${OUT}/${datei}`, leer)
  const auslieferung = {
    titles: lies<Title[]>('titles.json', []),
    ohneSynchro: lies<Title[]>('ohne-synchro.json', []),
    cartoons: lies<Title[]>('cartoons.json', []),
    franchises: lies<Record<string, { id: number; name: string }[]>>('franchises.json', {}),
  }
  /* `nichtImBestand` ist ein bewusst nicht geführter Titel (Amazon-Kanal-Angabe ohne Beleg): kein Handbeleg für den Bestand. */
  const handbelegteIds = new Set(loadDubChecks().filter((c) => c.dub === true && !c.nichtImBestand).map((c) => c.anilistId))
  return [
    ...synchroNichtHinterToggle(auslieferung, {
      dubsAnilist: readJson<Record<string, string>>('data/anisearch-dubs.json', {}),
      dubIds: readJson<Record<string, string>>('data/anisearch-dub-ids.json', {}),
      handbelegteIds,
      handKeine: ohneSynchroVonHand(),
      heute: todayIso(),
    }),
    ...reihenVerweiseAufgeloest(auslieferung),
  ]
}
