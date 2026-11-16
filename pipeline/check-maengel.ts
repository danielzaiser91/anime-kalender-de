/**
 * Wache des Mängel-Registers (`data/maengel.json`): meldet je Art, was seit dem letzten Bau NEU offen ist und was als RÜCKFALL (behoben, wieder offen) zurückkam.
 * Der Bau hat beides gegen die committete Vorfassung gerechnet (`pipeline/lib/maengel-register.ts`); hier wird nur gelesen. Exit bleibt 0: nichts schaltet hart.
 * Feste Zeilen für den Schritt „Mängel melden“ in bestand-bauen.yml (wie `STREAMING_RUECKGANG`): `MAENGEL_NEU …`, `MAENGEL_RUECKFALL …`. Cover steht nur im Register.
 *
 * Aufruf: `npx tsx pipeline/check-maengel.ts`
 */
import { log, readJson } from './lib/util.ts'
import { MAENGEL_DATEI, meldungen, type Register } from './lib/maengel-register.ts'

const ZEILEN = { neu: 'MAENGEL_NEU ', rueckfall: 'MAENGEL_RUECKFALL ' } as const

function main(): void {
  const register = readJson<Register | null>(MAENGEL_DATEI, null)
  if (!register) return log(`${MAENGEL_DATEI} fehlt — nichts zu vergleichen`)
  for (const ereignis of ['neu', 'rueckfall'] as const) {
    const m = meldungen(register, ereignis)
    if (m.length) console.log(`${ZEILEN[ereignis]}${m.join('; ')}`)
  }
  const offen = Object.values(register.zaehler).reduce((s, z) => s + z.offen, 0)
  log(`Mängel am ${register.stand}: ${offen} offen`)
}

main()
