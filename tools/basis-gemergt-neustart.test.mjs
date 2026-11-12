/**
 * Test für tools/basis-gemergt-neustart.mjs und den Job `basis-gemergt` in pr-pruefer-nachtrag.yml: Erkennung der Stapel-PRs,
 * Grenze, Fehlerpfade, Einstieg `main` mit Attrappen (Aufruf und Trockenschalter), Verdrahtung aus der YAML. Kein Netz, keine Uhr.
 * Aufruf: node tools/basis-gemergt-neustart.test.mjs
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { abhaengige, lauf, main, MAX_PRS } from './basis-gemergt-neustart.mjs'

const fehler = []
const gleich = (name, ist, soll) => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Ist ${JSON.stringify(ist)}, Soll ${JSON.stringify(soll)}`)
}

const pr = (number, body, isDraft = false) => ({ number, body, isDraft })
const OFFENE = [
  pr(40, 'mergen nach #30'),
  pr(10, 'erst nach #30 (Teil 2)'),
  pr(30, 'der Basis-PR selbst, nennt sich: mergen nach #30'),
  pr(50, 'mergen nach #31'),
  pr(60, 'ohne Hinweis'),
  pr(70, 'mergen nach #30', true),
  pr(80, '> mergen nach #30 (nur Zitat)'),
  pr(90, null),
]

gleich('Erkennung: nur offene Nicht-Entwürfe mit Basis 30, aufsteigend, ohne den Basis-PR', abhaengige(OFFENE, 30), [10, 40])
gleich('Erkennung: andere Basis trifft nur ihren PR', abhaengige(OFFENE, 31), [50])
gleich('Erkennung: keine Treffer', abhaengige(OFFENE, 99), [])

function fahre(basis, prs, codes = {}) {
  const zeilen = []
  const aufrufe = []
  const code = lauf({ basis, holePrs: () => prs, rechne: (nr) => (aufrufe.push(nr), codes[nr] ?? 0), melde: (t) => zeilen.push(t) })
  return { code, aufrufe, zeilen }
}

gleich('Grenze: höchstens 5 Stapel-PRs je Merge', MAX_PRS, 5)
const viele = Array.from({ length: 7 }, (_, i) => pr(101 + i, 'mergen nach #30'))
const v = fahre(30, viele)
gleich('Grenze: sechs und sieben bleiben liegen, die ersten fünf laufen', v.aufrufe, [101, 102, 103, 104, 105])
gleich('Grenze: genau 5 PRs: alle laufen, keine Restmeldung', [fahre(30, viele.slice(0, 5)).aufrufe.length, fahre(30, viele.slice(0, 5)).zeilen[0].includes('nicht bearbeitet')], [5, false])
gleich('Grenze: 6 PRs: Restmeldung nennt den sechsten', fahre(30, viele.slice(0, 6)).zeilen[0].includes('nicht bearbeitet (Grenze 5): #106'), true)

gleich('Kein Stapel-PR: Exit 0, nichts gerechnet', [fahre(30, [pr(60, 'x')]).code, fahre(30, [pr(60, 'x')]).aufrufe], [0, []])
const gut = fahre(30, OFFENE, { 10: 1, 40: 0 })
gleich('Ergebnis 0 und 1 von pr-nachrechnen: Exit 0, beide Zeilen mit Code', [gut.code, gut.aufrufe, gut.zeilen.filter((z) => z.includes('Exit'))], [0, [10, 40], ['Basis-Neustart: PR 10 Exit 1 (0 aktuell, 1 Kette neu gestartet, 2 nichts angestoßen)', 'Basis-Neustart: PR 40 Exit 0 (0 aktuell, 1 Kette neu gestartet, 2 nichts angestoßen)']])
const schlecht = fahre(30, OFFENE, { 10: 2 })
gleich('Exit 2 bei einem PR: Exit 1, der nächste PR läuft trotzdem', [schlecht.code, schlecht.aufrufe], [1, [10, 40]])
gleich('Basis fehlt (NaN): Exit 1, nichts gerechnet', [fahre(NaN, OFFENE).code, fahre(NaN, OFFENE).aufrufe], [1, []])
gleich('Basis 0: Exit 1', fahre(0, OFFENE).code, 1)
const kaputt = []
gleich('Abruffehler der PR-Liste: Exit 1, Zeile FEHLGESCHLAGEN mit Grund', [lauf({ basis: 30, holePrs: () => { throw new Error('HTTP 502\nzweite Zeile') }, rechne: () => 0, melde: (t) => kaputt.push(t) }), kaputt], [1, ['Basis-Neustart: FEHLGESCHLAGEN PR-Liste nicht lesbar (HTTP 502)']])

// Einstieg `main`: Umgebung -> Basis, Aufruf von nachrechnen (Argumente), Trockenschalter nur bei TROCKEN=true.
function einstieg(env) {
  const aufrufe = []
  const zeilen = []
  const code = main(env, { holePrs: () => OFFENE, nachrechnen: (argv) => (aufrufe.push(argv), 0), melde: (t) => zeilen.push(t) })
  return { code, aufrufe }
}
gleich('main: Basis aus BASIS_PR, nachrechnen ohne --trocken', einstieg({ BASIS_PR: '30', TROCKEN: 'false' }), { code: 0, aufrufe: [['10'], ['40']] })
gleich('main: TROCKEN=true reicht --trocken durch', einstieg({ BASIS_PR: '30', TROCKEN: 'true' }).aufrufe, [['--trocken', '10'], ['--trocken', '40']])
gleich('main: TROCKEN fehlt: nicht trocken (Standardwert)', einstieg({ BASIS_PR: '31' }).aufrufe, [['50']])
gleich('main: BASIS_PR fehlt: Exit 1', einstieg({}).code, 1)

// Verdrahtung aus der YAML: Auslöser, Bedingung, Rechte, Token, Aufruf.
const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer-nachtrag.yml', import.meta.url), 'utf8'))
const job = wf.jobs['basis-gemergt']
const schritt = job.steps.find((s) => s.name === 'Stapel-PRs nachrechnen')
gleich('Auslöser: pull_request_target closed', wf.on.pull_request_target, { types: ['closed'] })
gleich('Job nur bei gemergtem PR (geschlossen ohne Merge startet nichts)', job.if, "github.event_name == 'pull_request_target' && github.event.pull_request.merged == true")
gleich('Schritt ruft das Werkzeug ohne Argumente, ohne Ausdruck in run', [schritt.run, schritt.run.includes('${{')], ['node tools/basis-gemergt-neustart.mjs', false])
gleich('Basis-Nummer aus dem Ereignis, nur über env', schritt.env.BASIS_PR, '${{ github.event.pull_request.number }}')
gleich('Token: PAT, sonst GITHUB_TOKEN; ohne PAT Trockenlauf', [schritt.env.GH_TOKEN, schritt.env.TROCKEN], ['${{ secrets.NACHT_MERGER_TOKEN || secrets.GITHUB_TOKEN }}', "${{ secrets.NACHT_MERGER_TOKEN == '' }}"])
gleich('Rechte des Jobs nur lesend, Frist unter 10 min', [job.permissions, job['timeout-minutes'] < 10], [{ contents: 'read', 'pull-requests': 'read', actions: 'read' }, true])
const checkout = job.steps.find((s) => s.uses?.startsWith('actions/checkout'))
gleich('Checkout mit voller Historie (pr-nachrechnen liest git log) ohne gespeicherte Zugangsdaten', [checkout.with['fetch-depth'], checkout.with['persist-credentials']], [0, false])
gleich('Zeitbudget: je PR 1 min, höchstens MAX_PRS, Job-Frist deckt es', MAX_PRS * 1 <= job['timeout-minutes'], true)

console.log(`Basis-Neustart: ${fehler.length === 0 ? 'alle Fälle grün' : fehler.length + ' Fälle rot'}`)
process.exit(fehler.length === 0 ? 0 : 1)
