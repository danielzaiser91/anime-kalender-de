/**
 * Deutsche Folgenzahl gegen den gebauten Bestand (`check:bestand`, 12.10.2026): Ein `deFolgen` in `data/erstausgabe-von-hand.yaml`, dessen Titel oder Folgenzahl des Werks im Bestand fehlt, ist ein Fehler
 * (die Teilsynchro-Angabe verschwindet still). Liegt die Zahl nicht unter den Folgen des Werks, ist die Synchro vollständig und der Eintrag nur überholt: Hinweis
 * (`⚠ WARNUNG`, Exit 0; 25.10.2026). Bewertung in `lib/deutsche-folgenzahl-bestand.ts`; die Detaildaten trägt der nächste Bestandsbau.
 */
import type { Title } from '../shared/types.ts'
import { readJson } from './lib/util.ts'
import { zurueckgestellt } from './lib/quarantaene.ts'
import { ladeErstausgabeVonHand } from './lib/erstausgabe-von-hand.ts'
import { bewerteDeutscheFolgenzahl } from './lib/deutsche-folgenzahl-bestand.ts'
import { bestandWarnzeile } from './lib/bestand-warnzeile.ts'

const titel = new Map(readJson<Title[]>('public/data/titles.json', []).map((t) => [t.id, t]))
const { fehler, hinweise } = bewerteDeutscheFolgenzahl(ladeErstausgabeVonHand(), titel, zurueckgestellt().ids)

if (hinweise.length) console.log(bestandWarnzeile('Deutsche Folgenzahl', 'überholt (Synchro vollständig, deFolgen in data/erstausgabe-von-hand.yaml bei Gelegenheit löschen)', hinweise))
if (fehler.length) {
  console.error(`FEHLER: ${fehler.length} Einträge mit deFolgen in data/erstausgabe-von-hand.yaml ohne Titel oder Folgenzahl im Bestand — beheben:\n${fehler.join('\n')}`)
  process.exit(1)
}
console.log(`Deutsche Folgenzahl gegen den Bestand: ${hinweise.length} überholt (Hinweis), kein Eintrag verwaist.`)
