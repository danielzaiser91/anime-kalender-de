/**
 * Urteil des Sammeljobs `PR-Prüfkette` (25.10.2026). Wird die Kette neu gestartet, bricht GitHub den älteren Lauf ab; alle Teiljobs
 * stehen dann auf `cancelled`, und der Sammeljob endete bisher mit Exit 1 (roter Check neben dem laufenden neuen).
 *
 * Regel: alle `success` = grün; alle `cancelled` = abgebrochen (kein Fehlschlag); alles andere (auch ein Mix aus `success` und
 * `cancelled`, denn dann fehlt ein Teiljob) = rot. Eine leere Liste ist rot.
 * Aufruf: NEEDS='<toJSON(needs)>' node tools/kette-urteil.mjs
 */
import { pathToFileURL } from 'node:url'

/** @param {Record<string, {result: string}>} needs @returns {'gruen'|'abgebrochen'|'rot'} */
export function kettenUrteil(needs) {
  const ergebnisse = Object.values(needs ?? {}).map((n) => n?.result)
  if (ergebnisse.length === 0) return 'rot'
  if (ergebnisse.every((r) => r === 'success')) return 'gruen'
  if (ergebnisse.every((r) => r === 'cancelled')) return 'abgebrochen'
  return 'rot'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const needs = JSON.parse(process.env.NEEDS ?? '{}')
  for (const [name, n] of Object.entries(needs)) console.log(`${name}: ${n.result}`)
  const urteil = kettenUrteil(needs)
  console.log(`kette-urteil: ${urteil}`)
  process.exit(urteil === 'rot' ? 1 : 0)
}
