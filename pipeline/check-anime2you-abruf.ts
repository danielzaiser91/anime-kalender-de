/** Zusicherung: ein Abrufausfall (z. B. HTTP 403 vom Runner) heißt in der Quellen-Gesundheit nicht „kein Feed-Eintrag mit Termin“ (05.11.2026). */
import { leerGrund } from './lib/anime2you-abruf.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const g1 = leerGrund([], 4)
pruefe('ohne Abruffehler: ruhiger Tag', g1 === 'kein Feed-Eintrag mit Termin', g1)
const g2 = leerGrund(['https://x/feed/: HTTP 403', 'https://x/b/: HTTP 403', 'https://x/c/: HTTP 403', 'https://x/d/: HTTP 403'], 4)
pruefe('alle vier Feeds 403: Ausfall mit Status', g2 === 'Abruf gescheitert (alle Feeds): https://x/feed/: HTTP 403', g2)
const g3 = leerGrund(['https://x/feed/: HTTP 403'], 4)
pruefe('ein Feed von vier: Zählung', g3 === 'Abruf gescheitert (1 von 4 Feeds): https://x/feed/: HTTP 403', g3)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnime2You-Abrufgrund: alle Zusicherungen erfüllt (3 Fälle)')
