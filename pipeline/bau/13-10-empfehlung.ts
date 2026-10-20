import { gzipSync } from 'node:zlib'
import type { Franchises } from '../../shared/franchise-typ.ts'
import { baueEmpfehlung, type EmpfehlungsDatei, MAX_GZIP_BYTES, pruefeEmpfehlung } from '../../shared/empfehlung-pool.ts'
import type { Title } from '../../shared/types.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'
import { log, readJson, warn, writeJson } from '../lib/util.ts'
/* Nicht aus grundlagen.ts: dessen Import liest beim Laden Handdateien, der Test läuft in einem leeren Ordner. */
const OUT = 'public/data'

/** Bytes der Datei über die Leitung; der Größenwächter des Baus und der Bestandsprüfung. */
export function gzipGroesse(daten: unknown): number {
  return gzipSync(JSON.stringify(daten)).length
}

/** Hinweise, die der Bau meldet, ohne ihn abzubrechen: Einstieg ohne Cover in `titles.json`, Datei über der Größengrenze. Die Bestandsprüfung wertet sie als Fehler. */
export function hinweiseEmpfehlung(datei: EmpfehlungsDatei, titles: Title[]): string[] {
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const hinweise = datei.einstiege.filter((k) => !nachId.get(k.id)?.coverImage).map((k) => `Einstieg ${k.id} hat kein Cover`)
  const gz = gzipGroesse(datei)
  if (gz > MAX_GZIP_BYTES) hinweise.push(`${gz} Byte gzip über der Grenze von ${MAX_GZIP_BYTES}`)
  return hinweise
}

/**
 * **`empfehlung.json` — der Pool für „Was gucke ich als Nächstes?“**: ein Einstieg je Reihe mit belegter Synchro, dazu die Tabelle Titel → Reihe.
 * Wird aus den fertig geschriebenen `titles.json` und `franchises.json` abgeleitet. Ein Widerspruch in der Datei bricht den Bau ab; fehlende Cover und
 * Überschreitung der 40-KB-Grenze (gzip) sind Warnungen, denn die Datei ist abgeleitet und ein Tagesbau darf nicht an einem neuen Titel ohne Cover scheitern.
 */
export function schreibeEmpfehlung(): void {
  const titles = readJson<Title[]>(`${OUT}/titles.json`, [])
  const datei = baueEmpfehlung(titles, readJson<Franchises>(`${OUT}/franchises.json`, {}))
  brichAbBeiWiderspruch(pruefeEmpfehlung(datei, titles), 'Widerspruch/Widersprüche in empfehlung.json — Bau abgebrochen.')
  for (const h of hinweiseEmpfehlung(datei, titles)) warn(`empfehlung.json: ${h}`)
  writeJson(`${OUT}/empfehlung.json`, datei)
  log(`empfehlung.json: ${datei.einstiege.length} Einstiege aus ${datei.pool} Titeln, ${gzipGroesse(datei)} Byte gzip`)
}
