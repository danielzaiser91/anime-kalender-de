/**
 * Letzter Schritt von `npm run build` und `build:schlank`: zählt die Dateien in `dist/` und bricht über dem Budget ab
 * (Grenzen und Grund: `tools/web-hosting.ts`). Gezählt wird alles, auch `CNAME` und `_headers` — eher eine zu viel als zu wenig.
 *
 * Aufruf: `npx tsx tools/dateibudget.ts [verzeichnis]` (Vorgabe `dist`)
 */
import { todayIso } from '../shared/time.ts'
import { dateibudgetErgebnis, zaehleDateien } from './web-hosting.ts'

const { code, zeile } = dateibudgetErgebnis(zaehleDateien(process.argv[2] ?? 'dist'), todayIso())
if (code) console.error(zeile)
else console.log(zeile)
process.exit(code)
