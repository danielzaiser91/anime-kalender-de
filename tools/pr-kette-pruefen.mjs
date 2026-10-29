/**
 * Wächter für `.github/workflows/pr-pruefung.yml`: Die Teiljobs der PR-Prüfkette müssen zusammen genau `check:vor-commit` abdecken,
 * und der Sammeljob `PR-Prüfkette` darf keinen Teiljob verlieren (16.10.2026, Aufteilung in parallele Jobs).
 * Regeln (Form statt Muster, Whitelist statt Verbotsliste; 16.10.2026):
 *  - Prüfschritte eines Teiljobs sind genau `run: npm run <name>` (eine Zeile, nichts davor oder danach; env nur `PAGES_BASE: /`);
 *    nur so zählt eine Prüfung. Jede `npm run X` aus `check:vor-commit` steht in genau einem Teiljob (`check:vor-commit` selbst zählt alle);
 *  - Teiljob-Schlüssel nur name/if/runs-on/timeout-minutes/steps (kein strategy, defaults, env, continue-on-error), `if` textgleich der Standardbedingung,
 *    Schritt-Schlüssel nur name/uses/with/run/env (kein if, shell, working-directory), `uses` nur checkout und kette-einrichten, Workflow ohne env/defaults;
 *    Rahmen (Trigger, Rechte, Runner, Frist, `with` je Action, Schritte der Action `kette-einrichten`) siehe tools/pr-kette-rahmen.mjs;
 *  - der Sammeljob (Name `PR-Prüfkette`) führt jeden anderen Job in `needs`, auch `PR-Aussehen…` (davon nur die Form ausgenommen), sein `if` ist textgleich `always() && <if der Teiljobs>`
 *    (sonst überspringt ihn ein roter Teiljob, und übersprungen zählt als bestanden), er hat genau einen Schritt, dessen Zeilen und env textgleich der Sollfassung sind.
 * Aufruf: node tools/pr-kette-pruefen.mjs  (Exit 1 bei Verstoß; läuft über tools/pr-kette-pruefen.test.mjs in check:workflows)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { DATENBAU_NAME, pruefeDatenbau } from './pr-kette-datenbau.mjs'
import { pruefeRahmen, pruefeSchrittfolge } from './pr-kette-rahmen.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const SAMMEL = 'PR-Prüfkette'
const AUSSEHEN = 'PR-Aussehen'
/** Aussehen-Jobs (Matrix, eigene Form, kein Teil von check:vor-commit); sie zählen im Sammeljob trotzdem (seit 16.10.2026). */
const istAussehen = (job) => String(job.name ?? '').startsWith(AUSSEHEN)
/** Jobs mit eigener Form (Aussehen-Matrix, Datenbau), die nicht Teil von check:vor-commit sind. */
const istSonderjob = (job) => istAussehen(job) || job.name === DATENBAU_NAME
const TEILJOB_BEDINGUNG = "!startsWith(github.head_ref, 'daten/') && !github.event.pull_request.draft"

/** Alle `npm run X`-Namen in einem Text (für `check:vor-commit`). */
function npmNamen(text) {
  return [...String(text ?? '').matchAll(/npm run ([\w:.-]+)/g)].map((m) => m[1])
}

/** Name der Prüfung, wenn `run` exakt die Form `npm run <name>` hat (eine Zeile, sonst nichts), sonst null. */
function pruefName(run) {
  return /^npm run ([\w:.-]+)$/.exec(String(run ?? ''))?.[1] ?? null
}

/** Zählt je Prüfung, in wie vielen Vorkommen sie über alle Teiljobs läuft (nur feste Form zählt). */
function zaehleVorkommen(teiljobs, vorCommit) {
  const zaehler = new Map(vorCommit.map((n) => [n, 0]))
  for (const job of teiljobs) {
    for (const schritt of job.steps ?? []) {
      const name = pruefName(schritt.run)
      if (name === null) continue
      const liste = name === 'check:vor-commit' ? vorCommit : [name]
      for (const n of liste) if (zaehler.has(n)) zaehler.set(n, zaehler.get(n) + 1)
    }
  }
  return zaehler
}

/** Urteil in `tools/kette-urteil.mjs` (Test dort): success = grün, nur cancelled = abgebrochen, sonst Exit 1. */
const SAMMEL_ZEILEN = 'node tools/kette-urteil.mjs'
const CHECKOUT = { uses: 'actions/checkout@v4' }
const SAMMEL_ENV = { NEEDS: '${{ toJSON(needs) }}', GH_TOKEN: '${{ github.token }}' }
/** `actions: write` nur für `force-cancel` (API) im Urteilsskript (nichts sonst am Sammeljob). */
const SAMMEL_RECHTE = { contents: 'read', actions: 'write' }
const WORKFLOW_SCHLUESSEL = ['name', 'on', 'permissions', 'env', 'concurrency', 'jobs']
const JOB_SCHLUESSEL = ['name', 'if', 'runs-on', 'timeout-minutes', 'steps']
const SAMMEL_JOB_SCHLUESSEL = [...JOB_SCHLUESSEL, 'needs', 'permissions']
const SCHRITT_SCHLUESSEL = ['name', 'uses', 'with', 'run', 'env']
const UPLOAD = 'actions/upload-pages-artifact@v3'
const ERLAUBTE_ACTIONS = ['actions/checkout@v4', './.github/actions/kette-einrichten', UPLOAD]
/** Einziger Schritt mit Ausgabe: der Bau für den Deploy (`tools/deploy-aus-build.mjs`), fest in Form, nur als letzter Schritt, nur mit dem Pflicht-Env. */
const BAU_JOB = 'bau'
const UPLOAD_WITH = { path: 'dist', 'retention-days': 3 }
const BAU_ENV = { PAGES_BASE: '/', VITE_NEWSLETTER_API: '${{ vars.NEWSLETTER_API_URL }}' }

/** Unerlaubte Schlüssel eines Objekts (Whitelist statt Verbotsliste: neue Schalter fallen von selbst auf). */
function fremdeSchluessel(objekt, erlaubt) {
  return Object.keys(objekt).filter((k) => !erlaubt.includes(k))
}

/** Verstöße eines Jobs gegen die feste Form (Schlüssel, Laufzeitgrenze). */
function pruefeJobForm(id, job, erlaubt) {
  const fehler = fremdeSchluessel(job, erlaubt).map((k) => `Job "${id}": Schlüssel "${k}" nicht erlaubt (Whitelist: ${erlaubt.join(', ')})`)
  const frist = job['timeout-minutes']
  if (!Number.isInteger(frist) || frist < 1) fehler.push(`Job "${id}": timeout-minutes muss eine ganze Zahl ≥ 1 sein`)
  return fehler
}

/** Verstöße der Sammeljob-Schritte: Checkout, dann genau ein Urteilsschritt mit fester Fassung, nichts davor, nichts danach. */
function pruefeSammlerSchritte(sammler) {
  const schritte = sammler.steps ?? []
  const fehler = []
  if (schritte.length !== 2) fehler.push(`Sammeljob: genau zwei Schritte verlangt (Checkout, Urteil), gefunden ${schritte.length}`)
  if (JSON.stringify(schritte[0]) !== JSON.stringify(CHECKOUT)) fehler.push('Sammeljob: erster Schritt ist nicht exakt actions/checkout@v4 ohne Zusätze')
  for (const s of schritte.slice(1)) {
    for (const k of fremdeSchluessel(s, ['name', 'env', 'run'])) fehler.push(`Sammeljob: Schlüssel "${k}" am Schritt nicht erlaubt`)
    if (JSON.stringify(s.env) !== JSON.stringify(SAMMEL_ENV)) fehler.push('Sammeljob: env ist nicht exakt NEEDS und GH_TOKEN')
    if (String(s.run ?? '').trim() !== SAMMEL_ZEILEN) {
      fehler.push('Sammeljob: nicht auf success geprüft - die Schritt-Zeilen sind nicht textgleich der Sollfassung (node tools/kette-urteil.mjs)')
    }
  }
  return fehler
}

/** Verstöße des Sammeljobs: `needs`, `always()`, Form, feste Prüfzeilen. */
function pruefeSammler(jobs, sammlerId) {
  const fehler = []
  const sammler = jobs[sammlerId]
  const erwartet = Object.entries(jobs)
    .filter(([id]) => id !== sammlerId)
    .map(([id]) => id)
  const needs = [sammler.needs ?? []].flat()
  for (const id of erwartet) if (!needs.includes(id)) fehler.push(`Sammeljob: Teiljob "${id}" fehlt in needs`)
  for (const id of needs) if (!jobs[id]) fehler.push(`Sammeljob: needs nennt unbekannten Job "${id}"`)
  const erwartetIf = `\${{ always() && ${TEILJOB_BEDINGUNG} }}`
  if (sammler.if !== erwartetIf) {
    fehler.push(`Sammeljob: if ist nicht textgleich "${erwartetIf}" (always() ist Pflicht, sonst überspringt ihn ein roter Teiljob = bestanden)`)
  }
  if (JSON.stringify(sammler.permissions) !== JSON.stringify(SAMMEL_RECHTE)) fehler.push('Sammeljob: permissions sind nicht exakt contents: read, actions: write')
  fehler.push(...pruefeJobForm('Sammeljob', sammler, SAMMEL_JOB_SCHLUESSEL), ...pruefeSammlerSchritte(sammler))
  return fehler
}

/** Verstöße eines Teiljob-Schritts: nur bekannte Schlüssel, `uses` nur aus der Liste, `run` nur als `npm run <name>` mit Name aus `check:vor-commit`, env nur PAGES_BASE. */
function pruefeTeiljobSchritt(id, s, vorCommit) {
  const fehler = fremdeSchluessel(s, SCHRITT_SCHLUESSEL).map((k) => `Teiljob "${id}": Schlüssel "${k}" am Schritt nicht erlaubt`)
  if (s.uses !== undefined && !ERLAUBTE_ACTIONS.includes(s.uses)) fehler.push(`Teiljob "${id}": uses "${s.uses}" nicht erlaubt`)
  if (s.run !== undefined && pruefName(s.run) === null) fehler.push(`Teiljob "${id}": run ist nicht exakt "npm run <name>" (${JSON.stringify(s.run)})`)
  const name = pruefName(s.run)
  if (name !== null && name !== 'check:vor-commit' && !vorCommit.includes(name)) {
    fehler.push(`Teiljob "${id}": run "${name}" gehört nicht zu check:vor-commit (kein fremdes Skript vor der Prüfung)`)
  }
  const envErlaubt = [{ PAGES_BASE: '/' }, BAU_ENV].some((e) => JSON.stringify(s.env) === JSON.stringify(e))
  if (JSON.stringify(s.env) === JSON.stringify(BAU_ENV) && id !== BAU_JOB) fehler.push(`Teiljob "${id}": das Env des Baus (VITE_NEWSLETTER_API) nur im Job "${BAU_JOB}"`)
  if (s.uses === UPLOAD && id !== BAU_JOB) fehler.push(`Teiljob "${id}": ${UPLOAD} nur im Job "${BAU_JOB}"`)
  if (s.env !== undefined && !envErlaubt) fehler.push(`Teiljob "${id}": env am Schritt nur PAGES_BASE: / (beim Bau zusätzlich VITE_NEWSLETTER_API) erlaubt`)
  if (s.uses === UPLOAD && JSON.stringify(s.with) !== JSON.stringify(UPLOAD_WITH)) fehler.push(`Teiljob "${id}": ${UPLOAD} nur mit with ${JSON.stringify(UPLOAD_WITH)}`)
  return fehler
}

/** Auflagen an Jobs: feste Bedingung, feste Form, nichts abfangen (übersprungen oder abgefangen zählt als bestanden). */
function pruefeAuflagen(doc, jobs, sammlerId, vorCommit) {
  const fehler = fremdeSchluessel(doc, WORKFLOW_SCHLUESSEL).map((k) => `Workflow: Schlüssel "${k}" nicht erlaubt (env/defaults wirken auf alle Schritte)`)
  const standard = `\${{ ${TEILJOB_BEDINGUNG} }}`
  for (const [id, job] of Object.entries(jobs)) {
    if (istSonderjob(job) || id === sammlerId) continue
    fehler.push(...pruefeJobForm(id, job, JOB_SCHLUESSEL))
    if (job.if !== standard) fehler.push(`Teiljob "${id}": if ist nicht textgleich "${standard}"`)
    for (const s of job.steps ?? []) fehler.push(...pruefeTeiljobSchritt(id, s, vorCommit))
    fehler.push(...pruefeSchrittfolge(id, job.steps ?? []))
    const hochladen = (job.steps ?? []).findIndex((s) => s.uses === UPLOAD)
    if (hochladen >= 0 && hochladen !== (job.steps ?? []).length - 1) fehler.push(`Teiljob "${id}": ${UPLOAD} nur als letzter Schritt`)
  }
  return fehler
}

/** Gesamtprüfung: Liste der Verstöße (leer = in Ordnung). */
export function pruefeKette(doc, scripts, aktion) {
  const vorCommit = npmNamen(scripts['check:vor-commit'])
  const jobs = doc.jobs ?? {}
  const sammlerId = Object.keys(jobs).find((id) => jobs[id].name === SAMMEL)
  if (!sammlerId) return [`Kein Job mit dem Namen "${SAMMEL}" (Pflicht-Check im Ruleset)`]
  const teiljobs = Object.entries(jobs)
    .filter(([id, j]) => id !== sammlerId && !istSonderjob(j))
    .map(([, j]) => j)
  const pflichtJobs = Object.entries(jobs).filter(([, j]) => !istAussehen(j))
  const fehler = [
    ...pruefeSammler(jobs, sammlerId),
    ...pruefeAuflagen(doc, jobs, sammlerId, vorCommit),
    ...pruefeDatenbau(jobs),
    ...pruefeRahmen(doc, pflichtJobs, aktion),
  ]
  for (const [name, anzahl] of zaehleVorkommen(teiljobs, vorCommit)) {
    if (anzahl !== 1) fehler.push(`Prüfung "${name}" läuft ${anzahl}-mal in den Teiljobs (verlangt: genau einmal)`)
  }
  return fehler
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const doc = parse(readFileSync(resolve(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8'))
  const { scripts } = JSON.parse(readFileSync(resolve(WURZEL, 'package.json'), 'utf8'))
  const aktion = parse(readFileSync(resolve(WURZEL, '.github/actions/kette-einrichten/action.yml'), 'utf8'))
  const fehler = pruefeKette(doc, scripts, aktion)
  for (const f of fehler) console.error(`✗ ${f}`)
  if (fehler.length > 0) process.exit(1)
  console.log(`pr-kette-pruefen: ${npmNamen(scripts['check:vor-commit']).length} Prüfungen, jede in genau einem Teiljob; Sammeljob vollständig.`)
}
