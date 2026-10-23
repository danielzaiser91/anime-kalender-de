/**
 * Bestandsprüfung: Die Wochen-Datei darf das Start-Budget nicht reißen (Deploy 23.10.2026 rot, weil ein Bestandsbau `woche.json` um 1,4 KB gzip
 * wachsen ließ). Läuft in `check:bestand`, also im Bestandsbau vor dem Commit auf main. Einheitenfälle: `check-woche-groesse.ts`.
 */
import { pathToFileURL } from 'node:url'
import { bewerteWocheGroesse } from './lib/woche-groesse.ts'

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const { code, text } = bewerteWocheGroesse(new URL('../public/data/woche.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  if (code) console.error(`check-woche-groesse-bestand: ${text}`)
  else console.log(`check-woche-groesse-bestand: ok – ${text}`)
  process.exit(code)
}
