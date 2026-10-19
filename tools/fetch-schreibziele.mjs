/**
 * Die Dateien, die `data:fetch` (`pipeline/fetch.ts`) schreibt, aus dem Syntaxbaum von `fetch.ts` und allen Modulen, die es
 * einbindet (`import`, `export … from`, `import('./…')`): jeder Schreibaufruf von `node:fs`/`fs`/`fs/promises` (alles außer einer Liste
 * lesender Funktionen) und der Helfer `writeJson`/`writeText`/`clearDir`, dessen Ziel ein fester Pfad ist (Text oder `const` derselben Datei).
 * Im Zweifel steht `?` mit Fundort in der Liste — die Vollständigkeitsprobe (`tools/commit-data-test-verworfen.sh`) scheitert dann,
 * statt es zu übersehen: jede Nutzung eines `fs`-Namens oder Helfers außer dem direkten Aufruf (Namensraum, Zuweisung, Argument, `fsx['…']`),
 * `require`, `child_process`, ein Import, der sich nicht auflösen lässt, und ein `data:fetch`, das nicht genau `tsx <start>` startet.
 *
 * Aufruf: node tools/fetch-schreibziele.mjs [start.ts [package.json]]   → je Ziel eine Zeile `pfad<TAB>datei:zeile`
 * (die `package.json` wird nur ohne Startdatei oder mit ihrer Angabe geprüft)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const WURZEL = resolve(import.meta.dirname, '..')
const HELFER = new Set(['writeJson', 'writeText', 'clearDir'])
const FS_MODULE = new Set(['node:fs', 'fs', 'node:fs/promises', 'fs/promises'])
const ANDERE_WEGE = new Set(['node:child_process', 'child_process', 'node:worker_threads', 'worker_threads', 'node:module', 'module'])
const UMGEHUNG = new Set(['require', 'createRequire', 'globalThis'])
const LESEN = new Set(['readFileSync', 'readFile', 'readdirSync', 'readdir', 'existsSync', 'statSync', 'stat', 'lstatSync', 'lstat', 'accessSync', 'access', 'readlinkSync', 'readlink', 'realpathSync', 'realpath', 'createReadStream', 'opendirSync', 'opendir'])
const ZWEI_PFADE = /^(rename|copy|cp|link|symlink)/

/** Wie oft ein Name in der Datei deklariert wird (Variable, Parameter, Funktion): eine zweite Deklaration kann die `const` verdecken. */
function deklarationen(quelle) {
  const zaehler = new Map()
  const besuche = (k) => {
    const deklariert = ts.isVariableDeclaration(k) || ts.isParameter(k) || ts.isBindingElement(k) || ts.isFunctionDeclaration(k)
    if (deklariert && k.name && ts.isIdentifier(k.name)) zaehler.set(k.name.text, (zaehler.get(k.name.text) ?? 0) + 1)
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
  return zaehler
}

/** Feste Texte der `const`-Bindungen auf oberster Ebene einer Datei, deren Name sonst nirgends deklariert wird. */
function konstanten(quelle) {
  const werte = new Map()
  const zaehler = deklarationen(quelle)
  for (const satz of quelle.statements) {
    if (!ts.isVariableStatement(satz) || !(satz.declarationList.flags & ts.NodeFlags.Const)) continue
    for (const d of satz.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && zaehler.get(d.name.text) === 1 && d.initializer && ts.isStringLiteralLike(d.initializer)) werte.set(d.name.text, d.initializer.text)
    }
  }
  return werte
}

/** Ein Import-Satz bindet Namen aus `node:fs` (art `fs`/`fsNs`) oder einem relativen Modul (`helfer`/`modNs`). */
function importBindungen(satz, bindungen) {
  const spec = satz.moduleSpecifier.text
  const fs = FS_MODULE.has(spec)
  const klausel = satz.importClause
  if (!klausel || klausel.isTypeOnly || !(fs || spec.startsWith('.'))) return
  const raum = { art: fs ? 'fsNs' : 'modNs' }
  if (klausel.name) bindungen.set(klausel.name.text, raum)
  const nb = klausel.namedBindings
  if (nb && ts.isNamespaceImport(nb)) bindungen.set(nb.name.text, raum)
  if (!nb || !ts.isNamedImports(nb)) return
  for (const el of nb.elements) {
    const orig = (el.propertyName ?? el.name).text
    if (fs && !el.isTypeOnly) bindungen.set(el.name.text, { art: 'fs', name: orig })
    else if (HELFER.has(orig)) bindungen.set(el.name.text, { art: 'helfer', name: orig })
  }
}

/** `export … from`: relative Module folgen; ein Namensraum- oder Alias-Export eines Helfers entzieht ihn der Namensverfolgung. */
function exportBindung(satz, fund) {
  const spec = satz.moduleSpecifier.text
  const klausel = satz.exportClause
  const alias = klausel && ts.isNamedExports(klausel) && klausel.elements.some((e) => e.propertyName && HELFER.has(e.propertyName.text) && e.name.text !== e.propertyName.text)
  if (!spec.startsWith('.') || (klausel && ts.isNamespaceExport(klausel)) || alias) fund.fremde.push(satz)
  if (spec.startsWith('.')) fund.module.push({ spec, knoten: satz })
}

/** `import('…')`: ein festes relatives Modul wird gefolgt; seine Helfer-Namen müssen als Destrukturierung oder Namensraum greifbar sein. */
function dynamischerImport(knoten, bindungen, fund) {
  const arg = knoten.arguments[0]
  if (!arg || !ts.isStringLiteralLike(arg)) return void fund.fremde.push(knoten)
  if (FS_MODULE.has(arg.text) || ANDERE_WEGE.has(arg.text)) return void fund.fremde.push(knoten)
  if (!arg.text.startsWith('.')) return
  fund.module.push({ spec: arg.text, knoten })
  let eltern = knoten.parent
  while (eltern && (ts.isAwaitExpression(eltern) || ts.isParenthesizedExpression(eltern))) eltern = eltern.parent
  if (!eltern || !ts.isVariableDeclaration(eltern)) return void fund.fremde.push(knoten)
  if (ts.isIdentifier(eltern.name)) return void bindungen.set(eltern.name.text, { art: 'modNs' })
  for (const el of eltern.name.elements) {
    if (el.dotDotDotToken || !ts.isIdentifier(el.name)) fund.fremde.push(knoten)
    else if (HELFER.has((el.propertyName ?? el.name).text)) bindungen.set(el.name.text, { art: 'helfer', name: (el.propertyName ?? el.name).text })
  }
}

/** Bindungen, relative Module und nicht verfolgbare Stellen einer Datei in einem Durchgang über alle Knoten. */
function sammle(quelle) {
  const bindungen = new Map()
  const fund = { module: [], fremde: [] }
  const besuche = (knoten) => {
    if (ts.isImportDeclaration(knoten) && ts.isStringLiteral(knoten.moduleSpecifier)) {
      const spec = knoten.moduleSpecifier.text
      if (ANDERE_WEGE.has(spec)) fund.fremde.push(knoten)
      if (spec.startsWith('.')) fund.module.push({ spec, knoten })
      importBindungen(knoten, bindungen)
    } else if (ts.isExportDeclaration(knoten) && knoten.moduleSpecifier && ts.isStringLiteral(knoten.moduleSpecifier)) {
      exportBindung(knoten, fund)
    } else if (ts.isImportEqualsDeclaration(knoten)) fund.fremde.push(knoten)
    else if (ts.isCallExpression(knoten) && knoten.expression.kind === ts.SyntaxKind.ImportKeyword) dynamischerImport(knoten, bindungen, fund)
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return { bindungen, ...fund }
}

/** Die Pfade, die ein Schreibaufruf nennt: das erste Argument, bei `rename`/`copy*`/`cp`/`link` auch das zweite. */
function aufrufZiele(name, aufruf, werte) {
  const anzahl = ZWEI_PFADE.test(name) ? 2 : 1
  const args = aufruf.arguments.slice(0, anzahl)
  if (!args.length) return ['?']
  return args.map((a) => (ts.isStringLiteralLike(a) ? a.text : ts.isIdentifier(a) ? (werte.get(a.text) ?? '?') : '?'))
}

/** Schreibaufruf mit gebundenem Namen: Pfade des Aufrufs, leer für Lesendes und Fremdes; `null`, wenn der Aufruf nichts davon ist. */
function gebundenerAufruf(aufruf, bindungen, werte) {
  const ruf = aufruf.expression
  if (ts.isIdentifier(ruf)) {
    const b = bindungen.get(ruf.text) ?? (HELFER.has(ruf.text) ? { art: 'helfer', name: ruf.text } : null)
    if (b?.art === 'helfer') return aufrufZiele(b.name, aufruf, werte)
    if (b?.art === 'fs') return LESEN.has(b.name) ? [] : aufrufZiele(b.name, aufruf, werte)
    return null
  }
  if (!ts.isPropertyAccessExpression(ruf) || !ts.isIdentifier(ruf.expression)) return null
  const b = bindungen.get(ruf.expression.text)
  const name = ruf.name.text
  if (b?.art === 'fsNs') return LESEN.has(name) ? [] : aufrufZiele(name, aufruf, werte)
  if (b?.art === 'modNs') return HELFER.has(name) ? aufrufZiele(name, aufruf, werte) : []
  return null
}

/** Ein Name aus `fs`/Helfern/`require`, der nicht als Callee eines Aufrufs oder als Eigenschaftsname vorkommt, ist nicht verfolgbar. */
function nichtVerfolgbar(knoten, bindungen) {
  if (ts.isIdentifier(knoten)) {
    if (!bindungen.has(knoten.text) && !UMGEHUNG.has(knoten.text)) return false
    return !istNamensstelle(knoten)
  }
  return false
}

/** Der Name steht als Eigenschaft (`a.name`, `{ name: 1 }`) oder als Deklaration da, nicht als Verweis auf die Bindung. */
function istNamensstelle(knoten) {
  const eltern = knoten.parent
  if (ts.isPropertyAccessExpression(eltern)) return eltern.name === knoten
  if (ts.isPropertyAssignment(eltern) || ts.isVariableDeclaration(eltern) || ts.isParameter(eltern)) return eltern.name === knoten
  return ts.isBindingElement(eltern) && (eltern.name === knoten || eltern.propertyName === knoten)
}

/** Ziel und Fundort jedes Schreibaufrufs einer Datei, dazu die nicht verfolgbaren Stellen als `?`. */
function untersuche(datei) {
  const quelle = ts.createSourceFile(datei, readFileSync(datei, 'utf8'), ts.ScriptTarget.Latest, true)
  const werte = konstanten(quelle)
  const { bindungen, module, fremde } = sammle(quelle)
  const rel = relative(WURZEL, datei).replace(/\\/g, '/')
  const ort = (k) => `${rel}:${quelle.getLineAndCharacterOfPosition(k.getStart()).line + 1}`
  const ziele = fremde.map((k) => ({ pfad: '?', ort: ort(k) }))
  const besuche = (knoten) => {
    // Die Helfer selbst (`writeJson`, `writeText`, `clearDir` in `util.ts`) schreiben nur, was ihr Aufrufer nennt; der steht in der Liste.
    if (ts.isFunctionDeclaration(knoten) && knoten.name && HELFER.has(knoten.name.text)) return
    if (ts.isImportDeclaration(knoten) || (ts.isExportDeclaration(knoten) && knoten.moduleSpecifier)) return
    const pfade = ts.isCallExpression(knoten) ? gebundenerAufruf(knoten, bindungen, werte) : null
    if (pfade) {
      for (const pfad of pfade) ziele.push({ pfad, ort: ort(knoten) })
      knoten.arguments.forEach(besuche)
      return
    }
    if (nichtVerfolgbar(knoten, bindungen)) ziele.push({ pfad: '?', ort: ort(knoten) })
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return { ziele, module: module.map((m) => ({ ...m, ort: ort(m.knoten) })) }
}

/** Datei eines relativen Moduls (mit oder ohne Endung), `undefined` wenn es sie nicht gibt. */
function modulDatei(von, spec) {
  const basis = resolve(dirname(von), spec)
  return [basis, `${basis}.ts`, resolve(basis, 'index.ts')].find((p) => /\.[cm]?[jt]s$/.test(p) && existsSync(p))
}

/** `data:fetch` muss genau die Startdatei starten; sonst gäbe es einen zweiten Einstieg, den der Scanner nie sieht. */
function startbefehlFehler(start, paket) {
  const erwartet = `tsx ${relative(dirname(paket), start).replace(/\\/g, '/')}`
  let ist
  try {
    ist = JSON.parse(readFileSync(paket, 'utf8')).scripts?.['data:fetch']
  } catch {
    ist = undefined
  }
  return ist === erwartet ? [] : [{ pfad: '?', ort: `${relative(WURZEL, paket).replace(/\\/g, '/')}:data:fetch` }]
}

/** Alle Schreibziele von `start` samt der Module, die es (auch mittelbar) einbindet; `paket`: `package.json` mit dem Skript `data:fetch`. */
export function fetchSchreibziele(start, paket) {
  const gesehen = new Set()
  const offen = [resolve(start)]
  const ziele = paket ? startbefehlFehler(resolve(start), resolve(paket)) : []
  while (offen.length) {
    const datei = offen.pop()
    if (gesehen.has(datei)) continue
    gesehen.add(datei)
    const ergebnis = untersuche(datei)
    ziele.push(...ergebnis.ziele)
    for (const m of ergebnis.module) {
      const ziel = modulDatei(datei, m.spec)
      if (ziel) offen.push(ziel)
      else ziele.push({ pfad: '?', ort: m.ort })
    }
  }
  return ziele
}

/** Die Ziele für die Argumente der Kommandozeile `[start [package.json]]`; ein anderer Start dient nur der Erkennungsprobe, die `package.json` wird dann nur auf Wunsch geprüft. */
export function zieleAusArgumenten(argumente, wurzel = WURZEL) {
  const [start, paket] = argumente
  return fetchSchreibziele(start ?? resolve(wurzel, 'pipeline/fetch.ts'), paket ?? (start ? undefined : resolve(wurzel, 'package.json')))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const z of zieleAusArgumenten(process.argv.slice(2))) console.log(`${z.pfad}\t${z.ort}`)
}
