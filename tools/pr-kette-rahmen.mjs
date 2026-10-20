/**
 * Festgeschriebener Rahmen der PR-Prüfkette (Runde 4, 16.10.2026), Teil von `tools/pr-kette-pruefen.mjs`:
 * Trigger, Rechte, Runner, Laufzeitgrenze, Schrittfolge der Teiljobs (`with` je Action) und die Schritte der Composite-Action
 * `.github/actions/kette-einrichten`. Ohne das könnte ein zweiter Checkout (`ref: main`) oder ein Schritt in der Action
 * (`git checkout origin/main -- .`, `npm pkg set`, Schreiben nach `$GITHUB_ENV`) die Kette main statt den PR prüfen lassen.
 */
import { isDeepStrictEqual } from 'node:util'

const CHECKOUT = 'actions/checkout@v4'
const EINRICHTEN = './.github/actions/kette-einrichten'
const FRIST_MAX = 30
const RUNNER = 'ubuntu-latest'
const SOLL_PERMISSIONS = { contents: 'read' }
/** Einzige erlaubte Workflow-env: Ortszeit wie Daniels Rechner, damit Berlin-Fehler (00:30 Berlin = 22:30 UTC) in der Kette auffallen. */
const SOLL_ENV = { TZ: 'Europe/Berlin' }
const SOLL_TRIGGER = { pull_request: { branches: ['main'], types: ['opened', 'synchronize', 'reopened', 'ready_for_review'] } }

const NM_SCHLUESSEL = "nm-${{ runner.os }}-node22-${{ hashFiles('package.json', 'package-lock.json') }}"
const PW_SCHLUESSEL = "pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}"
/** Sollfassung der Action: `inputs` und `runs` (Name und Beschreibung sind frei). Jede Änderung hier ist eine bewusste Entscheidung. */
const SOLL_AKTION = {
  inputs: { playwright: { description: 'Chromium für Playwright bereitlegen', default: 'false' } },
  runs: {
    using: 'composite',
    steps: [
      { uses: 'actions/setup-node@v4', with: { 'node-version': 22, cache: 'npm' } },
      { name: 'node_modules aus dem Cache', id: 'nm', uses: 'actions/cache@v4', with: { path: 'node_modules', key: NM_SCHLUESSEL } },
      { name: 'Abhängigkeiten installieren', if: "steps.nm.outputs.cache-hit != 'true'", shell: 'bash', run: 'npm ci' },
      { name: 'Browser-Cache', if: "inputs.playwright == 'true'", id: 'pw', uses: 'actions/cache@v4', with: { path: '~/.cache/ms-playwright', key: PW_SCHLUESSEL } },
      {
        name: 'Microsoft-Paketquelle entfernen',
        if: "inputs.playwright == 'true'",
        shell: 'bash',
        run: 'sudo grep -l packages.microsoft.com /etc/apt/sources.list.d/* | sudo xargs -r rm -fv || true',
      },
      {
        name: 'Chromium installieren',
        if: "inputs.playwright == 'true' && steps.pw.outputs.cache-hit != 'true'",
        shell: 'bash',
        run: 'npx playwright install --with-deps chromium',
      },
      {
        name: 'Chromium-Systempakete',
        if: "inputs.playwright == 'true' && steps.pw.outputs.cache-hit == 'true'",
        shell: 'bash',
        run: 'npx playwright install-deps chromium',
      },
    ],
  },
}

/** Verstöße der Composite-Action gegen die Sollfassung. */
function pruefeAktion(aktion) {
  if (!aktion) return ['Aktion kette-einrichten: nicht gelesen']
  const fehler = []
  if (!isDeepStrictEqual(aktion.inputs, SOLL_AKTION.inputs)) fehler.push('Aktion kette-einrichten: inputs weichen von der Sollfassung ab')
  const ist = aktion.runs?.steps ?? []
  const soll = SOLL_AKTION.runs.steps
  if (aktion.runs?.using !== 'composite') fehler.push('Aktion kette-einrichten: runs.using ist nicht composite')
  if (ist.length !== soll.length) fehler.push(`Aktion kette-einrichten: ${ist.length} Schritte, Sollfassung hat ${soll.length}`)
  soll.forEach((s, i) => {
    if (!isDeepStrictEqual(ist[i], s)) fehler.push(`Aktion kette-einrichten: Schritt ${i + 1} (${s.name ?? s.uses}) weicht von der Sollfassung ab`)
  })
  const fremd = Object.keys(aktion.runs ?? {}).filter((k) => !['using', 'steps'].includes(k))
  return [...fehler, ...fremd.map((k) => `Aktion kette-einrichten: runs.${k} nicht erlaubt`)]
}

/** Verstöße der Schrittfolge eines Teiljobs: erst ein Checkout ohne `with`, dann kette-einrichten (nur `playwright: 'true'`), `with` nie an `run`. */
export function pruefeSchrittfolge(id, steps) {
  const fehler = []
  const nutzt = (s, was) => s?.uses === was
  if (!nutzt(steps[0], CHECKOUT)) fehler.push(`Teiljob "${id}": erster Schritt ist nicht ${CHECKOUT}`)
  if (!nutzt(steps[1], EINRICHTEN)) fehler.push(`Teiljob "${id}": zweiter Schritt ist nicht ${EINRICHTEN}`)
  if (steps.filter((s) => nutzt(s, CHECKOUT)).length !== 1) fehler.push(`Teiljob "${id}": genau ein Checkout verlangt (ein zweiter könnte main holen)`)
  for (const s of steps) {
    if (nutzt(s, CHECKOUT) && s.with !== undefined) fehler.push(`Teiljob "${id}": Checkout mit with (ref/repository) nicht erlaubt`)
    const einrichten = s.with === undefined || isDeepStrictEqual(s.with, { playwright: 'true' })
    if (nutzt(s, EINRICHTEN) && !einrichten) fehler.push(`Teiljob "${id}": kette-einrichten erlaubt nur with playwright: 'true'`)
    if (s.run !== undefined && s.with !== undefined) fehler.push(`Teiljob "${id}": with an einem run-Schritt nicht erlaubt`)
  }
  return fehler
}

/** Verstöße gegen Trigger, Rechte, Runner, Laufzeitgrenze (alle Jobs außer dem unverbindlichen) und die Action. */
export function pruefeRahmen(doc, pflichtJobs, aktion) {
  const fehler = []
  if (!isDeepStrictEqual(doc.permissions, SOLL_PERMISSIONS)) fehler.push('Workflow: permissions sind nicht exakt { contents: read }')
  if (!isDeepStrictEqual(doc.env, SOLL_ENV)) fehler.push('Workflow: env ist nicht exakt { TZ: Europe/Berlin }')
  if (!isDeepStrictEqual(doc.on, SOLL_TRIGGER)) fehler.push('Workflow: on ist nicht exakt pull_request auf main mit den vier types')
  for (const [id, job] of pflichtJobs) {
    if (job['runs-on'] !== RUNNER) fehler.push(`Job "${id}": runs-on ist nicht ${RUNNER}`)
    if (job['timeout-minutes'] > FRIST_MAX) fehler.push(`Job "${id}": timeout-minutes über ${FRIST_MAX}`)
  }
  return [...fehler, ...pruefeAktion(aktion)]
}
