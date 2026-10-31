/**
 * Ratsche: Kindprozess-Aufrufe in Tests ohne Frist. Ein direkter Aufruf hat eine Frist, wenn sein Optionenobjekt `timeout`
 * oder `limitMs` mit einem Wert ≠ 0/undefined/null setzt; `spawnMitLimit`/`mitLimit` (tools/kind-mit-limit.mjs) tragen sie
 * selbst, außer mit `limitMs: 0`. Jeder andere Verweis auf einen Child-Process-Namen (Alias, `.call`, `cp['spawnSync']`,
 * Destrukturierung aus Default-Import, `await import`, `createRequire`) zählt als ohne Frist.
 * Geltungsbereich: `tools/*.test.(mjs|ts|tsx)` und `tools/*-kulisse.mjs`, `tools/*-mock.mjs`. NICHT erfasst: `tools/*-attrappe.mjs`,
 * `pipeline/check-*.ts` (dort laufen ebenfalls Kindprozesse) — die Zahl unten ist kein Gesamtstand des Repos.
 * Der Stand je Datei steht in `tools/test-kind-frist-stand.json` und darf nur sinken; neue Dateien beginnen bei 0.
 * Erzeugen: `node tools/test-kind-frist.mjs --stand-schreiben`; für Proben `--wurzel <ordner> --stand <datei>`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const NAMEN = new Set(['spawnSync', 'execFileSync', 'execSync', 'spawn', 'execFile', 'exec', 'fork'])
const HELFER = new Set(['spawnMitLimit', 'mitLimit'])
const MODUL = /^(node:)?child_process$/

const ohneAusdruck = (n) => (ts.isParenthesizedExpression(n) || ts.isAwaitExpression(n) || ts.isAsExpression(n) ? ohneAusdruck(n.expression) : n)

/** Ausdruck, der das Modul `child_process` liefert: require(..), import(..), createRequire(..)(..), auch mit await. */
function istModulQuelle(ausdruck) {
  const n = ohneAusdruck(ausdruck)
  if (!ts.isCallExpression(n)) return false
  const f = n.expression
  const textArg = n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]) ? n.arguments[0].text : ''
  return MODUL.test(textArg) && (f.kind === ts.SyntaxKind.ImportKeyword || ts.isCallExpression(f) || (ts.isIdentifier(f) && f.text === 'require'))
}

/** Lokale Namen: `einzel` (lokal → Originalname) und `sammel` (Namensraum, Default, Alias davon). */
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
    if (ts.isVariableDeclaration(n) && n.initializer) {
      const init = ohneAusdruck(n.initializer)
      const modul = istModulQuelle(init) || (ts.isIdentifier(init) && sammel.has(init.text))
      if (modul && ts.isIdentifier(n.name)) sammel.add(n.name.text)
      if (modul && ts.isObjectBindingPattern(n.name)) for (const e of n.name.elements) einzel.set(e.name.getText(), (e.propertyName ?? e.name).getText())
    }
    ts.forEachChild(n, binde)
  }
  binde(sf)
  return { einzel, sammel }
}

const wertLos = (w) => w.kind === ts.SyntaxKind.NullKeyword || (ts.isNumericLiteral(w) && Number(w.text) === 0) || (ts.isIdentifier(w) && w.text === 'undefined')

/** Optionenobjekt mit wirksamer Frist: `timeout`/`limitMs` gesetzt und nicht 0/undefined/null. */
const fristWirksam = (a) => ts.isObjectLiteralExpression(a) && a.properties.some((p) => p.name && ['timeout', 'limitMs'].includes(p.name.getText()) && !(ts.isPropertyAssignment(p) && wertLos(p.initializer)))
/** `limitMs: 0`/`undefined` bei den Helfern hebt deren Frist auf. */
const fristAufgehoben = (a) => ts.isObjectLiteralExpression(a) && a.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'limitMs' && wertLos(p.initializer))

const deklariert = (n) => {
  const p = n.parent
  return ts.isImportSpecifier(p) || ts.isBindingElement(p) || (ts.isVariableDeclaration(p) && p.name === n) || (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n)
}

/** Name, auf den ein Zugriff `x.name`/`x['name']` zeigt, wenn x ein Modul-Namensraum ist; sonst ''. */
function namensraumName(n, sammel) {
  const { expression } = n
  const modul = (ts.isIdentifier(expression) && sammel.has(expression.text)) || istModulQuelle(expression)
  if (!modul) return ''
  const name = ts.isPropertyAccessExpression(n) ? n.name.text : ts.isStringLiteralLike(n.argumentExpression) ? n.argumentExpression.text : ''
  return NAMEN.has(name) ? name : ''
}

/** Zeilennummern der Kindprozess-Aufrufe und -Verweise ohne wirksame Frist. */
export function aufrufeOhneFrist(quelltext, dateiname = 'x.mjs') {
  const sf = ts.createSourceFile(dateiname, quelltext, ts.ScriptTarget.Latest, true)
  const { einzel, sammel } = bindungen(sf)
  const zeilen = []
  const melde = (n) => zeilen.push(sf.getLineAndCharacterOfPosition(n.getStart()).line + 1)
  const pruefeZiel = (n) => {
    // `cp.execSync = ersatz` (Attrappe) ersetzt, ruft nichts auf.
    if (ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) return
    const aufruf = ts.isCallExpression(n.parent) && n.parent.expression === n
    if (!aufruf || !n.parent.arguments.some(fristWirksam)) melde(n)
  }
  const geh = (n) => {
    if (ts.isIdentifier(n) && !deklariert(n)) {
      if (einzel.has(n.text) && NAMEN.has(einzel.get(n.text))) pruefeZiel(n)
      const helfer = HELFER.has(n.text) && ts.isCallExpression(n.parent) && n.parent.expression === n
      if (helfer && n.parent.arguments.some(fristAufgehoben)) melde(n)
    }
    if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && namensraumName(n, sammel)) pruefeZiel(n)
    ts.forEachChild(n, geh)
  }
  geh(sf)
  return zeilen
}

/** Geprüfte Dateien: alle Tests in `tools/` und ihre Kulissen (Bereich siehe Dateikopf). */
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

const argWert = (name, vorgabe) => (process.argv.includes(name) ? resolve(process.argv[process.argv.indexOf(name) + 1]) : vorgabe)

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = argWert('--wurzel', fileURLToPath(new URL('..', import.meta.url)))
  const standDatei = argWert('--stand', STAND_DATEI)
  const ist = zaehle(wurzel)
  if (process.argv.includes('--stand-schreiben')) {
    writeFileSync(standDatei, `${JSON.stringify(ist, null, 2)}\n`)
    console.log(`test-kind-frist: Stand geschrieben, ${summe(ist)} Aufrufe ohne Frist in ${Object.keys(ist).length} Dateien.`)
  } else {
    const probleme = vergleiche(ist, JSON.parse(readFileSync(standDatei, 'utf8')))
    for (const p of probleme) console.error(`✖ ${p}`)
    console.log(`test-kind-frist: ${summe(ist)} Aufrufe ohne Frist in ${Object.keys(ist).length} Dateien, ${probleme.length} Verstöße.`)
    process.exit(probleme.length ? 1 : 0)
  }
}
