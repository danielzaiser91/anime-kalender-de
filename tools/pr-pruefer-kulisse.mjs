/**
 * Kulisse für tools/pr-pruefer-ablauf.test.mjs: führt die run-Schritte des Jobs `pruefen` aus pr-pruefer.yml bis
 * einschließlich der Laufzeitsperre (id `eingang`) mit `bash -e` aus, wie der Runner bei fehlendem `shell`.
 * `gh` ist das Node-Programm unter dem Namen gh; `gh api …`/`gh pr …` laden so die Attrappe `api` bzw. `pr` im Arbeitsordner.
 * Die Attrappe antwortet nur auf die Aufrufe, die der Workflow heute macht (Pfad und Parameter genau), sonst HTTP 404.
 */
import { spawnMitLimit } from './kind-mit-limit.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const KOPF = 'c'.repeat(40)
const BASIS = 'e'.repeat(40)
const CHECKOUT = 'actions/checkout@v4'
const REPO = 'o/r'
const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCHLUESSEL = { workflow: ['name', 'on', 'permissions', 'concurrency', 'jobs'], job: ['name', 'needs', 'if', 'runs-on', 'timeout-minutes', 'permissions', 'env', 'steps'] }

const ATTRAPPE = fs.readFileSync(new URL('./pr-pruefer-kulisse-gh.cjs', import.meta.url), 'utf8')

const k = (login, author_association, body) => ({ user: { login }, author_association, body })
const commit = (sha, betreff) => ({ sha, commit: { message: `${betreff}\n\nRumpf` } })

/** Daten eines PR für die Attrappe; `kopf` ist der letzte Commit der Liste. */
export function prDaten(n, kopf) {
  return {
    view: `Titel: Titel ${n}\nZweig: zweig-${n}\n\nBeschreibung ${n}`,
    login: 'claude[bot]',
    dateien: [{ filename: 'a.ts', status: 'modified', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-a\n+b' }],
    kommentare: [
      [k('inhaber', 'OWNER', 'Prüfer: ändern'), k('inhaber', 'OWNER', '## Nachtrag eins')],
      [k('fremd', 'NONE', 'Nachtrag Fremd'), k('inhaber', 'OWNER', '**Nachtrag zwei')],
    ],
    commits: [[commit('a'.repeat(40), 'fix: eins'), commit('b'.repeat(40), 'refactor: zwei')], [commit(kopf, 'test: drei')]],
    einzel: { ['a'.repeat(40)]: ['a.ts'], ['b'.repeat(40)]: ['lib/x.ts'], [kopf]: ['a.test.ts'] },
  }
}

function auswerten(text, kontext) {
  return String(text).replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, a) => {
    const werte = {
      'github.event.pull_request.number': kontext.pr,
      'github.event.pull_request.head.sha': KOPF,
      'github.event.pull_request.base.sha': BASIS,
      'github.repository': REPO,
      'github.head_ref': 'zweig-7',
      'secrets.GITHUB_TOKEN': 'tok-attrappe',
      'runner.temp': kontext.temp,
    }
    const schritt = /^steps\.([\w-]+)\.outputs\.([\w-]+)$/.exec(a)
    if (schritt) return kontext.ausgaben[schritt[1]]?.[schritt[2]] ?? ''
    if (!(a in werte)) throw new Error(`Ausdruck nicht nachgebildet: ${a}`)
    return werte[a]
  })
}

function fremdeSchluessel(objekt, erlaubt) {
  return Object.keys(objekt ?? {}).filter((s) => !erlaubt.includes(s))
}

/**
 * `steps.<id>.outputs.<name> == '<wert>'`, auch mit ` && ` verknüpft (die Bedingungsformen der Zusatzschritte):
 * wahr/falsch, sonst null (jede andere Form, auch ein Glied davon).
 */
export function bedingungWahr(wenn, ausgaben) {
  const glieder = String(wenn).split(' && ').map((g) => /^steps\.([\w-]+)\.outputs\.([\w-]+) == '([^']*)'$/.exec(g))
  if (glieder.some((m) => !m)) return null
  return glieder.every((m) => ausgaben[m[1]]?.[m[2]] === m[3])
}

/** Wie der Checkout: die Dateien aus tools/ (oberste Ebene) liegen im Arbeitsordner, daneben die Attrappe. */
function kopiereSkripte(ziel) {
  for (const e of fs.readdirSync(path.join(WURZEL, 'tools'), { withFileTypes: true })) {
    if (e.isFile()) fs.copyFileSync(path.join(WURZEL, 'tools', e.name), path.join(ziel, e.name))
  }
}

function bereite(ordner, prs) {
  const bin = path.join(ordner, 'bin')
  const ws = path.join(ordner, 'ws')
  const temp = path.join(ordner, 'runner').replaceAll('\\', '/')
  for (const d of [bin, path.join(ws, 'tools'), temp]) fs.mkdirSync(d, { recursive: true })
  // Windows sucht nur gh.exe (kein Skript); ein harter Link nach Program Files ist dort verboten, also Kopie.
  if (process.platform === 'win32') fs.copyFileSync(process.execPath, path.join(bin, 'gh.exe'))
  else fs.symlinkSync(process.execPath, path.join(bin, 'gh'))
  for (const unterbefehl of ['api', 'pr', 'workflow', 'run']) fs.writeFileSync(path.join(ws, unterbefehl), ATTRAPPE)
  fs.writeFileSync(path.join(ordner, 'daten.json'), JSON.stringify({ repo: REPO, prs }))
  return { bin, ws, temp }
}

function umgebung(ordner, bin, temp) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([s]) => !/^(GITHUB_|RUNNER_|GH_)/.test(s)))
  const pfad = Object.keys(env).find((s) => s.toUpperCase() === 'PATH') ?? 'PATH'
  env[pfad] = bin + path.delimiter + env[pfad]
  return Object.assign(env, {
    RUNNER_TEMP: temp,
    GITHUB_REPOSITORY: REPO,
    GITHUB_STEP_SUMMARY: path.join(ordner, 'summary.md'),
    ATTRAPPE_LOG: path.join(ordner, 'aufrufe.log'),
    ATTRAPPE_DATEN: path.join(ordner, 'daten.json'),
  })
}

function leseAusgaben(datei) {
  const zeilen = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8').split('\n').filter(Boolean) : []
  return Object.fromEntries(zeilen.map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1)]))
}


const USES_ERLAUBT = { [CHECKOUT]: 'checkout', 'actions/download-artifact@v4': 'download', 'actions/upload-artifact@v4': 'upload' }
const USES_SCHLUESSEL = ['name', 'id', 'if', 'uses', 'with', 'continue-on-error']

/** Die Artefakt-Schritte: Download legt `artefakt` als Datei ab, Upload merkt sich Name, Pfad und Inhalt; Checkout ist ein Nichts. */
function fuehreUsesAus(s, kontext, ergebnis) {
  const art = USES_ERLAUBT[s.uses]
  if (!art || fremdeSchluessel(s, USES_SCHLUESSEL).length) {
    return `${s.name}: uses ist "${s.uses}", die Kulisse bildet nur ${Object.keys(USES_ERLAUBT).join(', ')} nach (USES_ERLAUBT in tools/pr-pruefer-kulisse.mjs anpassen, wenn die Änderung Absicht ist)`
  }
  if (art === 'download' && kontext.artefakt !== undefined) {
    const ziel = auswerten(s.with.path, kontext)
    fs.mkdirSync(ziel, { recursive: true })
    fs.writeFileSync(path.join(ziel, 'mutationsprobe.txt'), kontext.artefakt)
    ergebnis.heruntergeladen = s.with.name
  }
  if (art === 'upload') {
    const pfad = auswerten(s.with.path, kontext)
    ergebnis.hochgeladen = { name: s.with.name, pfad, inhalt: fs.existsSync(pfad) ? fs.readFileSync(pfad, 'utf8') : null, ohneDatei: s.with['if-no-files-found'] }
  }
  return null
}

/** Ein `run`-Schritt mit bash -e; liefert eine Fehlermeldung oder null. */
function fuehreRunAus(s, i, kontext, ctx) {
  const ausgabe = path.join(ctx.ordner, `ausgabe-${i}.txt`)
  const skript = path.join(ctx.ordner, `schritt-${i}.sh`)
  fs.writeFileSync(skript, auswerten(s.run, kontext))
  const env = { ...ctx.basis, GITHUB_OUTPUT: ausgabe, ...Object.fromEntries(Object.entries(s.env ?? {}).map(([n, w]) => [n, auswerten(w, kontext)])) }
  const r = spawnMitLimit(ctx.bash, ['-e', skript], { cwd: ctx.ws, env, encoding: 'utf8' })
  if (r.status !== 0) return `${s.name}: Exit ${r.status} ${r.stderr}`
  if (s.id) kontext.ausgaben[s.id] = leseAusgaben(ausgabe)
  kontext.protokoll[s.name] = r.stdout
  return null
}

/** Führt den Job `opt.job` bis zum Schritt mit der id `opt.ende` (null = alle Schritte) aus; liefert Ausgaben, Dateien, gh-Aufrufe oder `fehler`. */
function laufeSchritte(wf, ordner, prs, opt) {
  const job = wf.jobs?.[opt.job]
  const fremd = [...fremdeSchluessel(wf, SCHLUESSEL.workflow), ...fremdeSchluessel(job, SCHLUESSEL.job)]
  if (fremd.length) return { fehler: `Schlüssel nicht nachgebildet: ${fremd.join(', ')}` }
  const ende = opt.ende === null ? job.steps.length - 1 : job.steps.findIndex((s) => s.id === opt.ende)
  if (ende < 0) return { fehler: 'Sperre-Schritt fehlt' }
  const { bin, ws, temp } = bereite(ordner, prs)
  kopiereSkripte(path.join(ws, 'tools'))
  const kontext = { pr: '7', temp, ausgaben: {}, protokoll: {}, artefakt: opt.artefakt }
  const basis = { ...umgebung(ordner, bin, temp), ...Object.fromEntries(Object.entries(job.env ?? {}).map(([s, w]) => [s, auswerten(w, kontext)])) }
  const ctx = { ordner, ws, basis, bash: process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash' }
  const ergebnis = {}
  for (const [i, s] of job.steps.slice(0, ende + 1).entries()) {
    const wahr = s.if === undefined ? true : bedingungWahr(s.if, kontext.ausgaben)
    if (wahr === null) return { fehler: `${s.name}: Bedingung nicht nachgebildet: ${s.if}` }
    if (!wahr) continue
    if (s.uses === undefined && fremdeSchluessel(s, ['name', 'id', 'env', 'run', 'if']).length) return { fehler: `${s.name}: Schlüssel nicht nachgebildet: ${fremdeSchluessel(s, ['name', 'id', 'env', 'run', 'if'])}` }
    const fehler = s.uses !== undefined ? fuehreUsesAus(s, kontext, ergebnis) : fuehreRunAus(s, i, kontext, ctx)
    if (fehler) return { fehler }
  }
  const lies = (name) => (fs.existsSync(path.join(temp, 'pruefer', name)) ? fs.readFileSync(path.join(temp, 'pruefer', name), 'utf8') : null)
  return {
    ...ergebnis,
    kettenlog: lies('kettenlog.txt'),
    ausgaben: kontext.ausgaben,
    beschreibung: lies('pr-beschreibung.txt'),
    auflagen: lies('auflagen.md'),
    mutationsprobe: lies('mutationsprobe.txt'),
    protokoll: kontext.protokoll,
    aufrufe: leseAufrufe(path.join(ordner, 'aufrufe.log')),
    zeiten: leseZeiten(path.join(ordner, 'aufrufe.log.zeit')),
  }
}

/** Alle gh-Aufrufe der Attrappe in Reihenfolge, je Aufruf ein Wortlaut `api …` bzw. `pr …`. */
function leseAufrufe(datei) {
  const zeilen = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8').split('\n').filter(Boolean) : []
  return zeilen.map((z) => JSON.parse(z).join(' '))
}

/** Zeitpunkte (ms) der gh-Aufrufe in derselben Reihenfolge wie `aufrufe`. */
function leseZeiten(datei) {
  const zeilen = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8').split('\n').filter(Boolean) : []
  return zeilen.map(Number)
}

function imWegwerfordner(wf, prs, opt) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-pruefer-ablauf-'))
  try {
    return laufeSchritte(wf, ordner, prs, opt)
  } catch (e) {
    return { fehler: e.message }
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true })
  }
}

/** Führt den Job `pruefen` bis zur Sperre aus; `artefakt` = Inhalt des Artefakts `mutationsprobe` (fehlt: nichts herunterladbar). */
export function laufeBisEingang(wf, prs, artefakt) {
  return imWegwerfordner(wf, prs, { job: 'pruefen', ende: 'eingang', artefakt })
}

/** Führt alle Schritte des Jobs `mutationsprobe` aus (Start, Warten, Upload) gegen die gh-Attrappe. */
export function laufeProbeJob(wf, prs) {
  return imWegwerfordner(wf, prs, { job: 'mutationsprobe', ende: null })
}
