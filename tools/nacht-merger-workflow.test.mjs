/**
 * Test zu .github/workflows/nacht-merger.yml: Auslöser, Rechte, Token-Weiche und ob der Schritt das Werkzeug wirklich mit den
 * richtigen Argumenten startet. Der run-Block läuft in bash mit einem Ersatz-`node`, der nur seine Argumente aufschreibt.
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

let fehler = 0
let anzahl = 0
function pruefe(name, ok, info = '') {
  anzahl++
  if (!ok) {
    fehler++
    console.error(`✗ ${name} ${info}`)
  }
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const wf = parse(readFileSync(join(wurzel, '.github/workflows/nacht-merger.yml'), 'utf8'))
const job = wf.jobs.mergen
const schritt = job.steps.find((s) => s.name === 'Freigegebene PRs mergen')

pruefe('Auslöser nur workflow_dispatch (Wecker)', JSON.stringify(Object.keys(wf.on)) === '["workflow_dispatch"]')
pruefe('Eingaben trocken und hoechstens, Vorgabe 3', wf.on.workflow_dispatch.inputs.trocken.default === false && wf.on.workflow_dispatch.inputs.hoechstens.default === '3')
pruefe('GITHUB_TOKEN nur lesend', JSON.stringify(wf.permissions) === '{"contents":"read","pull-requests":"read","actions":"read"}')
pruefe('genau ein Job mit Frist unter 30 Minuten', Object.keys(wf.jobs).join() === 'mergen' && job['timeout-minutes'] > 0 && job['timeout-minutes'] <= 20)
pruefe('Läufe stoßen sich nicht an', wf.concurrency.group === 'nacht-merger' && wf.concurrency['cancel-in-progress'] === false)
pruefe('Schritte: Checkout ohne gespeichertes Token, dann der Merge-Schritt', job.steps.length === 2 && job.steps[0].uses === 'actions/checkout@v4' && job.steps[0].with['persist-credentials'] === false && job.steps[0].with['fetch-depth'] === 0)
pruefe('Token: Secret, sonst GITHUB_TOKEN', schritt.env.GH_TOKEN === '${{ secrets.NACHT_MERGER_TOKEN || secrets.GITHUB_TOKEN }}')
pruefe('Merge-Token-Weiche liest das Secret', schritt.env.MERGER_TOKEN_DA === "${{ secrets.NACHT_MERGER_TOKEN != '' }}")
pruefe('gh löst {owner}/{repo} über GH_REPO auf (Checkout-unabhängig)', schritt.env.GH_REPO === '${{ github.repository }}' && schritt.env.GITHUB_REPOSITORY === '${{ github.repository }}')
pruefe('Eingaben kommen nur über env', schritt.env.TROCKEN === '${{ inputs.trocken }}' && schritt.env.HOECHSTENS === "${{ inputs.hoechstens || '3' }}" && !schritt.run.includes('${{'))

const ordner = mkdtempSync(join(tmpdir(), 'nacht-merger-wf-'))
const aufruf = join(ordner, 'aufruf.txt')
writeFileSync(join(ordner, 'node'), `#!/bin/sh\necho "$@" >> "${aufruf.replaceAll('\\', '/')}"\n`)
chmodSync(join(ordner, 'node'), 0o755)
function fahre(env) {
  rmSync(aufruf, { force: true })
  const r = spawnSync('bash', ['-c', schritt.run], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    env: { PATH: `${ordner.replaceAll('\\', '/')}:${process.env.PATH}`, ...env },
  })
  let gestartet = ''
  try {
    gestartet = readFileSync(aufruf, 'utf8').trim()
  } catch {
    gestartet = '(nicht gestartet)'
  }
  return { exit: r.status, gestartet, aus: r.stdout }
}

const mitToken = fahre({ MERGER_TOKEN_DA: 'true', TROCKEN: 'false', HOECHSTENS: '3' })
pruefe('mit Token: echter Lauf mit Riegel 3', mitToken.exit === 0 && mitToken.gestartet === 'tools/nacht-merger.mjs --hoechstens 3', mitToken.gestartet)
const handTrocken = fahre({ MERGER_TOKEN_DA: 'true', TROCKEN: 'true', HOECHSTENS: '5' })
pruefe('mit Token, Eingabe trocken: Trockenlauf, Riegel 5', handTrocken.gestartet === 'tools/nacht-merger.mjs --hoechstens 5 --trocken', handTrocken.gestartet)
const ohneToken = fahre({ MERGER_TOKEN_DA: 'false', TROCKEN: '', HOECHSTENS: '3' })
pruefe('ohne Token: Trockenlauf mit Hinweis', ohneToken.gestartet === 'tools/nacht-merger.mjs --hoechstens 3 --trocken' && ohneToken.aus.includes('NACHT_MERGER_TOKEN fehlt'), ohneToken.gestartet)
const leerUndTrocken = fahre({ MERGER_TOKEN_DA: '', TROCKEN: 'false', HOECHSTENS: '1' })
pruefe('leere Token-Angabe gilt als fehlend', leerUndTrocken.gestartet === 'tools/nacht-merger.mjs --hoechstens 1 --trocken', leerUndTrocken.gestartet)
rmSync(ordner, { recursive: true, force: true })

if (fehler > 0) {
  console.error(`nacht-merger-workflow.test: ${fehler} von ${anzahl} Fällen rot`)
  process.exit(1)
}
console.log(`nacht-merger-workflow.test: ${anzahl} Fälle grün (Auslöser, Rechte, Token-Weiche, run-Block mit Ersatz-node in bash)`)
