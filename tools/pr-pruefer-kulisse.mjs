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
const SCHLUESSEL = { workflow: ['name', 'on', 'permissions', 'concurrency', 'jobs'], job: ['name', 'if', 'runs-on', 'timeout-minutes', 'env', 'steps'] }

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
  fs.writeFileSync(path.join(ws, 'api'), ATTRAPPE)
  fs.writeFileSync(path.join(ws, 'pr'), ATTRAPPE)
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

function laufeSchritte(wf, ordner, prs) {
  const job = wf.jobs?.pruefen
  const fremd = [...fremdeSchluessel(wf, SCHLUESSEL.workflow), ...fremdeSchluessel(job, SCHLUESSEL.job)]
  if (fremd.length) return { fehler: `Schlüssel nicht nachgebildet: ${fremd.join(', ')}` }
  const ende = job.steps.findIndex((s) => s.id === 'eingang')
  if (ende < 0) return { fehler: 'Sperre-Schritt fehlt' }
  const schritte = job.steps.slice(0, ende + 1)
  const { bin, ws, temp } = bereite(ordner, prs)
  kopiereSkripte(path.join(ws, 'tools'))
  const kontext = { pr: '7', temp, ausgaben: {} }
  const basis = { ...umgebung(ordner, bin, temp), ...Object.fromEntries(Object.entries(job.env ?? {}).map(([s, w]) => [s, auswerten(w, kontext)])) }
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
  for (const [i, s] of schritte.entries()) {
    if (s.uses !== undefined) {
      if (s.uses !== CHECKOUT || fremdeSchluessel(s, ['uses', 'with']).length) {
        return { fehler: `Schritt ${i}: uses ist "${s.uses}", die Kulisse bildet nur "${CHECKOUT}" nach (const CHECKOUT in tools/pr-pruefer-kulisse.mjs anpassen, wenn die Änderung Absicht ist)` }
      }
      continue
    }
    if (fremdeSchluessel(s, ['name', 'id', 'env', 'run']).length) return { fehler: `${s.name}: Schlüssel nicht nachgebildet: ${fremdeSchluessel(s, ['name', 'id', 'env', 'run'])}` }
    const ausgabe = path.join(ordner, `ausgabe-${i}.txt`)
    const skript = path.join(ordner, `schritt-${i}.sh`)
    fs.writeFileSync(skript, auswerten(s.run, kontext))
    const env = { ...basis, GITHUB_OUTPUT: ausgabe, ...Object.fromEntries(Object.entries(s.env ?? {}).map(([n, w]) => [n, auswerten(w, kontext)])) }
    const r = spawnMitLimit(bash, ['-e', skript], { cwd: ws, env, encoding: 'utf8' })
    if (r.status !== 0) return { fehler: `${s.name}: Exit ${r.status} ${r.stderr}` }
    if (s.id) kontext.ausgaben[s.id] = leseAusgaben(ausgabe)
  }
  const datei = path.join(temp, 'pruefer', 'pr-beschreibung.txt')
  const auflagen = path.join(temp, 'pruefer', 'auflagen.md')
  const kettenlog = path.join(temp, 'pruefer', 'kettenlog.txt')
  return {
    kettenlog: fs.existsSync(kettenlog) ? fs.readFileSync(kettenlog, 'utf8') : null,
    ausgaben: kontext.ausgaben,
    beschreibung: fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : null,
    auflagen: fs.existsSync(auflagen) ? fs.readFileSync(auflagen, 'utf8') : null,
    aufrufe: leseAufrufe(path.join(ordner, 'aufrufe.log')),
  }
}

/** Alle gh-Aufrufe der Attrappe in Reihenfolge, je Aufruf ein Wortlaut `api …` bzw. `pr …`. */
function leseAufrufe(datei) {
  const zeilen = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8').split('\n').filter(Boolean) : []
  return zeilen.map((z) => JSON.parse(z).join(' '))
}

/** Führt den Job bis zur Sperre aus; liefert die Ausgaben je Schritt-id und die Beschreibung, oder `fehler`. */
export function laufeBisEingang(wf, prs) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-pruefer-ablauf-'))
  try {
    return laufeSchritte(wf, ordner, prs)
  } catch (e) {
    return { fehler: e.message }
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true })
  }
}
