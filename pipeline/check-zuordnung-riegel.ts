/**
 * Zusicherungen zu `trenneFremdZugeordnete()` aus `pipeline/lib/zuordnung-riegel.ts`: Zuordnungen an Adressen, die ein anderer Eintrag
 * (Cartoon, Titel ohne Synchro) oder ein Handbeleg einer anderen Kennung führt, werden abgewiesen, je Adresse ein Eintrag mit
 * summierten Folgen und dem Grund der letzten Abweisung; der eigene Eintrag und der eigene Handbeleg weisen nicht ab; die Sprache
 * im Pfad zählt nicht. `trenneFremdImBestand` liest Dateien und bleibt hier ungeprüft. Läuft in `check:logic`.
 */
import { trenneFremdZugeordnete } from './lib/zuordnung-riegel.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const A = 'https://www.netflix.com/title/81000001'
const B = 'https://www.netflix.com/title/81000002'
/** Schlüssel wie `streamAdressen()`: Adresse ohne Schema, www und Sprache. */
const streams = new Map([['netflix.com/title/81000001', ['cartoons.json:900', 'titles.json:5']]])

pruefe('leer', trenneFremdZugeordnete({}, streams, []), { eigene: {}, abgewiesen: [] })
pruefe('freie Adresse bleibt', trenneFremdZugeordnete({ [`${B}#1`]: { titleId: 6, folgen: [1] } }, streams, []), { eigene: { [`${B}#1`]: { titleId: 6, folgen: [1] } }, abgewiesen: [] })

const z = {
  [`${A}#1`]: { titleId: 5, folgen: [1, 2] },
  [`${A}#2`]: { titleId: 6, folgen: [3] },
  [`${A}#3`]: { titleId: 6, folgen: [] },
  [`${B}#1`]: { titleId: 6, folgen: [1] },
}
pruefe('eine Adresse, ein Eintrag: Folgen summiert, Grund der letzten Abweisung', trenneFremdZugeordnete(z, streams, []), {
  eigene: { [`${B}#1`]: { titleId: 6, folgen: [1] } },
  abgewiesen: [{ url: A, titel: null, grund: 'Adresse gehört cartoons.json:900, titles.json:5: Zuordnung zu 6 abgewiesen', folgen: 3 }],
})
pruefe(
  'der eigene Eintrag zählt nicht als Besitzer',
  trenneFremdZugeordnete({ [`${A}#1`]: { titleId: 5, folgen: [1] } }, new Map([['netflix.com/title/81000001', ['titles.json:5']]]), []).abgewiesen,
  [],
)
pruefe(
  'Sprache im Pfad zählt nicht',
  trenneFremdZugeordnete({ 'https://www.netflix.com/de/title/81000001#1': { titleId: 6, folgen: [1] } }, streams, []).abgewiesen.map((o) => o.url),
  ['https://www.netflix.com/de/title/81000001'],
)

// Handbelege
pruefe('Handbeleg einer anderen Kennung weist ab', trenneFremdZugeordnete({ [`${A}#1`]: { titleId: 7, folgen: [1] } }, new Map(), [{ anilistId: 8, url: A }]), {
  eigene: {},
  abgewiesen: [{ url: A, titel: null, grund: 'Adresse gehört Handbeleg:8: Zuordnung zu 7 abgewiesen', folgen: 1 }],
})
pruefe(
  'eigener Handbeleg schlägt fremde Streams',
  Object.keys(trenneFremdZugeordnete({ [`${A}#1`]: { titleId: 8, folgen: [1] } }, streams, [{ anilistId: 8, url: A }]).eigene),
  [`${A}#1`],
)

if (fehler) {
  console.error(`check-zuordnung-riegel: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-zuordnung-riegel: alle Zusicherungen grün')
