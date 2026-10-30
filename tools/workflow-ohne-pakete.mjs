/**
 * Wächter (30.10.2026): Ein Workflow-Schritt ohne vorherige Paketinstallation darf nur Skripte starten, deren Importgraph
 * ohne Fremdpaket auskommt (nur `node:`-Module und relative Pfade).
 *
 * Anlass: `delta-wache.yml` lief ohne `npm ci`. PR 2288 (28.10.2026) ließ `belege-entfernt.ts` `js-yaml` importieren, über
 * `bestand-delta.ts` zog `delta-pruefen.mjs` es mit: ERR_MODULE_NOT_FOUND, die Wache war seit dem 29.10. blind (Lauf 41069357224).
 *
 * Gemessen wird der Syntaxbaum-Leser von TypeScript (`preProcessFile`, erkennt auch `require` und `import()` mit Literal),
 * nicht ein Regex auf Rohtext. Ab einem `npm ci`/`npm install` (im `run` ab dieser Stelle, davor im Job oder über eine
 * lokale Aktion) gilt der Job als versorgt; Aufrufe davor, auch im selben `run`, werden geprüft. Skripte werden aus
 * `node`/`tsx`/`npx tsx` und aus aufgerufenen `.sh`-Dateien gelesen.
 * Bekannte Grenzen: `npm run <skript>` und `node -e` werden nicht verfolgt, ebenso kein Skriptname aus einer Shell-Variable.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { parse } from 'yaml'

const SKRIPT = /\.(?:mjs|cjs|js|ts)$/
const QUELLE = /\.(?:mjs|cjs|js|ts|mts|cts)$/
const INSTALL = /\b(?:npm\s+(?:ci|install|i)|pnpm\s+(?:i|install)|yarn\s+install)\b/
const ENDE = new Set(['|', '||', '&&', ';', '&', '>', '>>', '2>&1'])

const EINGEBAUT = new Set(builtinModules)

export function istFremdpaket(spezifizierer) {
  if (spezifizierer.startsWith('.') || spezifizierer.startsWith('/')) return false
  if (spezifizierer.startsWith('node:')) return false
  return !EINGEBAUT.has(spezifizierer)
}

/** Skriptpfade (relativ zur Wurzel) und `.sh`-Aufrufe, die ein `run`-Text mit node/tsx/bash startet. */
export function aufrufeAusRun(run) {
  const skripte = []
  const shells = []
  for (const zeile of String(run).split('\n')) {
    const teile = zeile.trim().split(/\s+/)
    for (let i = 0; i < teile.length; i++) {
      const aufruf = ['node', 'tsx'].includes(teile[i])
      const shell = ['bash', 'sh'].includes(teile[i]) || /^\.\/\S+\.sh$/.test(teile[i])
      if (!aufruf && !shell) continue
      for (let j = shell && !teile[i].startsWith('./') ? i + 1 : i; j < teile.length; j++) {
        const t = teile[j].replace(/^["']|["']$/g, '')
        if (ENDE.has(t)) break
        if (t.startsWith('-') || t.includes('$') || j === i && !t.startsWith('./')) continue
        if (aufruf && SKRIPT.test(t)) skripte.push(t.replace(/^\.\//, ''))
        if (shell && t.endsWith('.sh')) shells.push(t.replace(/^\.\//, ''))
        if (aufruf || t.endsWith('.sh')) break
      }
    }
  }
  return { skripte, shells }
}

function loese(von, spezifizierer) {
  const basis = resolve(dirname(von), spezifizierer)
  for (const kandidat of [basis, `${basis}.ts`, `${basis}.mjs`, `${basis}.js`, join(basis, 'index.ts'), join(basis, 'index.js')]) {
    if (existsSync(kandidat) && QUELLE.test(kandidat)) return kandidat
  }
  return null
}

/** Alle Fremdpakete im Importgraph ab `datei`, je mit der Kette der Dateien dorthin. */
export function fremdImporte(wurzel, datei, besucht = new Set()) {
  const funde = []
  const stapel = [[resolve(wurzel, datei), [datei]]]
  while (stapel.length) {
    const [pfad, kette] = stapel.pop()
    if (besucht.has(pfad)) continue
    besucht.add(pfad)
    if (!existsSync(pfad)) {
      funde.push({ paket: '?', kette: [...kette, '(Datei fehlt)'] })
      continue
    }
    const info = ts.preProcessFile(readFileSync(pfad, 'utf8'), true, true)
    for (const { fileName } of info.importedFiles) {
      if (istFremdpaket(fileName)) {
        funde.push({ paket: fileName, kette })
        continue
      }
      const ziel = fileName.startsWith('node:') || EINGEBAUT.has(fileName) ? null : loese(pfad, fileName)
      if (ziel) stapel.push([ziel, [...kette, relative(wurzel, ziel).replaceAll('\\', '/')]])
      else if (!fileName.startsWith('node:') && !EINGEBAUT.has(fileName) && !/\.(?:json|css|svg)$/.test(fileName)) {
        funde.push({ paket: '?', kette: [...kette, `${fileName} (nicht aufgelöst)`] })
      }
    }
  }
  return funde
}

/** Eine lokale Composite-Action (`uses: ./…`) mit `npm ci` versorgt den Job. */
function installiertAktion(wurzel, uses) {
  if (typeof uses !== 'string' || !uses.startsWith('./')) return false
  const datei = ['action.yml', 'action.yaml'].map((n) => join(wurzel, uses, n)).find((p) => existsSync(p))
  const schritte = datei ? (parse(readFileSync(datei, 'utf8'))?.runs?.steps ?? []) : []
  return schritte.some((s) => INSTALL.test(String(s.run ?? '')))
}

/** Skripte, die ein Job vor seiner ersten Paketinstallation startet (Shell-Skripte eine Ebene tief mitgelesen). */
export function ungeschuetzteSkripte(wurzel, job) {
  const skripte = new Set()
  for (const schritt of job?.steps ?? []) {
    if (installiertAktion(wurzel, schritt.uses)) return [...skripte]
    const run = schritt.run
    if (!run) continue
    const install = INSTALL.exec(run)
    const { skripte: direkt, shells } = aufrufeAusRun(install ? run.slice(0, install.index) : run)
    direkt.forEach((s) => skripte.add(s))
    for (const sh of shells) {
      const pfad = resolve(wurzel, sh)
      if (existsSync(pfad)) aufrufeAusRun(readFileSync(pfad, 'utf8')).skripte.forEach((s) => skripte.add(s))
    }
    if (install) return [...skripte]
  }
  return [...skripte]
}

export function pruefeWorkflow(wurzel, name, doc) {
  const fehler = []
  for (const [jobName, job] of Object.entries(doc?.jobs ?? {})) {
    for (const skript of ungeschuetzteSkripte(wurzel, job)) {
      if (!existsSync(resolve(wurzel, skript))) continue
      const gemeldet = new Set()
      for (const f of fremdImporte(wurzel, skript)) {
        if (gemeldet.has(f.paket)) continue
        gemeldet.add(f.paket)
        fehler.push(`${name} (${jobName}): ${skript} braucht ${f.paket} ohne npm ci: ${f.kette.join(' -> ')}`)
      }
    }
  }
  return fehler
}

export function pruefeAlle(wurzel) {
  const ordner = join(wurzel, '.github/workflows')
  const dateien = readdirSync(ordner).filter((f) => /\.ya?ml$/.test(f))
  const fehler = dateien.flatMap((d) => pruefeWorkflow(wurzel, d, parse(readFileSync(join(ordner, d), 'utf8'))))
  return { fehler, anzahl: dateien.length }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const { fehler, anzahl } = pruefeAlle(process.argv[2] ?? process.cwd())
  for (const f of fehler) console.error(`FEHL ${f}`)
  if (fehler.length) process.exit(1)
  console.log(`workflow-ohne-pakete: ok (${anzahl} Workflows, kein Fremdpaket ohne Installation)`)
}
