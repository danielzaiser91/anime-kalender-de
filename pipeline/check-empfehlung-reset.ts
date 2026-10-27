/**
 * Zusicherungen zu „Empfehlungen zurücksetzen“ (`web/src/lib/empfehlung-reset.ts`): jeder Schlüssel der Ansicht ist weg,
 * fremde Schlüssel bleiben, ein gesperrter Speicher wirft nicht. Die erwarteten Schlüssel stehen hier fest.
 * Aufruf: `npm run check:logic`.
 */
import { empfehlungenZuruecksetzen } from '../web/src/lib/empfehlung-reset.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const EIGENE = ['empfehlung:gesehen', 'empfehlung:verworfen', 'empfehlung:anbieter', 'empfehlung:reise']
const FREMDE = ['meineAnbieter', 'favorites', 'hidden', 'gesehenBis', 'empfehlung:gesehen:changed']

function speicher(erlaubt = true) {
  const daten = new Map<string, string>([...EIGENE, ...FREMDE].map((k) => [k, '[1]']))
  return {
    daten,
    removeItem: (k: string) => {
      if (!erlaubt) throw new Error('gesperrt')
      daten.delete(k)
    },
  }
}

const s = speicher()
const n = empfehlungenZuruecksetzen(s)
for (const k of EIGENE) pruefe(`${k} gelöscht`, !s.daten.has(k))
for (const k of FREMDE) pruefe(`${k} bleibt`, s.daten.has(k))
pruefe('Zahl der Schlüssel', n === EIGENE.length, n)

const leer = speicher()
empfehlungenZuruecksetzen(leer)
pruefe('zweiter Lauf ohne Wirkung auf Fremdes', FREMDE.every((k) => leer.daten.has(k)) && empfehlungenZuruecksetzen(leer) === EIGENE.length)

const gesperrt = speicher(false)
let geworfen = false
try {
  empfehlungenZuruecksetzen(gesperrt)
} catch {
  geworfen = true
}
pruefe('gesperrter Speicher wirft nicht', !geworfen)

console.log(`empfehlung-reset: ${verletzt === 0 ? 'alle Zusicherungen erfüllt' : `${verletzt} verletzt`}`)
process.exit(verletzt === 0 ? 0 : 1)
