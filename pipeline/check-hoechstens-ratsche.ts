/**
 * Prüft den gemeinsamen Kern der `*_HOECHSTENS`-Ratschen (`lib/hoechstens-ratsche.ts`): an der Grenze grün, eins darüber rot,
 * Werte fest eingetragen. Läuft in `check:logic`.
 */
import { ueberHoechstens } from './lib/hoechstens-ratsche.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`)
}

pruefe('genau an der Grenze nicht darüber', !ueberHoechstens(27, 27))
pruefe('eins darüber ist darüber', ueberHoechstens(28, 27))
pruefe('eins darunter nicht darüber', !ueberHoechstens(26, 27))
pruefe('Grenze 0 mit einem Treffer ist darüber', ueberHoechstens(1, 0))
pruefe('Grenze 0 ohne Treffer nicht darüber', !ueberHoechstens(0, 0))

if (fehler) {
  console.error(`[hoechstens-ratsche] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[hoechstens-ratsche] ${faelle} Fälle grün (Grenze, eins darüber, eins darunter, Grenze 0)`)
