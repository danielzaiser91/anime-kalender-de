/**
 * Urteil des Sammeljobs `PR-Prüfkette` (25.10.2026). Wird die Kette neu gestartet, bricht GitHub den älteren Lauf ab; alle Teiljobs
 * stehen dann auf `cancelled`, und der Sammeljob endete bisher mit Exit 1 (roter Check neben dem laufenden neuen).
 *
 * Regel: alle `success` = grün; alle `cancelled` = abgebrochen (kein Fehlschlag); alles andere (auch ein Mix aus `success` und
 * `cancelled`, denn dann fehlt ein Teiljob) = rot. Eine leere Liste ist rot.
 *
 * Abgebrochen heißt: der Sammeljob muss selbst als `cancelled` enden. Exit 0 ließe ihn als `success` zählen (gemessen an PR 2053,
 * Lauf 40226531743) und ein von Hand abgebrochener Lauf wäre ein grüner Pflicht-Check. Darum bricht das Skript den eigenen Lauf
 * erzwungen ab (`force-cancel`; ein zweites gewöhnliches `gh run cancel` ließ den Schritt weiterlaufen, gemessen an PR 2053, Lauf
 * 40228130651); überlebt der Schritt das, bleibt es bei Exit 1.
 * Aufruf: NEEDS='<toJSON(needs)>' GITHUB_RUN_ID=<id> GITHUB_REPOSITORY=<owner/repo> GH_TOKEN=<token> node tools/kette-urteil.mjs
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
export function laufAbbrechen(ziel, ausfuehren) {
  if (!ziel) return false
  try {
    ausfuehren('gh', ['api', '-X', 'POST', ziel])
    return true
  } catch {
    return false
  }
}

/** Bricht bei „abgebrochen“ den eigenen Lauf ab und wartet auf das Ende des Schritts; Rückgabe ist der Exit-Code, falls er ausbleibt (immer 1). */
export async function abgebrochenBeenden(ziel, ausfuehren, warte) {
  if (laufAbbrechen(ziel, ausfuehren)) await warte()
  return 1
}

/** API-Adresse zum erzwungenen Abbruch des eigenen Laufs; leer, wenn Repo oder Lauf-Nummer fehlen. */
export function abbruchZiel(env) {
  if (!env.GITHUB_REPOSITORY || !env.GITHUB_RUN_ID) return ''
  return `repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/force-cancel`
}

/** Wartezeit auf den eigenen Abbruch; danach gilt der Schritt als rot. */
export const ABBRUCH_FRIST_MS = 120_000

/** Der ganze Ablauf mit eingespeisten Fremdzugriffen; Rückgabe ist der Exit-Code. */
export async function kettenLauf(env, ausgabe, ausfuehren, warte) {
  const needs = JSON.parse(env.NEEDS ?? '{}')
  for (const [name, n] of Object.entries(needs)) ausgabe(`${name}: ${n.result}`)
  const urteil = kettenUrteil(needs)
  ausgabe(`kette-urteil: ${urteil}`)
  if (urteil === 'gruen') return 0
  if (urteil === 'rot') return 1
  return abgebrochenBeenden(abbruchZiel(env), ausfuehren, warte)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ausfuehren = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', windowsHide: true })
  const warte = () => new Promise((fertig) => setTimeout(fertig, ABBRUCH_FRIST_MS))
  process.exit(await kettenLauf(process.env, console.log, ausfuehren, warte))
}
