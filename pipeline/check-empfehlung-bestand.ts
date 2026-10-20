/**
 * Bestandsprüfung zu `public/data/empfehlung.json`: Die Datei entspricht dem Neubau aus `titles.json` und `franchises.json`, besteht
 * `pruefeEmpfehlung`, jeder Einstieg hat ein Cover und die Datei bleibt unter der Größengrenze (gzip). Aufruf: `npm run check:bestand`.
 */
import { readFileSync } from 'node:fs'
import { baueEmpfehlung, MAX_GZIP_BYTES, pruefeEmpfehlung, type EmpfehlungsDatei } from '../shared/empfehlung-pool.ts'
import type { Franchises } from '../shared/franchise-typ.ts'
import type { Title } from '../shared/types.ts'
import { gzipGroesse, hinweiseEmpfehlung } from './bau/13-10-empfehlung.ts'

const lies = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8')) as T
const datei = lies<EmpfehlungsDatei>('empfehlung.json')
const titles = lies<Title[]>('titles.json')
const fehler = [...pruefeEmpfehlung(datei, titles), ...hinweiseEmpfehlung(datei, titles)]
if (JSON.stringify(datei) !== JSON.stringify(baueEmpfehlung(titles, lies<Franchises>('franchises.json')))) fehler.push('empfehlung.json weicht vom Neubau aus titles.json und franchises.json ab')

for (const f of fehler) console.error(`  ✖ ${f}`)
if (fehler.length) process.exit(1)
console.log(`Empfehlung (Bestand): ${datei.einstiege.length} Einstiege aus ${datei.pool} Titeln, ${gzipGroesse(datei)} Byte gzip (Grenze ${MAX_GZIP_BYTES})`)
