import { gzipSync } from 'node:zlib'
import type { Franchises } from '../../shared/franchise-typ.ts'
import { baueEmpfehlung, MAX_GZIP_BYTES, pruefeEmpfehlung } from '../../shared/empfehlung-pool.ts'
import type { Title } from '../../shared/types.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'
import { log, readJson, writeJson } from '../lib/util.ts'
/* Nicht aus grundlagen.ts: dessen Import liest beim Laden Handdateien, der Test läuft in einem leeren Ordner. */
const OUT = 'public/data'

/** Bytes der Datei über die Leitung; der Größenwächter des Baus und der Bestandsprüfung. */
export function gzipGroesse(daten: unknown): number {
  return gzipSync(JSON.stringify(daten)).length
}

/**
 * **`empfehlung.json` — der Pool für „Was gucke ich als Nächstes?“**: ein Einstieg je Reihe mit belegter Synchro, dazu die Tabelle Titel → Reihe.
 * Wird aus den fertig geschriebenen `titles.json` und `franchises.json` abgeleitet; Widerspruch oder mehr als 40 KB gzip brechen den Bau ab.
 */
export function schreibeEmpfehlung(): void {
  const titles = readJson<Title[]>(`${OUT}/titles.json`, [])
  const datei = baueEmpfehlung(titles, readJson<Franchises>(`${OUT}/franchises.json`, {}))
  const fehler = pruefeEmpfehlung(datei, titles)
  const gz = gzipGroesse(datei)
  if (gz > MAX_GZIP_BYTES) fehler.push(`${gz} Byte gzip über der Grenze von ${MAX_GZIP_BYTES}`)
  brichAbBeiWiderspruch(fehler, 'Widerspruch/Widersprüche in empfehlung.json — Bau abgebrochen.')
  writeJson(`${OUT}/empfehlung.json`, datei)
  log(`empfehlung.json: ${datei.einstiege.length} Einstiege aus ${datei.pool} Titeln, ${gz} Byte gzip`)
}
