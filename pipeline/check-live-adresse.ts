/**
 * Zusicherung zu `liveAdresse` (06.11.2026): bekannter Sender führt zum Livestream, alles andere zu nichts —
 * auch Namen aus `Object.prototype` ("constructor"). Aufruf: `npm run check:logic`.
 */
import { liveAdresse } from '../web/src/lib/live-adresse.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

pruefe('ProSieben MAXX führt zu Joyn', liveAdresse('ProSieben MAXX')?.url === 'https://www.joyn.de/play/live-tv?channel_id=5')
pruefe('Schreibweise und Leerraum egal', liveAdresse('  PROSIEBEN maxx ')?.name === 'Joyn')
pruefe('unbekannter Sender: nichts', liveAdresse('RTL') === undefined)
pruefe('ohne Sender: nichts', liveAdresse(undefined) === undefined)
for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
  pruefe(`Prototyp-Name "${name}": nichts`, liveAdresse(name) === undefined, liveAdresse(name))
}

if (verletzt > 0) {
  console.error(`✖ check-live-adresse: ${verletzt} verletzt`)
  process.exit(1)
}
console.log('✓ check-live-adresse: 8 Fälle ok')
