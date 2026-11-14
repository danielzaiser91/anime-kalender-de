/**
 * Zusicherungen zu `leiteAb()` aus `worker/src/pruefung-ableiten.ts`: Neue Meldungen (`vorhanden`, `ton_de`, `art`) ergeben den
 * Befund, alte (`befund`) die drei Felder; „vorhanden nein“ setzt den Ton auf „unbekannt“, „vorhanden ja“ ohne Sprachauskunft
 * ist ein Fehler, `art` fällt auf „gemessen“ zurück (alt: „angenommen“ nur bei ANGENOMMEN in der Notiz); Werte werden getrimmt,
 * aber nicht kleingeschrieben. Läuft in `check:logic`.
 */
import { leiteAb } from '../worker/src/pruefung-ableiten.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const F_VORHANDEN = { fehler: 'vorhanden muss ja oder nein sein' }
const F_TON = { fehler: 'ton_de muss ja, nein oder unbekannt sein' }
const F_JA_OHNE_TON = { fehler: 'vorhanden ja braucht ton_de ja oder nein' }
const F_ART = { fehler: 'art muss gemessen oder angenommen sein' }
const F_BEFUND = { fehler: 'befund muss dub, kein_dub oder weg sein' }

// Neue Meldung: vorhanden/ton_de/art → befund
pruefe('ja + ja → dub', leiteAb({ vorhanden: 'ja', ton_de: 'ja' }), { befund: 'dub', vorhanden: 'ja', tonDe: 'ja', art: 'gemessen' })
pruefe('ja + nein → kein_dub', leiteAb({ vorhanden: 'ja', ton_de: 'nein', art: 'angenommen' }), { befund: 'kein_dub', vorhanden: 'ja', tonDe: 'nein', art: 'angenommen' })
pruefe('nein → weg, Ton unbekannt (auch bei ton_de ja)', leiteAb({ vorhanden: 'nein', ton_de: 'ja' }), { befund: 'weg', vorhanden: 'nein', tonDe: 'unbekannt', art: 'gemessen' })
pruefe('nein ohne ton_de', leiteAb({ vorhanden: 'nein' }), { befund: 'weg', vorhanden: 'nein', tonDe: 'unbekannt', art: 'gemessen' })
pruefe('nein überschreibt ungültigen Ton', leiteAb({ vorhanden: 'nein', ton_de: 'vielleicht' }), { befund: 'weg', vorhanden: 'nein', tonDe: 'unbekannt', art: 'gemessen' })
pruefe('neue Felder schlagen alten befund', leiteAb({ vorhanden: 'ja', ton_de: 'ja', befund: 'weg' }), { befund: 'dub', vorhanden: 'ja', tonDe: 'ja', art: 'gemessen' })
pruefe('Leerzeichen werden getrimmt', leiteAb({ vorhanden: ' ja ', ton_de: ' nein', art: 'gemessen ' }), { befund: 'kein_dub', vorhanden: 'ja', tonDe: 'nein', art: 'gemessen' })
pruefe('Notiz ANGENOMMEN zählt bei neuen Meldungen nicht', leiteAb({ vorhanden: 'ja', ton_de: 'ja', notiz: 'ANGENOMMEN' }), { befund: 'dub', vorhanden: 'ja', tonDe: 'ja', art: 'gemessen' })

pruefe('vorhanden vielleicht', leiteAb({ vorhanden: 'vielleicht' }), F_VORHANDEN)
pruefe('Großschreibung wird nicht angepasst', leiteAb({ vorhanden: 'Ja', ton_de: 'ja' }), F_VORHANDEN)
pruefe('Boolean wird zu "true"', leiteAb({ vorhanden: true }), F_VORHANDEN)
pruefe('ja ohne ton_de', leiteAb({ vorhanden: 'ja' }), F_TON)
pruefe('ja + ton_de unbekannt', leiteAb({ vorhanden: 'ja', ton_de: 'unbekannt' }), F_JA_OHNE_TON)
pruefe('ja + ton_de jein', leiteAb({ vorhanden: 'ja', ton_de: 'jein' }), F_TON)
pruefe('art geraten', leiteAb({ vorhanden: 'ja', ton_de: 'ja', art: 'geraten' }), F_ART)

// Alte Meldung: befund → vorhanden/ton_de/art
pruefe('alt dub', leiteAb({ befund: 'dub' }), { befund: 'dub', vorhanden: 'ja', tonDe: 'ja', art: 'gemessen' })
pruefe('alt kein_dub', leiteAb({ befund: 'kein_dub' }), { befund: 'kein_dub', vorhanden: 'ja', tonDe: 'nein', art: 'gemessen' })
pruefe('alt weg', leiteAb({ befund: ' weg ' }), { befund: 'weg', vorhanden: 'nein', tonDe: 'unbekannt', art: 'gemessen' })
pruefe('alt mit ANGENOMMEN in der Notiz', leiteAb({ befund: 'dub', notiz: 'Folge 3 ANGENOMMEN aus Staffel' }), { befund: 'dub', vorhanden: 'ja', tonDe: 'ja', art: 'angenommen' })
pruefe('alt: angenommen klein zählt nicht', leiteAb({ befund: 'dub', notiz: 'angenommen' }), { befund: 'dub', vorhanden: 'ja', tonDe: 'ja', art: 'gemessen' })
pruefe('alt: art aus der Meldung wird überschrieben', leiteAb({ befund: 'dub', art: 'angenommen' }), { befund: 'dub', vorhanden: 'ja', tonDe: 'ja', art: 'gemessen' })
pruefe('leere Meldung', leiteAb({}), F_BEFUND)
pruefe('vorhanden leer fällt auf befund zurück', leiteAb({ vorhanden: '  ', befund: 'weg' }), { befund: 'weg', vorhanden: 'nein', tonDe: 'unbekannt', art: 'gemessen' })
pruefe('vorhanden null fällt auf befund zurück', leiteAb({ vorhanden: null, befund: 'kein_dub' }), { befund: 'kein_dub', vorhanden: 'ja', tonDe: 'nein', art: 'gemessen' })
pruefe('unbekannter befund', leiteAb({ befund: 'omu' }), F_BEFUND)

if (fehler) {
  console.error(`check-pruefung-ableiten: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-pruefung-ableiten: alle Zusicherungen grün')
