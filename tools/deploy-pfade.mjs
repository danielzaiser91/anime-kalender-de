/**
 * Welche Deploy-Prüfungen braucht dieser Stand? (18.11.2026, Ziel „Fix 5 min nach dem Merge live“)
 *
 * Verglichen wird mit dem Stand des letzten **erfolgreichen** Deploy-Laufs auf main (nicht mit `before` des Pushes: ein roter Vorgänger bliebe sonst
 * ungeprüft, sobald der nächste Push nur Daten anfasst). Berührt die Änderung seither keinen Pfad, den eine Prüfung liest, entfällt sie im Deploy; sie lief
 * schon in der PR-Kette (`pr-pruefung.yml`: Teiljobs workflows, workflows2, uebrige, logik). Jeder Fehler (gh, Git, kein Lauf) heißt „alle Prüfungen“.
 *
 * - `workflows` (check:workflows): `ZAEHLT` aus `workflows-beleg.mjs`, alles außer Datenpfaden (die Tests lesen fast jeden Ordner, gemessen 18.11.2026).
 * - `extension` (check:extension): `extension/`, `tools/` (die Prüfskripte), Paket- und Lint-Dateien, `public/data/pruefliste-stand.json`
 *   und `daniel-zum-abarbeiten/listen/17-vorfaelle.md` (beide liest eine Prüfung).
 * - `logik` (check:logic): `zaehlt` aus `logik-beleg.mjs`, dieselben Pfade wie der Logik-Beleg.
 *
 * Aufruf im Workflow `deploy.yml` (Jobs `pruefen`, `zusicherungen`): `node tools/deploy-pfade.mjs` schreibt `workflows`, `extension`, `logik` (je 0/1) nach $GITHUB_OUTPUT.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { zaehlt as zaehltLogik } from './logik-beleg.mjs'
import { ZAEHLT as zaehltWorkflows } from './workflows-beleg.mjs'

const EXTENSION_EINZELN = ['public/data/pruefliste-stand.json', 'daniel-zum-abarbeiten/listen/17-vorfaelle.md']
export const zaehltExtension = (pfad) =>
  pfad.startsWith('extension/') || pfad.startsWith('tools/') || /^(package(-lock)?\.json|eslint[^/]*|tsconfig[^/]*)$/.test(pfad) || EXTENSION_EINZELN.includes(pfad)

/** Bedarf je Prüfung aus der Liste geänderter Dateien. */
export const bedarf = (dateien) => ({
  workflows: dateien.some(zaehltWorkflows),
  extension: dateien.some(zaehltExtension),
  logik: dateien.some(zaehltLogik),
})

const git = (args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
/** `ausfuehren` ist für den Test einspritzbar: `status=success` in der URL ist tragend, ohne sie läge der Vergleich an einem roten Lauf. */
export const macheEcht = (ausfuehren = execFileSync) => ({
  letzterGruenerStand: (repo) => {
    const roh = ausfuehren('gh', ['api', `repos/${repo}/actions/workflows/deploy.yml/runs?branch=main&status=success&per_page=1`], { encoding: 'utf8', timeout: 60_000 })
    return JSON.parse(roh).workflow_runs?.[0]?.head_sha
  },
  geaendert: (basis) => git(['diff', '--name-only', '-z', basis, 'HEAD']).split('\0').filter(Boolean),
})
export const ECHT = macheEcht()

/** `{ ...bedarf, grund }`; bei jedem Fehler alles `true`. */
export function rechne(env, w = ECHT) {
  const alle = { workflows: true, extension: true, logik: true }
  try {
    const basis = w.letzterGruenerStand(env.GITHUB_REPOSITORY)
    if (!basis) return { ...alle, grund: 'kein erfolgreicher Deploy-Lauf gefunden' }
    const dateien = w.geaendert(basis)
    if (dateien.some((p) => p.includes('\n'))) return { ...alle, grund: 'Pfad mit Zeilenumbruch' }
    return { ...bedarf(dateien), grund: `${dateien.length} Dateien seit dem letzten erfolgreichen Deploy-Lauf (${basis.slice(0, 9)})` }
  } catch (fehler) {
    return { ...alle, grund: `Vergleich nicht lesbar (${String(fehler.message).split('\n')[0]})` }
  }
}

export function main(env = process.env, ausgabe = console.log, w = ECHT, schreibe = appendFileSync) {
  const { grund, ...b } = rechne(env, w)
  ausgabe(`Deploy-Prüfungen nötig: ${Object.entries(b).map(([k, v]) => `${k}=${v ? 1 : 0}`).join(' ')} — ${grund}`)
  if (env.GITHUB_OUTPUT) schreibe(env.GITHUB_OUTPUT, Object.entries(b).map(([k, v]) => `${k}=${v ? 1 : 0}\n`).join(''))
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
