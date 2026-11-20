/**
 * Urteil des Sammeljobs `PR-Prüfkette` (25.10.2026). Wird die Kette neu gestartet, bricht GitHub den älteren Lauf ab; alle Teiljobs
 * stehen dann auf `cancelled`, und der Sammeljob endete bisher mit Exit 1 (roter Check neben dem laufenden neuen).
 *
 * Regel: alle `success` = grün; alle `cancelled` = abgebrochen (kein Fehlschlag); alles andere (auch ein Mix aus `success` und
 * `cancelled`, denn dann fehlt ein Teiljob) = rot. Eine leere Liste ist rot. Ausnahme Mod-Schnellweg: siehe `kettenUrteil`.
 *
 * Abgebrochen heißt: der Sammeljob muss selbst als `cancelled` enden. Exit 0 ließe ihn als `success` zählen (gemessen an PR 2053,
 * Lauf 40226531743) und ein von Hand abgebrochener Lauf wäre ein grüner Pflicht-Check. Darum bricht das Skript den eigenen Lauf
 * erzwungen ab (`force-cancel`; ein zweites gewöhnliches `gh run cancel` ließ den Schritt weiterlaufen, gemessen an PR 2053, Lauf
 * 40228130651); überlebt der Schritt das, bleibt es bei Exit 1.
 * Aufruf: NEEDS='<toJSON(needs)>' GITHUB_RUN_ID=<id> GITHUB_REPOSITORY=<owner/repo> GH_TOKEN=<token> node tools/kette-urteil.mjs
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/** Job-Schlüssel in pr-pruefung.yml: Umfangsjob (liefert `nur_mod`) und Mod-Schnellweg (läuft nur bei `nur_mod == '1'`). */
export const SCOPE_JOB = 'scope'
export const SCHNELLWEG_JOB = 'modschnell'

/**
 * Mod-Schnellweg (20.11.2026): Bei `scope.outputs.nur_mod == '1'` zählt `skipped` für jeden Job außer Umfangsjob und Schnellweg als bestanden,
 * der Schnellweg muss `success` sein; sonst darf nur der Schnellweg übersprungen sein. Fehlt `nur_mod` oder ist es nicht genau '1', gilt die volle Kette.
 * Abgebrochen: alle zählenden Jobs außer dem Umfangsjob `cancelled` (der Umfangsjob selbst darf vorher fertig geworden sein).
 * @param {Record<string, {result: string, outputs?: Record<string, string>}>} needs @returns {'gruen'|'abgebrochen'|'rot'}
 */
export function kettenUrteil(needs) {
  const eintraege = Object.entries(needs ?? {})
  if (eintraege.length === 0) return 'rot'
  const nurMod = needs[SCOPE_JOB]?.outputs?.nur_mod === '1'
  const darfUebersprungenSein = (id) => (nurMod ? id !== SCOPE_JOB && id !== SCHNELLWEG_JOB : id === SCHNELLWEG_JOB)
  const zaehlend = eintraege.filter(([id, n]) => !(n?.result === 'skipped' && darfUebersprungenSein(id)))
  const schnellOk = !nurMod || needs[SCHNELLWEG_JOB]?.result === 'success' // fehlt der Schnellweg in needs, wurde nichts geprüft
  if (schnellOk && zaehlend.every(([, n]) => n?.result === 'success')) return 'gruen'
  const rest = zaehlend.filter(([id]) => id !== SCOPE_JOB)
  const scopeOk = [undefined, 'success', 'cancelled'].includes(needs[SCOPE_JOB]?.result)
  if (rest.length > 0 && scopeOk && rest.every(([, n]) => n?.result === 'cancelled')) return 'abgebrochen'
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
