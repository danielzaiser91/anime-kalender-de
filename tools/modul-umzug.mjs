#!/usr/bin/env node
/**
 * Verschiebt Code wörtlich in ein anderes Modul und richtet die Importe beider Seiten ein — das
 * Handwerk hinter dem Skill `zerlegen`. Am Code selbst ändert es nichts außer `export` und der
 * Hülle um einen Abschnitt.
 *
 *   namen     <quelle> <ziel> a,b,c
 *     Die Deklarationen a, b, c (Funktionen, Konstanten, Typen der obersten Ebene) samt ihren
 *     Kommentaren nach <ziel>; <quelle> importiert sie von dort, soweit sie sie noch braucht.
 *
 *   abschnitt <quelle> <von> <bis> <ziel> <funktion>
 *     Die Zeilen <von>–<bis> einer Funktion werden Rumpf von `export function <funktion>` in
 *     <ziel>. Ein- und Ausgaben ermittelt der Typprüfer (wie `abschnitt-schnittstelle.mjs`); an
 *     der alten Stelle steht danach `const { aus… } = <funktion>({ ein… })`. Neu zugewiesene
 *     Eingaben (`ändert`) werden gemeldet und müssen von Hand zurückgegeben werden.
 *
 * Danach entfernt es unbenutzte Importe (TypeScript „Organize Imports", nur Entfernen) — der
 * Aufrufer prüft mit `npm run typecheck` und dem passenden Vergleich (Skill `zerlegen`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'

const [modus, ...args] = process.argv.slice(2)
const OPTIONEN = {
  allowImportingTsExtensions: true,
  noEmit: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  allowJs: true,
  skipLibCheck: true,
}

function programm(pfad) {
  const p = ts.createProgram([pfad], OPTIONEN)
  return { pruefer: p.getTypeChecker(), quelle: p.getSourceFile(pfad) }
}

/** Importe einer Datei: lokaler Name → { modul, text } (`text` ist der Bezeichner im Importsatz). */
function importe(quelle) {
  const karte = new Map()
  for (const s of quelle.statements) {
    if (!ts.isImportDeclaration(s) || !s.importClause) continue
    const modul = s.moduleSpecifier.text
    const nurTyp = s.importClause.isTypeOnly
    if (s.importClause.name) karte.set(s.importClause.name.text, { modul, standard: true })
    const b = s.importClause.namedBindings
    if (b && ts.isNamespaceImport(b)) karte.set(b.name.text, { modul, namensraum: true })
    if (b && ts.isNamedImports(b))
      for (const e of b.elements)
        karte.set(e.name.text, {
          modul,
          text: `${nurTyp || e.isTypeOnly ? 'type ' : ''}${e.propertyName ? `${e.propertyName.text} as ` : ''}${e.name.text}`,
        })
  }
  return karte
}

const relModul = (vonDatei, modul, zuDatei) => {
  if (!modul.startsWith('.')) return modul
  let r = relative(dirname(zuDatei), resolve(dirname(vonDatei), modul)).replaceAll('\\', '/')
  if (!r.startsWith('.')) r = `./${r}`
  return r
}

const spezifizierer = (vonDatei, zuDatei) => {
  const r = relative(dirname(vonDatei), zuDatei).replaceAll('\\', '/')
  return r.startsWith('.') ? r : `./${r}`
}

/** Importsätze für alle Bezeichner in `namen`, die `quelle` importiert — umgerechnet auf `ziel`. */
function importsaetze(quellPfad, karte, namen, zielPfad) {
  const jeModul = new Map()
  for (const n of namen) {
    const i = karte.get(n)
    if (!i) continue
    const modul = relModul(quellPfad, i.modul, zielPfad)
    if (i.standard) jeModul.set(`${modul}\0standard`, `import ${n} from '${modul}'`)
    else if (i.namensraum) jeModul.set(`${modul}\0ns`, `import * as ${n} from '${modul}'`)
    else (jeModul.get(modul) ?? jeModul.set(modul, []).get(modul)).push(i.text)
  }
  return [...jeModul].map(([modul, teil]) => {
    if (typeof teil === 'string') return teil
    const zeile = `import { ${teil.join(', ')} } from '${modul}'`
    return zeile.length <= 120 ? zeile : `import {\n${teil.map((t) => `  ${t},`).join('\n')}\n} from '${modul}'`
  })
}

function bezeichnerIn(knoten, menge = new Set()) {
  if (ts.isIdentifier(knoten)) menge.add(knoten.text)
  ts.forEachChild(knoten, (k) => {
    bezeichnerIn(k, menge) // kein Rückgabewert: ein wahrer beendet forEachChild
  })
  return menge
}

const deklName = (s) =>
  ts.isVariableStatement(s) ? s.declarationList.declarations.map((d) => d.name.getText()) : s.name ? [s.name.text] : []

/** Text der Deklaration samt Kommentar davor, mit `export` vor dem Schlüsselwort. */
function exportiert(text, s, gebraucht) {
  const vorspann = text.slice(s.getFullStart(), s.getStart()).replace(/^\n+/, '')
  const kern = text.slice(s.getStart(), s.end)
  const hatExport = s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  return vorspann + (hatExport || !gebraucht ? kern : `export ${kern}`)
}

/** Unbenutzte Importe entfernen, sonst nichts — über den Sprachdienst von TypeScript. */
function importeAufraeumen(pfad, alles = false) {
  const dateien = new Map([[pfad, readFileSync(pfad, 'utf8')]])
  const dienst = ts.createLanguageService({
    getCompilationSettings: () => OPTIONEN,
    getScriptFileNames: () => [pfad],
    getScriptVersion: () => '1',
    getScriptSnapshot: (f) => {
      const t = dateien.get(f) ?? (existsSync(f) ? readFileSync(f, 'utf8') : undefined)
      return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t)
    },
    getCurrentDirectory: () => process.cwd(),
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: existsSync,
    readFile: (f) => readFileSync(f, 'utf8'),
  })
  const aenderungen = dienst.organizeImports(
    { type: 'file', fileName: pfad, mode: alles ? ts.OrganizeImportsMode.All : ts.OrganizeImportsMode.RemoveUnused },
    { ...ts.getDefaultFormatCodeSettings('\n'), semicolons: ts.SemicolonPreference.Remove, indentSize: 2, insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true },
    { quotePreference: 'single' },
  )
  let text = dateien.get(pfad)
  for (const a of aenderungen)
    for (const t of [...a.textChanges].sort((x, y) => y.span.start - x.span.start))
      text = text.slice(0, t.span.start) + t.newText + text.slice(t.span.start + t.span.length)
  writeFileSync(pfad, text)
}

function anhaengen(zielPfad, kopf, rumpf) {
  const alt = existsSync(zielPfad) ? readFileSync(zielPfad, 'utf8') : ''
  // Neue Importe vor die bisherigen, Rumpf ans Ende; doppelte führt „Organize Imports" zusammen.
  const neu = alt ? `${kopf.join('\n')}\n${alt.trimEnd()}\n\n${rumpf.trim()}\n` : `${kopf.join('\n')}\n\n${rumpf.trim()}\n`
  writeFileSync(zielPfad, neu)
}

function verschiebeNamen(quellPfad, zielPfad, namen) {
  const { quelle } = programm(quellPfad)
  const text = quelle.getFullText()
  const karte = importe(quelle)
  const gesucht = new Set(namen)
  const wandern = quelle.statements.filter((s) => deklName(s).some((n) => gesucht.has(n)))
  const fehlt = namen.filter((n) => !wandern.some((s) => deklName(s).includes(n)))
  if (fehlt.length) throw new Error(`nicht gefunden: ${fehlt.join(', ')}`)
  const bleiben = quelle.statements.filter((s) => !wandern.includes(s) && !ts.isImportDeclaration(s))
  const bleibendeNamen = new Set(bleiben.flatMap(deklName))
  const benutzt = new Set()
  for (const s of wandern) bezeichnerIn(s, benutzt)
  const rueckbezug = [...benutzt].filter((n) => bleibendeNamen.has(n))
  if (rueckbezug.length) console.warn(`⚠ braucht noch Namen aus ${quellPfad}: ${rueckbezug.join(', ')} — mitverschieben`)
  const draussen = new Set()
  for (const s of bleiben) bezeichnerIn(s, draussen)
  const rumpf = wandern.map((s) => exportiert(text, s, deklName(s).some((n) => draussen.has(n)))).join('\n\n')
  anhaengen(zielPfad, importsaetze(quellPfad, karte, benutzt, zielPfad), rumpf)

  // Quelle: Deklarationen herausnehmen (von hinten), Import des Ziels ergänzen.
  let neu = text
  for (const s of [...wandern].reverse()) neu = neu.slice(0, s.getFullStart()) + neu.slice(s.end)
  const wanderNamen = wandern.flatMap(deklName).filter((n) => draussen.has(n))
  const zielModul = spezifizierer(quellPfad, zielPfad)
  const letzterImport = [...quelle.statements].reverse().find(ts.isImportDeclaration)
  const stelle = letzterImport ? letzterImport.end : 0
  const nurTyp = new Set(wandern.filter((s) => ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)).flatMap(deklName))
  const liste = wanderNamen.map((n) => (nurTyp.has(n) ? `type ${n}` : n)).join(', ')
  if (wanderNamen.length) neu = `${neu.slice(0, stelle)}\nimport { ${liste} } from '${zielModul}'${neu.slice(stelle)}`
  writeFileSync(quellPfad, neu)
  importeAufraeumen(quellPfad)
  importeAufraeumen(zielPfad)
  console.log(`${wanderNamen.length} Deklaration(en) nach ${zielPfad}: ${wanderNamen.join(', ')}`)
}

function verschiebeAbschnitt(quellPfad, von, bis, zielPfad, funktion) {
  const { pruefer, quelle } = programm(quellPfad)
  const zeile = (pos) => quelle.getLineAndCharacterOfPosition(pos).line + 1
  let huelle
  const suche = (k) => {
    if (ts.isFunctionLike(k) && k.body && zeile(k.getStart(quelle)) < von && zeile(k.end) > bis) huelle = k
    ts.forEachChild(k, suche)
  }
  suche(quelle)
  if (!huelle) throw new Error('Keine Funktion umschließt diesen Abschnitt.')
  const ein = new Map()
  const aendert = new Set()
  const aus = new Map()
  const schreibend = (b) => {
    const p = b.parent
    return (
      (ts.isBinaryExpression(p) && p.left === b && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && p.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
      ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(p.operator))
    )
  }
  const benutzt = new Set()
  const besuche = (k) => {
    if (ts.isIdentifier(k)) {
      const z = zeile(k.getStart(quelle))
      if (z >= von && z <= bis) benutzt.add(k.text)
      const sym = pruefer.getSymbolAtLocation(k)
      const d = sym?.declarations?.[0]
      const variabel = d && (ts.isVariableDeclaration(d) || ts.isParameter(d) || ts.isBindingElement(d) || ts.isFunctionDeclaration(d))
      if (variabel && d !== huelle && d.getSourceFile() === quelle && d.pos >= huelle.pos && d.end <= huelle.end) {
        const dz = zeile(d.getStart(quelle))
        if (z >= von && z <= bis && (dz < von || dz > bis)) {
          ein.set(sym.name, pruefer.typeToString(pruefer.getTypeAtLocation(d.name ?? d), huelle, ts.TypeFormatFlags.NoTruncation))
          if (schreibend(k)) aendert.add(sym.name)
        }
        if (z > bis && dz >= von && dz <= bis) aus.set(sym.name, true)
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(huelle.body)

  const zeilen = quelle.getFullText().split('\n')
  const koerper = zeilen.slice(von - 1, bis).join('\n')
  const namen = [...ein.keys()]
  const signatur = namen.length
    ? `{ ${namen.join(', ')} }: {\n${namen.map((n) => `  ${n}: ${ein.get(n)}`).join('\n')}\n}`
    : ''
  const rueckgabe = aus.size ? `\n  return { ${[...aus.keys()].join(', ')} }` : ''
  const rumpf = `export function ${funktion}(${signatur}) {\n${koerper}${rueckgabe}\n}`

  // Typnamen in der Signatur brauchen ihre Importe genauso wie der Rumpf.
  const typBezeichner = new Set([...ein.values()].flatMap((t) => t.match(/[A-Za-z_$][\w$]*/g) ?? []))
  const karte = importe(quelle)
  const topNamen = new Set(quelle.statements.flatMap(deklName))
  const rueck = [...new Set([...benutzt, ...typBezeichner])].filter((n) => topNamen.has(n))
  if (rueck.length) console.warn(`⚠ braucht Namen der obersten Ebene von ${quellPfad}: ${rueck.join(', ')} — erst auslagern`)
  anhaengen(zielPfad, importsaetze(quellPfad, karte, new Set([...benutzt, ...typBezeichner]), zielPfad), rumpf)

  const einrueck = zeilen[von - 1].match(/^\s*/)[0]
  const aufruf = `${einrueck}${aus.size ? `const { ${[...aus.keys()].join(', ')} } = ` : ''}${funktion}(${namen.length ? `{ ${namen.join(', ')} }` : ''})`
  const neu = [...zeilen.slice(0, von - 1), aufruf, ...zeilen.slice(bis)]
  const zielModul = spezifizierer(quellPfad, zielPfad)
  const letzterImport = [...quelle.statements].reverse().find(ts.isImportDeclaration)
  const importZeile = letzterImport ? zeile(letzterImport.end) : 0
  neu.splice(importZeile, 0, `import { ${funktion} } from '${zielModul}'`)
  writeFileSync(quellPfad, neu.join('\n'))
  importeAufraeumen(quellPfad)
  importeAufraeumen(zielPfad)
  console.log(`${funktion}: ${bis - von + 1} Zeilen nach ${zielPfad}`)
  console.log(`  ein: ${namen.join(', ') || '—'}`)
  console.log(`  aus: ${[...aus.keys()].join(', ') || '—'}`)
  if (aendert.size) console.warn(`⚠ weist neu zu: ${[...aendert].join(', ')} — Rückgabe von Hand ergänzen`)
}

if (modus === 'namen' && args.length === 3) verschiebeNamen(resolve(args[0]), resolve(args[1]), args[2].split(','))
else if (modus === 'abschnitt' && args.length === 5)
  verschiebeAbschnitt(resolve(args[0]), Number(args[1]), Number(args[2]), resolve(args[3]), args[4])
else {
  console.error('Aufruf: modul-umzug.mjs namen <quelle> <ziel> a,b,c | abschnitt <quelle> <von> <bis> <ziel> <funktion>')
  process.exit(2)
}
