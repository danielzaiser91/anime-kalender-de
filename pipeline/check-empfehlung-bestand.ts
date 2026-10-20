/**
 * Bestandsprüfung zu `public/data/empfehlung.json`: Die Datei entspricht dem Neubau aus `titles.json` und `franchises.json`, besteht
 * `pruefeEmpfehlung`, jeder Einstieg hat ein Cover, die Datei bleibt unter der Größengrenze (gzip) und nach der Übersetzung auf `ak`
 * finden alle Kennungen ihren Titel. Aufruf: `npm run check:bestand`.
 */
import { readFileSync } from 'node:fs'
import { MAX_GZIP_BYTES, type EmpfehlungsDatei } from '../shared/empfehlung-pool.ts'
import type { Franchises } from '../shared/franchise-typ.ts'
import type { Title } from '../shared/types.ts'
import { ladeAkVon, uebersetzeDatei } from './lib/ausgabe-kennung.ts'
import { bestandsFehler, gzipGroesse } from './bau/13-10-empfehlung.ts'

const lies = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8')) as T
const datei = lies<EmpfehlungsDatei>('empfehlung.json')
const titles = lies<Title[]>('titles.json')
const fehler = bestandsFehler(datei, titles, lies<Franchises>('franchises.json'))

const { akVon } = ladeAkVon('data/kennungen.json')
const aus = uebersetzeDatei('empfehlung.json', datei, akVon) as EmpfehlungsDatei
const akTitel = new Set((uebersetzeDatei('titles.json', titles, akVon) as Title[]).map((t) => t.id))
for (const id of [...aus.einstiege.map((k) => k.id), ...Object.keys(aus.reihe).map(Number), ...Object.values(aus.reihe)]) {
  if (!akTitel.has(id)) fehler.push(`nach der Übersetzung auf ak: Kennung ${id} ohne Titel`)
}

for (const f of fehler) console.error(`  ✖ ${f}`)
if (fehler.length) process.exit(1)
console.log(`Empfehlung (Bestand): ${datei.einstiege.length} Einstiege aus ${datei.pool} Titeln, ${gzipGroesse(datei)} Byte gzip (Grenze ${MAX_GZIP_BYTES}), Kennungen in ak aufgelöst`)
