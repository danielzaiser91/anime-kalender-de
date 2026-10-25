/**
 * Urteil des Sammeljobs `PR-Prüfkette` (25.10.2026). Wird die Kette neu gestartet, bricht GitHub den älteren Lauf ab; alle Teiljobs
 * stehen dann auf `cancelled`, und der Sammeljob endete bisher mit Exit 1 (roter Check neben dem laufenden neuen).
 *
 * Regel: alle `success` = grün; alle `cancelled` = abgebrochen (kein Fehlschlag); alles andere (auch ein Mix aus `success` und
 * `cancelled`, denn dann fehlt ein Teiljob) = rot. Eine leere Liste ist rot.
 *
 * Abgebrochen heißt: der Sammeljob muss selbst als `cancelled` enden. Exit 0 ließe ihn als `success` zählen (gemessen an PR 2053,
 * Lauf 40226531743) und ein von Hand abgebrochener Lauf wäre ein grüner Pflicht-Check. Darum bricht das Skript den eigenen Lauf
 * erneut ab (`gh run cancel`); überlebt der Schritt das, bleibt es bei Exit 1.
 * Aufruf: NEEDS='<toJSON(needs)>' GITHUB_RUN_ID=<id> node tools/kette-urteil.mjs
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/** @param {Record<string, {result: string}>} needs @returns {'gruen'|'abgebrochen'|'rot'} */
export function kettenUrteil(needs) {
  const ergebnisse = Object.values(needs ?? {}).map((n) => n?.result)
  if (ergebnisse.length === 0) return 'rot'
  if (ergebnisse.every((r) => r === 'success')) return 'gruen'
  if (ergebnisse.every((r) => r === 'cancelled')) return 'abgebrochen'
  return 'rot'
}

/** Bricht den eigenen Lauf ab; `true` nur, wenn der Aufruf gelang (Fehler oder fehlende Lauf-Nummer = `false`). */
export function laufAbbrechen(laufId, ausfuehren) {
  if (!laufId) return false
  try {
    ausfuehren('gh', ['run', 'cancel', laufId])
    return true
  } catch {
    return false
  }
}

/** Bricht bei „abgebrochen“ den eigenen Lauf ab und wartet auf das Ende des Schritts; Rückgabe ist der Exit-Code, falls er ausbleibt (immer 1). */
export async function abgebrochenBeenden(laufId, ausfuehren, warte) {
  if (laufAbbrechen(laufId, ausfuehren)) await warte()
  return 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const needs = JSON.parse(process.env.NEEDS ?? '{}')
  for (const [name, n] of Object.entries(needs)) console.log(`${name}: ${n.result}`)
  const urteil = kettenUrteil(needs)
  console.log(`kette-urteil: ${urteil}`)
  if (urteil === 'gruen') process.exit(0)
  if (urteil === 'rot') process.exit(1)
  const ausfuehren = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', windowsHide: true })
  // Der Abbruch beendet diesen Schritt; kommt er nicht an, bleibt es nach der Frist beim Fehlschlag.
  process.exit(await abgebrochenBeenden(process.env.GITHUB_RUN_ID, ausfuehren, () => new Promise((fertig) => setTimeout(fertig, 120_000))))
}
