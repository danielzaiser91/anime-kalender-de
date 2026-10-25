/**
 * Bestandsprüfung: Die Wochen-Datei darf das Start-Budget nicht reißen (Deploy 23.10.2026 rot, weil ein Bestandsbau `woche.json` um 1,4 KB gzip
 * wachsen ließ). Läuft in `check:bestand`, also im Bestandsbau vor dem Commit auf main. Einheitenfälle: `check-woche-groesse.ts`.
 * Aufruf: `tsx pipeline/check-woche-groesse-bestand.ts [woche-kacheln.json]` (Vorgabe `public/data/woche-kacheln.json`).
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bewerteWocheGroesse } from './lib/woche-groesse.ts'

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const pfad = process.argv[2] ?? fileURLToPath(new URL('../public/data/woche-kacheln.json', import.meta.url))
  const { code, text } = bewerteWocheGroesse(pfad)
  if (code) console.error(`check-woche-groesse-bestand: ${text}`)
  else console.log(`check-woche-groesse-bestand: ok – ${text}`)
  console.log(`VERSTÖSSE: ${code}`)
  process.exit(code)
}
