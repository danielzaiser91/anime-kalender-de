/**
 * Zusicherungen zu `folgenProWoche()` aus `shared/folgenrhythmus.ts`: Einzelzahl ohne Strich, Spanne mit Halbgeviertstrich (nicht
 * Bindestrich), Werte unverändert in Eingabereihenfolge. Läuft in `check:logic`.
 */
import { folgenProWoche } from '../shared/folgenrhythmus.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  if (ist !== soll) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${JSON.stringify(ist)}\n  soll ${JSON.stringify(soll)}`)
  }
}

pruefe('gleiche Zahlen: eine Zahl', folgenProWoche([3, 3]), '3')
pruefe('Spanne mit Halbgeviertstrich', folgenProWoche([3, 4]), '3–4')
pruefe('zweistellig', folgenProWoche([1, 12]), '1–12')
pruefe('Reihenfolge bleibt', folgenProWoche([4, 3]), '4–3')

if (fehler) {
  console.error(`check-folgenrhythmus: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-folgenrhythmus: alle Zusicherungen grün')
