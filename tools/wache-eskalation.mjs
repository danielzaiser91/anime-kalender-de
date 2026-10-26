/**
 * Eskalation stummer Quellen: Die Wochenwache meldet eine Quelle mit überschrittener Frist
 * (`pipeline/check-sources.ts --nur-melden`), aber die Meldung steht danach wochenlang im Posteingang
 * (`data/meldungen-an-claude.jsonl`): cr-einzelwerke und cr-filmbloecke 27 Tage bei 21 erlaubten, link-check 15 bei 9.
 * Kehrt das Schweigen über die **doppelte** Frist hinaus wieder, wird es zur `ALARM`-Zeile in `laeufe-aufraeumen`.
 */
import { readFileSync } from 'node:fs'
import { FRISTEN } from './quellen-fristen.mjs'

const TAG_MS = 86_400_000
/** Standardfrist von `pipeline/check-sources.ts` für Quellen ohne eigenen Eintrag. */
export const STANDARD_FRIST_TAGE = 4
/** Läuft nur von Daniels Rechner (anonymes Crunchyroll-Token mit deutscher Region), nie aus der Cloud. */
export const DANIELS_HANDGRIFF = new Set(['cr-einzelwerke', 'cr-filmbloecke'])

/**
 * `frist` in Tagen (kein Wert → keine Eskalation), `letzterErfolg` als ISO-Zeit oder leer („noch nie“).
 * Eskaliert wird erst über der doppelten Frist; genau die doppelte gilt noch nicht.
 */
export function eskalation(name, frist, letzterErfolg, jetztMs) {
  if (!(frist > 0)) return { eskalieren: false }
  const erfolgMs = letzterErfolg ? Date.parse(letzterErfolg) : Number.NaN
  const tage = Number.isFinite(erfolgMs) ? (jetztMs - erfolgMs) / TAG_MS : Number.POSITIVE_INFINITY
  if (!(tage > 2 * frist)) return { eskalieren: false, tage }
  const seit = Number.isFinite(tage) ? `seit ${tage.toFixed(1)} Tagen` : 'noch nie'
  const hand = DANIELS_HANDGRIFF.has(name) ? ' — Daniels Handgriff: npm run data:cr-einzelwerke && npm run data:cr-filmbloecke von seinem Rechner' : ''
  return { eskalieren: true, tage, text: `ALARM Quelle ${name} ${seit} ohne Erfolg (Frist ${frist} Tage, Eskalation ab ${2 * frist})${hand}` }
}

/** Alle Alarmzeilen zu einem Gesundheitsstand `{ name: { lastOk } }`, nach Name sortiert. */
export function eskalationsZeilen(gesundheit, jetztMs, fristen = FRISTEN, zusatz = () => '') {
  return Object.keys(gesundheit)
    .sort()
    .map((name) => ({ name, e: eskalation(name, fristen[name] ?? STANDARD_FRIST_TAGE, gesundheit[name]?.lastOk, jetztMs) }))
    .filter(({ e }) => e.eskalieren)
    .map(({ name, e }) => e.text + zusatz(name, gesundheit[name]))
}

/** Liest den Stand aus `datei`; nicht lesbar ist selbst eine Zeile, nie Schweigen. */
export function eskalationsText(datei, jetztMs, zusatz) {
  try {
    return eskalationsZeilen(JSON.parse(readFileSync(datei, 'utf8')), jetztMs, FRISTEN, zusatz)
  } catch (fehler) {
    return [`ALARM? ${datei} nicht lesbar: ${fehler.message}`]
  }
}
