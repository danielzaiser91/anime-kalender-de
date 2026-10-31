/**
 * Ratsche: Kindprozess-Aufrufe in Tests ohne Frist. Ein Aufruf hat eine Frist, wenn sein Optionenobjekt `timeout` oder
 * `limitMs` setzt; `spawnMitLimit`/`mitLimit` (tools/kind-mit-limit.mjs) tragen sie selbst und zählen nicht.
 * Der Stand je Datei steht in `tools/test-kind-frist-stand.json` und darf nur sinken; neue Dateien beginnen bei 0.
 * Erzeugen: `node tools/test-kind-frist.mjs --stand-schreiben`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const NAMEN = new Set(['spawnSync', 'execFileSync', 'execSync', 'spawn', 'execFile', 'exec', 'fork'])
const MODUL = /^(node:)?child_process$/

/** Lokale Namen, die an `child_process` gebunden sind: `einzel` (lokal → Originalname) und `sammel` (Namensraum/Default). */
function bindungen(sf) {
  const einzel = new Map()
  const sammel = new Set()
  const binde = (n) => {
    if (ts.isImportDeclaration(n) && MODUL.test(n.moduleSpecifier.text)) {
      const b = n.importClause?.namedBindings
      if (n.importClause?.name) sammel.add(n.importClause.name.text)
      if (b && ts.isNamespaceImport(b)) sammel.add(b.name.text)
      if (b && ts.isNamedImports(b)) for (const e of b.elements) einzel.set(e.name.text, (e.propertyName ?? e.name).text)
    }
    const init = ts.isVariableDeclaration(n) ? n.initializer : undefined
    const quelle = init && ts.isCallExpression(init) && init.expression.getText() === 'require' && MODUL.test(init.arguments[0]?.text ?? '')
    if (quelle && ts.isIdentifier(n.name)) sammel.add(n.name.text)
    if (quelle && ts.isObjectBindingPattern(n.name)) for (const e of n.name.elements) einzel.set(e.name.getText(), (e.propertyName ?? e.name).getText())
    ts.forEachChild(n, binde)
  }
  binde(sf)
  return { einzel, sammel }
}

const hatFrist = (a) => ts.isObjectLiteralExpression(a) && a.properties.some((p) => p.name && ['timeout', 'limitMs'].includes(p.name.getText()))

/** Zeilennummern der Kindprozess-Aufrufe ohne Frist. */
export function aufrufeOhneFrist(quelltext, dateiname = 'x.mjs') {
  const sf = ts.createSourceFile(dateiname, quelltext, ts.ScriptTarget.Latest, true)
  const { einzel, sammel } = bindungen(sf)
  const zeilen = []
  const geh = (n) => {
    if (ts.isCallExpression(n)) {
      const f = n.expression
      let name = ''
      if (ts.isIdentifier(f)) name = einzel.get(f.text) ?? ''
      else if (ts.isPropertyAccessExpression(f)) {
        const objekt = f.expression.getText()
        const modul = sammel.has(objekt) || /^require\(['"](node:)?child_process['"]\)$/.test(objekt)
        if (f.name.text !== 'exec' || modul) name = f.name.text
      }
      if (NAMEN.has(name) && !n.arguments.some(hatFrist)) zeilen.push(sf.getLineAndCharacterOfPosition(n.getStart()).line + 1)
    }
    ts.forEachChild(n, geh)
  }
  geh(sf)
  return zeilen
}

/** Geprüfte Dateien: alle Tests in `tools/` und ihre Kulissen. */
const geprueft = (f) => /\.test\.(mjs|ts|tsx)$/.test(f) || /-(kulisse|mock)\.mjs$/.test(f)

export function zaehle(wurzel) {
  const stand = {}
  for (const f of readdirSync(join(wurzel, 'tools')).filter(geprueft).sort()) {
    const n = aufrufeOhneFrist(readFileSync(join(wurzel, 'tools', f), 'utf8'), f).length
    if (n > 0) stand[`tools/${f}`] = n
  }
  return stand
}

/** Meldungen: mehr Aufrufe ohne Frist als im Stand (Fehler) oder weniger (Stand senken, sonst bleibt Platz für neue). */
export function vergleiche(ist, soll) {
  const probleme = []
  for (const datei of new Set([...Object.keys(ist), ...Object.keys(soll)])) {
    const a = ist[datei] ?? 0
    const s = soll[datei] ?? 0
    if (a > s) probleme.push(`${datei}: ${a} Kindprozess-Aufrufe ohne Frist, erlaubt ${s} (timeout setzen oder spawnMitLimit aus tools/kind-mit-limit.mjs nehmen)`)
    if (a < s) probleme.push(`${datei}: nur noch ${a} ohne Frist, Stand in tools/test-kind-frist-stand.json auf ${a} senken (node tools/test-kind-frist.mjs --stand-schreiben)`)
  }
  return probleme
}

export const STAND_DATEI = fileURLToPath(new URL('./test-kind-frist-stand.json', import.meta.url))
export const summe = (stand) => Object.values(stand).reduce((x, y) => x + y, 0)

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = fileURLToPath(new URL('..', import.meta.url))
  const ist = zaehle(wurzel)
  if (process.argv.includes('--stand-schreiben')) {
    writeFileSync(STAND_DATEI, `${JSON.stringify(ist, null, 2)}\n`)
    console.log(`test-kind-frist: Stand geschrieben, ${summe(ist)} Aufrufe ohne Frist in ${Object.keys(ist).length} Dateien.`)
  } else {
    const probleme = vergleiche(ist, JSON.parse(readFileSync(STAND_DATEI, 'utf8')))
    for (const p of probleme) console.error(`✖ ${p}`)
    console.log(`test-kind-frist: ${summe(ist)} Aufrufe ohne Frist in ${Object.keys(ist).length} Dateien, ${probleme.length} Verstöße.`)
    process.exit(probleme.length ? 1 : 0)
  }
}
