/**
 * Zusicherungen zu `wegWiderspruchtSich()` (`lib/weg-entwerten.ts`): Ein „weg", das selbst eine deutsche Tonspur nennt, bleibt liegen
 * (Landei II, 19.11.2026). Die Verdrahtung in `fetch-pruefungen.ts` prüft `check-fetch-pruefungen-laufzeit.ts` (nachts). Läuft in `check:logic`.
 */
import { wegWiderspruchtSich } from './lib/weg-entwerten.ts'

let fehler = 0
let faelle = 0
function pruefe(text: string, ist: boolean, soll: boolean) {
  faelle++
  if (ist !== soll) {
    fehler++
    console.error(`FEHLER ${text}: ist ${ist}, soll ${soll}`)
  }
}

/* Wörtlich aus der Meldung zu Landei II (B0H1QXQL33), wie sie in der Notiz des Belegs stand. */
const LANDEI = '["Deutsch","English","Español (España)","Español (Latinoamérica)","Français","Italiano","Português (Brasil)","ไทย","日本語"]'
const weg = (sprachen: string | null) => ({ befund: 'weg', sprachen })

pruefe('Landei II: weg mit Deutsch (Prime-Form)', wegWiderspruchtSich(weg(LANDEI)), true)
pruefe('Netflix-Form de|Deutsch', wegWiderspruchtSich(weg('["de|Deutsch","ja|Japanisch [Original]"]')), true)
pruefe('Disney+-Form de', wegWiderspruchtSich(weg('["de"]')), true)
pruefe('Deutsch Dialogue Boost', wegWiderspruchtSich(weg('["Deutsch Dialogue Boost: High"]')), true)
pruefe('weg ohne Sprachen (null)', wegWiderspruchtSich(weg(null)), false)
pruefe('weg mit leerer Liste (Regionssperre)', wegWiderspruchtSich(weg('[]')), false)
pruefe('weg nur mit Japanisch', wegWiderspruchtSich(weg('["日本語","English"]')), false)
pruefe('Netflix ja|Japanisch', wegWiderspruchtSich(weg('["ja|Japanisch [Original]"]')), false)
pruefe('dub mit Deutsch ist kein Widerspruch', wegWiderspruchtSich({ befund: 'dub', sprachen: LANDEI }), false)
pruefe('kein_dub mit Deutsch ist kein weg', wegWiderspruchtSich({ befund: 'kein_dub', sprachen: '["Deutsch"]' }), false)
pruefe('ohne Meldung', wegWiderspruchtSich(undefined), false)

if (fehler) {
  console.error(`check-weg-widerspruch: ${fehler} von ${faelle} Fällen falsch`)
  process.exit(1)
}
console.log(`check-weg-widerspruch: ${faelle} Fälle grün — „weg" mit deutscher Tonspur (Prime, Netflix, Disney+) bleibt liegen, ohne Deutsch und andere Befunde nicht`)
