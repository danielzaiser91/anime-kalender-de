/**
 * Bestandswache: `data/eigene-titel.yaml` gegen die gebaute Ausgabe (`public/data`). Rot: ein eigener Titel fehlt im Hauptbestand oder steht nach
 * `zuId`/Widerruf noch da. Warnung (Exit 0): „Katalog führt jetzt X“ (dann `zuId` setzen) und ein Titel, dessen Meldung keinen Termin ergab.
 * Bewertung in `bau/eigene-titel-bestand.ts`, Test `check-eigene-titel-bestand-lauf.ts`.
 *
 * Aufruf: npx tsx pipeline/check-eigene-titel-bestand.ts [Wurzel mit data/ und public/data/]
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { melde } from './lib/quarantaene.ts'
import { ladeEigeneTitel } from './bau/eigene-titel.ts'
import { pruefeEigeneImBestand } from './bau/eigene-titel-bestand.ts'

const lies = <T>(datei: string): T => (existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as T) : ([] as T))

export function main(wurzel: string): number {
  const eintraege = ladeEigeneTitel(wurzel)
  const daten = (name: string) => resolve(wurzel, 'public/data', name)
  const lage = pruefeEigeneImBestand(eintraege, lies(daten('titles.json')), lies(daten('ohne-synchro.json')), lies(daten('releases.json')))
  for (const z of lage.rot) {
    console.error(`  ✖ Eigene Titel: ${z.text}`)
    if (z.titleId) melde(z.titleId, 'eigene-titel', z.text)
  }
  for (const z of lage.warnungen) console.log(`  ⚠ WARNUNG Eigene Titel: ${z}`)
  if (!lage.rot.length) console.log(`  ✓ Eigene Titel: ${eintraege.length} Zeilen, ${lage.warnungen.length} Warnungen`)
  console.log(`VERSTÖSSE: ${lage.rot.length}`)
  return lage.rot.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')))
}
