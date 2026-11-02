/**
 * Zusicherung: **die Wache rechnet begründet entfernte Verweise heraus** (06.09.2026: „78 Verweise entfernt" war der Normalfall,
 * die aniSearch-Ergänzung legt Verweise an und entfernt belegte Neins im selben Lauf). Lauf von `findeAuffaelliges` mit
 * Kennzahlen-Paaren — ersetzt die Quelltext-Zusicherung auf `entferntProtokolliert`/`wegUnerklaert` in `check-logic.ts`.
 */
import { findeAuffaelliges, type Kennzahlen } from './lib/bestand-delta.ts'

const fehler: string[] = []
let faelle = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  faelle++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}

const kz = (ueber: Partial<Kennzahlen>): Kennzahlen => ({
  titel: 500,
  titelMitVerweis: 500,
  verweise: 1000,
  mitUrteil: 900,
  ohneUrteil: 100,
  titelMitSynchro: 400,
  entferntProtokolliert: 0,
  releases: 10,
  termine: 100,
  jeAnbieter: { netflix: 3 },
  ...ueber,
})
const vorher = kz({ entferntProtokolliert: 200 })
/** Nachher: `weg` Verweise weniger, das Gedächtnis um `protokolliert` gewachsen. */
const auffaellig = (weg: number, protokolliert: number, ueber: Partial<Kennzahlen> = {}) =>
  findeAuffaelliges(kz({ verweise: 1000 - weg, entferntProtokolliert: 200 + protokolliert, ...ueber }), vorher).auffaellig

erwarte('78 weg, 78 im Gedächtnis: der Normalfall, keine Zeile', auffaellig(78, 78), [])
erwarte('78 weg, nichts protokolliert: Alarm mit der vollen Zahl', auffaellig(78, 0), ['78 Verweise ohne protokollierten Grund weg'])
erwarte('78 weg, 20 protokolliert: nur der Rest, mit Hinweis auf die begründeten', auffaellig(78, 20), [
  '58 Verweise ohne protokollierten Grund weg (20 weitere sind begründet entfernt)',
])
erwarte('Grenze: 50 unerklärt bleiben still', auffaellig(50, 0), [])
erwarte('Grenze: 51 unerklärt melden', auffaellig(51, 0), ['51 Verweise ohne protokollierten Grund weg'])
erwarte('78 weg, 28 protokolliert: 50 Rest bleiben still', auffaellig(78, 28), [])
erwarte('78 weg, 27 protokolliert: 51 Rest melden', auffaellig(78, 27), ['51 Verweise ohne protokollierten Grund weg (27 weitere sind begründet entfernt)'])
erwarte('ein schrumpfendes Gedächtnis erklärt nichts', auffaellig(78, -10), ['78 Verweise ohne protokollierten Grund weg'])
erwarte('mehr Verweise als vorher: keine Zeile', auffaellig(-40, 0), [])

if (fehler.length) {
  console.error(`FEHL check-bestand-delta-entfernt:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-bestand-delta-entfernt: ${faelle} Fälle ok.`)
