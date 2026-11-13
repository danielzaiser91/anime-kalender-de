#!/usr/bin/env node
/**
 * Wächter gegen stumme Fehlerpfade (Projektziel 1, 13.11.2026); Ratsche wie tools/design-klassen.mjs:
 *  - Code: leerer catch / catch mit nur Leerwert-return (eslint.stumm.config.js) je Datei in pipeline, tools, worker, shared
 *  - Workflows und Composite-Actions (.github/workflows, .github/actions): `|| true` / `|| echo` / `|| :` / `|| exit 0` braucht
 *    `# stumm: <Grund>` in derselben oder der Vorzeile
 * Die Zahl je Datei darf nur sinken, eine Datei ohne Eintrag erlaubt 0 (Grenzen: tools/stumme-pfade-grenzen.json).
 * Die Grenzdatei selbst wird gegen ihren Stand auf origin/main (Merge-Basis) verglichen: ein höherer oder neuer Eintrag ist rot.
 *
 *   node tools/stumme-pfade.mjs                  prüfen (Exit 1 bei Überschreitung)
 *   node tools/stumme-pfade.mjs --liste          Fundstellen
 *   node tools/stumme-pfade.mjs --festschreiben  gesunkene Werte übernehmen (erhöht nie; nur der Bestandsbau)
 *   --wurzel <ordner> --grenzen <datei> --konfig <datei> --git <ordner>   andere Wurzel, Grenzen, ESLint-Konfig, Git-Repo (Test)
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = resolve(import.meta.dirname, '..')
const HINWEIS =
  'Wird nur von tools/stumme-pfade.mjs --festschreiben gesenkt (Bestandsbau, tools/commit-data.sh), nie von Hand erhöht. Ausgangswerte 13.11.2026.'
const STUMM = /\|\|\s*(true\b|echo\b|:(?=\s|$)|exit\s+0\b)/
const GRENZDATEI = 'tools/stumme-pfade-grenzen.json'
const BEGRUENDET = /#\s*stumm:\s*\S/

function existiert(wurzel, ordner) {
  try {
    return readdirSync(join(wurzel, ordner)).length > 0
  } catch {
    return false
  }
}

/** Fundstellen im Code je Datei: `{ 'pfad': ['zeile regel', …] }`. Ein Parsefehler bricht den Lauf ab, er zählt nicht als 0. */
export function codeFunde(wurzel, konfig = join(REPO, 'eslint.stumm.config.js')) {
  const eslint = join(REPO, 'node_modules/eslint/bin/eslint.js')
  const ordner = ['pipeline', 'tools', 'worker', 'shared'].filter((o) => existiert(wurzel, o))
  if (!ordner.length) return {}
  const lauf = spawnSync(process.execPath, [eslint, '-c', konfig, '-f', 'json', ...ordner], {
    cwd: wurzel,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
  if (lauf.status > 1 || !lauf.stdout) throw new Error(`eslint lief nicht durch: ${lauf.stderr || lauf.status}`)
  const funde = {}
  for (const datei of JSON.parse(lauf.stdout)) {
    const pfad = relative(wurzel, datei.filePath).replaceAll('\\', '/')
    for (const m of datei.messages) {
      if (m.fatal) throw new Error(`${pfad}:${m.line} nicht lesbar: ${m.message}`)
      if (m.ruleId) (funde[pfad] ??= []).push(`${m.line} ${m.ruleId}`)
    }
  }
  return funde
}

/** Zeilen mit `|| true`/`|| echo`/`|| :`/`|| exit 0` ohne `# stumm: Grund` in derselben oder der Vorzeile, je Workflow-Datei. */
export function workflowFunde(wurzel) {
  const funde = {}
  for (const pfad of workflowDateien(wurzel)) {
    const zeilen = readFileSync(join(wurzel, pfad), 'utf8').split('\n')
    zeilen.forEach((z, i) => {
      if (STUMM.test(z) && !BEGRUENDET.test(z) && !BEGRUENDET.test(zeilen[i - 1] ?? '')) funde[pfad] = [...(funde[pfad] ?? []), `${i + 1}`]
    })
  }
  return funde
}

/** Workflow-Dateien und Composite-Actions relativ zur Wurzel; fehlende Ordner (Test-Wurzeln) zählen nicht. */
function workflowDateien(wurzel) {
  const liste = (ordner) => {
    try {
      return readdirSync(join(wurzel, ordner)).map((n) => `${ordner}/${n}`)
    } catch {
      return []
    }
  }
  const aktionen = liste('.github/actions').flatMap((a) => liste(a))
  return [...liste('.github/workflows'), ...aktionen].filter((p) => /\.ya?ml$/.test(p))
}

const zahlen = (funde) => Object.fromEntries(Object.entries(funde).map(([p, l]) => [p, l.length]))
const summe = (z) => Object.values(z).reduce((a, b) => a + b, 0)

/** Dateien über ihrer Grenze (fehlender Eintrag erlaubt 0). */
export function zuViel(ist, erlaubt) {
  return Object.entries(ist)
    .filter(([pfad, n]) => n > (erlaubt[pfad] ?? 0))
    .map(([pfad, n]) => `${pfad}: ${n} statt höchstens ${erlaubt[pfad] ?? 0}`)
}

/** Neue Grenzen: nur gesunkene Werte, erledigte Dateien fallen heraus, nie ein höherer. */
export function gesenkt(ist, erlaubt) {
  const neu = {}
  for (const [pfad, grenze] of Object.entries(erlaubt)) {
    const n = ist[pfad] ?? 0
    if (n > 0) neu[pfad] = Math.min(n, grenze)
  }
  return neu
}

function git(ordner, ...args) {
  return spawnSync('git', ['-C', ordner, ...args], { encoding: 'utf8' })
}

/** Grenzdatei am Stand der Merge-Basis mit origin/main (sonst origin/main selbst); `entfaellt` nennt den Grund. */
export function basisGrenzen(gitOrdner) {
  if (git(gitOrdner, 'rev-parse', '--verify', '-q', 'origin/main').status !== 0) return { entfaellt: 'origin/main fehlt' }
  const basis = git(gitOrdner, 'merge-base', 'origin/main', 'HEAD')
  const ref = basis.status === 0 ? basis.stdout.trim() : 'origin/main'
  const datei = git(gitOrdner, 'show', `${ref}:${GRENZDATEI}`)
  if (datei.status !== 0) return { entfaellt: 'Grenzdatei steht noch nicht auf origin/main' }
  return { grenzen: JSON.parse(datei.stdout) }
}

/** Einträge der Grenzdatei, die höher sind als in der Basis (neue Einträge zählen gegen 0). */
export function angehoben(erlaubt, basis) {
  const ergebnis = []
  for (const art of ['code', 'workflows'])
    for (const [pfad, n] of Object.entries(erlaubt[art] ?? {})) {
      const alt = basis[art]?.[pfad] ?? 0
      if (n > alt) ergebnis.push(`${art} ${pfad}: Grenze ${n} statt höchstens ${alt} auf origin/main`)
    }
  return ergebnis
}

/** Ausgangswerte für die erste Grenzdatei. */
export function ausgangswerte(ist) {
  return { _hinweis: HINWEIS, code: ist.code, workflows: ist.workflows }
}

function argument(name, vorgabe) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? resolve(process.argv[i + 1]) : vorgabe
}

function melden(zuhoch, hoch) {
  if (hoch.length) console.error(`✖ Grenzdatei von Hand angehoben:\n  ${hoch.join('\n  ')}`)
  if (zuhoch.code.length)
    console.error(`✖ Neue stumme catch-Blöcke (leer oder nur Leerwert-return):\n  ${zuhoch.code.join('\n  ')}\n  Loggen, werfen oder das Warum als Kommentar in den Block schreiben.`)
  if (zuhoch.workflows.length)
    console.error(`✖ Neues „|| true“/„|| echo“ ohne Begründung:\n  ${zuhoch.workflows.join('\n  ')}\n  „# stumm: <Grund>“ in dieselbe oder die Vorzeile.`)
  console.error('Fundstellen: node tools/stumme-pfade.mjs --liste. Die Grenzen werden nicht angehoben.')
}

/** Basisvergleich (Prüflauf und Festschreiben); das Log nennt, ob er lief. */
function angehobeneGrenzen(erlaubt) {
  const basis = basisGrenzen(argument('--git', REPO))
  if (basis.entfaellt) {
    console.log(`Basisvergleich entfällt: ${basis.entfaellt}`)
    return []
  }
  console.log('Basisvergleich ja')
  return angehoben(erlaubt, basis.grenzen)
}

function main() {
  const wurzel = argument('--wurzel', REPO)
  const grenzDatei = argument('--grenzen', join(REPO, 'tools/stumme-pfade-grenzen.json'))
  const funde = { code: codeFunde(wurzel, argument('--konfig', undefined)), workflows: workflowFunde(wurzel) }
  const ist = { code: zahlen(funde.code), workflows: zahlen(funde.workflows) }

  if (process.argv.includes('--liste')) {
    for (const art of Object.keys(funde)) for (const [p, l] of Object.entries(funde[art])) console.log(`${p}: ${l.join(', ')}`)
    return 0
  }
  if (process.argv.includes('--ausgangswerte')) {
    writeFileSync(grenzDatei, JSON.stringify(ausgangswerte(ist), null, 2) + '\n')
    return 0
  }

  const erlaubt = JSON.parse(readFileSync(grenzDatei, 'utf8'))
  const zuhoch = { code: zuViel(ist.code, erlaubt.code ?? {}), workflows: zuViel(ist.workflows, erlaubt.workflows ?? {}) }
  const hoch = angehobeneGrenzen(erlaubt)
  const ueber = hoch.length || zuhoch.code.length || zuhoch.workflows.length

  if (process.argv.includes('--festschreiben')) {
    if (ueber) {
      melden(zuhoch, hoch)
      return 1
    }
    const neu = { _hinweis: HINWEIS, code: gesenkt(ist.code, erlaubt.code ?? {}), workflows: gesenkt(ist.workflows, erlaubt.workflows ?? {}) }
    writeFileSync(grenzDatei, JSON.stringify(neu, null, 2) + '\n')
    console.log('Gesunkene Werte übernommen.')
    return 0
  }
  if (ueber) {
    melden(zuhoch, hoch)
    return 1
  }
  console.log(`Stumme Fehlerpfade in Ordnung (Altfälle: Code ${summe(ist.code)}, Workflows ${summe(ist.workflows)}).`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
