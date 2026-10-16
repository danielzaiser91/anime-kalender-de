import type { Release, Title } from '../../shared/types.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { alleTermineGekennzeichnet } from '../lib/pruefung.ts'
import { log } from '../lib/util.ts'

/**
 * Ein Weg, dessen Termine **alle** eine Sprachkennzeichnung tragen (`sprache`: omu/offen), trägt kein „deutsch" aus einer bloßen Rohmeldung:
 * Amazon führt auf einem Kanal-Titel je Folge die Sprachen des Kanals, das ist kein Beleg für die Synchro (Demon Slayer Hashira Training und
 * Swordsmith Village, Prime, 16.10.2026: Der Bestandsbau brach an `deutschNurAusSpracheTermin` ab, sobald eine Meldung die Seite berührte).
 * Ein Handbeleg „deutsch" bleibt unberührt — er hat Vorrang, und widerspricht ihm der Termin, soll die Prüfung es zeigen. Gibt die Zahl der Wege zurück.
 */
export function nimmDeutschGegenSprachTermin(titles: Map<number, Title>, releases: Release[]): number {
  const handJa = new Set(loadDubChecks().filter((c) => c.dub === true).map((c) => `${c.anilistId}|${c.platform}`))
  let genommen = 0
  for (const k of alleTermineGekennzeichnet(releases)) {
    if (handJa.has(k)) continue
    const [id, plattform] = k.split('|')
    for (const s of titles.get(Number(id))?.streams ?? []) {
      if (s.platform !== plattform || s.dub !== true) continue
      delete s.dub
      delete s.dubRanges
      genommen++
    }
  }
  if (genommen) log(`${genommen} Wege ohne „deutsch": alle Termine des Anbieters tragen eine Sprachkennzeichnung`)
  return genommen
}
