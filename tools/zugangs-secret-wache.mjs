/**
 * Abgleich Repo-Secrets gegen `data/zugangs-register.json` (nur Namen, nie Werte).
 *
 * Läuft nur lokal in der Wachphase (`laeufe-aufraeumen.mjs`, in der CI mit `GITHUB_ACTIONS` ausgelassen) und über `node tools/zugangs-waechter.mjs --secrets`:
 * `gh secret list` ruft „List repository secrets“ auf, das Admin-Recht am Repo verlangt; das `GITHUB_TOKEN` eines Workflows
 * hat laut GitHub-Doku („Permissions for the GITHUB_TOKEN“) keinen Bereich `secrets`, ein Versuch endet mit 403.
 * Kein Secret ohne Eintrag (wie NACHT_MERGER_TOKEN seit 01.11., aufgefallen erst am 401); kein Repo-Secret-Eintrag ohne Secret.
 * Einträge mit anderem `ort` (Worker, Vercel, `GITHUB_TOKEN`) sind keine Repo-Secrets und bleiben außen vor.
 */
import { readFileSync } from 'node:fs'

const REGISTER = new URL('../data/zugangs-register.json', import.meta.url)

/** Befundzeilen aus Registereinträgen und Secret-Namen (leer = stimmig). */
export function secretBefunde(zugaenge, namen) {
  const ids = new Set(zugaenge.filter((z) => z.ort === 'github-secret').map((z) => z.id))
  const alleIds = new Set(zugaenge.map((z) => z.id))
  const zeilen = []
  for (const n of [...namen].sort()) if (!alleIds.has(n)) zeilen.push(`Zugang: Repo-Secret ${n} hat keinen Eintrag in data/zugangs-register.json`)
  for (const id of [...ids].sort()) if (!namen.includes(id)) zeilen.push(`Zugang: Register führt ${id} als Repo-Secret, \`gh secret list\` kennt es nicht`)
  return zeilen
}

/** Wachzeilen; `gh` bekommt die Argumentliste und gibt den JSON-Text zurück. Ein Lesefehler ist Nichtauskunft, kein Befund. */
export function secretZeilen(gh, repo, register = JSON.parse(readFileSync(REGISTER, 'utf8'))) {
  let namen
  try {
    const liste = JSON.parse(gh(['secret', 'list', '--repo', repo, '--json', 'name']))
    namen = liste.map((e) => e?.name).filter((n) => typeof n === 'string')
  } catch (fehler) {
    return [`Zugang: Secret-Liste nicht lesbar (${String(fehler?.message ?? fehler).split('\n')[0].slice(0, 120)})`]
  }
  if (!namen.length) return ['Zugang: Secret-Liste leer oder nicht lesbar, Abgleich ausgelassen']
  return secretBefunde(register.zugaenge, namen)
}
