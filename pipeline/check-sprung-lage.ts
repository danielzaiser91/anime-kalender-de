/**
 * Zusicherungen zu `sprungLage()` aus `web/src/lib/sprung-lage.ts`: Das Datumsfenster geht unter dem Knopf auf, wenn dort die
 * Wunschhöhe (330 px) Platz hat oder unten nicht weniger Platz ist als oben, sonst darüber; `maxHoehe` ist der Platz der gewählten
 * Seite; `left` bleibt zwischen Rand (8 px) und Fensterbreite − 280 − 2 × 8, ein zu schmales Fenster gibt den Rand. Läuft in `check:logic`.
 */
import { sprungLage } from '../web/src/lib/sprung-lage.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const knopf = (top: number, left = 50) => ({ top, bottom: top + 30, left })
const fenster = (hoehe: number, breite = 400) => ({ breite, hoehe })

// Seite
pruefe('viel Platz unten: darunter', sprungLage(knopf(100), fenster(800)), { left: 50, top: 136, maxHoehe: 656 })
pruefe('Knopf weit unten: darüber', sprungLage(knopf(700), fenster(800)), { left: 50, bottom: 106, maxHoehe: 686 })
pruefe('genau Wunschhöhe unten, oben mehr: darunter', sprungLage(knopf(500), fenster(874)), { left: 50, top: 536, maxHoehe: 330 })
pruefe('1 px unter Wunschhöhe, oben mehr: darüber', sprungLage(knopf(500), fenster(873)), { left: 50, bottom: 379, maxHoehe: 486 })
pruefe('oben und unten gleich knapp: darunter', sprungLage(knopf(200), fenster(430)), { left: 50, top: 236, maxHoehe: 186 })
pruefe('unten knapp, aber mehr als oben: darunter', sprungLage(knopf(50), fenster(300)), { left: 50, top: 86, maxHoehe: 206 })

// Waagerecht
pruefe('zu weit rechts: an die Höchstgrenze', sprungLage(knopf(100, 300), fenster(800)).left, 104)
pruefe('genau an der Höchstgrenze', sprungLage(knopf(100, 104), fenster(800)).left, 104)
pruefe('links vom Rand: an den Rand', sprungLage(knopf(100, -20), fenster(800)).left, 8)
pruefe('zu schmales Fenster: Rand', sprungLage(knopf(100, 50), fenster(800, 250)).left, 8)

if (fehler) {
  console.error(`check-sprung-lage: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-sprung-lage: alle Zusicherungen grün')
