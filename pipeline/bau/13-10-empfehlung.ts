import { gzipSync } from 'node:zlib'
import type { Franchises } from '../../shared/franchise-typ.ts'
import { baueEmpfehlung, type EmpfehlungsDatei, MAX_GZIP_BYTES, pruefeEmpfehlung } from '../../shared/empfehlung-pool.ts'
import type { Title } from '../../shared/types.ts'
import { type AkVon, uebersetzeDatei } from '../lib/ausgabe-kennung.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'
import { log, readJson, warn, writeJson } from '../lib/util.ts'
/* Nicht aus grundlagen.ts: dessen Import liest beim Laden Handdateien, der Test läuft in einem leeren Ordner. */
const OUT = 'public/data'

/** Bytes der Datei über die Leitung; der Größenwächter des Baus und der Bestandsprüfung. */
export function gzipGroesse(daten: unknown): number {
  return gzipSync(JSON.stringify(daten)).length
}

/** Einstiege ohne Cover in `titles.json`: nur Warnung, auch in der Bestandsprüfung (ein neu synchronisierter Titel darf den Tagesbau nicht zurückrollen). */
export function coverHinweise(datei: EmpfehlungsDatei, titles: Title[]): string[] {
  const nachId = new Map(titles.map((t) => [t.id, t]))
  return datei.einstiege.filter((k) => !nachId.get(k.id)?.coverImage).map((k) => `Einstieg ${k.id} hat kein Cover`)
}

/** Datei über der Größengrenze: Warnung im Bau, Fehler in der Bestandsprüfung. */
export function groessenHinweise(datei: EmpfehlungsDatei): string[] {
  const gz = gzipGroesse(datei)
  return gz > MAX_GZIP_BYTES ? [`${gz} Byte gzip über der Grenze von ${MAX_GZIP_BYTES}`] : []
}

/** Hinweise, die der Bau meldet, ohne ihn abzubrechen. */
export function hinweiseEmpfehlung(datei: EmpfehlungsDatei, titles: Title[]): string[] {
  return [...coverHinweise(datei, titles), ...groessenHinweise(datei)]
}

/** Kennungen der Datei (Einstiege, Reihen-Schlüssel und -Werte), die nach der Übersetzung auf `ak` keinen Titel finden. */
export function kennungenOhneTitel(datei: EmpfehlungsDatei, titles: Title[], akVon: AkVon): string[] {
  const aus = uebersetzeDatei('empfehlung.json', datei, akVon) as EmpfehlungsDatei
  const akTitel = new Set((uebersetzeDatei('titles.json', titles, akVon) as Title[]).map((t) => t.id))
  const ids = [...aus.einstiege.map((k) => k.id), ...Object.keys(aus.reihe).map(Number), ...Object.values(aus.reihe)]
  return ids.filter((id) => !akTitel.has(id)).map((id) => `nach der Übersetzung auf ak: Kennung ${id} ohne Titel`)
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

/** Alles, was die Bestandsprüfung rot macht: Widersprüche, Größe, und eine Datei, die vom Neubau aus den Titeln und Reihen abweicht. */
export function bestandsFehler(datei: EmpfehlungsDatei, titles: Title[], franchises: Franchises): string[] {
  const fehler = [...pruefeEmpfehlung(datei, titles), ...groessenHinweise(datei)]
  if (JSON.stringify(datei) !== JSON.stringify(baueEmpfehlung(titles, franchises))) fehler.push('empfehlung.json weicht vom Neubau aus titles.json und franchises.json ab')
  return fehler
}
